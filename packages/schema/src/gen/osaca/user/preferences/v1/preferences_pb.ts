import type { GenEnum, GenFile, GenMessage } from "@bufbuild/protobuf/codegenv2";
import { enumDesc, fileDesc, messageDesc } from "@bufbuild/protobuf/codegenv2";
import type { AccessibilityOverrides, AccessibilitySettings } from "./accessibility_pb";
import { file_osaca_user_preferences_v1_accessibility } from "./accessibility_pb";
import type { EmojiPickerState, EmojiState, EmojiStickerLayoutSettings, MemesPickerState, SoundSettings, StickerPickerState } from "./pickers_pb";
import { file_osaca_user_preferences_v1_pickers } from "./pickers_pb";
import type { Message } from "@bufbuild/protobuf";

/**
 * Describes the file osaca/user/preferences/v1/preferences.proto.
 */
export const file_osaca_user_preferences_v1_preferences: GenFile = /*@__PURE__*/
  fileDesc("Citvc2FjYS91c2VyL3ByZWZlcmVuY2VzL3YxL3ByZWZlcmVuY2VzLnByb3RvEhlvc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxIoYWChFTeW5jZWRQcmVmZXJlbmNlcxJHCg1hY2Nlc3NpYmlsaXR5GAEgASgLMjAub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5BY2Nlc3NpYmlsaXR5U2V0dGluZ3MSUgoXYWNjZXNzaWJpbGl0eV9vdmVycmlkZXMYAiABKAsyMS5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLkFjY2Vzc2liaWxpdHlPdmVycmlkZXMSSgoPdGV4dHVhbF9wcmV2aWV3GAMgASgLMjEub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5UZXh0dWFsUHJldmlld1NldHRpbmdzEkEKDGVtb2ppX3BpY2tlchgUIAEoCzIrLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuRW1vamlQaWNrZXJTdGF0ZRJFCg5zdGlja2VyX3BpY2tlchgVIAEoCzItLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuU3RpY2tlclBpY2tlclN0YXRlEkEKDG1lbWVzX3BpY2tlchgWIAEoCzIrLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuTWVtZXNQaWNrZXJTdGF0ZRI0CgVlbW9qaRgXIAEoCzIlLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuRW1vamlTdGF0ZRJTChRlbW9qaV9zdGlja2VyX2xheW91dBgYIAEoCzI1Lm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuRW1vamlTdGlja2VyTGF5b3V0U2V0dGluZ3MSPAoJZmF2b3JpdGVzGCggASgLMikub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5GYXZvcml0ZXNTdGF0ZRJKCg9yZWNlbnRfbWVudGlvbnMYKSABKAsyMS5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLlJlY2VudE1lbnRpb25zU2V0dGluZ3MSPgoHc2lkZWJhchgqIAEoCzItLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuU2lkZWJhclByZWZlcmVuY2VzEj8KC21lbWJlcl9saXN0GCsgASgLMioub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5NZW1iZXJMaXN0U3RhdGUSRwoPdW5yZWFkX2NoYW5uZWxzGCwgASgLMi4ub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5VbnJlYWRDaGFubmVsc1N0YXRlEkkKEG1lbnRpb25fZnJlY2VuY3kYLSABKAsyLy5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLk1lbnRpb25GcmVjZW5jeVN0YXRlEjwKB25hZ2JhcnMYPCABKAsyKy5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLk5hZ2JhckRpc21pc3NhbHMSTQoVZ3VpbGRfbnNmd19hZ3JlZW1lbnRzGD4gASgLMi4ub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5HdWlsZE5zZndBZ3JlZW1lbnRzEjsKCXdoYXRzX25ldxg/IAEoCzIoLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuV2hhdHNOZXdTdGF0ZRI+Cgdwcml2YWN5GFAgASgLMi0ub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5Qcml2YWN5UHJlZmVyZW5jZXMSTwoUbG9jYWxfc3BhbV9vdmVycmlkZXMYUSABKAsyMS5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLkxvY2FsVXNlclNwYW1PdmVycmlkZXMSFQoNc2FuaXRpemVfdXJscxhSIAEoCBI3CgVzb3VuZBhkIAEoCzIoLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuU291bmRTZXR0aW5ncxJBCgpzcGVsbGNoZWNrGGUgASgLMi0ub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5TcGVsbGNoZWNrU2V0dGluZ3MSRwoOc2VhcmNoX2VuZ2luZXMYZiABKAsyLy5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLlNlYXJjaEVuZ2luZVNldHRpbmdzEk4KEXBlcm1pc3Npb25fbGF5b3V0GGcgASgLMjMub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5QZXJtaXNzaW9uTGF5b3V0U2V0dGluZ3MSUQoTZ3VpbGRfbWVtYmVyX2xheW91dBhoIAEoCzI0Lm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuR3VpbGRNZW1iZXJMYXlvdXRTZXR0aW5ncxJKCg1ndWlsZF9mb2xkZXJzGGkgASgLMjMub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5HdWlsZEZvbGRlckV4cGFuZGVkU3RhdGUSTwoUaGlkZGVuX2d1aWxkX2J1dHRvbnMYaiABKAsyMS5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLkhpZGRlbkd1aWxkTGlzdEJ1dHRvbnMSTgoTa2V5Ym9hcmRfbW9kZV9pbnRybxhrIAEoCzIxLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuS2V5Ym9hcmRNb2RlSW50cm9TdGF0ZRJQChBpbnB1dF9tb25pdG9yaW5nGGwgASgLMjYub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5JbnB1dE1vbml0b3JpbmdQcm9tcHRzU3RhdGUSQwoNdm9pY2VfcHJvbXB0cxhtIAEoCzIsLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuVm9pY2VQcm9tcHRzU3RhdGUSPwoLc3Vkb19wcm9tcHQYbiABKAsyKi5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLlN1ZG9Qcm9tcHRTdGF0ZRI8CghrZXliaW5kcxhvIAEoCzIqLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuS2V5YmluZFNldHRpbmdzEkAKCmNoYXRfaW5wdXQYcCABKAsyLC5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLkNoYXRJbnB1dFNldHRpbmdzEioKHXNhdmVfY2FtZXJhX3VwbG9hZHNfdG9fZGV2aWNlGHEgASgISACIAQESRQoTZG91YmxlX3RhcF9yZWFjdGlvbhhyIAEoCzIoLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuUmVhY3Rpb25FbW9qaRJJChBjaGFubmVsX2ZyZWNlbmN5GHMgASgLMi8ub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5DaGFubmVsRnJlY2VuY3lTdGF0ZRJRChRhbm5vdW5jZW1lbnRfcHJvbXB0cxh0IAEoCzIzLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuQW5ub3VuY2VtZW50UHJvbXB0c1N0YXRlEkUKEWRvdWJsZV90YXBfYWN0aW9uGHUgASgOMioub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5Eb3VibGVUYXBBY3Rpb24SSgoac3dpcGVfcmlnaHRfdG9fbGVmdF9hY3Rpb24YdiABKA4yJi5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLlN3aXBlQWN0aW9uQiAKHl9zYXZlX2NhbWVyYV91cGxvYWRzX3RvX2RldmljZUoECBkQGkoECD0QPlINZmF2b3JpdGVfZ2lmc1IRZGlzbWlzc2VkX3Vwc2VsbHMisAEKElNwZWxsY2hlY2tTZXR0aW5ncxIUCgdlbmFibGVkGAEgASgISACIAQESEQoJbGFuZ3VhZ2VzGAIgAygJEhsKE3BlcnNvbmFsX2RpY3Rpb25hcnkYAyADKAkSGAoLYXV0b19kZXRlY3QYBCABKAhIAYgBARITCgZlbmdpbmUYBSABKAlIAogBAUIKCghfZW5hYmxlZEIOCgxfYXV0b19kZXRlY3RCCQoHX2VuZ2luZSLmAQoUU2VhcmNoRW5naW5lU2V0dGluZ3MSIgoVdGV4dF9zZWFyY2hfZW5naW5lX2lkGAEgASgJSACIAQESKwoecmV2ZXJzZV9pbWFnZV9zZWFyY2hfZW5naW5lX2lkGAIgASgJSAGIAQESJAoXdHJhbnNsYXRpb25fcHJvdmlkZXJfaWQYAyABKAlIAogBAUIYChZfdGV4dF9zZWFyY2hfZW5naW5lX2lkQiEKH19yZXZlcnNlX2ltYWdlX3NlYXJjaF9lbmdpbmVfaWRCGgoYX3RyYW5zbGF0aW9uX3Byb3ZpZGVyX2lkIrUBChJQcml2YWN5UHJlZmVyZW5jZXMSHwoXZGlzYWJsZV9zdHJlYW1fcHJldmlld3MYASABKAgSHAoPc2hvd19hY3RpdmVfbm93GAIgASgISACIAQESKgodcHJldXBsb2FkX21lc3NhZ2VfYXR0YWNobWVudHMYAyABKAhIAYgBAUISChBfc2hvd19hY3RpdmVfbm93QiAKHl9wcmV1cGxvYWRfbWVzc2FnZV9hdHRhY2htZW50cyJQChZMb2NhbFVzZXJTcGFtT3ZlcnJpZGVzEhgKEHNwYW1tZXJfdXNlcl9pZHMYASADKAkSHAoUbm90X3NwYW1tZXJfdXNlcl9pZHMYAiADKAkiKwoWVGV4dHVhbFByZXZpZXdTZXR0aW5ncxIRCgl3cmFwX3RleHQYASABKAgi3AEKElNpZGViYXJQcmVmZXJlbmNlcxIcChRpbmxpbmVfZG1zX2NvbGxhcHNlZBgBIAEoCBIsCh9zaG93X2NvbGxhcHNlZF91bnJlYWRfZG1zX2JhZGdlGAIgASgISACIAQESLwoic2hvd19pbmNvbWluZ19mcmllbmRfcmVxdWVzdF9iYWRnZRgDIAEoCEgBiAEBQiIKIF9zaG93X2NvbGxhcHNlZF91bnJlYWRfZG1zX2JhZGdlQiUKI19zaG93X2luY29taW5nX2ZyaWVuZF9yZXF1ZXN0X2JhZGdlIj0KD01lbWJlckxpc3RTdGF0ZRIZCgxtZW1iZXJzX29wZW4YASABKAhIAIgBAUIPCg1fbWVtYmVyc19vcGVuIjQKE1VucmVhZENoYW5uZWxzU3RhdGUSHQoVY29sbGFwc2VkX2NoYW5uZWxfaWRzGAEgAygJIqoBChZSZWNlbnRNZW50aW9uc1NldHRpbmdzEh0KEGluY2x1ZGVfZXZlcnlvbmUYASABKAhIAIgBARIaCg1pbmNsdWRlX3JvbGVzGAIgASgISAGIAQESGwoOaW5jbHVkZV9ndWlsZHMYAyABKAhIAogBAUITChFfaW5jbHVkZV9ldmVyeW9uZUIQCg5faW5jbHVkZV9yb2xlc0IRCg9faW5jbHVkZV9ndWlsZHMi/QEKFE1lbnRpb25GcmVjZW5jeVN0YXRlEkUKBnNjb3BlcxgBIAMoCzI1Lm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuTWVudGlvbkZyZWNlbmN5U3RhdGUuU2NvcGUaOwoFRW50cnkSDwoHdXNlcl9pZBgBIAEoCRINCgVjb3VudBgCIAEoDRISCgpsYXN0X2F0X21zGAMgASgDGmEKBVNjb3BlEhAKCGd1aWxkX2lkGAEgASgJEkYKB2VudHJpZXMYAiADKAsyNS5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLk1lbnRpb25GcmVjZW5jeVN0YXRlLkVudHJ5ItsBCg5GYXZvcml0ZXNTdGF0ZRI8CghjaGFubmVscxgBIAMoCzIqLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuRmF2b3JpdGVDaGFubmVsEj8KCmNhdGVnb3JpZXMYAiADKAsyKy5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLkZhdm9yaXRlQ2F0ZWdvcnkSHgoWY29sbGFwc2VkX2NhdGVnb3J5X2lkcxgDIAMoCRIbChNoaWRlX211dGVkX2NoYW5uZWxzGAQgASgIEg0KBW11dGVkGAUgASgIIpMBCg9GYXZvcml0ZUNoYW5uZWwSEgoKY2hhbm5lbF9pZBgBIAEoCRIQCghndWlsZF9pZBgCIAEoCRIWCglwYXJlbnRfaWQYAyABKAlIAIgBARIQCghwb3NpdGlvbhgEIAEoBRIVCghuaWNrbmFtZRgFIAEoCUgBiAEBQgwKCl9wYXJlbnRfaWRCCwoJX25pY2tuYW1lIj4KEEZhdm9yaXRlQ2F0ZWdvcnkSCgoCaWQYASABKAkSDAoEbmFtZRgCIAEoCRIQCghwb3NpdGlvbhgDIAEoBSK8BgoQTmFnYmFyRGlzbWlzc2FscxITCgtpb3NfaW5zdGFsbBgBIAEoCBITCgtwd2FfaW5zdGFsbBgCIAEoCBIZChFwdXNoX25vdGlmaWNhdGlvbhgDIAEoCBIcChRkZXNrdG9wX25vdGlmaWNhdGlvbhgEIAEoCBIYChBkZXNrdG9wX2Rvd25sb2FkGAogASgIEhwKFGd1aWxkX21lbWJlcnNoaXBfY3RhGAsgASgIEmMKFXBlbmRpbmdfYnVsa19kZWxldGlvbhgPIAMoCzJELm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuTmFnYmFyRGlzbWlzc2Fscy5QZW5kaW5nQnVsa0RlbGV0aW9uRW50cnkSWgoQaW52aXRlc19kaXNhYmxlZBgQIAMoCzJALm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuTmFnYmFyRGlzbWlzc2Fscy5JbnZpdGVzRGlzYWJsZWRFbnRyeRJjChVndWlsZF9tZmFfcmVxdWlyZW1lbnQYESADKAsyRC5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLk5hZ2JhckRpc21pc3NhbHMuR3VpbGRNZmFSZXF1aXJlbWVudEVudHJ5GjoKGFBlbmRpbmdCdWxrRGVsZXRpb25FbnRyeRILCgNrZXkYASABKAkSDQoFdmFsdWUYAiABKAg6AjgBGjYKFEludml0ZXNEaXNhYmxlZEVudHJ5EgsKA2tleRgBIAEoCRINCgV2YWx1ZRgCIAEoCDoCOAEaOgoYR3VpbGRNZmFSZXF1aXJlbWVudEVudHJ5EgsKA2tleRgBIAEoCRINCgV2YWx1ZRgCIAEoCDoCOAFKBAgFEApKBAgMEA1KBAgOEA9KBAgSEBNKBAgTEBRSFHByZW1pdW1fZ3JhY2VfcGVyaW9kUg9wcmVtaXVtX2V4cGlyZWRSEnByZW1pdW1fb25ib2FyZGluZ1IWcHJlbWl1bV90cmlhbF9leHBpcmluZ1IOZ2lmdF9pbnZlbnRvcnlSDXZpc2lvbmFyeV9tZmFSEnByaWNlX2Fubm91bmNlbWVudFITbGVnYWN5X3ByaWNlX29wdF9pbiJoChNHdWlsZE5zZndBZ3JlZW1lbnRzEhoKEmFncmVlZF9jaGFubmVsX2lkcxgBIAMoCRIYChBhZ3JlZWRfZ3VpbGRfaWRzGAIgAygJEhsKE2FncmVlZF9jYXRlZ29yeV9pZHMYAyADKAkiUQoNV2hhdHNOZXdTdGF0ZRIkChdsYXN0X2Rpc21pc3NlZF9lbnRyeV9pZBgBIAEoCUgAiAEBQhoKGF9sYXN0X2Rpc21pc3NlZF9lbnRyeV9pZCKYAQoYUGVybWlzc2lvbkxheW91dFNldHRpbmdzEj8KBmxheW91dBgBIAEoDjIvLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuUGVybWlzc2lvbkxheW91dE1vZGUSOwoEZ3JpZBgCIAEoDjItLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuUGVybWlzc2lvbkdyaWRNb2RlIlkKGUd1aWxkTWVtYmVyTGF5b3V0U2V0dGluZ3MSPAoEbW9kZRgBIAEoDjIuLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuR3VpbGRNZW1iZXJWaWV3TW9kZSI3ChhHdWlsZEZvbGRlckV4cGFuZGVkU3RhdGUSGwoTZXhwYW5kZWRfZm9sZGVyX2lkcxgBIAMoBiJGChZIaWRkZW5HdWlsZExpc3RCdXR0b25zEhcKD2Rvd25sb2FkX2J1dHRvbhgBIAEoCBITCgtoZWxwX2J1dHRvbhgCIAEoCCImChZLZXlib2FyZE1vZGVJbnRyb1N0YXRlEgwKBHNlZW4YASABKAgiLwobSW5wdXRNb25pdG9yaW5nUHJvbXB0c1N0YXRlEhAKCHNlZW5fY3RhGAEgASgIIoMBChFWb2ljZVByb21wdHNTdGF0ZRIkChxza2lwX2hpZGVfb3duX2NhbWVyYV9jb25maXJtGAEgASgIEikKIXNraXBfaGlkZV9vd25fc2NyZWVuc2hhcmVfY29uZmlybRgCIAEoCBIdChVza2lwX3AycF9qb2luX2NvbmZpcm0YAyABKAgiNgoYQW5ub3VuY2VtZW50UHJvbXB0c1N0YXRlEhoKEmhpZGVfcHVibGlzaF9udWRnZRgBIAEoCCJzCg9TdWRvUHJvbXB0U3RhdGUSRwoUbGFzdF91c2VkX21mYV9tZXRob2QYASABKA4yJC5vc2FjYS51c2VyLnByZWZlcmVuY2VzLnYxLk1mYU1ldGhvZEgAiAEBQhcKFV9sYXN0X3VzZWRfbWZhX21ldGhvZCK5AQoPS2V5YmluZFNldHRpbmdzEkEKD2N1c3RvbV9rZXliaW5kcxgBIAMoCzIoLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuQ3VzdG9tS2V5YmluZBIVCg10cmFuc21pdF9tb2RlGAIgASgJEioKHXB1c2hfdG9fdGFsa19yZWxlYXNlX2RlbGF5X21zGAMgASgNSACIAQFCIAoeX3B1c2hfdG9fdGFsa19yZWxlYXNlX2RlbGF5X21zIoQBCg1DdXN0b21LZXliaW5kEgoKAmlkGAEgASgJEhMKBmFjdGlvbhgCIAEoCUgAiAEBEjYKBWNvbWJvGAMgASgLMicub3NhY2EudXNlci5wcmVmZXJlbmNlcy52MS5LZXliaW5kQ29tYm8SDwoHZW5hYmxlZBgEIAEoCEIJCgdfYWN0aW9uIs4CCgxLZXliaW5kQ29tYm8SCwoDa2V5GAEgASgJEhEKBGNvZGUYAiABKAlIAIgBARIUCgxjdHJsX29yX21ldGEYAyABKAgSDAoEY3RybBgEIAEoCBILCgNhbHQYBSABKAgSDQoFc2hpZnQYBiABKAgSDAoEbWV0YRgHIAEoCBITCgZnbG9iYWwYCCABKAhIAYgBARIUCgdlbmFibGVkGAkgASgISAKIAQESFQoNbW9kaWZpZXJfb25seRgKIAEoCBISCgpib3RoX3NpZGVzGAsgASgIEhkKDG1vdXNlX2J1dHRvbhgMIAEoDUgDiAEBEhsKDmdhbWVwYWRfYnV0dG9uGA0gASgNSASIAQFCBwoFX2NvZGVCCQoHX2dsb2JhbEIKCghfZW5hYmxlZEIPCg1fbW91c2VfYnV0dG9uQhEKD19nYW1lcGFkX2J1dHRvbiJCChRDaGFubmVsRnJlY2VuY3lFbnRyeRISCgp0b3RhbF91c2VzGAEgASgNEhYKDnJlY2VudF91c2VzX21zGAIgAygDIsABChRDaGFubmVsRnJlY2VuY3lTdGF0ZRJJCgV1c2FnZRgBIAMoCzI6Lm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuQ2hhbm5lbEZyZWNlbmN5U3RhdGUuVXNhZ2VFbnRyeRpdCgpVc2FnZUVudHJ5EgsKA2tleRgBIAEoCRI+CgV2YWx1ZRgCIAEoCzIvLm9zYWNhLnVzZXIucHJlZmVyZW5jZXMudjEuQ2hhbm5lbEZyZWNlbmN5RW50cnk6AjgBIkkKEUNoYXRJbnB1dFNldHRpbmdzEh4KEWNvbnZlcnRfZW1vdGljb25zGAEgASgISACIAQFCFAoSX2NvbnZlcnRfZW1vdGljb25zIjUKDVJlYWN0aW9uRW1vamkSDwoCaWQYASABKAlIAIgBARIMCgRuYW1lGAIgASgJQgUKA19pZCqCAQoUUGVybWlzc2lvbkxheW91dE1vZGUSJgoiUEVSTUlTU0lPTl9MQVlPVVRfTU9ERV9VTlNQRUNJRklFRBAAEiAKHFBFUk1JU1NJT05fTEFZT1VUX01PREVfQ09NRlkQARIgChxQRVJNSVNTSU9OX0xBWU9VVF9NT0RFX0RFTlNFEAIqegoSUGVybWlzc2lvbkdyaWRNb2RlEiQKIFBFUk1JU1NJT05fR1JJRF9NT0RFX1VOU1BFQ0lGSUVEEAASHwobUEVSTUlTU0lPTl9HUklEX01PREVfU0lOR0xFEAESHQoZUEVSTUlTU0lPTl9HUklEX01PREVfR1JJRBACKoABChNHdWlsZE1lbWJlclZpZXdNb2RlEiYKIkdVSUxEX01FTUJFUl9WSUVXX01PREVfVU5TUEVDSUZJRUQQABIgChxHVUlMRF9NRU1CRVJfVklFV19NT0RFX1RBQkxFEAESHwobR1VJTERfTUVNQkVSX1ZJRVdfTU9ERV9HUklEEAIqVQoJTWZhTWV0aG9kEhoKFk1GQV9NRVRIT0RfVU5TUEVDSUZJRUQQABITCg9NRkFfTUVUSE9EX1RPVFAQARIXChNNRkFfTUVUSE9EX1dFQkFVVEhOEAMqiQEKD0RvdWJsZVRhcEFjdGlvbhIhCh1ET1VCTEVfVEFQX0FDVElPTl9VTlNQRUNJRklFRBAAEhsKF0RPVUJMRV9UQVBfQUNUSU9OX1JFQUNUEAESGgoWRE9VQkxFX1RBUF9BQ1RJT05fRURJVBACEhoKFkRPVUJMRV9UQVBfQUNUSU9OX05PTkUQAyplCgtTd2lwZUFjdGlvbhIcChhTV0lQRV9BQ1RJT05fVU5TUEVDSUZJRUQQABIgChxTV0lQRV9BQ1RJT05fQ0hBTk5FTF9ERVRBSUxTEAESFgoSU1dJUEVfQUNUSU9OX1JFUExZEAJiBnByb3RvMw", [file_osaca_user_preferences_v1_accessibility, file_osaca_user_preferences_v1_pickers]);

