// Saving and restoring the user's clipboard around simulated copy / paste (replacement translation and the
// selection assistant). Only text and images are kept; other formats are lost, as documented in the release notes.
use arboard::{Clipboard, ImageData};
use std::time::Duration;

const CLIPBOARD_RESTORE_RETRIES: usize = 3;

pub(crate) enum ClipboardBackup {
    Text(String),
    Image(ImageData<'static>),
    Empty,
}

pub(crate) fn backup_clipboard(clipboard: &mut Clipboard) -> ClipboardBackup {
    if let Ok(text) = clipboard.get_text() {
        ClipboardBackup::Text(text)
    } else if let Ok(image) = clipboard.get_image() {
        ClipboardBackup::Image(image.to_owned_img())
    } else {
        ClipboardBackup::Empty
    }
}

fn restore_clipboard(clipboard: &mut Clipboard, backup: &ClipboardBackup) -> Result<(), String> {
    match backup {
        ClipboardBackup::Text(text) => clipboard
            .set_text(text.clone())
            .map_err(|error| error.to_string()),
        ClipboardBackup::Image(image) => clipboard
            .set_image(image.clone())
            .map_err(|error| error.to_string()),
        ClipboardBackup::Empty => clipboard.clear().map_err(|error| error.to_string()),
    }
}

pub(crate) fn restore_clipboard_with_retry(
    clipboard: &mut Clipboard,
    backup: &ClipboardBackup,
) -> Result<(), String> {
    let mut last_error = None;
    for attempt in 0..CLIPBOARD_RESTORE_RETRIES {
        match restore_clipboard(clipboard, backup) {
            Ok(()) => return Ok(()),
            Err(error) => last_error = Some(error),
        }
        if attempt + 1 < CLIPBOARD_RESTORE_RETRIES {
            std::thread::sleep(Duration::from_millis(50));
        }
    }
    Err(last_error.unwrap_or_else(|| "Failed to restore clipboard".to_string()))
}
