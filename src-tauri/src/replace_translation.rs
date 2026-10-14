use crate::clipboard::{ClipboardMonitorSuppressWrapper, ClipboardMonitorSuppression};
use crate::clipboard_backup::{backup_clipboard, restore_clipboard_with_retry};
use crate::APP;
use arboard::Clipboard;
use enigo::{
    Direction::{Click, Press, Release},
    Enigo, Key, Keyboard, Settings,
};
use log::{info, warn};
use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Manager, State};

static NEXT_REQUEST_ID: AtomicU64 = AtomicU64::new(1);
const CLIPBOARD_RESTORE_DELAY: Duration = Duration::from_millis(500);

#[derive(Clone, Debug)]
struct PendingReplaceTranslation {
    request_id: u64,
    source_text: String,
    foreground_window: isize,
}

#[derive(Default)]
pub struct ReplaceTranslationState(Mutex<Option<PendingReplaceTranslation>>);

#[derive(Clone, Serialize)]
struct ReplaceTranslationRequest {
    request_id: u64,
    text: String,
}

#[cfg(target_os = "windows")]
fn foreground_window_id() -> isize {
    unsafe { windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow().0 as isize }
}

#[cfg(not(target_os = "windows"))]
fn foreground_window_id() -> isize {
    0
}

fn clear_pending_request(state: &ReplaceTranslationState, request_id: u64) {
    let mut pending = state.0.lock().unwrap();
    if pending
        .as_ref()
        .is_some_and(|pending| pending.request_id == request_id)
    {
        *pending = None;
    }
}

fn combine_paste_and_restore_results(
    paste_result: Result<(), String>,
    restore_result: Result<(), String>,
) -> Result<(), String> {
    match (paste_result, restore_result) {
        (Ok(()), Ok(())) => Ok(()),
        (Err(paste_error), Ok(())) => Err(paste_error),
        (Ok(()), Err(restore_error)) => {
            Err(format!("Failed to restore clipboard: {}", restore_error))
        }
        (Err(paste_error), Err(restore_error)) => Err(format!(
            "{}; additionally failed to restore clipboard: {}",
            paste_error, restore_error
        )),
    }
}

fn paste_from_clipboard() -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|error| error.to_string())?;

    #[cfg(target_os = "macos")]
    let modifier = Key::Meta;
    #[cfg(not(target_os = "macos"))]
    let modifier = Key::Control;

    #[cfg(target_os = "windows")]
    let paste_key = Key::V;
    #[cfg(not(target_os = "windows"))]
    let paste_key = Key::Unicode('v');

    enigo
        .key(modifier, Press)
        .map_err(|error| error.to_string())?;
    let paste_result = enigo
        .key(paste_key, Click)
        .map_err(|error| error.to_string());
    let release_result = enigo
        .key(modifier, Release)
        .map_err(|error| error.to_string());
    paste_result?;
    release_result
}

pub fn request_replace_translation() {
    let app_handle = APP.get().unwrap();
    let suppress_state = app_handle.state::<ClipboardMonitorSuppressWrapper>();
    let _suppression = ClipboardMonitorSuppression::new(&suppress_state);
    let text = selection::get_text();
    drop(_suppression);
    request_replace_translation_with_text(text);
}

// Starts a replacement translation for text that was already read from the foreground window's selection.
pub fn request_replace_translation_with_text(text: String) {
    if text.trim().is_empty() {
        return;
    }
    let app_handle = APP.get().unwrap();

    let request_id = NEXT_REQUEST_ID.fetch_add(1, Ordering::Relaxed);
    let pending = PendingReplaceTranslation {
        request_id,
        source_text: text.clone(),
        foreground_window: foreground_window_id(),
    };
    let state = app_handle.state::<ReplaceTranslationState>();
    *state.0.lock().unwrap() = Some(pending);

    let Some(daemon_window) = app_handle.get_window("daemon") else {
        clear_pending_request(&state, request_id);
        warn!("Daemon window not found for replacement translation");
        return;
    };

    if let Err(error) = daemon_window.emit(
        "replace_translate_request",
        ReplaceTranslationRequest { request_id, text },
    ) {
        clear_pending_request(&state, request_id);
        warn!("Failed to emit replacement translation request: {}", error);
    }
}

