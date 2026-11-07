// SPDX-License-Identifier: AGPL-3.0-or-later

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::collections::HashMap;

use crate::group::{DeviceSession, MlsGroupSession, ProcessedMessageOutput};
use crate::identity::{AccountKeyBundle, IdentityKey};
use crate::recovery::{decrypt_recovery_bundle, encrypt_recovery_bundle, generate_recovery_secret};

const RESULT_HEADER_BYTES: usize = 16;

static NEXT_HANDLE: AtomicU64 = AtomicU64::new(1);

// Handle tables for stateful MLS sessions across WASM FFI
static DEVICE_STORE: Mutex<Option<HashMap<u64, DeviceSession>>> = Mutex::new(None);
static GROUP_STORE: Mutex<Option<HashMap<u64, MlsGroupSession>>> = Mutex::new(None);

fn with_device_store<R>(f: impl FnOnce(&mut HashMap<u64, DeviceSession>) -> R) -> R {
    let mut lock = DEVICE_STORE.lock().unwrap();
    let map = lock.get_or_insert_with(HashMap::new);
    f(map)
}

fn with_group_store<R>(f: impl FnOnce(&mut HashMap<u64, MlsGroupSession>) -> R) -> R {
    let mut lock = GROUP_STORE.lock().unwrap();
    let map = lock.get_or_insert_with(HashMap::new);
    f(map)
}

