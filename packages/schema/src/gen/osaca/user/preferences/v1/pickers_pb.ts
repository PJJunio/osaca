import type { GenEnum, GenFile, GenMessage } from "@bufbuild/protobuf/codegenv2";
import { enumDesc, fileDesc, messageDesc } from "@bufbuild/protobuf/codegenv2";
import type { Message } from "@bufbuild/protobuf";

/**
 * Describes the file osaca/user/preferences/v1/pickers.proto.
 */
export const file_osaca_user_preferences_v1_pickers: GenFile = /*@__PURE__*/
  fileDesc("Cidvc2FjYS91c2VyL3ByZWZlcmVuY2VzL3YxL3BpY2tlcnMucHJvdG8SGW9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEiMAoJVXNhZ2VTdGF0Eg0KBWNvdW50GAEgASgNEhQKDGxhc3RfdXNlZF9tcxgCIAEoAyLpAQoQRW1vamlQaWNrZXJTdGF0ZRJFCgV1c2FnZRgBIAMoCzI2Lm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuRW1vamlQaWNrZXJTdGF0ZS5Vc2FnZUVudHJ5EhoKEmZhdm9yaXRlX2Vtb2ppX2lkcxgCIAMoCRIeChZjb2xsYXBzZWRfY2F0ZWdvcnlfaWRzGAMgAygJGlIKClVzYWdlRW50cnkSCwoDa2V5GAEgASgJEjMKBXZhbHVlGAIgASgLMiQub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5Vc2FnZVN0YXQ6AjgBIu8BChJTdGlja2VyUGlja2VyU3RhdGUSRwoFdXNhZ2UYASADKAsyOC5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLlN0aWNrZXJQaWNrZXJTdGF0ZS5Vc2FnZUVudHJ5EhwKFGZhdm9yaXRlX3N0aWNrZXJfaWRzGAIgAygJEh4KFmNvbGxhcHNlZF9jYXRlZ29yeV9pZHMYAyADKAkaUgoKVXNhZ2VFbnRyeRILCgNrZXkYASABKAkSMwoFdmFsdWUYAiABKAsyJC5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLlVzYWdlU3RhdDoCOAEi6AEKEE1lbWVzUGlja2VyU3RhdGUSRQoFdXNhZ2UYASADKAsyNi5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLk1lbWVzUGlja2VyU3RhdGUuVXNhZ2VFbnRyeRIZChFmYXZvcml0ZV9tZW1lX2lkcxgCIAMoCRIeChZjb2xsYXBzZWRfY2F0ZWdvcnlfaWRzGAMgAygJGlIKClVzYWdlRW50cnkSCwoDa2V5GAEgASgJEjMKBXZhbHVlGAIgASgLMiQub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5Vc2FnZVN0YXQ6AjgBIh8KCkVtb2ppU3RhdGUSEQoJc2tpbl90b25lGAEgASgJIq0BChpFbW9qaVN0aWNrZXJMYXlvdXRTZXR0aW5ncxJCCgxlbW9qaV9sYXlvdXQYASABKA4yLC5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLkVtb2ppUGlja2VyTGF5b3V0EksKEXN0aWNrZXJfdmlld19tb2RlGAIgASgOMjAub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5TdGlja2VyUGlja2VyVmlld01vZGUi9gIKDVNvdW5kU2V0dGluZ3MSGwoTYWxsX3NvdW5kc19kaXNhYmxlZBgBIAEoCBIaCg1tYXN0ZXJfdm9sdW1lGAIgASgBSACIAQESVQoPZGlzYWJsZWRfc291bmRzGAMgAygLMjwub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5Tb3VuZFNldHRpbmdzLkRpc2FibGVkU291bmRzRW50cnkSVQoPc291bmRfb3ZlcnJpZGVzGAQgAygLMjwub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5Tb3VuZFNldHRpbmdzLlNvdW5kT3ZlcnJpZGVzRW50cnkaNQoTRGlzYWJsZWRTb3VuZHNFbnRyeRILCgNrZXkYASABKAkSDQoFdmFsdWUYAiABKAg6AjgBGjUKE1NvdW5kT3ZlcnJpZGVzRW50cnkSCwoDa2V5GAEgASgJEg0KBXZhbHVlGAIgASgBOgI4AUIQCg5fbWFzdGVyX3ZvbHVtZSp0ChFFbW9qaVBpY2tlckxheW91dBIjCh9FTU9KSV9QSUNLRVJfTEFZT1VUX1VOU1BFQ0lGSUVEEAASHAoYRU1PSklfUElDS0VSX0xBWU9VVF9MSVNUEAESHAoYRU1PSklfUElDS0VSX0xBWU9VVF9HUklEEAIqigEKFVN0aWNrZXJQaWNrZXJWaWV3TW9kZRIoCiRTVElDS0VSX1BJQ0tFUl9WSUVXX01PREVfVU5TUEVDSUZJRUQQABIhCh1TVElDS0VSX1BJQ0tFUl9WSUVXX01PREVfQ09aWRABEiQKIFNUSUNLRVJfUElDS0VSX1ZJRVdfTU9ERV9DT01QQUNUEAIq2AMKCVNvdW5kVHlwZRIaChZTT1VORF9UWVBFX1VOU1BFQ0lGSUVEEAASEwoPU09VTkRfVFlQRV9ERUFGEAESFQoRU09VTkRfVFlQRV9VTkRFQUYQAhITCg9TT1VORF9UWVBFX01VVEUQAxIVChFTT1VORF9UWVBFX1VOTVVURRAEEhYKElNPVU5EX1RZUEVfTUVTU0FHRRAFEhwKGFNPVU5EX1RZUEVfSU5DT01JTkdfUklORxAGEhgKFFNPVU5EX1RZUEVfVVNFUl9KT0lOEAcSGQoVU09VTkRfVFlQRV9VU0VSX0xFQVZFEAgSGAoUU09VTkRfVFlQRV9VU0VSX01PVkUQCRIaChZTT1VORF9UWVBFX1ZJRVdFUl9KT0lOEAoSGwoXU09VTkRfVFlQRV9WSUVXRVJfTEVBVkUQCxIfChtTT1VORF9UWVBFX1ZPSUNFX0RJU0NPTk5FQ1QQDBIYChRTT1VORF9UWVBFX0NBTUVSQV9PThANEhkKFVNPVU5EX1RZUEVfQ0FNRVJBX09GRhAOEiEKHVNPVU5EX1RZUEVfU0NSRUVOX1NIQVJFX1NUQVJUEA8SIAocU09VTkRfVFlQRV9TQ1JFRU5fU0hBUkVfU1RPUBAQYgZwcm90bzM");

