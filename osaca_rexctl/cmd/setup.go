// SPDX-License-Identifier: AGPL-3.0-or-later

package cmd

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/spf13/cobra"

	"github.com/PJJunio/osaca/osaca_rexctl/internal/adminapi"
	"github.com/PJJunio/osaca/osaca_rexctl/internal/deploy"
	"github.com/PJJunio/osaca/osaca_rexctl/internal/engine"
	"github.com/PJJunio/osaca/osaca_rexctl/internal/instance"
	"github.com/PJJunio/osaca/osaca_rexctl/internal/setup"
	"github.com/PJJunio/osaca/osaca_rexctl/internal/ui"
)

type setupFlags struct {
	Username     string
	PasswordFile string
	Name         string
	Registration string
}

var setupFlagNames = []string{"admin-username", "admin-password-file", "name", "registration"}

func (f *setupFlags) bind(c *cobra.Command) {
	fl := c.Flags()
	fl.StringVar(&f.Username, "admin-username", "", "username for your admin account")
	fl.StringVar(&f.PasswordFile, "admin-password-file", "", "file with your admin password, or - for stdin")
	fl.StringVar(&f.Name, "name", "", "your instance's name")
	fl.StringVar(&f.Registration, "registration", "", "who can create an account (invite, approval, open or closed)")
}

func (f *setupFlags) passed(c *cobra.Command) bool {
	return len(f.passedNames(c)) > 0
}

func (f *setupFlags) passedNames(c *cobra.Command) []string {
	var names []string
	for _, name := range setupFlagNames {
		if fl := c.Flags().Lookup(name); fl != nil && fl.Changed {
			names = append(names, "--"+name)
		}
	}
	return names
}

func newSetupCmd(app *App) *cobra.Command {
	var f setupFlags
	c := &cobra.Command{
		Use:   "setup",
		Short: "Create the admin account and finish setup in the terminal",
		Args:  noArgs,
		RunE: func(c *cobra.Command, _ []string) error {
			if err := oneStdinFlag(c); err != nil {
				return err
			}
			ctx := c.Context()
			inst, err := app.Instance()
			if err != nil {
				return err
			}
			return app.Locked(ctx, inst, func() error {
				p, err := app.Named(ctx, inst)
				if err != nil {
					return err
				}
				adminID, err := runSetup(ctx, app, c, inst, p, &f, nil)
				if err != nil {
					return err
				}
				if !signInAfterSetup(ctx, app, inst, p, adminID) {
					app.UI.Info("Sign in at %s.", inst.Origin())
				}
				return nil
			})
		},
	}
	f.bind(c)
	c.AddCommand(&cobra.Command{
		Use:   "token",
		Short: "Show the setup token for the browser",
		Args:  noArgs,
		RunE: func(c *cobra.Command, _ []string) error {
			return runSetupToken(c.Context(), app)
		},
	})
	return c
}

func runSetupToken(ctx context.Context, app *App) error {
	inst, err := app.Instance()
	if err != nil {
		return err
	}
	p, err := app.Named(ctx, inst)
	if err != nil {
		return err
	}
	client := app.adminClient(inst, p)
	if done, err := setup.Done(ctx, client); err == nil && done {
		return ui.Refused("Setup is already finished.", fmt.Sprintf("Sign in at %s.", inst.Origin()))
	}
	if admin, err := setup.AdminExists(ctx, client); err == nil && admin {
		return ui.Refused("Your admin account already exists, but setup isn't finished.", browserSetupFix(inst.Origin(), true))
	}
	token := setup.Token(inst.State.Secrets)
	if token == "" {
		err := app.Change(ctx, inst, func(e *engine.Engine) error {
			t, err := setup.EnsureToken(inst.State.Secrets)
			if err != nil {
				return err
			}
			if err := inst.Save(); err != nil {
				return err
			}
			return app.UI.Step(ctx, "Restarting OSACA with a new setup token", func(ctx context.Context, s *ui.Step) error {
				if _, err := deploy.Apply(ctx, inst, e, deploy.ApplyOptions{Pull: true, OnEvent: app.progress(s, "Restarting")}); err != nil {
					return ui.Wrap(readyFailure(ctx, inst, p, err), "Couldn't restart OSACA with a new setup token.", "Run rexctl logs api to see why.")
				}
				if err := waitForOsaca(ctx, inst, p, s, "Restarting"); err != nil {
					return err
				}
				token = t
				s.Done("Restarted OSACA with a new setup token.")
				return nil
			})
		})
		if err != nil {
			return err
		}
	}
	app.UI.Info("Open %s and enter this setup token to create your admin account.", inst.Origin())
	app.UI.Highlight(token)
	return nil
}