#[unsafe(no_mangle)]
pub extern "C" fn crypto_alloc(len: u32) -> u32 {
    if len == 0 {
        return 0;
    }
    let Ok(len) = usize::try_from(len) else {
        return 0;
    };
    let mut bytes = Vec::new();
    if bytes.try_reserve_exact(len).is_err() {
        return 0;
    }
    bytes.resize(len, 0);
    leak_u8_boxed_slice(bytes.into_boxed_slice()).unwrap_or(0)
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn crypto_free(ptr: u32, len: u32) {
    if ptr == 0 || len == 0 {
        return;
    }
    let Ok(len) = usize::try_from(len) else {
        return;
    };
    let ptr = ptr as usize as *mut u8;
    unsafe {
        drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len)));
    }
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn crypto_identity_generate(
    account_id_ptr: u32,
    account_id_len: u32,
    out_ptr: u32,
) -> u32 {
    let Some(account_id) = (unsafe { read_utf8(account_id_ptr, account_id_len) }) else {
        return unsafe { set_error_result(out_ptr, "invalid account_id utf8") };
    };
    let identity = IdentityKey::generate(account_id);
    let json = match serde_json::to_vec(&serde_json::json!({
        "account_id": identity.account_id(),
        "seed": identity.seed().to_vec(),
        "public_key_bytes": identity.public_key_bytes().to_vec(),
        "public_key_hex": identity.public_key_hex(),
    })) {
        Ok(j) => j,
        Err(e) => return unsafe { set_error_result(out_ptr, &e.to_string()) },
    };
    unsafe { set_bytes_result(out_ptr, json) }
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn crypto_identity_from_seed(
    account_id_ptr: u32,
    account_id_len: u32,
    seed_ptr: u32,
    seed_len: u32,
    out_ptr: u32,
) -> u32 {
    let Some(account_id) = (unsafe { read_utf8(account_id_ptr, account_id_len) }) else {
        return unsafe { set_error_result(out_ptr, "invalid account_id utf8") };
    };
    let Some(seed_bytes) = (unsafe { read_bytes(seed_ptr, seed_len) }) else {
        return unsafe { set_error_result(out_ptr, "invalid seed bytes") };
    };
    if seed_bytes.len() != 32 {
        return unsafe { set_error_result(out_ptr, "seed must be exactly 32 bytes") };
    }
    let mut seed = [0u8; 32];
    seed.copy_from_slice(seed_bytes);
    let identity = IdentityKey::from_seed(account_id, seed);
    let json = match serde_json::to_vec(&serde_json::json!({
        "account_id": identity.account_id(),
        "seed": identity.seed().to_vec(),
        "public_key_bytes": identity.public_key_bytes().to_vec(),
        "public_key_hex": identity.public_key_hex(),
    })) {
        Ok(j) => j,
        Err(e) => return unsafe { set_error_result(out_ptr, &e.to_string()) },
    };
    unsafe { set_bytes_result(out_ptr, json) }
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn crypto_recovery_secret_generate(out_ptr: u32) -> u32 {
    let secret = generate_recovery_secret();
    unsafe { set_bytes_result(out_ptr, secret.to_vec()) }
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn crypto_recovery_encrypt(
    secret_ptr: u32,
    secret_len: u32,
    bundle_json_ptr: u32,
    bundle_json_len: u32,
    out_ptr: u32,
) -> u32 {
    let Some(secret) = (unsafe { read_bytes(secret_ptr, secret_len) }) else {
        return unsafe { set_error_result(out_ptr, "invalid secret bytes") };
    };
    let Some(bundle_bytes) = (unsafe { read_bytes(bundle_json_ptr, bundle_json_len) }) else {
        return unsafe { set_error_result(out_ptr, "invalid bundle bytes") };
    };
    let bundle: AccountKeyBundle = match serde_json::from_slice(bundle_bytes) {
        Ok(b) => b,
        Err(e) => return unsafe { set_error_result(out_ptr, &e.to_string()) },
    };
    match encrypt_recovery_bundle(secret, &bundle) {
        Ok(enc) => unsafe { set_bytes_result(out_ptr, enc) },
        Err(e) => unsafe { set_error_result(out_ptr, &e.to_string()) },
    }
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn crypto_recovery_decrypt(
    secret_ptr: u32,
    secret_len: u32,
    payload_ptr: u32,
    payload_len: u32,
    out_ptr: u32,
) -> u32 {
    let Some(secret) = (unsafe { read_bytes(secret_ptr, secret_len) }) else {
        return unsafe { set_error_result(out_ptr, "invalid secret bytes") };
    };
    let Some(payload) = (unsafe { read_bytes(payload_ptr, payload_len) }) else {
        return unsafe { set_error_result(out_ptr, "invalid payload bytes") };
    };
    match decrypt_recovery_bundle(secret, payload) {
        Ok(bundle) => match serde_json::to_vec(&bundle) {
            Ok(json) => unsafe { set_bytes_result(out_ptr, json) },
            Err(e) => unsafe { set_error_result(out_ptr, &e.to_string()) },
        },
        Err(e) => unsafe { set_error_result(out_ptr, &e.to_string()) },
    }
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn crypto_device_create(
    account_id_ptr: u32,
    account_id_len: u32,
    device_id_ptr: u32,
    device_id_len: u32,
    out_ptr: u32,
) -> u32 {
    let Some(account_id) = (unsafe { read_utf8(account_id_ptr, account_id_len) }) else {
        return unsafe { set_error_result(out_ptr, "invalid account_id utf8") };
    };
    let Some(device_id) = (unsafe { read_utf8(device_id_ptr, device_id_len) }) else {
        return unsafe { set_error_result(out_ptr, "invalid device_id utf8") };
    };

    match DeviceSession::new(account_id, device_id) {
        Ok(session) => {
            let handle = NEXT_HANDLE.fetch_add(1, Ordering::Relaxed);
            with_device_store(|store| store.insert(handle, session));
            let json = serde_json::to_vec(&serde_json::json!({ "handle": handle })).unwrap();
            unsafe { set_bytes_result(out_ptr, json) }
        }
        Err(e) => unsafe { set_error_result(out_ptr, &e.to_string()) },
    }
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn crypto_device_generate_key_package(
    handle: u64,
    out_ptr: u32,
) -> u32 {
    let kp_res = with_device_store(|store| {
        let Some(device) = store.get(&handle) else {
            return Err("device handle not found".to_string());
        };
        device.generate_key_package().map_err(|e| e.to_string())
    });

    match kp_res {
        Ok(kp_bytes) => unsafe { set_bytes_result(out_ptr, kp_bytes) },
        Err(e) => unsafe { set_error_result(out_ptr, &e) },
    }
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn crypto_group_create(
    device_handle: u64,
    group_id_ptr: u32,
    group_id_len: u32,
    out_ptr: u32,
) -> u32 {
    let Some(group_id) = (unsafe { read_bytes(group_id_ptr, group_id_len) }) else {
        return unsafe { set_error_result(out_ptr, "invalid group_id bytes") };
    };

    let group_res = with_device_store(|store| {
        let Some(device) = store.get(&device_handle) else {
            return Err("device handle not found".to_string());
        };
        MlsGroupSession::create(device, group_id).map_err(|e| e.to_string())
    });

    match group_res {
        Ok(group_session) => {
            let handle = NEXT_HANDLE.fetch_add(1, Ordering::Relaxed);
            let epoch = group_session.epoch();
            with_group_store(|store| store.insert(handle, group_session));
            let json = serde_json::to_vec(&serde_json::json!({
                "handle": handle,
                "epoch": epoch,
            }))
            .unwrap();
            unsafe { set_bytes_result(out_ptr, json) }
        }
        Err(e) => unsafe { set_error_result(out_ptr, &e) },
    }
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn crypto_group_join_welcome(
    device_handle: u64,
    welcome_ptr: u32,
    welcome_len: u32,
    out_ptr: u32,
) -> u32 {
    let Some(welcome_bytes) = (unsafe { read_bytes(welcome_ptr, welcome_len) }) else {
        return unsafe { set_error_result(out_ptr, "invalid welcome bytes") };
    };

    let group_res = with_device_store(|store| {
        let Some(device) = store.get(&device_handle) else {
            return Err("device handle not found".to_string());
        };
        MlsGroupSession::join_from_welcome(device, welcome_bytes).map_err(|e| e.to_string())
    });

    match group_res {
        Ok(group_session) => {
            let handle = NEXT_HANDLE.fetch_add(1, Ordering::Relaxed);
            let epoch = group_session.epoch();
            with_group_store(|store| store.insert(handle, group_session));
            let json = serde_json::to_vec(&serde_json::json!({
                "handle": handle,
                "epoch": epoch,
            }))
            .unwrap();
            unsafe { set_bytes_result(out_ptr, json) }
        }
        Err(e) => unsafe { set_error_result(out_ptr, &e) },
    }
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn crypto_group_add_member(
    group_handle: u64,
    key_package_ptr: u32,
    key_package_len: u32,
    out_ptr: u32,
) -> u32 {
    let Some(kp_bytes) = (unsafe { read_bytes(key_package_ptr, key_package_len) }) else {
        return unsafe { set_error_result(out_ptr, "invalid key_package bytes") };
    };

    let add_res = with_group_store(|store| {
        let Some(group) = store.get_mut(&group_handle) else {
            return Err("group handle not found".to_string());
        };
        group.add_member(kp_bytes).map_err(|e| e.to_string())
    });

    match add_res {
        Ok(res) => {
            let json = serde_json::to_vec(&serde_json::json!({
                "commit": res.commit,
                "welcome": res.welcome,
                "epoch": res.epoch,
            }))
            .unwrap();
            unsafe { set_bytes_result(out_ptr, json) }
        }
        Err(e) => unsafe { set_error_result(out_ptr, &e) },
    }
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn crypto_group_remove_member(
    group_handle: u64,
    leaf_index: u32,
    out_ptr: u32,
) -> u32 {
    let remove_res = with_group_store(|store| {
        let Some(group) = store.get_mut(&group_handle) else {
            return Err("group handle not found".to_string());
        };
        group.remove_member(leaf_index).map_err(|e| e.to_string())
    });

    match remove_res {
        Ok(commit) => unsafe { set_bytes_result(out_ptr, commit) },
        Err(e) => unsafe { set_error_result(out_ptr, &e) },
    }
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn crypto_group_encrypt(
    group_handle: u64,
    plaintext_ptr: u32,
    plaintext_len: u32,
    out_ptr: u32,
) -> u32 {
    let Some(plaintext) = (unsafe { read_bytes(plaintext_ptr, plaintext_len) }) else {
        return unsafe { set_error_result(out_ptr, "invalid plaintext bytes") };
    };

    let enc_res = with_group_store(|store| {
        let Some(group) = store.get_mut(&group_handle) else {
            return Err("group handle not found".to_string());
        };
        group.encrypt_message(plaintext).map_err(|e| e.to_string())
    });

    match enc_res {
        Ok(ciphertext) => unsafe { set_bytes_result(out_ptr, ciphertext) },
        Err(e) => unsafe { set_error_result(out_ptr, &e) },
    }
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn crypto_group_decrypt(
    group_handle: u64,
    ciphertext_ptr: u32,
    ciphertext_len: u32,
    out_ptr: u32,
) -> u32 {
    let Some(ciphertext) = (unsafe { read_bytes(ciphertext_ptr, ciphertext_len) }) else {
        return unsafe { set_error_result(out_ptr, "invalid ciphertext bytes") };
    };

    let dec_res = with_group_store(|store| {
        let Some(group) = store.get_mut(&group_handle) else {
            return Err("group handle not found".to_string());
        };
        group.decrypt_message(ciphertext).map_err(|e| e.to_string())
    });

    match dec_res {
        Ok(plaintext) => unsafe { set_bytes_result(out_ptr, plaintext) },
        Err(e) => unsafe { set_error_result(out_ptr, &e) },
    }
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn crypto_group_process_message(
    group_handle: u64,
    msg_ptr: u32,
    msg_len: u32,
    out_ptr: u32,
) -> u32 {
    let Some(msg_bytes) = (unsafe { read_bytes(msg_ptr, msg_len) }) else {
        return unsafe { set_error_result(out_ptr, "invalid message bytes") };
    };

    let proc_res = with_group_store(|store| {
        let Some(group) = store.get_mut(&group_handle) else {
            return Err("group handle not found".to_string());
        };
        group.process_message(msg_bytes).map_err(|e| e.to_string())
    });

    match proc_res {
        Ok(out) => {
            let json = match out {
                ProcessedMessageOutput::ApplicationMessage { epoch, plaintext } => {
                    serde_json::to_vec(&serde_json::json!({
                        "kind": "application",
                        "epoch": epoch,
                        "plaintext": plaintext,
                    }))
                    .unwrap()
                }
                ProcessedMessageOutput::Commit { new_epoch } => {
                    serde_json::to_vec(&serde_json::json!({
                        "kind": "commit",
                        "epoch": new_epoch,
                    }))
                    .unwrap()
                }
                ProcessedMessageOutput::Other => {
                    serde_json::to_vec(&serde_json::json!({
                        "kind": "other",
                    }))
                    .unwrap()
                }
            };
            unsafe { set_bytes_result(out_ptr, json) }
        }
        Err(e) => unsafe { set_error_result(out_ptr, &e) },
    }
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn crypto_group_epoch(group_handle: u64) -> u64 {
    with_group_store(|store| store.get(&group_handle).map(|g| g.epoch()).unwrap_or(0))
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn crypto_group_members(group_handle: u64, out_ptr: u32) -> u32 {
    let members_res = with_group_store(|store| {
        let Some(group) = store.get(&group_handle) else {
            return Err("group handle not found".to_string());
        };
        Ok(group.members())
    });

    match members_res {
        Ok(members) => {
            let json = serde_json::to_vec(&members).unwrap();
            unsafe { set_bytes_result(out_ptr, json) }
        }
        Err(e) => unsafe { set_error_result(out_ptr, &e) },
    }
}

unsafe fn read_utf8<'a>(ptr: u32, len: u32) -> Option<&'a str> {
    if ptr == 0 || len == 0 {
        return Some("");
    }
    let Ok(len) = usize::try_from(len) else {
        return None;
    };
    let ptr = ptr as usize as *const u8;
    let bytes = unsafe { std::slice::from_raw_parts(ptr, len) };
    std::str::from_utf8(bytes).ok()
}

unsafe fn read_bytes<'a>(ptr: u32, len: u32) -> Option<&'a [u8]> {
    if ptr == 0 || len == 0 {
        return Some(&[]);
    }
    let Ok(len) = usize::try_from(len) else {
        return None;
    };
    let ptr = ptr as usize as *const u8;
    Some(unsafe { std::slice::from_raw_parts(ptr, len) })
}

fn write_u32_le(output: &mut [u8], offset: usize, value: u32) {
    output[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
}

unsafe fn write_result_header(
    out_ptr: u32,
    data_ptr: u32,
    data_len: u32,
    err_ptr: u32,
    err_len: u32,
) -> u32 {
    if out_ptr == 0 {
        return 1;
    }
    let out_ptr = out_ptr as usize as *mut u8;
    let output = unsafe { std::slice::from_raw_parts_mut(out_ptr, RESULT_HEADER_BYTES) };
    write_u32_le(output, 0, data_ptr);
    write_u32_le(output, 4, data_len);
    write_u32_le(output, 8, err_ptr);
    write_u32_le(output, 12, err_len);
    0
}

unsafe fn set_bytes_result(out_ptr: u32, bytes: Vec<u8>) -> u32 {
    if bytes.len() > u32::MAX as usize {
        return unsafe { set_error_result(out_ptr, "result is too large") };
    }
    let len = bytes.len();
    let ptr = match leak_result_bytes(bytes) {
        Ok(ptr) => ptr,
        Err(()) => return unsafe { set_error_result(out_ptr, "result pointer is too large") },
    };
    unsafe { write_result_header(out_ptr, ptr, len as u32, 0, 0) }
}

unsafe fn set_error_result(out_ptr: u32, message: &str) -> u32 {
    let message = message.as_bytes();
    let mut bytes = Vec::new();
    if bytes.try_reserve_exact(message.len()).is_err() {
        return unsafe { write_result_header(out_ptr, 0, 0, 0, 0) }.max(1);
    }
    bytes.extend_from_slice(message);
    let len = bytes.len();
    let ptr = match leak_result_bytes(bytes) {
        Ok(ptr) => ptr,
        Err(()) => return unsafe { write_result_header(out_ptr, 0, 0, 0, 0) }.max(1),
    };
    let _ = unsafe { write_result_header(out_ptr, 0, 0, ptr, len as u32) };
    1
}

fn leak_result_bytes(bytes: Vec<u8>) -> Result<u32, ()> {
    if bytes.is_empty() {
        return Ok(0);
    }
    leak_u8_boxed_slice(bytes.into_boxed_slice()).ok_or(())
}

fn leak_u8_boxed_slice(bytes: Box<[u8]>) -> Option<u32> {
    let mut bytes = bytes;
    let ptr = u32::try_from(bytes.as_mut_ptr() as usize).ok()?;
    Box::leak(bytes);
    Some(ptr)
}