#[tauri::command]
pub fn replace_selected_text(
    request_id: u64,
    source_text: String,
    translated_text: String,
    state: State<ReplaceTranslationState>,
    suppress_state: State<ClipboardMonitorSuppressWrapper>,
) -> Result<(), String> {
    let pending =
        state.0.lock().unwrap().clone().ok_or_else(|| {
            "[stale replacement request] The request is no longer active".to_string()
        })?;

    if pending.request_id != request_id || pending.source_text != source_text {
        return Err(
            "[stale replacement request] A newer request superseded this result".to_string(),
        );
    }
    if pending.foreground_window != foreground_window_id() {
        clear_pending_request(&state, request_id);
        return Err("The active window changed before translation completed".to_string());
    }
    if translated_text.trim().is_empty() {
        clear_pending_request(&state, request_id);
        return Err("The translation result is empty".to_string());
    }

    let _suppression = ClipboardMonitorSuppression::new(&suppress_state);
    let current_selection = selection::get_text();
    if current_selection != pending.source_text {
        clear_pending_request(&state, request_id);
        return Err("The selected text changed before translation completed".to_string());
    }

    clear_pending_request(&state, request_id);
    let mut clipboard = Clipboard::new().map_err(|error| error.to_string())?;
    let backup = backup_clipboard(&mut clipboard);
    clipboard
        .set_text(translated_text.clone())
        .map_err(|error| error.to_string())?;
    let paste_result = paste_from_clipboard();
    if paste_result.is_ok() {
        // Give slower applications time to consume the paste before restoring
        // the user's clipboard. A user change during this interval still wins.
        std::thread::sleep(CLIPBOARD_RESTORE_DELAY);
    }

    // Do not overwrite a clipboard value the user changed while the paste was
    // being delivered. A failed paste restores immediately because this function
    // is the operation that placed the translated text on the clipboard.
    let should_restore = paste_result.is_err()
        || clipboard.get_text().ok().as_deref() == Some(translated_text.as_str());
    let restore_result = if should_restore {
        restore_clipboard_with_retry(&mut clipboard, &backup)
    } else {
        Ok(())
    };
    combine_paste_and_restore_results(paste_result, restore_result)?;

    info!("Replacement translation pasted successfully");
    Ok(())
}

#[tauri::command]
pub fn cancel_replace_translation(request_id: u64, state: State<ReplaceTranslationState>) {
    clear_pending_request(&state, request_id);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clearing_an_old_request_does_not_cancel_the_latest_one() {
        let state = ReplaceTranslationState::default();
        *state.0.lock().unwrap() = Some(PendingReplaceTranslation {
            request_id: 2,
            source_text: "new".to_string(),
            foreground_window: 1,
        });

        clear_pending_request(&state, 1);
        assert_eq!(state.0.lock().unwrap().as_ref().unwrap().request_id, 2);

        clear_pending_request(&state, 2);
        assert!(state.0.lock().unwrap().is_none());
    }

    #[test]
    fn paste_errors_are_preserved_when_clipboard_restore_succeeds() {
        let result = combine_paste_and_restore_results(Err("paste failed".to_string()), Ok(()));
        assert_eq!(result, Err("paste failed".to_string()));
    }

    #[test]
    fn paste_and_restore_errors_are_both_reported() {
        let result = combine_paste_and_restore_results(
            Err("paste failed".to_string()),
            Err("clipboard busy".to_string()),
        );
        assert_eq!(
            result,
            Err(
                "paste failed; additionally failed to restore clipboard: clipboard busy"
                    .to_string()
            )
        );
    }
}
