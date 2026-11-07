// SPDX-License-Identifier: AGPL-3.0-or-later

//! Push payload builders.
//!
//! Every message notification is a Wake-up Push: an opaque envelope that tells
//! the client "something arrived in channel X" and nothing more. The server
//! never puts message content, author names, avatars, attachment URLs or
//! channel/guild names into a push payload; the client fetches and decrypts
//! the message itself before showing anything to the user.

use crate::job::{ClearJob, MessageJob, RingJob};
use crate::metrics::PayloadShrink;
use crate::unix_seconds;
use serde_json::{Map, Value, json};

const WEB_PUSH_MARKER: u64 = 8030;
const WAKEUP_TYPE: &str = "wakeup";
const CLEAR_TYPE: &str = "notification_clear";
const CLEAR_ACTION: &str = "clear_channel";
const RING_TYPE: &str = "call_ring";
const FALLBACK_TAG: &str = "osaca-message";
const FALLBACK_TITLE: &str = "OSACA";
/// Generic, content-free text shown by operating systems that render the
/// notification before the app can decrypt anything (FCM / APNs alerts).
const WAKEUP_BODY: &str = "New message";
const APNS_CATEGORY: &str = "osaca_message";
const FCM_CLICK_ACTION: &str = "OSACA_MESSAGE";
const APNS_SOUND: &str = "default";
const APNS_ALERT_EXPIRATION_SECONDS: i64 = 86_400;
const APNS_BACKGROUND_EXPIRATION_SECONDS: i64 = 86_400;
const APNS_COLLAPSE_ID_MAX_BYTES: usize = 64;
const SHRUNK_BODY_MAX_BYTES: usize = 40;
const MINIMAL_TITLE_MAX_BYTES: usize = 120;
const MEDIA_KEYS: [&str; 2] = ["image_url", "image"];
const ICON_KEYS: [&str; 3] = ["icon", "badge", "author_avatar_url"];
/// Keys that may carry plaintext or sender metadata. They are never emitted;
/// provider payloads strip them defensively even if an envelope carries them.
const CONTENT_KEYS: [&str; 12] = [
    "title",
    "body",
    "icon",
    "image",
    "image_url",
    "author_avatar_url",
    "channel_name",
    "parent_name",
    "caller_id",
    "caller_name",
    "caller_avatar_url",
    "has_media",
];
const NOTIF_TYPE_KEY: &str = "notif_type_id";
const FORUM_THREAD_CREATED_NOTIF_TYPE: u64 = 9;
const FCM_DEFAULT_CHANNEL_ID: &str = "osaca_default_push";
const FCM_FORUM_THREAD_CREATED_CHANNEL_ID: &str = "osaca_forum_thread_created";
const MINIMAL_DATA_KEYS: [&str; 11] = [
    "type",
    "action",
    "channel_id",
    "parent_id",
    NOTIF_TYPE_KEY,
    "message_id",
    "guild_id",
    "target_user_id",
    "notification_tag",
    "url",
    "badge_count",
];

pub fn web_push_message(job: &MessageJob, target_user_id: &str, badge_count: u32) -> Value {
    let (guild_id, guild_path) = if job.is_direct_message() {
        (Value::Null, "@me")
    } else {
        (Value::String(job.guild_id.clone()), job.guild_id.as_str())
    };
    let url = format!(
        "/channels/{guild_path}/{}/{}",
        job.channel_id, job.message_id
    );
    let notification_tag = format!("channel:{}", job.channel_id);
    let tag = format!("channel:{}:{}", job.channel_id, job.message_id);
    let mut data = json!({
        "type": WAKEUP_TYPE,
        "channel_id": job.channel_id,
        "message_id": job.message_id,
        "notification_tag": notification_tag,
        "guild_id": guild_id,
        "url": url,
        "badge_count": badge_count,
        "target_user_id": target_user_id,
    });
    merge_thread_fields(&mut data, job);
    let notification = json!({
        "type": WAKEUP_TYPE,
        "title": FALLBACK_TITLE,
        "body": "",
        "tag": tag,
        "navigate": url,
        "app_badge": badge_count.to_string(),
        "data": data,
    });
    json!({
        "web_push": WEB_PUSH_MARKER,
        "type": WAKEUP_TYPE,
        "notification": notification,
        "title": FALLBACK_TITLE,
        "body": "",
        "tag": tag,
        "data": data,
    })
}

