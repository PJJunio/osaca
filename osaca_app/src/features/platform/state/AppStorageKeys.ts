// SPDX-License-Identifier: AGPL-3.0-or-later

import {AuthSessionStorageKey} from '@app/features/platform/state/auth_session/AuthSessionStorage';

export const AppStorageKey = Object.freeze({
	ACCESSIBILITY_LEGACY_STORE: 'Accessibility',
	ACCOUNT_KEYBINDS: 'AccountKeybinds',
	ACCOUNT_RESET_KEPT_KEYS: 'osaca:internal:account-reset-kept-keys',
	ACCOUNT_THEME: 'AccountTheme',
	ACCOUNT_THEME_MODE: 'AccountThemeMode',
	AUTH_ACCOUNT_KEY: AuthSessionStorageKey.ActiveAccountKey,
	AUTH_DESKTOP_CLIENT_INTRO_COMPLETED: 'osaca:auth:desktop-client-intro:completed',
	AUTH_DESKTOP_CLIENT_PERMISSIONS_SKIPPED: 'osaca:auth:desktop-client-intro:permissions-skipped',
	AUTH_DESKTOP_CLIENT_PREFERENCES_SEEN: 'osaca:auth:desktop-client-intro:preferences-seen',
	AUTH_DESKTOP_CLIENT_WELCOME_SEEN: 'osaca:auth:desktop-client-intro:welcome-seen',
	AUTH_SESSION_TOKEN: AuthSessionStorageKey.Token,
	AUTH_SESSION_USER_ID: AuthSessionStorageKey.UserId,
	DELETED_KEYS: 'osaca:internal:deleted-keys',
	I18N_CHOSEN_LOCALE: 'osaca:i18n:chosen-locale',
	INSTALLATION_THEME: 'InstallationTheme',
	MESSAGING_DRAFTS: 'Drafts',
	MESSAGING_MESSAGE_EDIT: 'MessageEdit',
	MLS_DEVICE_ID: 'osaca:mls:device-id',
	MLS_IDENTITY_SEED: 'osaca:mls:identity-seed',
	NOTIFICATION: 'Notification',
	QUICK_CSS_EDITOR_HISTORY: 'QuickCssEditor:history:v1',
	QUICK_CSS_EDITOR_PANEL_LAYOUT: 'QuickCssEditor:panelLayout',
	QUICK_CSS_EDITOR_PLACEMENT: 'QuickCssEditor:placement',
	QUICK_CSS_EDITOR_PREFERENCES: 'QuickCssEditor:preferences',
	SAVED_MESSAGES: 'osaca:messaging:saved-messages',
	THEME: 'Theme',
	THEME_LIBRARY_ACCOUNT_ENABLED_IDS: 'osaca:theme-library:account-enabled-ids',
	THEME_LIBRARY_ENABLED_IDS: 'osaca:theme-library:enabled-ids',
	THEME_LIBRARY_FOLDERS: 'osaca:theme-library:folders',
	THEME_LIBRARY_LOCAL_FILES: 'osaca:theme-library:local-files',
	THEME_LIBRARY_MIGRATED: 'osaca:theme-library:migrated-to-app-storage',
	THEME_LIBRARY_THEMES: 'osaca:theme-library:themes',
	THEME_PREBOOT_MIRROR: 'theme',
	THEME_PROFILES_MIGRATED: 'ThemeProfiles:migrated:v1',
	UI_CHANNEL_PINS_POPOUT_SIZE: 'osaca:ui:channel-pins-popout-size',
	UI_EXPRESSION_PICKER_SIZE: 'osaca:ui:expression-picker-size',
	UI_INBOX_OTHER_ACCOUNTS_COLLAPSED: 'osaca:ui:inbox-other-accounts-collapsed',
	UI_INBOX_POPOUT_SIZE: 'osaca:ui:inbox-popout-size',
	UI_SIDEBAR_WIDTH: 'osaca:ui:sidebar-width',
	VOICE_SETTINGS: 'VoiceSettings',
	WINDOWS_FONT: 'WindowsFont',
} as const);

export type AppStorageKey = (typeof AppStorageKey)[keyof typeof AppStorageKey];

export const LEGACY_APP_STORAGE_MIGRATION_MARKER_KEY = 'osaca:migration:legacy-app-storage';
export const LEGACY_SHARED_CONTENT_REVIEW_KEY = 'osaca:migration:shared-content-review';

export const LegacySharedContentReviewState = Object.freeze({
	PENDING: 'pending',
	DONE: 'done',
} as const);

const GLOBAL_APP_STORAGE_KEY_LOOKUP: Readonly<Record<string, true>> = Object.freeze({
	[AppStorageKey.ACCOUNT_KEYBINDS]: true,
	[AppStorageKey.AUTH_ACCOUNT_KEY]: true,
	[AppStorageKey.AUTH_DESKTOP_CLIENT_INTRO_COMPLETED]: true,
	[AppStorageKey.AUTH_DESKTOP_CLIENT_PERMISSIONS_SKIPPED]: true,
	[AppStorageKey.AUTH_DESKTOP_CLIENT_PREFERENCES_SEEN]: true,
	[AppStorageKey.AUTH_DESKTOP_CLIENT_WELCOME_SEEN]: true,
	[AppStorageKey.AUTH_SESSION_TOKEN]: true,
	[AppStorageKey.AUTH_SESSION_USER_ID]: true,
	[AppStorageKey.I18N_CHOSEN_LOCALE]: true,
	[AppStorageKey.QUICK_CSS_EDITOR_HISTORY]: true,
	[AppStorageKey.QUICK_CSS_EDITOR_PANEL_LAYOUT]: true,
	[AppStorageKey.QUICK_CSS_EDITOR_PLACEMENT]: true,
	[AppStorageKey.QUICK_CSS_EDITOR_PREFERENCES]: true,
	[AppStorageKey.INSTALLATION_THEME]: true,
	[AppStorageKey.THEME_LIBRARY_ENABLED_IDS]: true,
	[AppStorageKey.THEME_LIBRARY_FOLDERS]: true,
	[AppStorageKey.THEME_LIBRARY_LOCAL_FILES]: true,
	[AppStorageKey.THEME_LIBRARY_MIGRATED]: true,
	[AppStorageKey.THEME_LIBRARY_THEMES]: true,
	[AppStorageKey.THEME_PROFILES_MIGRATED]: true,
	[AppStorageKey.UI_INBOX_OTHER_ACCOUNTS_COLLAPSED]: true,
	[AppStorageKey.WINDOWS_FONT]: true,
});

export function isGlobalAppStorageKey(key: string): boolean {
	return Object.hasOwn(GLOBAL_APP_STORAGE_KEY_LOOKUP, key);
}
