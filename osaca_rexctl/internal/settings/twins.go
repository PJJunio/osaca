// SPDX-License-Identifier: AGPL-3.0-or-later

package settings

var Twins = map[string]string{
	"OSACA_APP_FAVICON_DARK_URL":                 "app_public.branding.favicon_dark_url",
	"OSACA_APP_FAVICON_URL":                      "app_public.branding.favicon_url",
	"OSACA_APP_ICON_URL":                         "app_public.branding.icon_url",
	"OSACA_APP_LOGO_URL":                         "app_public.branding.logo_url",
	"OSACA_APP_PRODUCT_NAME":                     "app_public.branding.product_name",
	"OSACA_APP_SIGN_IN_BACKDROP_URL":             "app_public.branding.sign_in_backdrop_url",
	"OSACA_APP_STATUS_PAGE_INCIDENT_HISTORY_URL": "app_public.branding.status_page_incident_history_url",
	"OSACA_APP_STATUS_PAGE_URL":                  "app_public.branding.status_page_url",
	"OSACA_APP_SYMBOL_URL":                       "app_public.branding.symbol_url",
	"OSACA_APP_THEME_COLOR":                      "app_public.branding.theme_color",
	"OSACA_APP_WORDMARK_URL":                     "app_public.branding.wordmark_url",
	"OSACA_AUTH_BLUESKY_CLIENT_NAME":             "integrations.bluesky.client_name",
	"OSACA_AUTH_BLUESKY_CLIENT_URI":              "integrations.bluesky.client_uri",
	"OSACA_AUTH_BLUESKY_ENABLED":                 "integrations.bluesky.enabled",
	"OSACA_AUTH_BLUESKY_KEYS":                    "integrations.bluesky.keys",
	"OSACA_AUTH_BLUESKY_LOGO_URI":                "integrations.bluesky.logo_uri",
	"OSACA_AUTH_BLUESKY_POLICY_URI":              "integrations.bluesky.policy_uri",
	"OSACA_AUTH_BLUESKY_TOS_URI":                 "integrations.bluesky.tos_uri",
	"OSACA_YOUTUBE_API_KEY":                      "integrations.youtube.api_key",
}

func TwinVar(adminKey string) (string, bool) {
	for v, k := range Twins {
		if k == adminKey {
			return v, true
		}
	}
	return "", false
}