/**
 * @generated from message osaca.user.preferences.v1.SyncedPreferences
 */
export type SyncedPreferences = Message<"osaca.user.preferences.v1.SyncedPreferences"> & {
  /**
   * @generated from field: osaca.user.preferences.v1.AccessibilitySettings accessibility = 1;
   */
  accessibility?: AccessibilitySettings | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.AccessibilityOverrides accessibility_overrides = 2;
   */
  accessibilityOverrides?: AccessibilityOverrides | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.TextualPreviewSettings textual_preview = 3;
   */
  textualPreview?: TextualPreviewSettings | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.EmojiPickerState emoji_picker = 20;
   */
  emojiPicker?: EmojiPickerState | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.StickerPickerState sticker_picker = 21;
   */
  stickerPicker?: StickerPickerState | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.MemesPickerState memes_picker = 22;
   */
  memesPicker?: MemesPickerState | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.EmojiState emoji = 23;
   */
  emoji?: EmojiState | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.EmojiStickerLayoutSettings emoji_sticker_layout = 24;
   */
  emojiStickerLayout?: EmojiStickerLayoutSettings | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.FavoritesState favorites = 40;
   */
  favorites?: FavoritesState | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.RecentMentionsSettings recent_mentions = 41;
   */
  recentMentions?: RecentMentionsSettings | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.SidebarPreferences sidebar = 42;
   */
  sidebar?: SidebarPreferences | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.MemberListState member_list = 43;
   */
  memberList?: MemberListState | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.UnreadChannelsState unread_channels = 44;
   */
  unreadChannels?: UnreadChannelsState | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.MentionFrecencyState mention_frecency = 45;
   */
  mentionFrecency?: MentionFrecencyState | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.NagbarDismissals nagbars = 60;
   */
  nagbars?: NagbarDismissals | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.GuildNsfwAgreements guild_nsfw_agreements = 62;
   */
  guildNsfwAgreements?: GuildNsfwAgreements | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.WhatsNewState whats_new = 63;
   */
  whatsNew?: WhatsNewState | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.PrivacyPreferences privacy = 80;
   */
  privacy?: PrivacyPreferences | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.LocalUserSpamOverrides local_spam_overrides = 81;
   */
  localSpamOverrides?: LocalUserSpamOverrides | undefined;

  /**
   * @generated from field: bool sanitize_urls = 82;
   */
  sanitizeUrls: boolean;

  /**
   * @generated from field: osaca.user.preferences.v1.SoundSettings sound = 100;
   */
  sound?: SoundSettings | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.SpellcheckSettings spellcheck = 101;
   */
  spellcheck?: SpellcheckSettings | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.SearchEngineSettings search_engines = 102;
   */
  searchEngines?: SearchEngineSettings | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.PermissionLayoutSettings permission_layout = 103;
   */
  permissionLayout?: PermissionLayoutSettings | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.GuildMemberLayoutSettings guild_member_layout = 104;
   */
  guildMemberLayout?: GuildMemberLayoutSettings | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.GuildFolderExpandedState guild_folders = 105;
   */
  guildFolders?: GuildFolderExpandedState | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.HiddenGuildListButtons hidden_guild_buttons = 106;
   */
  hiddenGuildButtons?: HiddenGuildListButtons | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.KeyboardModeIntroState keyboard_mode_intro = 107;
   */
  keyboardModeIntro?: KeyboardModeIntroState | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.InputMonitoringPromptsState input_monitoring = 108;
   */
  inputMonitoring?: InputMonitoringPromptsState | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.VoicePromptsState voice_prompts = 109;
   */
  voicePrompts?: VoicePromptsState | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.SudoPromptState sudo_prompt = 110;
   */
  sudoPrompt?: SudoPromptState | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.KeybindSettings keybinds = 111;
   */
  keybinds?: KeybindSettings | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.ChatInputSettings chat_input = 112;
   */
  chatInput?: ChatInputSettings | undefined;

  /**
   * @generated from field: optional bool save_camera_uploads_to_device = 113;
   */
  saveCameraUploadsToDevice?: boolean | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.ReactionEmoji double_tap_reaction = 114;
   */
  doubleTapReaction?: ReactionEmoji | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.ChannelFrecencyState channel_frecency = 115;
   */
  channelFrecency?: ChannelFrecencyState | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.AnnouncementPromptsState announcement_prompts = 116;
   */
  announcementPrompts?: AnnouncementPromptsState | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.DoubleTapAction double_tap_action = 117;
   */
  doubleTapAction: DoubleTapAction;

  /**
   * @generated from field: osaca.user.preferences.v1.SwipeAction swipe_right_to_left_action = 118;
   */
  swipeRightToLeftAction: SwipeAction;
};

