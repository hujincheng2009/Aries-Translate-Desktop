use crate::window::text_translate;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use tauri::{ClipboardManager, Manager};

pub struct ClipboardMonitorEnableWrapper(pub Mutex<String>);
pub struct ClipboardMonitorSuppressWrapper {
    pub count: AtomicUsize,
}

pub struct ClipboardMonitorSuppression<'a>(&'a ClipboardMonitorSuppressWrapper);

impl<'a> ClipboardMonitorSuppression<'a> {
    pub fn new(state: &'a ClipboardMonitorSuppressWrapper) -> Self {
        state.count.fetch_add(1, Ordering::SeqCst);
        Self(state)
    }
}

impl Drop for ClipboardMonitorSuppression<'_> {
    fn drop(&mut self) {
        self.0.count.fetch_sub(1, Ordering::SeqCst);
    }
}

pub fn start_clipboard_monitor(app_handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut pre_text = "".to_string();
        loop {
            let handle = app_handle.app_handle();
            let suppress_state = handle.state::<ClipboardMonitorSuppressWrapper>();
            if suppress_state.count.load(Ordering::SeqCst) > 0 {
                std::thread::sleep(std::time::Duration::from_millis(50));
                continue;
            }
            let state = handle.state::<ClipboardMonitorEnableWrapper>();
            if let Ok(clipboard_monitor) = state.0.try_lock() {
                if clipboard_monitor.contains("true") {
                    if let Ok(result) = app_handle.clipboard_manager().read_text() {
                        match result {
                            Some(v) => {
                                if v != pre_text {
                                    text_translate(v.clone());
                                    pre_text = v;
                                }
                            }
                            None => {}
                        }
                    }
                } else {
                    break;
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
    });
}
