use crate::{error::Error, APP};
use dirs::config_dir;
use log::{info, warn};
use serde_json::{json, Value};
use std::{fs, path::Path, sync::Mutex};
use tauri::{Manager, Wry};
use tauri_plugin_store::{Store, StoreBuilder};

pub struct StoreWrapper(pub Mutex<Store<Wry>>);

const OFFICIAL_IDENTIFIER: &str = "com.pot-app.desktop";
const PERSONAL_IDENTIFIER: &str = "com.pot-app.personal";
const PROFILE_MIGRATION_MARKER: &str = ".previous-profile-migrated";
const WINDOW_GEOMETRY_KEYS: [&str; 7] = [
    "translate_window_position",
    "translate_window_position_x",
    "translate_window_position_y",
    "translate_window_width",
    "translate_window_height",
    "recognize_window_width",
    "recognize_window_height",
];

fn copy_directory_contents(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        if source_path.is_dir() {
            copy_directory_contents(&source_path, &destination_path)?;
        } else if !destination_path.exists() {
            fs::copy(&source_path, &destination_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn sanitize_official_config(mut config: Value) -> Result<Value, String> {
    let object = config
        .as_object_mut()
        .ok_or_else(|| "official config root is not an object".to_string())?;

    for key in WINDOW_GEOMETRY_KEYS {
        object.remove(key);
    }
    // Personal builds never contact the official updater.
    object.insert("check_update".to_string(), json!(false));

    Ok(config)
}

fn migrate_config(source: &Path, destination: &Path) -> Result<(), String> {
    if destination.exists() || !source.exists() {
        return Ok(());
    }

    let contents = fs::read_to_string(source).map_err(|e| e.to_string())?;
    let config: Value = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
    let config = sanitize_official_config(config)?;

    let sanitized = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(destination, sanitized).map_err(|e| e.to_string())
}

fn copy_file_once(source: &Path, destination: &Path) -> Result<(), String> {
    if source.exists() && !destination.exists() {
        fs::copy(source, destination).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Copies history and plugins from `source_dir`; the config file is handled by the caller.
fn import_history_and_plugins(source_dir: &Path, app_dir: &Path) -> Result<(), String> {
    copy_file_once(&source_dir.join("history.db"), &app_dir.join("history.db"))?;
    let source_plugins = source_dir.join("plugins");
    if source_plugins.exists() {
        copy_directory_contents(&source_plugins, &app_dir.join("plugins"))?;
    }
    Ok(())
}

/// Imports the newest earlier profile into `app_dir`, without overwriting anything already there:
/// Pot Personal (copied as is) if it has a config, otherwise the official Pot (window geometry removed).
/// Returns a short description of what was imported, for the log.
fn import_previous_profile(root: &Path, app_dir: &Path) -> Result<&'static str, String> {
    fs::create_dir_all(app_dir).map_err(|e| e.to_string())?;

    let personal_dir = root.join(PERSONAL_IDENTIFIER);
    if personal_dir != app_dir && personal_dir.join("config.json").exists() {
        copy_file_once(
            &personal_dir.join("config.json"),
            &app_dir.join("config.json"),
        )?;
        import_history_and_plugins(&personal_dir, app_dir)?;
        return Ok("Pot Personal profile imported");
    }

    let official_dir = root.join(OFFICIAL_IDENTIFIER);
    if official_dir.exists() {
        migrate_config(
            &official_dir.join("config.json"),
            &app_dir.join("config.json"),
        )?;
        import_history_and_plugins(&official_dir, app_dir)?;
        return Ok("official Pot profile imported");
    }

    Ok("no earlier Pot profile found; nothing imported")
}

/// Runs once per profile, before either the frontend or the backend opens the config store.
pub fn migrate_previous_profile_once(app: &tauri::App) -> Result<(), String> {
    let root = config_dir().ok_or_else(|| "configuration directory is unavailable".to_string())?;
    let app_dir = root.join(app.config().tauri.bundle.identifier.clone());
    let marker = app_dir.join(PROFILE_MIGRATION_MARKER);
    if marker.exists() {
        return Ok(());
    }

    let result = import_previous_profile(&root, &app_dir)?;
    info!("Profile migration: {}", result);
    fs::write(marker, format!("{}\n", app.package_info().version)).map_err(|e| e.to_string())
}

pub fn init_config(app: &mut tauri::App) {
    let config_path = config_dir().unwrap();
    let config_path = config_path.join(app.config().tauri.bundle.identifier.clone());
    let config_path = config_path.join("config.json");
    info!("Load config from: {:?}", config_path);
    let mut store = StoreBuilder::new(app.handle(), config_path).build();

    match store.load() {
        Ok(_) => info!("Config loaded"),
        Err(e) => {
            warn!("Config load error: {:?}", e);
            info!("Config not found, creating new config");
        }
    }
    app.manage(StoreWrapper(Mutex::new(store)));
    let _ = check_service_available();
}

fn check_available(list: Vec<String>, builtin: Vec<&str>, plugin: Vec<String>, key: &str) {
    for service in list {
        let name = service.split("@").collect::<Vec<&str>>()[0];
        let mut is_available = true;
        if name.starts_with("plugin") {
            if !plugin.contains(&name.to_string()) {
                is_available = false;
            }
        } else {
            if !builtin.contains(&name) {
                is_available = false;
            }
        }
        if !is_available {
            warn!(
                "Skipping unavailable service {} in {}; configuration retained",
                service, key
            );
        }
    }
}

pub fn check_service_available() -> Result<(), Error> {
    let builtin_recognize_list: Vec<&str> = vec![
        "baidu_ocr",
        "baidu_accurate_ocr",
        "baidu_img_ocr",
        "azure_ocr",
        "iflytek_ocr",
        "iflytek_intsig_ocr",
        "iflytek_latex_ocr",
        "google_ocr",
        "qrcode",
        "simple_latex_ocr",
        "system",
        "tencent_ocr",
        "tencent_accurate_ocr",
        "tencent_img_ocr",
        "tesseract",
        "volcengine_ocr",
        "volcengine_multi_lang_ocr",
    ];
    let builtin_translate_list: Vec<&str> = vec![
        "alibaba",
        "azure_translate",
        "baidu",
        "baidu_field",
        "bing",
        "bing_dict",
        "caiyun",
        "cambridge_dict",
        "chatglm",
        "deepl",
        "gemini_free",
        "geminipro",
        "niutrans",
        "ollama",
        "openai",
        "google",
        "google_cloud_translate",
        "tencent",
        "transmart",
        "volcengine",
        "yandex",
        "youdao",
    ];
    let builtin_tts_list: Vec<&str> = vec![
        "lingva_tts",
        "azure_tts",
        "openrouter_tts",
        "google_cloud_tts",
        "gemini_tts",
        "gemini_live_tts",
    ];
    let builtin_collection_list: Vec<&str> = vec!["anki", "eudic"];

    let plugin_recognize_list: Vec<String> = get_plugin_list("recognize").unwrap_or_default();
    let plugin_translate_list: Vec<String> = get_plugin_list("translate").unwrap_or_default();
    let plugin_tts_list: Vec<String> = get_plugin_list("tts").unwrap_or_default();
    let plugin_collection_list: Vec<String> = get_plugin_list("collection").unwrap_or_default();
    if let Some(recognize_service_list) = get("recognize_service_list") {
        let recognize_service_list: Vec<String> = serde_json::from_value(recognize_service_list)?;
        check_available(
            recognize_service_list,
            builtin_recognize_list,
            plugin_recognize_list,
            "recognize_service_list",
        );
    }
    if let Some(translate_service_list) = get("translate_service_list") {
        let translate_service_list: Vec<String> = serde_json::from_value(translate_service_list)?;
        check_available(
            translate_service_list,
            builtin_translate_list,
            plugin_translate_list,
            "translate_service_list",
        );
    }
    if let Some(tts_service_list) = get("tts_service_list") {
        let tts_service_list: Vec<String> = serde_json::from_value(tts_service_list)?;
        check_available(
            tts_service_list,
            builtin_tts_list,
            plugin_tts_list,
            "tts_service_list",
        );
    }
    if let Some(collection_service_list) = get("collection_service_list") {
        let collection_service_list: Vec<String> = serde_json::from_value(collection_service_list)?;
        check_available(
            collection_service_list,
            builtin_collection_list,
            plugin_collection_list,
            "collection_service_list",
        );
    }
    Ok(())
}

pub fn get_plugin_list(plugin_type: &str) -> Option<Vec<String>> {
    let app_handle = APP.get().unwrap();
    let config_dir = dirs::config_dir()?;
    let config_dir = config_dir.join(app_handle.config().tauri.bundle.identifier.clone());
    let plugin_dir = config_dir.join("plugins");
    let plugin_dir = plugin_dir.join(plugin_type);

    // dirs in plugin_dir
    let mut plugin_list = vec![];
    if plugin_dir.exists() {
        let read_dir = std::fs::read_dir(plugin_dir).ok()?;
        for entry in read_dir {
            let entry = entry.ok()?;

            if entry.path().is_dir() {
                let name = entry.file_name().to_str()?.to_string();
                if name.starts_with("plugin") {
                    plugin_list.push(name);
                }
            }
        }
    }
    Some(plugin_list)
}

pub fn get(key: &str) -> Option<Value> {
    let state = APP.get().unwrap().state::<StoreWrapper>();
    let store = state.0.lock().unwrap();
    match store.get(key) {
        Some(value) => Some(value.clone()),
        None => None,
    }
}

pub fn set<T: serde::ser::Serialize>(key: &str, value: T) {
    let state = APP.get().unwrap().state::<StoreWrapper>();
    let mut store = state.0.lock().unwrap();
    store.insert(key.to_string(), json!(value)).unwrap();
    store.save().unwrap();
}

pub fn is_first_run() -> bool {
    let state = APP.get().unwrap().state::<StoreWrapper>();
    let store = state.0.lock().unwrap();
    store.is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn official_config_migration_preserves_services_but_removes_window_geometry() {
        let config = json!({
            "app_language": "zh_cn",
            "openai@personal": { "api_key": "kept" },
            "translate_window_position": "pre_state",
            "translate_window_position_x": 100,
            "translate_window_position_y": 200,
            "translate_window_width": 900,
            "translate_window_height": 700,
            "recognize_window_width": 800,
            "recognize_window_height": 600,
            "check_update": true
        });

        let migrated = sanitize_official_config(config).unwrap();
        let object = migrated.as_object().unwrap();

        assert_eq!(object["app_language"], json!("zh_cn"));
        assert_eq!(object["openai@personal"]["api_key"], json!("kept"));
        assert_eq!(object["check_update"], json!(false));
        for key in WINDOW_GEOMETRY_KEYS {
            assert!(!object.contains_key(key));
        }
    }

    fn scratch_root(name: &str) -> std::path::PathBuf {
        let root =
            std::env::temp_dir().join(format!("aries-config-test-{}-{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn personal_profile_is_preferred_and_copied_verbatim() {
        let root = scratch_root("personal");
        let personal = root.join(PERSONAL_IDENTIFIER);
        let official = root.join(OFFICIAL_IDENTIFIER);
        fs::create_dir_all(personal.join("plugins/tts/plugin.demo")).unwrap();
        fs::create_dir_all(&official).unwrap();
        fs::write(
            personal.join("config.json"),
            r#"{"translate_window_width":900}"#,
        )
        .unwrap();
        fs::write(personal.join("history.db"), "history").unwrap();
        fs::write(personal.join("plugins/tts/plugin.demo/info.json"), "{}").unwrap();
        fs::write(official.join("config.json"), r#"{"from":"official"}"#).unwrap();
        let app_dir = root.join("com.aries.translate");

        assert_eq!(
            import_previous_profile(&root, &app_dir).unwrap(),
            "Pot Personal profile imported"
        );
        assert_eq!(
            fs::read_to_string(app_dir.join("config.json")).unwrap(),
            r#"{"translate_window_width":900}"#
        );
        assert_eq!(
            fs::read_to_string(app_dir.join("history.db")).unwrap(),
            "history"
        );
        assert!(app_dir.join("plugins/tts/plugin.demo/info.json").exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn existing_files_are_never_overwritten() {
        let root = scratch_root("keep");
        let personal = root.join(PERSONAL_IDENTIFIER);
        let app_dir = root.join("com.aries.translate");
        fs::create_dir_all(&personal).unwrap();
        fs::create_dir_all(&app_dir).unwrap();
        fs::write(personal.join("config.json"), r#"{"old":true}"#).unwrap();
        fs::write(app_dir.join("config.json"), r#"{"new":true}"#).unwrap();

        import_previous_profile(&root, &app_dir).unwrap();
        assert_eq!(
            fs::read_to_string(app_dir.join("config.json")).unwrap(),
            r#"{"new":true}"#
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn official_profile_is_the_fallback() {
        let root = scratch_root("official");
        let official = root.join(OFFICIAL_IDENTIFIER);
        fs::create_dir_all(&official).unwrap();
        fs::write(
            official.join("config.json"),
            r#"{"translate_window_width":900,"check_update":true}"#,
        )
        .unwrap();
        let app_dir = root.join("com.aries.translate");

        assert_eq!(
            import_previous_profile(&root, &app_dir).unwrap(),
            "official Pot profile imported"
        );
        let config: Value =
            serde_json::from_str(&fs::read_to_string(app_dir.join("config.json")).unwrap())
                .unwrap();
        assert!(config.get("translate_window_width").is_none());
        assert_eq!(config["check_update"], json!(false));
        let _ = fs::remove_dir_all(&root);
    }
}