/**
 * Describes the message osaca.user.preferences.v1.SyncedPreferences.
 * Use `create(SyncedPreferencesSchema)` to create a new message.
 */
export const SyncedPreferencesSchema: GenMessage<SyncedPreferences> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 0);

/**
 * @generated from message osaca.user.preferences.v1.SpellcheckSettings
 */
export type SpellcheckSettings = Message<"osaca.user.preferences.v1.SpellcheckSettings"> & {
  /**
   * @generated from field: optional bool enabled = 1;
   */
  enabled?: boolean | undefined;

  /**
   * @generated from field: repeated string languages = 2;
   */
  languages: string[];

  /**
   * @generated from field: repeated string personal_dictionary = 3;
   */
  personalDictionary: string[];

  /**
   * @generated from field: optional bool auto_detect = 4;
   */
  autoDetect?: boolean | undefined;

  /**
   * @generated from field: optional string engine = 5;
   */
  engine?: string | undefined;
};

/**
 * Describes the message osaca.user.preferences.v1.SpellcheckSettings.
 * Use `create(SpellcheckSettingsSchema)` to create a new message.
 */
export const SpellcheckSettingsSchema: GenMessage<SpellcheckSettings> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 1);

/**
 * @generated from message osaca.user.preferences.v1.SearchEngineSettings
 */