/**
 * @generated from message osaca.user.preferences.v1.UsageStat
 */
export type UsageStat = Message<"osaca.user.preferences.v1.UsageStat"> & {
  /**
   * @generated from field: uint32 count = 1;
   */
  count: number;

  /**
   * @generated from field: int64 last_used_ms = 2;
   */
  lastUsedMs: bigint;
};

/**
 * Describes the message osaca.user.preferences.v1.UsageStat.
 * Use `create(UsageStatSchema)` to create a new message.
 */
export const UsageStatSchema: GenMessage<UsageStat> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_pickers, 0);

/**
 * @generated from message osaca.user.preferences.v1.EmojiPickerState
 */
export type EmojiPickerState = Message<"osaca.user.preferences.v1.EmojiPickerState"> & {
  /**
   * @generated from field: map<string, osaca.user.preferences.v1.UsageStat> usage = 1;
   */
  usage: { [key: string]: UsageStat };

  /**
   * @generated from field: repeated string favorite_emoji_ids = 2;
   */
  favoriteEmojiIds: string[];

  /**
   * @generated from field: repeated string collapsed_category_ids = 3;
   */
  collapsedCategoryIds: string[];
};

/**
 * Describes the message osaca.user.preferences.v1.EmojiPickerState.
 * Use `create(EmojiPickerStateSchema)` to create a new message.
 */
export const EmojiPickerStateSchema: GenMessage<EmojiPickerState> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_pickers, 1);

