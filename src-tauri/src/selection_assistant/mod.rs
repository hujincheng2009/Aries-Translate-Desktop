// Selection assistant (划词助手, 1.1.0): after the user selects text anywhere, a small Aries icon appears next to
// the mouse and expands into a toolbar (translate, replace with translation, copy, read aloud).
// Windows only. The pure decision logic lives in gesture / decide / placement.

pub mod decide;
pub mod gesture;
pub mod placement;
#[cfg(target_os = "windows")]
mod windows;

use crate::config::get;
use serde::Serialize;
use serde_json::Value;

pub const ACTIONS: [&str; 4] = ["translate", "replace_translate", "copy", "read_aloud"];

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub enable: bool,
    // "icon": small icon first, toolbar on hover; "toolbar": toolbar right away.
    pub display_mode: String,
    // "icon" (default) or "icon_text".
    pub button_style: String,
    pub show_logo: bool,
    // 0 = never hide on a timer.
    pub hide_delay_secs: u64,
    // Logical pixels from the point where the mouse button was released.
    pub offset_x: i32,
    pub offset_y: i32,
    pub disable_in_fullscreen: bool,
    pub compat_mode: bool,
    pub actions: Vec<String>,
    pub blacklist: Vec<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            enable: false,
            display_mode: "icon".into(),
            button_style: "icon".into(),
            show_logo: true,
            hide_delay_secs: 3,
            offset_x: 12,
            offset_y: 16,
            disable_in_fullscreen: true,
            compat_mode: true,
            actions: ACTIONS.iter().map(|a| a.to_string()).collect(),
            blacklist: vec![],
        }
    }
}

// Known actions only, without duplicates, in the user's order; an empty result falls back to all actions.
pub fn normalize_actions(value: &Value) -> Vec<String> {
    let mut actions: Vec<String> = vec![];
    if let Some(items) = value.as_array() {
        for item in items {
            if let Some(action) = item.as_str() {
                if ACTIONS.contains(&action) && !actions.iter().any(|a| a == action) {
                    actions.push(action.to_string());
                }
            }
        }
    }
    if actions.is_empty() {
        Settings::default().actions
    } else {
        actions
    }
}