fn merge_thread_fields(data: &mut Value, job: &MessageJob) {
    let Some(object) = data.as_object_mut() else {
        return;
    };
    if let Some(parent_id) = job.parent_id.as_deref().filter(|id| !id.is_empty()) {
        object.insert("parent_id".to_owned(), parent_id.into());
    }
    if job.is_forum_thread_created() {
        object.insert(
            NOTIF_TYPE_KEY.to_owned(),
            FORUM_THREAD_CREATED_NOTIF_TYPE.into(),
        );
    }
}

pub fn web_push_clear(job: &ClearJob, badge_count: u32) -> Value {
    let tag = format!("channel:{}", job.channel_id);
    let data = json!({
        "type": CLEAR_TYPE,
        "action": CLEAR_ACTION,
        "channel_id": job.channel_id,
        "message_id": job.message_id,
        "target_user_id": job.user_id,
        "notification_tag": tag,
        "tag": tag,
        "badge_count": badge_count,
    });
    json!({
        "type": CLEAR_TYPE,
        "action": CLEAR_ACTION,
        "silent": true,
        "tag": tag,
        "notification_tag": tag,
        "data": data,
        "badge_count": badge_count,
        "web_push": WEB_PUSH_MARKER,
        "notification": {
            "tag": tag,
            "data": data,
            "silent": true,
            "close": true,
        },
    })
}

/// Incoming-call wake-up. The caller's identity is deliberately omitted; the
/// client resolves who is calling from its own state once it is awake.
pub fn web_push_call_ring(job: &RingJob) -> Value {
    let data = json!({
        "type": RING_TYPE,
        "channel_id": job.channel_id,
        "message_id": job.message_id,
        "target_user_id": job.user_id,
        "started_at_ms": job.started_at_ms,
        "expires_at_ms": job.expires_at_ms,
    });
    json!({
        "web_push": WEB_PUSH_MARKER,
        "type": RING_TYPE,
        "data": data,
    })
}

pub fn fcm_message(device_token: &str, envelope: &Value) -> Value {
    if is_clear(envelope) {
        return fcm_clear_message(device_token, envelope);
    }
    fcm_notification_message(device_token, envelope)
}

fn fcm_clear_message(device_token: &str, envelope: &Value) -> Value {
    let tag = match envelope.get("notification_tag") {
        Some(value) => value.as_str().unwrap_or(FALLBACK_TAG),
        None => envelope
            .get("tag")
            .and_then(Value::as_str)
            .unwrap_or(FALLBACK_TAG),
    };
    let mut data = stringified_data(envelope.get("data"));
    data.insert("type".to_owned(), CLEAR_TYPE.into());
    data.insert("action".to_owned(), CLEAR_ACTION.into());
    data.insert("notification_tag".to_owned(), tag.into());
    json!({
        "message": {
            "token": device_token,
            "data": data,
            "android": {
                "priority": "NORMAL",
                "ttl": "86400s",
                "collapse_key": format!("clear:{tag}"),
            },
            "fcm_options": {"analytics_label": CLEAR_TYPE},
        },
    })
}

fn fcm_notification_message(device_token: &str, envelope: &Value) -> Value {
    let tag = envelope
        .get("tag")
        .and_then(Value::as_str)
        .unwrap_or(FALLBACK_TAG);
    let mut data = stringified_data(envelope.get("data"));
    data.insert("type".to_owned(), WAKEUP_TYPE.into());
    data.insert("tag".to_owned(), tag.into());
    json!({
        "message": {
            "token": device_token,
            "notification": {"title": FALLBACK_TITLE, "body": WAKEUP_BODY},
            "data": data,
            "android": {
                "priority": "HIGH",
                "ttl": "86400s",
                "notification": {
                    "channel_id": fcm_channel_id(envelope),
                    "tag": tag,
                    "click_action": FCM_CLICK_ACTION,
                },
            },
            "fcm_options": {"analytics_label": "message_create"},
        },
    })
}

fn fcm_channel_id(envelope: &Value) -> &'static str {
    let notif_type = envelope
        .get("data")
        .and_then(|data| data.get(NOTIF_TYPE_KEY))
        .and_then(Value::as_u64);
    if notif_type == Some(FORUM_THREAD_CREATED_NOTIF_TYPE) {
        FCM_FORUM_THREAD_CREATED_CHANNEL_ID
    } else {
        FCM_DEFAULT_CHANNEL_ID
    }
}