func runSetup(ctx context.Context, app *App, c *cobra.Command, inst *instance.Instance, p *engine.Project, f *setupFlags, pre *setup.Answers) (string, error) {
	client := app.adminClient(inst, p)
	done, err := setup.Done(ctx, client)
	if err != nil {
		return "", ui.Wrap(err, "Couldn't connect to your instance.", "Run rexctl status to see whether it's running.")
	}
	if done {
		return "", ui.Refused("Setup is already finished.", fmt.Sprintf("Sign in at %s.", inst.Origin()))
	}
	if admin, err := setup.AdminExists(ctx, client); err == nil && admin {
		return "", ui.Refused("Your admin account already exists, but setup isn't finished.", browserSetupFix(inst.Origin(), true))
	}
	var answers setup.Answers
	if pre != nil {
		answers = *pre
	} else if answers, err = askSetup(app, c, f); err != nil {
		return "", err
	}

	var res *setup.Result
	err = app.UI.Step(ctx, "Creating your admin account", func(ctx context.Context, s *ui.Step) error {
		var err error
		res, err = setup.Run(ctx, client, setup.Token(inst.State.Secrets), inst.Origin(), inst.Dir, answers)
		if err == nil || errors.Is(err, setup.ErrRecoveryKit) {
			s.Done("Created your admin account.")
		}
		return err
	})
	switch {
	case err == nil:
	case errors.Is(err, setup.ErrRecoveryKit):
		app.UI.Warn("Couldn't save your recovery kit.", "Create one in your account settings.")
	case errors.Is(err, setup.ErrAlreadyDone):
		return "", ui.Refused("Setup is already finished.", fmt.Sprintf("Sign in at %s.", inst.Origin()))
	case res != nil:
		return "", ui.Wrap(err, "Couldn't finish setup.", fmt.Sprintf("Open %s and sign in to finish setup in your browser.", inst.Origin()))
	default:
		return "", setupError(err)
	}
	if res != nil && res.RecoveryKitPath != "" {
		app.UI.OK("Saved your recovery kit to %s.", res.RecoveryKitPath)
		app.UI.Info("  Keep a copy somewhere safe. You'll need it if you lose your password.")
	}
	inst.State.SetupDone = true
	if err := inst.Save(); err != nil {
		return "", err
	}
	if res == nil {
		return "", nil
	}
	return res.UserID, nil
}

func signInAfterSetup(ctx context.Context, app *App, inst *instance.Instance, p *engine.Project, adminID string) bool {
	if adminID == "" {
		return false
	}
	if err := printSignInLink(ctx, app, app.adminClient(inst, p), adminID, "you"); err != nil {
		app.UI.Detail("%v", err)
		return false
	}
	return true
}

func setupError(err error) error {
	var apiErr *adminapi.APIError
	if errors.As(err, &apiErr) && (apiErr.Message != "" || len(apiErr.Fields) > 0) {
		msg := strings.TrimSpace(apiErr.Error())
		if !strings.HasSuffix(msg, ".") {
			msg += "."
		}
		return ui.Wrap(err, msg, "Run rexctl setup to try again.")
	}
	return ui.Wrap(err, "Couldn't create your admin account.", "Run rexctl setup to try again.")
}

