// SPDX-License-Identifier: AGPL-3.0-or-later

package cmd

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/PJJunio/osaca/osaca_rexctl/internal/adminapi"
	"github.com/PJJunio/osaca/osaca_rexctl/internal/instance"
	"github.com/PJJunio/osaca/osaca_rexctl/internal/ui"
)

const reindexPoll = 2 * time.Second

func newSearchCmd(app *App) *cobra.Command {
	c := &cobra.Command{Use: "search", Short: "Manage search on your instance", Args: noArgs}
	var noWait bool
	reindex := &cobra.Command{
		Use:   "reindex",
		Short: "Rebuild search from your data",
		Long:  "Rebuild every search index from your data, with the messages in every channel and DM. Search shows partial results until it finishes. If a rebuild is already running, rexctl follows that one, and stopping rexctl doesn't stop the rebuild.",
		Args:  noArgs,
	}
	reindex.Flags().BoolVar(&noWait, "no-wait", false, "start the rebuild and return without waiting for it")
	reindex.RunE = func(c *cobra.Command, _ []string) error {
		var jobID string
		err := adminWrite(c, app, func(ctx context.Context, api *adminapi.Client, _ *instance.Instance) error {
			id, err := api.ReindexSearch(ctx)
			jobID = id
			return err
		})
		if err != nil {
			return err
		}
		if noWait {
			app.UI.OK("Started rebuilding search. Run rexctl search reindex to follow it.")
			return nil
		}
		return adminRead(c, app, func(ctx context.Context, api *adminapi.Client, _ *instance.Instance) error {
			return followReindex(ctx, app, api, jobID)
		})
	}
	c.AddCommand(reindex)
	return c
}

func followReindex(ctx context.Context, app *App, api *adminapi.Client, jobID string) error {
	return app.UI.Step(ctx, "Rebuilding search", func(ctx context.Context, s *ui.Step) error {
		for {
			st, err := api.SearchReindexStatus(ctx, jobID)
			if err != nil {
				return err
			}
			switch st.Status {
			case "completed":
				s.Done("Rebuilt search.")
				return nil
			case "failed":
				msg := "Rebuilding search failed."
				if st.Error != "" {
					msg = "Rebuilding search failed. " + sentenceOf(st.Error)
				}
				return ui.Failed(msg, "Run rexctl logs worker to see why, then run rexctl search reindex again.")
			case "not_found":
				return ui.Failed("rexctl lost track of the rebuild.", "Run rexctl search reindex again.")
			}
			s.Title(reindexTitle(st))
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(reindexPoll):
			}
		}
	})
}

func reindexTitle(st *adminapi.SearchReindexStatus) string {
	switch st.Phase {
	case "queued":
		return "Waiting for a worker to start rebuilding search"
	case "guild_members":
		return fmt.Sprintf("Rebuilding search for members, %s of %s communities", thousands(st.Indexed), thousands(st.Total))
	case "threads":
		return fmt.Sprintf("Rebuilding search for threads, %s of %s communities", thousands(st.Indexed), thousands(st.Total))
	case "messages":
		return fmt.Sprintf("Rebuilding search for messages, %s of %s channels", thousands(st.Indexed), thousands(st.Total))
	}
	what, ok := reindexPhases[st.Phase]
	if !ok {
		return "Rebuilding search"
	}
	return fmt.Sprintf("Rebuilding search for %s, %s done", what, thousands(st.Indexed))
}

var reindexPhases = map[string]string{
	"users":      "accounts",
	"guilds":     "communities",
	"discovery":  "Explore",
	"reports":    "reports",
	"audit_logs": "the admin audit log",
}

func thousands(n int64) string {
	s := fmt.Sprint(n)
	for i := len(s) - 3; i > 0; i -= 3 {
		s = s[:i] + "," + s[i:]
	}
	return s
}

func sentenceOf(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	s = strings.ToUpper(s[:1]) + s[1:]
	if !strings.HasSuffix(s, ".") {
		s += "."
	}
	return s
}
