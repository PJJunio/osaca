// SPDX-License-Identifier: AGPL-3.0-or-later

package setup

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/PJJunio/osaca/osaca_rexctl/internal/adminapi"
	"github.com/PJJunio/osaca/osaca_rexctl/internal/envfile"
	"github.com/PJJunio/osaca/osaca_rexctl/internal/secrets"
)

const TokenKey = "OSACA_SETUP_TOKEN"

type Registration string

const (
	RegistrationOpen     Registration = "open"
	RegistrationApproval Registration = "approval"
	RegistrationInvite   Registration = "invite"
	RegistrationClosed   Registration = "closed"
)

type Answers struct {
	Username     string
	Password     string
	Name         string
	Registration Registration
}

type Result struct {
	UserID          string
	RecoveryKitPath string
}

var (
	ErrNoToken       = errors.New("setup: no setup token")
	ErrAlreadyDone   = errors.New("setup: already finished")
	ErrPendingSignup = errors.New("setup: the account is waiting for approval")
	ErrRecoveryKit   = errors.New("setup: couldn't save the recovery kit")
)

func Token(values map[string]string) string {
	if t := strings.TrimSpace(values[TokenKey]); t != "CHANGE_ME" {
		return t
	}
	return ""
}

func EnsureToken(values map[string]string) (string, error) {
	if t := Token(values); t != "" {
		return t, nil
	}
	t, err := secrets.Hex(16)
	if err != nil {
		return "", err
	}
	values[TokenKey] = t
	return t, nil
}

type discovery struct {
	AppPublic struct {
		Setup struct {
			Configured  bool `json:"configured"`
			AdminExists bool `json:"admin_exists"`
		} `json:"setup"`
	} `json:"app_public"`
}

func Done(ctx context.Context, c *adminapi.Client) (bool, error) {
	var d discovery
	if err := c.Loopback(ctx, http.MethodGet, "/.well-known/osaca", nil, nil, &d); err != nil {
		return false, err
	}
	return d.AppPublic.Setup.Configured, nil
}

func AdminExists(ctx context.Context, c *adminapi.Client) (bool, error) {
	var d discovery
	if err := c.Loopback(ctx, http.MethodGet, "/.well-known/osaca", nil, nil, &d); err != nil {
		return false, err
	}
	return d.AppPublic.Setup.AdminExists, nil
}

type registerResponse struct {
	Token  string `json:"token"`
	UserID string `json:"user_id"`
}

type recoveryKitResponse struct {
	RecoveryKey string `json:"recovery_key"`
	CreatedAt   string `json:"created_at"`
}

func Run(ctx context.Context, c *adminapi.Client, token, origin, dir string, a Answers) (*Result, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, ErrNoToken
	}
	patch := map[string]any{
		"app_public":   map[string]any{"branding": map[string]any{"product_name": a.Name}},
		"registration": registrationPatch(a.Registration),
	}
	done, err := Done(ctx, c)
	if err != nil {
		return nil, err
	}
	if done {
		return nil, ErrAlreadyDone
	}
	if err := c.Loopback(ctx, http.MethodPost, "/instance/setup/token-checks", nil, map[string]any{"setup_token": token}, nil); err != nil {
		return nil, err
	}
	account := map[string]any{"username": a.Username, "password": a.Password, "setup_token": token}
	var reg registerResponse
	if err := register(ctx, c, account, &reg); err != nil {
		return nil, err
	}
	if reg.Token == "" {
		return nil, ErrPendingSignup
	}
	auth := map[string]string{"Authorization": reg.Token}
	res := &Result{UserID: reg.UserID}

	if err := c.Call(ctx, http.MethodPatch, "/admin/instance/config", nil, patch, nil); err != nil {
		return res, err
	}

	var kitErr error
	res.RecoveryKitPath, kitErr = saveRecoveryKit(ctx, c, auth, origin, dir, a)

	finish := map[string]any{"app_public": map[string]any{"setup": map[string]any{"configured": true}}}
	if err := c.Call(ctx, http.MethodPatch, "/admin/instance/config", nil, finish, nil); err != nil {
		return res, err
	}
	if kitErr != nil {
		return res, fmt.Errorf("%w: %w", ErrRecoveryKit, kitErr)
	}
	return res, nil
}

func registrationPatch(r Registration) map[string]any {
	switch r {
	case RegistrationOpen:
		return map[string]any{"mode": "open", "admin_registration_urls_enabled": true}
	case RegistrationApproval:
		return map[string]any{"mode": "approval", "admin_registration_urls_enabled": true}
	case RegistrationClosed:
		return map[string]any{"mode": "closed", "admin_registration_urls_enabled": false}
	default:
		return map[string]any{"mode": "closed", "admin_registration_urls_enabled": true}
	}
}

func saveRecoveryKit(ctx context.Context, c *adminapi.Client, auth map[string]string, origin, dir string, a Answers) (string, error) {
	var kit recoveryKitResponse
	if err := c.Loopback(ctx, http.MethodPost, "/users/@me/recovery-kit", auth, map[string]any{"password": a.Password}, &kit); err != nil {
		return "", err
	}
	path := filepath.Join(dir, "recovery-kit-"+slug(a.Username)+".txt")
	data := recoveryKitText(strings.TrimRight(origin, "/"), a.Name, a.Username, kit)
	if err := envfile.WriteFileAtomic(path, []byte(data), true); err != nil {
		return "", err
	}
	return path, nil
}

func recoveryKitText(origin, name, username string, kit recoveryKitResponse) string {
	created := kit.CreatedAt
	if t, err := time.Parse(time.RFC3339Nano, kit.CreatedAt); err == nil {
		created = t.UTC().Format("2 January 2006 15:04 UTC")
	}
	title := "OSACA recovery kit"
	if name != "" {
		title = name + " recovery kit"
	}
	var b strings.Builder
	b.WriteString(title + "\n\n")
	b.WriteString("Keep this file somewhere safe. If you forget your password, you can use it to get back into your account. Anyone with this recovery key can reset your password. Never share it.\n\n")
	fmt.Fprintf(&b, "Instance       %s\n", origin)
	fmt.Fprintf(&b, "Username       %s\n", username)
	fmt.Fprintf(&b, "Recovery key   %s\n", kit.RecoveryKey)
	fmt.Fprintf(&b, "Created        %s\n\n", created)
	b.WriteString("How to recover your account\n\n")
	fmt.Fprintf(&b, "1. Go to %s/recover.\n", origin)
	b.WriteString("2. Enter your username and this recovery key.\n")
	b.WriteString("3. Choose a new password. You get a new recovery kit and this one stops working.\n")
	return b.String()
}

var slugPattern = regexp.MustCompile(`[^a-z0-9]+`)

func slug(s string) string {
	out := strings.Trim(slugPattern.ReplaceAllString(strings.ToLower(s), "-"), "-")
	if out == "" {
		return "admin"
	}
	return out
}