export type SearchEngineSettings = Message<"osaca.user.preferences.v1.SearchEngineSettings"> & {
  /**
   * @generated from field: optional string text_search_engine_id = 1;
   */
  textSearchEngineId?: string | undefined;

  /**
   * @generated from field: optional string reverse_image_search_engine_id = 2;
   */
  reverseImageSearchEngineId?: string | undefined;

  /**
   * @generated from field: optional string translation_provider_id = 3;
   */
  translationProviderId?: string | undefined;
};

/**
 * Describes the message osaca.user.preferences.v1.SearchEngineSettings.
 * Use `create(SearchEngineSettingsSchema)` to create a new message.
 */
export const SearchEngineSettingsSchema: GenMessage<SearchEngineSettings> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 2);

/**
 * @generated from message osaca.user.preferences.v1.PrivacyPreferences
 */
export type PrivacyPreferences = Message<"osaca.user.preferences.v1.PrivacyPreferences"> & {
  /**
   * @generated from field: bool disable_stream_previews = 1;
   */
  disableStreamPreviews: boolean;

  /**
   * @generated from field: optional bool show_active_now = 2;
   */
  showActiveNow?: boolean | undefined;

  /**
   * @generated from field: optional bool preupload_message_attachments = 3;
   */
  preuploadMessageAttachments?: boolean | undefined;
};