pub fn apns_payload(envelope: &Value) -> Value {
    let data = envelope.get("data");
    let mut payload = data
        .and_then(Value::as_object)
        .cloned()
        .map(without_content)
        .unwrap_or_default();
    if is_clear(envelope) {
        payload.insert("type".to_owned(), CLEAR_TYPE.into());
        payload.insert("action".to_owned(), CLEAR_ACTION.into());
        payload.insert("aps".to_owned(), json!({"content-available": 1}));
        return Value::Object(payload);
    }
    let notification = envelope.get("notification");
    let url = data
        .and_then(|data| field(data, "url"))
        .or_else(|| notification.and_then(|value| field(value, "navigate")))
        .map(str::to_owned);
    let thread_id = data
        .and_then(|data| field(data, "notification_tag"))
        .map(str::to_owned)
        .or_else(|| {
            data.and_then(|data| field(data, "channel_id"))
                .map(|channel_id| format!("channel:{channel_id}"))
        })
        .unwrap_or_else(|| FALLBACK_TAG.to_owned());
    let mut aps = Map::new();
    aps.insert(
        "alert".to_owned(),
        json!({"title": FALLBACK_TITLE, "body": WAKEUP_BODY}),
    );
    aps.insert("sound".to_owned(), APNS_SOUND.into());
    aps.insert("thread-id".to_owned(), thread_id.into());
    aps.insert("category".to_owned(), APNS_CATEGORY.into());
    aps.insert("interruption-level".to_owned(), "active".into());
    aps.insert("relevance-score".to_owned(), Value::from(0.5));
    if let Some(badge) = badge_number(data.and_then(|data| data.get("badge_count"))) {
        aps.insert("badge".to_owned(), badge.into());
    }
    aps.insert("mutable-content".to_owned(), 1.into());
    payload.insert("type".to_owned(), WAKEUP_TYPE.into());
    payload.remove("url");
    if let Some(url) = url {
        payload.insert("url".to_owned(), url.into());
    }
    payload.insert("aps".to_owned(), Value::Object(aps));
    Value::Object(payload)
}

pub fn apns_delivery_headers(envelope: &Value) -> Vec<(String, String)> {
    let clear = is_clear(envelope);
    let expiration = unix_seconds()
        + if clear {
            APNS_BACKGROUND_EXPIRATION_SECONDS
        } else {
            APNS_ALERT_EXPIRATION_SECONDS
        };
    let mut headers = vec![
        (
            "apns-push-type".to_owned(),
            if clear { "background" } else { "alert" }.to_owned(),
        ),
        (
            "apns-priority".to_owned(),
            if clear { "5" } else { "10" }.to_owned(),
        ),
        ("apns-expiration".to_owned(), expiration.to_string()),
        ("content-type".to_owned(), "application/json".to_owned()),
    ];
    let collapse_id = field(envelope, "tag").or_else(|| {
        envelope
            .get("data")
            .and_then(|data| field(data, "message_id"))
    });
    if let Some(collapse_id) = collapse_id.filter(|id| id.len() <= APNS_COLLAPSE_ID_MAX_BYTES) {
        headers.push(("apns-collapse-id".to_owned(), collapse_id.to_owned()));
    }
    headers
}

fn stringified_data(data: Option<&Value>) -> Map<String, Value> {
    data.and_then(Value::as_object)
        .map(|data| {
            data.iter()
                .filter(|(key, _)| !CONTENT_KEYS.contains(&key.as_str()))
                .map(|(key, value)| (key.clone(), stringified(value)))
                .collect()
        })
        .unwrap_or_default()
}

fn without_content(mut data: Map<String, Value>) -> Map<String, Value> {
    data.retain(|key, _| !CONTENT_KEYS.contains(&key.as_str()));
    data
}

fn stringified(value: &Value) -> Value {
    match value {
        Value::String(text) => Value::String(text.clone()),
        Value::Null => Value::String("null".to_owned()),
        Value::Bool(flag) => Value::String(flag.to_string()),
        Value::Number(number) => Value::String(number.to_string()),
        other => Value::String(other.to_string()),
    }
}

fn field<'a>(value: &'a Value, key: &str) -> Option<&'a str> {
    value.get(key).and_then(non_empty)
}