/**
 * @generated from message osaca.user.preferences.v1.StickerPickerState
 */
export type StickerPickerState = Message<"osaca.user.preferences.v1.StickerPickerState"> & {
  /**
   * @generated from field: map<string, osaca.user.preferences.v1.UsageStat> usage = 1;
   */
  usage: { [key: string]: UsageStat };

  /**
   * @generated from field: repeated string favorite_sticker_ids = 2;
   */
  favoriteStickerIds: string[];

  /**
   * @generated from field: repeated string collapsed_category_ids = 3;
   */
  collapsedCategoryIds: string[];
};

/**
 * Describes the message osaca.user.preferences.v1.StickerPickerState.
 * Use `create(StickerPickerStateSchema)` to create a new message.
 */
export const StickerPickerStateSchema: GenMessage<StickerPickerState> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_pickers, 2);

/**
 * @generated from message osaca.user.preferences.v1.MemesPickerState
 */
export type MemesPickerState = Message<"osaca.user.preferences.v1.MemesPickerState"> & {
  /**
   * @generated from field: map<string, osaca.user.preferences.v1.UsageStat> usage = 1;
   */
  usage: { [key: string]: UsageStat };

  /**
   * @generated from field: repeated string favorite_meme_ids = 2;
   */
  favoriteMemeIds: string[];

  /**
   * @generated from field: repeated string collapsed_category_ids = 3;
   */
  collapsedCategoryIds: string[];
};

/**
 * Describes the message osaca.user.preferences.v1.MemesPickerState.
 * Use `create(MemesPickerStateSchema)` to create a new message.
 */
export const MemesPickerStateSchema: GenMessage<MemesPickerState> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_pickers, 3);

/**
 * @generated from message osaca.user.preferences.v1.EmojiState
 */
export type EmojiState = Message<"osaca.user.preferences.v1.EmojiState"> & {
  /**
   * @generated from field: string skin_tone = 1;
   */
  skinTone: string;
};

/**
 * Describes the message osaca.user.preferences.v1.EmojiState.
 * Use `create(EmojiStateSchema)` to create a new message.
 */
export const EmojiStateSchema: GenMessage<EmojiState> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_pickers, 4);

/**
 * @generated from message osaca.user.preferences.v1.EmojiStickerLayoutSettings
 */
export type EmojiStickerLayoutSettings = Message<"osaca.user.preferences.v1.EmojiStickerLayoutSettings"> & {
  /**
   * @generated from field: osaca.user.preferences.v1.EmojiPickerLayout emoji_layout = 1;
   */
  emojiLayout: EmojiPickerLayout;

  /**
   * @generated from field: osaca.user.preferences.v1.StickerPickerViewMode sticker_view_mode = 2;
   */
  stickerViewMode: StickerPickerViewMode;
};

/**
 * Describes the message osaca.user.preferences.v1.EmojiStickerLayoutSettings.
 * Use `create(EmojiStickerLayoutSettingsSchema)` to create a new message.
 */
export const EmojiStickerLayoutSettingsSchema: GenMessage<EmojiStickerLayoutSettings> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_pickers, 5);

/**
 * @generated from message osaca.user.preferences.v1.SoundSettings
 */
export type SoundSettings = Message<"osaca.user.preferences.v1.SoundSettings"> & {
  /**
   * @generated from field: bool all_sounds_disabled = 1;
   */
  allSoundsDisabled: boolean;

  /**
   * @generated from field: optional double master_volume = 2;
   */
  masterVolume?: number | undefined;

  /**
   * @generated from field: map<string, bool> disabled_sounds = 3;
   */
  disabledSounds: { [key: string]: boolean };

  /**
   * @generated from field: map<string, double> sound_overrides = 4;
   */
  soundOverrides: { [key: string]: number };
};

/**
 * Describes the message osaca.user.preferences.v1.SoundSettings.
 * Use `create(SoundSettingsSchema)` to create a new message.
 */
export const SoundSettingsSchema: GenMessage<SoundSettings> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_pickers, 6);

/**
 * @generated from enum osaca.user.preferences.v1.EmojiPickerLayout
 */
