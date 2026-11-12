// SPDX-License-Identifier: AGPL-3.0-or-later

package cmd

import (
	"testing"

	"github.com/spf13/cobra"

	"github.com/PJJunio/osaca/osaca_rexctl/internal/ui"
)

func findCommand(t *testing.T, path ...string) *cobra.Command {
	t.Helper()
	root := newRoot(&App{UI: ui.New(ui.Options{})})
	c, _, err := root.Find(path)
	if err != nil || c.Name() != path[len(path)-1] {
		return nil
	}
	return c
}

// ADR-0010: the Operator cannot recover a Member's Account. Only the local, Operator-only sign-in link stays.
func TestOperatorCannotCreateAResetLinkForAnAccount(t *testing.T) {
	if c := findCommand(t, "users", "reset-link"); c != nil {
		t.Fatalf("%s still exists", c.CommandPath())
	}
}

func TestOperatorKeepsTheLocalSignInLinkForAdminAccounts(t *testing.T) {
	if c := findCommand(t, "admins", "sign-in-link"); c == nil {
		t.Fatal("rexctl admins sign-in-link is missing")
	}
}

func TestOperatorCannotTurnOffAnAccountsTwoFactorAuthentication(t *testing.T) {
	if c := findCommand(t, "users", "disable-mfa"); c != nil {
		t.Fatalf("%s still exists", c.CommandPath())
	}
}