fn badge_number(value: Option<&Value>) -> Option<u64> {
    match value? {
        Value::Number(number) => {
            let badge = number.as_f64()?;
            badge.is_finite().then(|| badge.max(0.0).trunc() as u64)
        }
        Value::String(text) => text
            .parse::<i64>()
            .ok()
            .map(|badge| badge.max(0).unsigned_abs()),
        _ => None,
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RecordKind {
    Message,
    Clear,
    Ring,
}

pub fn record_kind(envelope: &Value) -> RecordKind {
    let kind = envelope.get("type").and_then(Value::as_str);
    if kind == Some(RING_TYPE) {
        return RecordKind::Ring;
    }
    if kind == Some(CLEAR_TYPE)
        || envelope.get("action").and_then(Value::as_str) == Some(CLEAR_ACTION)
    {
        return RecordKind::Clear;
    }
    RecordKind::Message
}

pub fn is_clear(envelope: &Value) -> bool {
    matches!(record_kind(envelope), RecordKind::Clear)
}

pub fn fit(envelope: &Value, budget: usize) -> (Vec<u8>, Option<PayloadShrink>) {
    let serialized = serialize(envelope);
    if serialized.len() <= budget {
        return (serialized, None);
    }
    if matches!(record_kind(envelope), RecordKind::Ring) {
        return fit_ring(envelope, budget);
    }
    let mut working = envelope.clone();
    for step in PayloadShrink::ALL {
        working = shrink(&working, step, budget);
        let serialized = serialize(&working);
        if serialized.len() <= budget {
            return (serialized, Some(step));
        }
    }
    (serialize(&working), Some(PayloadShrink::Minimal))
}

fn fit_ring(envelope: &Value, _budget: usize) -> (Vec<u8>, Option<PayloadShrink>) {
    let mut working = envelope.clone();
    if let Some(data) = working.get_mut("data").and_then(Value::as_object_mut) {
        data.retain(|key, _| MINIMAL_DATA_KEYS.contains(&key.as_str()));
    }
    (serialize(&working), Some(PayloadShrink::Minimal))
}

fn shrink(envelope: &Value, step: PayloadShrink, budget: usize) -> Value {
    let mut working = envelope.clone();
    match step {
        PayloadShrink::Media => drop_keys(&mut working, &MEDIA_KEYS),
        PayloadShrink::Icons => drop_keys(&mut working, &ICON_KEYS),
        PayloadShrink::Body => truncate_body(&mut working),
        PayloadShrink::Minimal => working = minimal(envelope, budget),
    }
    working
}

fn minimal(envelope: &Value, budget: usize) -> Value {
    let title = truncate_bytes(
        first_text(envelope, "title").unwrap_or(FALLBACK_TITLE),
        MINIMAL_TITLE_MAX_BYTES,
    );
    let tag = first_text(envelope, "tag")
        .unwrap_or(FALLBACK_TAG)
        .to_owned();
    let url = first_text(envelope, "navigate")
        .or_else(|| {
            envelope
                .get("data")
                .and_then(|data| data.get("url"))
                .and_then(non_empty)
        })
        .unwrap_or_default()
        .to_owned();
    let data = minimal_data(envelope.get("data"));

    let candidates = [
        minimal_envelope(&title, &tag, &url, data.clone()),
        minimal_envelope(&title, &tag, "", data),
        minimal_envelope(&title, &tag, "", Map::new()),
        minimal_envelope(&title, "", "", Map::new()),
    ];
    for candidate in candidates {
        if serialize(&candidate).len() <= budget {
            return candidate;
        }
    }
    title_only(&title, budget)
}

fn minimal_envelope(title: &str, tag: &str, url: &str, data: Map<String, Value>) -> Value {
    json!({
        "web_push": WEB_PUSH_MARKER,
        "title": title,
        "tag": tag,
        "data": data,
        "notification": {
            "title": title,
            "tag": tag,
            "navigate": url,
            "data": data,
        },
    })
}

fn title_only(title: &str, budget: usize) -> Value {
    let mut allowance = title.len();
    loop {
        let candidate = json!({
            "web_push": WEB_PUSH_MARKER,
            "title": truncate_bytes(title, allowance),
        });
        if allowance == 0 || serialize(&candidate).len() <= budget {
            return candidate;
        }
        allowance -= 1;
    }
}

fn minimal_data(data: Option<&Value>) -> Map<String, Value> {
    let Some(data) = data.and_then(Value::as_object) else {
        return Map::new();
    };
    MINIMAL_DATA_KEYS
        .into_iter()
        .filter_map(|key| data.get(key).map(|value| (key.to_owned(), value.clone())))
        .collect()
}

fn drop_keys(envelope: &mut Value, keys: &[&str]) {
    for_each_block(envelope, &mut |block| {
        for key in keys {
            block.remove(*key);
        }
    });
}

fn truncate_body(envelope: &mut Value) {
    for_each_block(envelope, &mut |block| {
        let Some(body) = block.get("body").and_then(Value::as_str) else {
            return;
        };
        let shortened = truncate_bytes(body, SHRUNK_BODY_MAX_BYTES);
        block.insert("body".to_owned(), shortened.into());
    });
}

fn for_each_block(envelope: &mut Value, apply: &mut impl FnMut(&mut Map<String, Value>)) {
    let Some(root) = envelope.as_object_mut() else {
        return;
    };
    for key in ["notification", "data"] {
        if let Some(nested) = root.get_mut(key) {
            for_each_block(nested, apply);
        }
    }
    apply(root);
}

fn truncate_bytes(text: &str, max_bytes: usize) -> String {
    if text.len() <= max_bytes {
        return text.to_owned();
    }
    let mut end = max_bytes;
    while end > 0 && !text.is_char_boundary(end) {
        end -= 1;
    }
    text[..end].to_owned()
}

fn first_text<'a>(envelope: &'a Value, key: &str) -> Option<&'a str> {
    envelope
        .get(key)
        .and_then(non_empty)
        .or_else(|| envelope.get("notification")?.get(key).and_then(non_empty))
}