fn normalize_blacklist(value: &Value) -> Vec<String> {
    value
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str())
                .map(|item| item.trim().to_string())
                .filter(|item| !item.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

impl Settings {
    // Applies one config value; unknown keys and values of the wrong type keep the current setting.
    pub fn apply(&mut self, key: &str, value: &Value) {
        let clamp_offset = |v: &Value, current: i32| {
            v.as_f64()
                .map(|n| n.round().clamp(-200.0, 200.0) as i32)
                .unwrap_or(current)
        };
        match key {
            "selection_assistant_enable" => self.enable = value.as_bool().unwrap_or(self.enable),
            "selection_assistant_display_mode" => {
                if let Some(mode @ ("icon" | "toolbar")) = value.as_str() {
                    self.display_mode = mode.to_string();
                }
            }
            "selection_assistant_button_style" => {
                if let Some(style @ ("icon" | "icon_text")) = value.as_str() {
                    self.button_style = style.to_string();
                }
            }
            "selection_assistant_show_logo" => {
                self.show_logo = value.as_bool().unwrap_or(self.show_logo)
            }
            "selection_assistant_hide_delay" => {
                if let Some(secs) = value.as_u64() {
                    self.hide_delay_secs = secs.min(30);
                }
            }
            "selection_assistant_offset_x" => self.offset_x = clamp_offset(value, self.offset_x),
            "selection_assistant_offset_y" => self.offset_y = clamp_offset(value, self.offset_y),
            "selection_assistant_disable_in_fullscreen" => {
                self.disable_in_fullscreen = value.as_bool().unwrap_or(self.disable_in_fullscreen)
            }
            "selection_assistant_compat_mode" => {
                self.compat_mode = value.as_bool().unwrap_or(self.compat_mode)
            }
            "selection_assistant_actions" => self.actions = normalize_actions(value),
            "selection_assistant_blacklist" => self.blacklist = normalize_blacklist(value),
            _ => {}
        }
    }
}

pub const KEYS: [&str; 11] = [
    "selection_assistant_enable",
    "selection_assistant_display_mode",
    "selection_assistant_button_style",
    "selection_assistant_show_logo",
    "selection_assistant_hide_delay",
    "selection_assistant_offset_x",
    "selection_assistant_offset_y",
    "selection_assistant_disable_in_fullscreen",
    "selection_assistant_compat_mode",
    "selection_assistant_actions",
    "selection_assistant_blacklist",
];

pub fn load_settings() -> Settings {
    let mut settings = Settings::default();
    for key in KEYS {
        if let Some(value) = get(key) {
            settings.apply(key, &value);
        }
    }
    settings
}

// Called once from setup: starts the assistant when it is enabled.
pub fn init() {
    #[cfg(target_os = "windows")]
    windows::apply(load_settings());
}

// Tray menu toggle; the settings page is told through the usual `<key>_changed` event.
pub fn set_enabled_from_tray(enabled: bool) {
    use tauri::Manager;
    crate::config::set("selection_assistant_enable", enabled);
    if let Some(app) = crate::APP.get() {
        let _ = app.emit_all("selection_assistant_enable_changed", enabled);
    }
    #[cfg(target_os = "windows")]
    {
        let mut settings = windows::current_settings();
        settings.enable = enabled;
        windows::apply(settings);
    }
}

// Runtime state (the config file may lag behind a change made on the settings page by a few milliseconds).
pub fn is_enabled() -> bool {
    #[cfg(target_os = "windows")]
    return windows::current_settings().enable;
    #[cfg(not(target_os = "windows"))]
    false
}

fn sync_tray_item(enabled: bool) {
    #[cfg(target_os = "windows")]
    if let Some(app) = crate::APP.get() {
        let _ = app
            .tray_handle()
            .get_item("selection_assistant")
            .set_selected(enabled);
    }
    #[cfg(not(target_os = "windows"))]
    let _ = enabled;
}

#[derive(Clone, Serialize)]
pub struct RunningApp {
    pub exe: String,
    pub title: String,
}

// The settings page saves the value with useConfig and then tells the running assistant about it.
#[tauri::command]
pub async fn selection_assistant_set(key: String, value: Value) {
    #[cfg(target_os = "windows")]
    {
        let mut settings = windows::current_settings();
        settings.apply(&key, &value);
        let enabled = settings.enable;
        windows::apply(settings);
        if key == "selection_assistant_enable" {
            sync_tray_item(enabled);
        }
    }
    #[cfg(not(target_os = "windows"))]
    let _ = (key, value, sync_tray_item);
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn selection_bar_set_size(
    seq: u64,
    width: f64,
    height: f64,
    hit_x: f64,
    hit_y: f64,
    hit_width: f64,
    hit_height: f64,
    expanded: bool,
) {
    #[cfg(target_os = "windows")]
    windows::send(windows::Event::SetSize {
        seq,
        size: (width, height),
        hit: (hit_x, hit_y, hit_width, hit_height),
        expanded,
    });
    #[cfg(not(target_os = "windows"))]
    let _ = (
        seq, width, height, hit_x, hit_y, hit_width, hit_height, expanded,
    );
}

#[tauri::command]
pub fn selection_bar_action(seq: u64, action: String) {
    #[cfg(target_os = "windows")]
    windows::send(windows::Event::Action { seq, action });
    #[cfg(not(target_os = "windows"))]
    let _ = (seq, action);
}

#[tauri::command]
pub fn selection_bar_hide(seq: u64) {
    #[cfg(target_os = "windows")]
    windows::send(windows::Event::HideRequest { seq });
    #[cfg(not(target_os = "windows"))]
    let _ = seq;
}

#[tauri::command]
pub async fn selection_assistant_running_apps() -> Vec<RunningApp> {
    #[cfg(target_os = "windows")]
    return windows::running_apps();
    #[cfg(not(target_os = "windows"))]
    vec![]
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn actions_keep_known_unique_entries_in_order() {
        assert_eq!(
            normalize_actions(&json!(["copy", "bogus", "translate", "copy"])),
            vec!["copy", "translate"]
        );
    }

    #[test]
    fn empty_or_invalid_actions_fall_back_to_all() {
        assert_eq!(normalize_actions(&json!([])), Settings::default().actions);
        assert_eq!(
            normalize_actions(&json!("copy")),
            Settings::default().actions
        );
    }

    #[test]
    fn settings_ignore_values_of_the_wrong_type() {
        let mut s = Settings::default();
        s.apply("selection_assistant_display_mode", &json!("toolbar"));
        s.apply("selection_assistant_hide_delay", &json!(99));
        assert_eq!(s.hide_delay_secs, 30);
        s.apply("selection_assistant_button_style", &json!("weird"));
        s.apply("selection_assistant_enable", &json!("yes"));
        s.apply("selection_assistant_offset_x", &json!(-500));
        s.apply("selection_assistant_offset_y", &json!(20.4));
        s.apply("selection_assistant_hide_delay", &json!(0));
        s.apply(
            "selection_assistant_blacklist",
            &json!([" a.exe ", "", 3, "b.exe"]),
        );
        assert_eq!(s.display_mode, "toolbar");
        assert_eq!(s.button_style, "icon");
        assert!(!s.enable);
        assert_eq!((s.offset_x, s.offset_y), (-200, 20));
        assert_eq!(s.hide_delay_secs, 0);
        assert_eq!(s.blacklist, vec!["a.exe", "b.exe"]);
    }
}
