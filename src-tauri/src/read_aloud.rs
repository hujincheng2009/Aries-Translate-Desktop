use crate::clipboard::{ClipboardMonitorSuppressWrapper, ClipboardMonitorSuppression};
use crate::window::read_aloud_window;
use crate::APP;
use log::warn;
use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::{Manager, State};

static NEXT_READ_ALOUD_REQUEST_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Debug, Serialize)]
pub struct ReadAloudRequest {
    request_id: u64,
    text: String,
}

#[derive(Default)]
pub struct ReadAloudState(Mutex<Option<ReadAloudRequest>>);

pub fn request_read_aloud() {
    let app_handle = APP.get().unwrap();
    let suppress_state = app_handle.state::<ClipboardMonitorSuppressWrapper>();
    let _suppression = ClipboardMonitorSuppression::new(&suppress_state);
    let text = selection::get_text();
    if text.trim().is_empty() {
        return;
    }

    let request = ReadAloudRequest {
        request_id: NEXT_READ_ALOUD_REQUEST_ID.fetch_add(1, Ordering::Relaxed),
        text,
    };
    let state = app_handle.state::<ReadAloudState>();
    *state.0.lock().unwrap() = Some(request.clone());

    let window = read_aloud_window();
    if let Err(error) = window.unminimize() {
        warn!("Failed to restore read-aloud window: {}", error);
    }
    if let Err(error) = window.show() {
        warn!("Failed to show read-aloud window: {}", error);
    }
    if let Err(error) = window.set_focus() {
        warn!("Failed to focus read-aloud window: {}", error);
    }
    if let Err(error) = window.emit("read_aloud_request", request) {
        warn!("Failed to emit read-aloud request: {}", error);
    }
}

#[tauri::command]
pub fn get_read_aloud_request(state: State<ReadAloudState>) -> Option<ReadAloudRequest> {
    state.0.lock().unwrap().clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_aloud_state_returns_the_latest_request() {
        let state = ReadAloudState::default();
        *state.0.lock().unwrap() = Some(ReadAloudRequest {
            request_id: 7,
            text: "Zażółć gęślą jaźń".to_string(),
        });

        let request = state.0.lock().unwrap().clone().unwrap();
        assert_eq!(request.request_id, 7);
        assert_eq!(request.text, "Zażółć gęślą jaźń");
    }
}