fn non_empty(value: &Value) -> Option<&str> {
    value.as_str().filter(|text| !text.is_empty())
}

fn serialize(value: &Value) -> Vec<u8> {
    serde_json::to_vec(value).expect("a json value serialises")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::job::{MessageJob, RingJob};

    const CHANNEL_ID: &str = "9876543210987654321";
    const MESSAGE_ID: &str = "1122334455667788990";
    const USER_ID: &str = "1234567890123456789";
    const GUILD_ID: &str = "5555555555555555555";

    /// Strings a legacy gateway used to send. None may appear in any payload.
    const LEAKS: [&str; 7] = [
        "Elias",
        "see you tomorrow",
        "avatars",
        "attachments",
        "general",
        "ideas",
        "Ada Lovelace",
    ];

    fn legacy_message_job_bytes(guild_id: &str, kind: Option<&str>) -> Vec<u8> {
        let mut job = json!({
            "v": 1,
            "guild_id": guild_id,
            "channel_id": CHANNEL_ID,
            "message_id": MESSAGE_ID,
            "notification": {
                "title": "Elias (#general, Guild)",
                "body": "see you tomorrow",
                "icon": "https://media.osaca.example/avatars/1/a.webp",
                "badge": "https://media.osaca.example/badge.png",
                "tag": format!("channel:{CHANNEL_ID}:{MESSAGE_ID}"),
                "notification_tag": format!("channel:{CHANNEL_ID}"),
                "url": format!("/channels/@me/{CHANNEL_ID}"),
                "image_url": "https://media.osaca.example/attachments/1/2/cat.png",
            },
            "user_ids": [USER_ID],
            "parent_id": "200",
            "parent_name": "general",
            "channel_name": "ideas",
        });
        if let Some(kind) = kind {
            job["kind"] = kind.into();
        }
        job.to_string().into_bytes()
    }

    fn message_job(guild_id: &str) -> MessageJob {
        crate::job::decode_message(&legacy_message_job_bytes(guild_id, None)).expect("decodes")
    }

    fn ring_job() -> RingJob {
        crate::job::decode_ring(
            json!({
                "v": 1,
                "user_id": USER_ID,
                "channel_id": CHANNEL_ID,
                "message_id": MESSAGE_ID,
                "started_at_ms": 1,
                "expires_at_ms": 2,
                "caller_id": "42",
                "caller_name": "Ada Lovelace",
                "caller_avatar_url": "https://media.osaca.example/avatars/42/a.webp",
            })
            .to_string()
            .as_bytes(),
        )
        .expect("decodes")
    }

    fn assert_no_leaks(payload: &Value) {
        let serialized = payload.to_string();
        for leak in LEAKS {
            assert!(
                !serialized.contains(leak),
                "payload leaks {leak:?}: {serialized}"
            );
        }
        for key in [
            "author_avatar_url",
            "image_url",
            "channel_name",
            "parent_name",
            "caller_id",
            "caller_name",
            "caller_avatar_url",
            "icon",
            "image",
        ] {
            assert!(
                !serialized.contains(&format!("\"{key}\"")),
                "payload carries {key:?}: {serialized}"
            );
        }
    }

    fn envelope(guild_id: &str) -> Value {
        web_push_message(&message_job(guild_id), USER_ID, 3)
    }

    #[test]
    fn a_web_push_message_is_an_opaque_wakeup() {
        let envelope = envelope("0");
        assert_eq!(envelope["type"], json!("wakeup"));
        assert_eq!(envelope["data"]["type"], json!("wakeup"));
        assert_eq!(envelope["title"], json!("OSACA"));
        assert_eq!(envelope["body"], json!(""));
        assert_eq!(envelope["notification"]["body"], json!(""));
        assert_eq!(envelope["data"]["channel_id"], json!(CHANNEL_ID));
        assert_eq!(envelope["data"]["message_id"], json!(MESSAGE_ID));
        assert_eq!(envelope["data"]["guild_id"], Value::Null);
        assert_eq!(
            envelope["data"]["url"],
            json!(format!("/channels/@me/{CHANNEL_ID}/{MESSAGE_ID}"))
        );
        assert_no_leaks(&envelope);
    }

    #[test]
    fn a_guild_web_push_message_routes_without_names() {
        let envelope = envelope(GUILD_ID);
        assert_eq!(envelope["data"]["guild_id"], json!(GUILD_ID));
        assert_eq!(envelope["data"]["parent_id"], json!("200"));
        assert_no_leaks(&envelope);
    }

    #[test]
    fn an_fcm_message_carries_no_content_or_sender() {
        for guild_id in ["0", GUILD_ID] {
            let message = fcm_message("device-token", &envelope(guild_id));
            assert_eq!(message["message"]["notification"]["title"], json!("OSACA"));
            assert_eq!(
                message["message"]["notification"]["body"],
                json!(WAKEUP_BODY)
            );
            assert_eq!(message["message"]["data"]["type"], json!("wakeup"));
            assert_no_leaks(&message);
        }
    }

    #[test]
    fn an_apns_payload_carries_no_content_or_sender() {
        for guild_id in ["0", GUILD_ID] {
            let payload = apns_payload(&envelope(guild_id));
            assert_eq!(payload["aps"]["alert"]["title"], json!("OSACA"));
            assert_eq!(payload["aps"]["alert"]["body"], json!(WAKEUP_BODY));
            assert_eq!(payload["type"], json!("wakeup"));
            assert_no_leaks(&payload);
        }
    }

    #[test]
    fn provider_payloads_strip_content_smuggled_into_an_envelope() {
        let mut smuggled = envelope("0");
        smuggled["title"] = json!("Elias");
        smuggled["body"] = json!("see you tomorrow");
        smuggled["image_url"] = json!("https://media.osaca.example/attachments/x.png");
        smuggled["data"]["channel_name"] = json!("general");
        smuggled["data"]["author_avatar_url"] = json!("https://x/avatars/1.webp");
        smuggled["notification"]["body"] = json!("see you tomorrow");
        assert_no_leaks(&fcm_message("device-token", &smuggled));
        assert_no_leaks(&apns_payload(&smuggled));
    }

    #[test]
    fn a_call_ring_does_not_reveal_the_caller() {
        let ring = web_push_call_ring(&ring_job());
        assert_eq!(ring["type"], json!("call_ring"));
        assert_eq!(ring["data"]["channel_id"], json!(CHANNEL_ID));
        assert_no_leaks(&ring);
    }

    #[test]
    fn a_forum_thread_wakeup_keeps_its_android_channel() {
        let job = crate::job::decode_message(&legacy_message_job_bytes(
            GUILD_ID,
            Some("forum_thread_created"),
        ))
        .expect("decodes");
        let message = fcm_message("device-token", &web_push_message(&job, USER_ID, 1));
        assert_eq!(
            message["message"]["android"]["notification"]["channel_id"],
            json!(FCM_FORUM_THREAD_CREATED_CHANNEL_ID)
        );
        assert_no_leaks(&message);
    }

    #[test]
    fn the_apns_category_is_the_identifier_the_app_registers() {
        assert_eq!(
            apns_payload(&envelope("0"))["aps"]["category"],
            json!("osaca_message")
        );
    }

    #[test]
    fn the_android_click_action_keeps_its_own_identifier() {
        let message = fcm_message("device-token", &envelope("0"));
        assert_eq!(
            message["message"]["android"]["notification"]["click_action"],
            json!("OSACA_MESSAGE")
        );
    }

    #[test]
    fn a_wakeup_fits_a_tight_budget_without_leaking() {
        let (bytes, _) = fit(&envelope(GUILD_ID), 200);
        let fitted: Value = serde_json::from_slice(&bytes).expect("json");
        assert!(bytes.len() <= 200, "{} bytes", bytes.len());
        assert_no_leaks(&fitted);
    }
}