/**
 * Describes the message osaca.user.preferences.v1.PrivacyPreferences.
 * Use `create(PrivacyPreferencesSchema)` to create a new message.
 */
export const PrivacyPreferencesSchema: GenMessage<PrivacyPreferences> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 3);

/**
 * @generated from message osaca.user.preferences.v1.LocalUserSpamOverrides
 */
export type LocalUserSpamOverrides = Message<"osaca.user.preferences.v1.LocalUserSpamOverrides"> & {
  /**
   * @generated from field: repeated string spammer_user_ids = 1;
   */
  spammerUserIds: string[];

  /**
   * @generated from field: repeated string not_spammer_user_ids = 2;
   */
  notSpammerUserIds: string[];
};

/**
 * Describes the message osaca.user.preferences.v1.LocalUserSpamOverrides.
 * Use `create(LocalUserSpamOverridesSchema)` to create a new message.
 */
export const LocalUserSpamOverridesSchema: GenMessage<LocalUserSpamOverrides> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 4);

/**
 * @generated from message osaca.user.preferences.v1.TextualPreviewSettings
 */
export type TextualPreviewSettings = Message<"osaca.user.preferences.v1.TextualPreviewSettings"> & {
  /**
   * @generated from field: bool wrap_text = 1;
   */
  wrapText: boolean;
};

/**
 * Describes the message osaca.user.preferences.v1.TextualPreviewSettings.
 * Use `create(TextualPreviewSettingsSchema)` to create a new message.
 */
export const TextualPreviewSettingsSchema: GenMessage<TextualPreviewSettings> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 5);

/**
 * @generated from message osaca.user.preferences.v1.SidebarPreferences
 */
export type SidebarPreferences = Message<"osaca.user.preferences.v1.SidebarPreferences"> & {
  /**
   * @generated from field: bool inline_dms_collapsed = 1;
   */
  inlineDmsCollapsed: boolean;

  /**
   * @generated from field: optional bool show_collapsed_unread_dms_badge = 2;
   */
  showCollapsedUnreadDmsBadge?: boolean | undefined;

  /**
   * @generated from field: optional bool show_incoming_friend_request_badge = 3;
   */
  showIncomingFriendRequestBadge?: boolean | undefined;
};

/**
 * Describes the message osaca.user.preferences.v1.SidebarPreferences.
 * Use `create(SidebarPreferencesSchema)` to create a new message.
 */
export const SidebarPreferencesSchema: GenMessage<SidebarPreferences> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 6);

/**
 * @generated from message osaca.user.preferences.v1.MemberListState
 */
export type MemberListState = Message<"osaca.user.preferences.v1.MemberListState"> & {
  /**
   * @generated from field: optional bool members_open = 1;
   */
  membersOpen?: boolean | undefined;
};

/**
 * Describes the message osaca.user.preferences.v1.MemberListState.
 * Use `create(MemberListStateSchema)` to create a new message.
 */
export const MemberListStateSchema: GenMessage<MemberListState> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 7);

/**
 * @generated from message osaca.user.preferences.v1.UnreadChannelsState
 */
export type UnreadChannelsState = Message<"osaca.user.preferences.v1.UnreadChannelsState"> & {
  /**
   * @generated from field: repeated string collapsed_channel_ids = 1;
   */
  collapsedChannelIds: string[];
};

/**
 * Describes the message osaca.user.preferences.v1.UnreadChannelsState.
 * Use `create(UnreadChannelsStateSchema)` to create a new message.
 */
export const UnreadChannelsStateSchema: GenMessage<UnreadChannelsState> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 8);

/**
 * @generated from message osaca.user.preferences.v1.RecentMentionsSettings
 */
export type RecentMentionsSettings = Message<"osaca.user.preferences.v1.RecentMentionsSettings"> & {
  /**
   * @generated from field: optional bool include_everyone = 1;
   */
  includeEveryone?: boolean | undefined;

  /**
   * @generated from field: optional bool include_roles = 2;
   */
  includeRoles?: boolean | undefined;

  /**
   * @generated from field: optional bool include_guilds = 3;
   */
  includeGuilds?: boolean | undefined;
};

/**
 * Describes the message osaca.user.preferences.v1.RecentMentionsSettings.
 * Use `create(RecentMentionsSettingsSchema)` to create a new message.
 */
export const RecentMentionsSettingsSchema: GenMessage<RecentMentionsSettings> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 9);

/**
 * @generated from message osaca.user.preferences.v1.MentionFrecencyState
 */
export type MentionFrecencyState = Message<"osaca.user.preferences.v1.MentionFrecencyState"> & {
  /**
   * @generated from field: repeated osaca.user.preferences.v1.MentionFrecencyState.Scope scopes = 1;
   */
  scopes: MentionFrecencyState_Scope[];
};

/**
 * Describes the message osaca.user.preferences.v1.MentionFrecencyState.
 * Use `create(MentionFrecencyStateSchema)` to create a new message.
 */
export const MentionFrecencyStateSchema: GenMessage<MentionFrecencyState> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 10);

/**
 * @generated from message osaca.user.preferences.v1.MentionFrecencyState.Entry
 */
export type MentionFrecencyState_Entry = Message<"osaca.user.preferences.v1.MentionFrecencyState.Entry"> & {
  /**
   * @generated from field: string user_id = 1;
   */
  userId: string;

  /**
   * @generated from field: uint32 count = 2;
   */
  count: number;

  /**
   * @generated from field: int64 last_at_ms = 3;
   */
  lastAtMs: bigint;
};

/**
 * Describes the message osaca.user.preferences.v1.MentionFrecencyState.Entry.
 * Use `create(MentionFrecencyState_EntrySchema)` to create a new message.
 */
export const MentionFrecencyState_EntrySchema: GenMessage<MentionFrecencyState_Entry> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 10, 0);

/**
 * @generated from message osaca.user.preferences.v1.MentionFrecencyState.Scope
 */
export type MentionFrecencyState_Scope = Message<"osaca.user.preferences.v1.MentionFrecencyState.Scope"> & {
  /**
   * @generated from field: string guild_id = 1;
   */
  guildId: string;

  /**
   * @generated from field: repeated osaca.user.preferences.v1.MentionFrecencyState.Entry entries = 2;
   */
  entries: MentionFrecencyState_Entry[];
};

