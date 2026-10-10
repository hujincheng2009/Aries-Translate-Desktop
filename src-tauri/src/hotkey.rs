use crate::config::{get, set};
use crate::read_aloud::request_read_aloud;
use crate::replace_translation::request_replace_translation;
use crate::window::{input_translate, ocr_recognize, ocr_translate, selection_translate};
use crate::APP;
use log::{info, warn};
use tauri::{AppHandle, GlobalShortcutManager};

fn should_suppress_hotkey() -> bool {
    get("hotkey_disable_in_fullscreen")
        .and_then(|value| value.as_bool())
        .unwrap_or(true)
        && crate::fullscreen::foreground_is_fullscreen()
}

fn register<F>(app_handle: &AppHandle, name: &str, handler: F, key: &str) -> Result<(), String>
where
    F: Fn() + Send + 'static,
{
    let hotkey = {
        if key.is_empty() {
            match get(name) {
                Some(v) => v.as_str().unwrap().to_string(),
                None => {
                    set(name, "");
                    String::new()
                }
            }
        } else {
            key.to_string()
        }
    };

    if !hotkey.is_empty() {
        match app_handle
            .global_shortcut_manager()
            .register(hotkey.as_str(), move || {
                if should_suppress_hotkey() {
                    info!("Global shortcut suppressed while foreground application is fullscreen");
                    return;
                }
                handler();
            }) {
            Ok(()) => {
                info!("Registered global shortcut: {} for {}", hotkey, name);
            }
            Err(e) => {
                warn!("Failed to register global shortcut: {} {:?}", hotkey, e);
                return Err(e.to_string());
            }
        };
    }
    Ok(())
}

fn record_registration_result(errors: &mut Vec<String>, name: &str, result: Result<(), String>) {
    if let Err(error) = result {
        errors.push(format!("{}: {}", name, error));
    }
}

// Register global shortcuts
pub fn register_shortcut(shortcut: &str) -> Result<(), String> {
    let app_handle = APP.get().unwrap();
    match shortcut {
        "hotkey_selection_translate" => register(
            app_handle,
            "hotkey_selection_translate",
            selection_translate,
            "",
        )?,
        "hotkey_input_translate" => {
            register(app_handle, "hotkey_input_translate", input_translate, "")?
        }
        "hotkey_replace_translate" => register(
            app_handle,
            "hotkey_replace_translate",
            request_replace_translation,
            "",
        )?,
        "hotkey_read_aloud" => register(app_handle, "hotkey_read_aloud", request_read_aloud, "")?,
        "hotkey_ocr_recognize" => register(app_handle, "hotkey_ocr_recognize", ocr_recognize, "")?,
        "hotkey_ocr_translate" => register(app_handle, "hotkey_ocr_translate", ocr_translate, "")?,
        "all" => {
            let mut errors = Vec::new();
            record_registration_result(
                &mut errors,
                "hotkey_selection_translate",
                register(
                    app_handle,
                    "hotkey_selection_translate",
                    selection_translate,
                    "",
                ),
            );
            record_registration_result(
                &mut errors,
                "hotkey_input_translate",
                register(app_handle, "hotkey_input_translate", input_translate, ""),
            );
            record_registration_result(
                &mut errors,
                "hotkey_replace_translate",
                register(
                    app_handle,
                    "hotkey_replace_translate",
                    request_replace_translation,
                    "",
                ),
            );
            record_registration_result(
                &mut errors,
                "hotkey_read_aloud",
                register(app_handle, "hotkey_read_aloud", request_read_aloud, ""),
            );
            record_registration_result(
                &mut errors,
                "hotkey_ocr_recognize",
                register(app_handle, "hotkey_ocr_recognize", ocr_recognize, ""),
            );
            record_registration_result(
                &mut errors,
                "hotkey_ocr_translate",
                register(app_handle, "hotkey_ocr_translate", ocr_translate, ""),
            );

            if !errors.is_empty() {
                return Err(errors.join("; "));
            }
        }
        _ => {}
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::record_registration_result;

    #[test]
    fn one_conflicting_shortcut_does_not_stop_the_registration_batch() {
        let mut errors = Vec::new();
        record_registration_result(&mut errors, "first", Err("conflict".to_string()));
        record_registration_result(&mut errors, "second", Ok(()));

        assert_eq!(errors, vec!["first: conflict"]);
    }
}

#[tauri::command]
pub fn register_shortcut_by_frontend(name: &str, shortcut: &str) -> Result<(), String> {
    let app_handle = APP.get().unwrap();
    match name {
        "hotkey_selection_translate" => register(
            app_handle,
            "hotkey_selection_translate",
            selection_translate,
            shortcut,
        )?,
        "hotkey_input_translate" => register(
            app_handle,
            "hotkey_input_translate",
            input_translate,
            shortcut,
        )?,
        "hotkey_replace_translate" => register(
            app_handle,
            "hotkey_replace_translate",
            request_replace_translation,
            shortcut,
        )?,
        "hotkey_read_aloud" => register(
            app_handle,
            "hotkey_read_aloud",
            request_read_aloud,
            shortcut,
        )?,
        "hotkey_ocr_recognize" => {
            register(app_handle, "hotkey_ocr_recognize", ocr_recognize, shortcut)?
        }
        "hotkey_ocr_translate" => {
            register(app_handle, "hotkey_ocr_translate", ocr_translate, shortcut)?
        }
        _ => {}
    }
    Ok(())
}