export enum EmojiPickerLayout {
  /**
   * @generated from enum value: EMOJI_PICKER_LAYOUT_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * @generated from enum value: EMOJI_PICKER_LAYOUT_LIST = 1;
   */
  LIST = 1,

  /**
   * @generated from enum value: EMOJI_PICKER_LAYOUT_GRID = 2;
   */
  GRID = 2,
}

/**
 * Describes the enum osaca.user.preferences.v1.EmojiPickerLayout.
 */
export const EmojiPickerLayoutSchema: GenEnum<EmojiPickerLayout> = /*@__PURE__*/
  enumDesc(file_osaca_user_preferences_v1_pickers, 0);

/**
 * @generated from enum osaca.user.preferences.v1.StickerPickerViewMode
 */
export enum StickerPickerViewMode {
  /**
   * @generated from enum value: STICKER_PICKER_VIEW_MODE_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * @generated from enum value: STICKER_PICKER_VIEW_MODE_COZY = 1;
   */
  COZY = 1,

  /**
   * @generated from enum value: STICKER_PICKER_VIEW_MODE_COMPACT = 2;
   */
  COMPACT = 2,
}

/**
 * Describes the enum osaca.user.preferences.v1.StickerPickerViewMode.
 */
export const StickerPickerViewModeSchema: GenEnum<StickerPickerViewMode> = /*@__PURE__*/
  enumDesc(file_osaca_user_preferences_v1_pickers, 1);

/**
 * @generated from enum osaca.user.preferences.v1.SoundType
 */
export enum SoundType {
  /**
   * @generated from enum value: SOUND_TYPE_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * @generated from enum value: SOUND_TYPE_DEAF = 1;
   */
  DEAF = 1,

  /**
   * @generated from enum value: SOUND_TYPE_UNDEAF = 2;
   */
  UNDEAF = 2,

  /**
   * @generated from enum value: SOUND_TYPE_MUTE = 3;
   */
  MUTE = 3,

  /**
   * @generated from enum value: SOUND_TYPE_UNMUTE = 4;
   */
  UNMUTE = 4,

  /**
   * @generated from enum value: SOUND_TYPE_MESSAGE = 5;
   */
  MESSAGE = 5,

  /**
   * @generated from enum value: SOUND_TYPE_INCOMING_RING = 6;
   */
  INCOMING_RING = 6,

  /**
   * @generated from enum value: SOUND_TYPE_USER_JOIN = 7;
   */
  USER_JOIN = 7,

  /**
   * @generated from enum value: SOUND_TYPE_USER_LEAVE = 8;
   */
  USER_LEAVE = 8,

  /**
   * @generated from enum value: SOUND_TYPE_USER_MOVE = 9;
   */
  USER_MOVE = 9,

  /**
   * @generated from enum value: SOUND_TYPE_VIEWER_JOIN = 10;
   */
  VIEWER_JOIN = 10,

  /**
   * @generated from enum value: SOUND_TYPE_VIEWER_LEAVE = 11;
   */
  VIEWER_LEAVE = 11,

  /**
   * @generated from enum value: SOUND_TYPE_VOICE_DISCONNECT = 12;
   */
  VOICE_DISCONNECT = 12,

  /**
   * @generated from enum value: SOUND_TYPE_CAMERA_ON = 13;
   */
  CAMERA_ON = 13,

  /**
   * @generated from enum value: SOUND_TYPE_CAMERA_OFF = 14;
   */
  CAMERA_OFF = 14,

  /**
   * @generated from enum value: SOUND_TYPE_SCREEN_SHARE_START = 15;
   */
  SCREEN_SHARE_START = 15,

  /**
   * @generated from enum value: SOUND_TYPE_SCREEN_SHARE_STOP = 16;
   */
  SCREEN_SHARE_STOP = 16,
}

/**
 * Describes the enum osaca.user.preferences.v1.SoundType.
 */
export const SoundTypeSchema: GenEnum<SoundType> = /*@__PURE__*/
  enumDesc(file_osaca_user_preferences_v1_pickers, 2);