/**
 * Describes the message osaca.user.preferences.v1.MentionFrecencyState.Scope.
 * Use `create(MentionFrecencyState_ScopeSchema)` to create a new message.
 */
export const MentionFrecencyState_ScopeSchema: GenMessage<MentionFrecencyState_Scope> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 10, 1);

/**
 * @generated from message osaca.user.preferences.v1.FavoritesState
 */
export type FavoritesState = Message<"osaca.user.preferences.v1.FavoritesState"> & {
  /**
   * @generated from field: repeated osaca.user.preferences.v1.FavoriteChannel channels = 1;
   */
  channels: FavoriteChannel[];

  /**
   * @generated from field: repeated osaca.user.preferences.v1.FavoriteCategory categories = 2;
   */
  categories: FavoriteCategory[];

  /**
   * @generated from field: repeated string collapsed_category_ids = 3;
   */
  collapsedCategoryIds: string[];

  /**
   * @generated from field: bool hide_muted_channels = 4;
   */
  hideMutedChannels: boolean;

  /**
   * @generated from field: bool muted = 5;
   */
  muted: boolean;
};

/**
 * Describes the message osaca.user.preferences.v1.FavoritesState.
 * Use `create(FavoritesStateSchema)` to create a new message.
 */
export const FavoritesStateSchema: GenMessage<FavoritesState> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 11);

/**
 * @generated from message osaca.user.preferences.v1.FavoriteChannel
 */
export type FavoriteChannel = Message<"osaca.user.preferences.v1.FavoriteChannel"> & {
  /**
   * @generated from field: string channel_id = 1;
   */
  channelId: string;

  /**
   * @generated from field: string guild_id = 2;
   */
  guildId: string;

  /**
   * @generated from field: optional string parent_id = 3;
   */
  parentId?: string | undefined;

  /**
   * @generated from field: int32 position = 4;
   */
  position: number;

  /**
   * @generated from field: optional string nickname = 5;
   */
  nickname?: string | undefined;
};

/**
 * Describes the message osaca.user.preferences.v1.FavoriteChannel.
 * Use `create(FavoriteChannelSchema)` to create a new message.
 */
export const FavoriteChannelSchema: GenMessage<FavoriteChannel> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 12);

/**
 * @generated from message osaca.user.preferences.v1.FavoriteCategory
 */
export type FavoriteCategory = Message<"osaca.user.preferences.v1.FavoriteCategory"> & {
  /**
   * @generated from field: string id = 1;
   */
  id: string;

  /**
   * @generated from field: string name = 2;
   */
  name: string;

  /**
   * @generated from field: int32 position = 3;
   */
  position: number;
};

/**
 * Describes the message osaca.user.preferences.v1.FavoriteCategory.
 * Use `create(FavoriteCategorySchema)` to create a new message.
 */
export const FavoriteCategorySchema: GenMessage<FavoriteCategory> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 13);

/**
 * @generated from message osaca.user.preferences.v1.NagbarDismissals
 */
export type NagbarDismissals = Message<"osaca.user.preferences.v1.NagbarDismissals"> & {
  /**
   * @generated from field: bool ios_install = 1;
   */
  iosInstall: boolean;

  /**
   * @generated from field: bool pwa_install = 2;
   */
  pwaInstall: boolean;

  /**
   * @generated from field: bool push_notification = 3;
   */
  pushNotification: boolean;

  /**
   * @generated from field: bool desktop_notification = 4;
   */
  desktopNotification: boolean;

  /**
   * @generated from field: bool desktop_download = 10;
   */
  desktopDownload: boolean;

  /**
   * @generated from field: bool guild_membership_cta = 11;
   */
  guildMembershipCta: boolean;

  /**
   * @generated from field: map<string, bool> pending_bulk_deletion = 15;
   */
  pendingBulkDeletion: { [key: string]: boolean };

  /**
   * @generated from field: map<string, bool> invites_disabled = 16;
   */
  invitesDisabled: { [key: string]: boolean };

  /**
   * @generated from field: map<string, bool> guild_mfa_requirement = 17;
   */
  guildMfaRequirement: { [key: string]: boolean };
};

/**
 * Describes the message osaca.user.preferences.v1.NagbarDismissals.
 * Use `create(NagbarDismissalsSchema)` to create a new message.
 */
export const NagbarDismissalsSchema: GenMessage<NagbarDismissals> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 14);

/**
 * @generated from message osaca.user.preferences.v1.GuildNsfwAgreements
 */
export type GuildNsfwAgreements = Message<"osaca.user.preferences.v1.GuildNsfwAgreements"> & {
  /**
   * @generated from field: repeated string agreed_channel_ids = 1;
   */
  agreedChannelIds: string[];

  /**
   * @generated from field: repeated string agreed_guild_ids = 2;
   */
  agreedGuildIds: string[];

  /**
   * @generated from field: repeated string agreed_category_ids = 3;
   */
  agreedCategoryIds: string[];
};

/**
 * Describes the message osaca.user.preferences.v1.GuildNsfwAgreements.
 * Use `create(GuildNsfwAgreementsSchema)` to create a new message.
 */
export const GuildNsfwAgreementsSchema: GenMessage<GuildNsfwAgreements> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 15);

/**
 * @generated from message osaca.user.preferences.v1.WhatsNewState
 */
export type WhatsNewState = Message<"osaca.user.preferences.v1.WhatsNewState"> & {
  /**
   * @generated from field: optional string last_dismissed_entry_id = 1;
   */
  lastDismissedEntryId?: string | undefined;
};

/**
 * Describes the message osaca.user.preferences.v1.WhatsNewState.
 * Use `create(WhatsNewStateSchema)` to create a new message.
 */
export const WhatsNewStateSchema: GenMessage<WhatsNewState> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 16);

/**
 * @generated from message osaca.user.preferences.v1.PermissionLayoutSettings
 */
export type PermissionLayoutSettings = Message<"osaca.user.preferences.v1.PermissionLayoutSettings"> & {
  /**
   * @generated from field: osaca.user.preferences.v1.PermissionLayoutMode layout = 1;
   */
  layout: PermissionLayoutMode;

  /**
   * @generated from field: osaca.user.preferences.v1.PermissionGridMode grid = 2;
   */
  grid: PermissionGridMode;
};

/**
 * Describes the message osaca.user.preferences.v1.PermissionLayoutSettings.
 * Use `create(PermissionLayoutSettingsSchema)` to create a new message.
 */
export const PermissionLayoutSettingsSchema: GenMessage<PermissionLayoutSettings> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 17);

/**
 * @generated from message osaca.user.preferences.v1.GuildMemberLayoutSettings
 */
export type GuildMemberLayoutSettings = Message<"osaca.user.preferences.v1.GuildMemberLayoutSettings"> & {
  /**
   * @generated from field: osaca.user.preferences.v1.GuildMemberViewMode mode = 1;
   */
  mode: GuildMemberViewMode;
};

/**
 * Describes the message osaca.user.preferences.v1.GuildMemberLayoutSettings.
 * Use `create(GuildMemberLayoutSettingsSchema)` to create a new message.
 */
export const GuildMemberLayoutSettingsSchema: GenMessage<GuildMemberLayoutSettings> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 18);

/**
 * @generated from message osaca.user.preferences.v1.GuildFolderExpandedState
 */