func askSetup(app *App, c *cobra.Command, f *setupFlags) (setup.Answers, error) {
	var a setup.Answers
	u := app.UI
	if err := u.Ask(c, ui.Field{Flag: "admin-username", Title: "Your admin username", Value: &f.Username, Validate: validateSetupUsername}); err != nil {
		return a, err
	}
	password, err := askSecret(app, c, "admin-password-file", "Your admin password", f.PasswordFile, validateSetupPassword)
	if err != nil {
		return a, err
	}
	if err := u.Ask(c, ui.Field{Flag: "name", Title: "What's your instance called?", Value: &f.Name, Validate: validateSetupName}); err != nil {
		return a, err
	}
	if err := u.Ask(c, ui.Field{
		Flag:    "registration",
		Title:   "Who can create an account?",
		Value:   &f.Registration,
		Default: string(setup.RegistrationInvite),
		Options: registrationOptions(f.Registration),
	}); err != nil {
		return a, err
	}
	a.Username = strings.TrimSpace(f.Username)
	a.Password = password
	a.Name = strings.TrimSpace(f.Name)
	a.Registration = setup.Registration(f.Registration)
	return a, nil
}

func registrationOptions(current string) []ui.Option {
	opts := []ui.Option{
		{Label: "People with an invite link", Value: string(setup.RegistrationInvite)},
		{Label: "Anyone, after you approve them", Value: string(setup.RegistrationApproval)},
		{Label: "Anyone", Value: string(setup.RegistrationOpen)},
	}
	if current == string(setup.RegistrationClosed) {
		opts = append(opts, ui.Option{Label: "Nobody", Value: string(setup.RegistrationClosed)})
	}
	return opts
}

func askSecret(app *App, c *cobra.Command, flag, title, file string, validate func(string) error) (string, error) {
	if file != "" {
		v, err := readSetupSecret(app, file)
		if err != nil {
			return "", ui.Wrap(err, fmt.Sprintf("Couldn't read %s.", file), fmt.Sprintf("Check the path you passed to --%s.", flag))
		}
		if validate != nil {
			if err := validate(v); err != nil {
				return "", ui.Usage(err.Error())
			}
		}
		return v, nil
	}
	if !app.UI.Interactive() {
		return "", ui.MissingFlag(flag)
	}
	var v string
	if err := app.UI.Ask(nil, ui.Field{Title: title, Value: &v, Secret: true, Validate: validate}); err != nil {
		return "", err
	}
	return v, nil
}

func oneStdinFlag(c *cobra.Command) error {
	var names []string
	stdin := 0
	for _, name := range []string{"storage-secret-key-file", "admin-password-file"} {
		fl := c.Flags().Lookup(name)
		if fl == nil {
			continue
		}
		names = append(names, "--"+name)
		if fl.Value.String() == "-" {
			stdin++
		}
	}
	if stdin > 1 {
		return ui.Usage(fmt.Sprintf("Only one of %s can read from stdin.", ui.JoinAnd(names)))
	}
	return nil
}

func readSetupSecret(app *App, file string) (string, error) {
	var data []byte
	var err error
	if file == "-" {
		data, err = io.ReadAll(io.LimitReader(app.UI.Stdin(), 64*1024))
	} else {
		data, err = os.ReadFile(file)
	}
	if err != nil {
		return "", err
	}
	return strings.TrimRight(string(data), "\r\n"), nil
}

var setupUsernamePattern = regexp.MustCompile(`^[A-Za-z0-9_.]{1,32}$`)

type setupInputError string

func (e setupInputError) Error() string { return string(e) }

func validateSetupUsername(v string) error {
	if !setupUsernamePattern.MatchString(strings.TrimSpace(v)) {
		return setupInputError("Use up to 32 letters, numbers, dots or underscores.")
	}
	return nil
}

func validateSetupPassword(v string) error {
	n := utf8.RuneCountInString(v)
	if n < 8 || n > 256 {
		return setupInputError("Use at least 8 characters.")
	}
	return nil
}

func validateSetupName(v string) error {
	n := utf8.RuneCountInString(strings.TrimSpace(v))
	if n < 1 || n > 100 {
		return setupInputError("Use between 1 and 100 characters.")
	}
	return nil
}

func browserSetupFix(origin string, admin bool) string {
	if admin {
		return fmt.Sprintf("Open %s and sign in as your admin to finish setup in your browser.", origin)
	}
	return fmt.Sprintf("Run rexctl setup token and enter the token at %s to finish setup in your browser.", origin)
}