export type GuildFolderExpandedState = Message<"osaca.user.preferences.v1.GuildFolderExpandedState"> & {
  /**
   * @generated from field: repeated fixed64 expanded_folder_ids = 1;
   */
  expandedFolderIds: bigint[];
};

/**
 * Describes the message osaca.user.preferences.v1.GuildFolderExpandedState.
 * Use `create(GuildFolderExpandedStateSchema)` to create a new message.
 */
export const GuildFolderExpandedStateSchema: GenMessage<GuildFolderExpandedState> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 19);

/**
 * @generated from message osaca.user.preferences.v1.HiddenGuildListButtons
 */
export type HiddenGuildListButtons = Message<"osaca.user.preferences.v1.HiddenGuildListButtons"> & {
  /**
   * @generated from field: bool download_button = 1;
   */
  downloadButton: boolean;

  /**
   * @generated from field: bool help_button = 2;
   */
  helpButton: boolean;
};

/**
 * Describes the message osaca.user.preferences.v1.HiddenGuildListButtons.
 * Use `create(HiddenGuildListButtonsSchema)` to create a new message.
 */
export const HiddenGuildListButtonsSchema: GenMessage<HiddenGuildListButtons> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 20);

/**
 * @generated from message osaca.user.preferences.v1.KeyboardModeIntroState
 */
export type KeyboardModeIntroState = Message<"osaca.user.preferences.v1.KeyboardModeIntroState"> & {
  /**
   * @generated from field: bool seen = 1;
   */
  seen: boolean;
};

/**
 * Describes the message osaca.user.preferences.v1.KeyboardModeIntroState.
 * Use `create(KeyboardModeIntroStateSchema)` to create a new message.
 */
export const KeyboardModeIntroStateSchema: GenMessage<KeyboardModeIntroState> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 21);

/**
 * @generated from message osaca.user.preferences.v1.InputMonitoringPromptsState
 */
export type InputMonitoringPromptsState = Message<"osaca.user.preferences.v1.InputMonitoringPromptsState"> & {
  /**
   * @generated from field: bool seen_cta = 1;
   */
  seenCta: boolean;
};

/**
 * Describes the message osaca.user.preferences.v1.InputMonitoringPromptsState.
 * Use `create(InputMonitoringPromptsStateSchema)` to create a new message.
 */
export const InputMonitoringPromptsStateSchema: GenMessage<InputMonitoringPromptsState> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 22);

/**
 * @generated from message osaca.user.preferences.v1.VoicePromptsState
 */
export type VoicePromptsState = Message<"osaca.user.preferences.v1.VoicePromptsState"> & {
  /**
   * @generated from field: bool skip_hide_own_camera_confirm = 1;
   */
  skipHideOwnCameraConfirm: boolean;

  /**
   * @generated from field: bool skip_hide_own_screenshare_confirm = 2;
   */
  skipHideOwnScreenshareConfirm: boolean;

  /**
   * @generated from field: bool skip_p2p_join_confirm = 3;
   */
  skipP2pJoinConfirm: boolean;
};

/**
 * Describes the message osaca.user.preferences.v1.VoicePromptsState.
 * Use `create(VoicePromptsStateSchema)` to create a new message.
 */
export const VoicePromptsStateSchema: GenMessage<VoicePromptsState> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 23);

/**
 * @generated from message osaca.user.preferences.v1.AnnouncementPromptsState
 */
export type AnnouncementPromptsState = Message<"osaca.user.preferences.v1.AnnouncementPromptsState"> & {
  /**
   * @generated from field: bool hide_publish_nudge = 1;
   */
  hidePublishNudge: boolean;
};

/**
 * Describes the message osaca.user.preferences.v1.AnnouncementPromptsState.
 * Use `create(AnnouncementPromptsStateSchema)` to create a new message.
 */
export const AnnouncementPromptsStateSchema: GenMessage<AnnouncementPromptsState> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 24);

/**
 * @generated from message osaca.user.preferences.v1.SudoPromptState
 */
export type SudoPromptState = Message<"osaca.user.preferences.v1.SudoPromptState"> & {
  /**
   * @generated from field: optional osaca.user.preferences.v1.MfaMethod last_used_mfa_method = 1;
   */
  lastUsedMfaMethod?: MfaMethod | undefined;
};

/**
 * Describes the message osaca.user.preferences.v1.SudoPromptState.
 * Use `create(SudoPromptStateSchema)` to create a new message.
 */
export const SudoPromptStateSchema: GenMessage<SudoPromptState> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 25);

/**
 * @generated from message osaca.user.preferences.v1.KeybindSettings
 */
export type KeybindSettings = Message<"osaca.user.preferences.v1.KeybindSettings"> & {
  /**
   * @generated from field: repeated osaca.user.preferences.v1.CustomKeybind custom_keybinds = 1;
   */
  customKeybinds: CustomKeybind[];

  /**
   * @generated from field: string transmit_mode = 2;
   */
  transmitMode: string;

  /**
   * @generated from field: optional uint32 push_to_talk_release_delay_ms = 3;
   */
  pushToTalkReleaseDelayMs?: number | undefined;
};

/**
 * Describes the message osaca.user.preferences.v1.KeybindSettings.
 * Use `create(KeybindSettingsSchema)` to create a new message.
 */
export const KeybindSettingsSchema: GenMessage<KeybindSettings> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 26);

/**
 * @generated from message osaca.user.preferences.v1.CustomKeybind
 */
export type CustomKeybind = Message<"osaca.user.preferences.v1.CustomKeybind"> & {
  /**
   * @generated from field: string id = 1;
   */
  id: string;

  /**
   * @generated from field: optional string action = 2;
   */
  action?: string | undefined;

  /**
   * @generated from field: osaca.user.preferences.v1.KeybindCombo combo = 3;
   */
  combo?: KeybindCombo | undefined;

  /**
   * @generated from field: bool enabled = 4;
   */
  enabled: boolean;
};

/**
 * Describes the message osaca.user.preferences.v1.CustomKeybind.
 * Use `create(CustomKeybindSchema)` to create a new message.
 */
export const CustomKeybindSchema: GenMessage<CustomKeybind> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 27);

/**
 * @generated from message osaca.user.preferences.v1.KeybindCombo
 */
export type KeybindCombo = Message<"osaca.user.preferences.v1.KeybindCombo"> & {
  /**
   * @generated from field: string key = 1;
   */
  key: string;

  /**
   * @generated from field: optional string code = 2;
   */
  code?: string | undefined;

  /**
   * @generated from field: bool ctrl_or_meta = 3;
   */
  ctrlOrMeta: boolean;

  /**
   * @generated from field: bool ctrl = 4;
   */
  ctrl: boolean;

  /**
   * @generated from field: bool alt = 5;
   */
  alt: boolean;

  /**
   * @generated from field: bool shift = 6;
   */
  shift: boolean;

  /**
   * @generated from field: bool meta = 7;
   */
  meta: boolean;

  /**
   * @generated from field: optional bool global = 8;
   */
  global?: boolean | undefined;

  /**
   * @generated from field: optional bool enabled = 9;
   */
  enabled?: boolean | undefined;

  /**
   * @generated from field: bool modifier_only = 10;
   */
  modifierOnly: boolean;

  /**
   * @generated from field: bool both_sides = 11;
   */
  bothSides: boolean;

  /**
   * @generated from field: optional uint32 mouse_button = 12;
   */
  mouseButton?: number | undefined;

  /**
   * @generated from field: optional uint32 gamepad_button = 13;
   */
  gamepadButton?: number | undefined;
};

/**
 * Describes the message osaca.user.preferences.v1.KeybindCombo.
 * Use `create(KeybindComboSchema)` to create a new message.
 */
export const KeybindComboSchema: GenMessage<KeybindCombo> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 28);

/**
 * @generated from message osaca.user.preferences.v1.ChannelFrecencyEntry
 */
export type ChannelFrecencyEntry = Message<"osaca.user.preferences.v1.ChannelFrecencyEntry"> & {
  /**
   * @generated from field: uint32 total_uses = 1;
   */
  totalUses: number;

  /**
   * @generated from field: repeated int64 recent_uses_ms = 2;
   */
  recentUsesMs: bigint[];
};

/**
 * Describes the message osaca.user.preferences.v1.ChannelFrecencyEntry.
 * Use `create(ChannelFrecencyEntrySchema)` to create a new message.
 */
export const ChannelFrecencyEntrySchema: GenMessage<ChannelFrecencyEntry> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 29);

/**
 * @generated from message osaca.user.preferences.v1.ChannelFrecencyState
 */
export type ChannelFrecencyState = Message<"osaca.user.preferences.v1.ChannelFrecencyState"> & {
  /**
   * @generated from field: map<string, osaca.user.preferences.v1.ChannelFrecencyEntry> usage = 1;
   */
  usage: { [key: string]: ChannelFrecencyEntry };
};

/**
 * Describes the message osaca.user.preferences.v1.ChannelFrecencyState.
 * Use `create(ChannelFrecencyStateSchema)` to create a new message.
 */
export const ChannelFrecencyStateSchema: GenMessage<ChannelFrecencyState> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 30);

/**
 * @generated from message osaca.user.preferences.v1.ChatInputSettings
 */
export type ChatInputSettings = Message<"osaca.user.preferences.v1.ChatInputSettings"> & {
  /**
   * @generated from field: optional bool convert_emoticons = 1;
   */
  convertEmoticons?: boolean | undefined;
};

/**
 * Describes the message osaca.user.preferences.v1.ChatInputSettings.
 * Use `create(ChatInputSettingsSchema)` to create a new message.
 */
export const ChatInputSettingsSchema: GenMessage<ChatInputSettings> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 31);

/**
 * @generated from message osaca.user.preferences.v1.ReactionEmoji
 */
export type ReactionEmoji = Message<"osaca.user.preferences.v1.ReactionEmoji"> & {
  /**
   * @generated from field: optional string id = 1;
   */
  id?: string | undefined;

  /**
   * @generated from field: string name = 2;
   */
  name: string;
};

/**
 * Describes the message osaca.user.preferences.v1.ReactionEmoji.
 * Use `create(ReactionEmojiSchema)` to create a new message.
 */
export const ReactionEmojiSchema: GenMessage<ReactionEmoji> = /*@__PURE__*/
  messageDesc(file_osaca_user_preferences_v1_preferences, 32);

/**
 * @generated from enum osaca.user.preferences.v1.PermissionLayoutMode
 */
export enum PermissionLayoutMode {
  /**
   * @generated from enum value: PERMISSION_LAYOUT_MODE_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * @generated from enum value: PERMISSION_LAYOUT_MODE_COMFY = 1;
   */
  COMFY = 1,

  /**
   * @generated from enum value: PERMISSION_LAYOUT_MODE_DENSE = 2;
   */
  DENSE = 2,
}

/**
 * Describes the enum osaca.user.preferences.v1.PermissionLayoutMode.
 */
export const PermissionLayoutModeSchema: GenEnum<PermissionLayoutMode> = /*@__PURE__*/
  enumDesc(file_osaca_user_preferences_v1_preferences, 0);

/**
 * @generated from enum osaca.user.preferences.v1.PermissionGridMode
 */
export enum PermissionGridMode {
  /**
   * @generated from enum value: PERMISSION_GRID_MODE_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * @generated from enum value: PERMISSION_GRID_MODE_SINGLE = 1;
   */
  SINGLE = 1,

  /**
   * @generated from enum value: PERMISSION_GRID_MODE_GRID = 2;
   */
  GRID = 2,
}

/**
 * Describes the enum osaca.user.preferences.v1.PermissionGridMode.
 */
export const PermissionGridModeSchema: GenEnum<PermissionGridMode> = /*@__PURE__*/
  enumDesc(file_osaca_user_preferences_v1_preferences, 1);

/**
 * @generated from enum osaca.user.preferences.v1.GuildMemberViewMode
 */
export enum GuildMemberViewMode {
  /**
   * @generated from enum value: GUILD_MEMBER_VIEW_MODE_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * @generated from enum value: GUILD_MEMBER_VIEW_MODE_TABLE = 1;
   */
  TABLE = 1,

  /**
   * @generated from enum value: GUILD_MEMBER_VIEW_MODE_GRID = 2;
   */
  GRID = 2,
}

/**
 * Describes the enum osaca.user.preferences.v1.GuildMemberViewMode.
 */
export const GuildMemberViewModeSchema: GenEnum<GuildMemberViewMode> = /*@__PURE__*/
  enumDesc(file_osaca_user_preferences_v1_preferences, 2);

/**
 * @generated from enum osaca.user.preferences.v1.MfaMethod
 */
export enum MfaMethod {
  /**
   * @generated from enum value: MFA_METHOD_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * @generated from enum value: MFA_METHOD_TOTP = 1;
   */
  TOTP = 1,

  /**
   * @generated from enum value: MFA_METHOD_WEBAUTHN = 3;
   */
  WEBAUTHN = 3,
}

/**
 * Describes the enum osaca.user.preferences.v1.MfaMethod.
 */
export const MfaMethodSchema: GenEnum<MfaMethod> = /*@__PURE__*/
  enumDesc(file_osaca_user_preferences_v1_preferences, 3);

/**
 * @generated from enum osaca.user.preferences.v1.DoubleTapAction
 */
export enum DoubleTapAction {
  /**
   * @generated from enum value: DOUBLE_TAP_ACTION_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * @generated from enum value: DOUBLE_TAP_ACTION_REACT = 1;
   */
  REACT = 1,

  /**
   * @generated from enum value: DOUBLE_TAP_ACTION_EDIT = 2;
   */
  EDIT = 2,

  /**
   * @generated from enum value: DOUBLE_TAP_ACTION_NONE = 3;
   */
  NONE = 3,
}

/**
 * Describes the enum osaca.user.preferences.v1.DoubleTapAction.
 */
export const DoubleTapActionSchema: GenEnum<DoubleTapAction> = /*@__PURE__*/
  enumDesc(file_osaca_user_preferences_v1_preferences, 4);

/**
 * @generated from enum osaca.user.preferences.v1.SwipeAction
 */
export enum SwipeAction {
  /**
   * @generated from enum value: SWIPE_ACTION_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * @generated from enum value: SWIPE_ACTION_CHANNEL_DETAILS = 1;
   */
  CHANNEL_DETAILS = 1,

  /**
   * @generated from enum value: SWIPE_ACTION_REPLY = 2;
   */
  REPLY = 2,
}

/**
 * Describes the enum osaca.user.preferences.v1.SwipeAction.
 */
export const SwipeActionSchema: GenEnum<SwipeAction> = /*@__PURE__*/
  enumDesc(file_osaca_user_preferences_v1_preferences, 5);
