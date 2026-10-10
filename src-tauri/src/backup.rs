use crate::{error::Error, APP};
use reqwest_dav::{Auth, ClientBuilder, Depth};
use serde::{Deserialize, Serialize};
use std::{
    io::Write,
    path::{Path, PathBuf},
};
use walkdir::WalkDir;
use zip::{read::ZipArchive, write::SimpleFileOptions};

const BACKUP_DIRECTORY: &str = "aries";
const LEGACY_BACKUP_DIRECTORY: &str = "pot-app";

fn app_config_dir() -> Result<PathBuf, Error> {
    APP.get()
        .and_then(|app| app.path_resolver().app_config_dir())
        .ok_or_else(|| Error::Error("Application configuration directory unavailable".into()))
}

#[derive(Debug, PartialEq)]
struct BackupPaths {
    archive: PathBuf,
    config: PathBuf,
    database: PathBuf,
    plugins: PathBuf,
}

fn backup_paths(root: &Path) -> BackupPaths {
    BackupPaths {
        archive: root.join("archive.zip"),
        config: root.join("config.json"),
        database: root.join("history.db"),
        plugins: root.join("plugins"),
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
struct RemoteBackup {
    name: String,
    path: String,
    legacy: bool,
}

fn merge_remote_backups(current: &[String], legacy: &[String]) -> Vec<RemoteBackup> {
    let mut result = Vec::new();
    for (directory, entries, old) in [
        (BACKUP_DIRECTORY, current, false),
        (LEGACY_BACKUP_DIRECTORY, legacy, true),
    ] {
        for href in entries {
            let name = href.rsplit('/').next().unwrap_or_default();
            if name.ends_with(".zip") && !name.is_empty() {
                let path = format!("{directory}/{name}");
                if !result.iter().any(|file: &RemoteBackup| file.path == path) {
                    result.push(RemoteBackup {
                        name: name.to_string(),
                        path,
                        legacy: old,
                    });
                }
            }
        }
    }
    result
}

fn remote_path(name: Option<String>, writing: bool) -> Result<String, Error> {
    let name = name.ok_or_else(|| Error::Error("Missing backup name".into()))?;
    let path = if writing {
        format!("{BACKUP_DIRECTORY}/{name}")
    } else {
        name
    };
    let parts: Vec<_> = path.split('/').collect();
    if parts.len() != 2
        || ![BACKUP_DIRECTORY, LEGACY_BACKUP_DIRECTORY].contains(&parts[0])
        || !parts[1].ends_with(".zip")
        || parts[1].contains(['\\', '?', '#'])
        || ["%2e", "%2f", "%5c"]
            .iter()
            .any(|encoded| parts[1].to_ascii_lowercase().contains(encoded))
        || parts[1].contains("..")
    {
        return Err(Error::Error("Invalid backup path".into()));
    }
    Ok(format!("/{path}"))
}

fn write_backup(root: &Path, destination: &Path) -> Result<(), Error> {
    let paths = backup_paths(root);
    let mut zip = zip::ZipWriter::new(std::fs::File::create(destination)?);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    zip.start_file("config.json", options)?;
    zip.write_all(&std::fs::read(paths.config)?)?;
    if paths.database.exists() {
        zip.start_file("history.db", options)?;
        zip.write_all(&std::fs::read(paths.database)?)?;
    }
    if paths.plugins.exists() {
        for entry in WalkDir::new(paths.plugins).follow_links(false) {
            let entry = entry?;
            if entry.file_type().is_file() {
                let relative = entry
                    .path()
                    .strip_prefix(root)?
                    .to_string_lossy()
                    .replace('\\', "/");
                zip.start_file(relative, options)?;
                zip.write_all(&std::fs::read(entry.path())?)?;
            }
        }
    }
    zip.finish()?;
    Ok(())
}

fn restore_backup(root: &Path, archive: &Path) -> Result<(), Error> {
    let mut zip = ZipArchive::new(std::fs::File::open(archive)?)?;
    for index in 0..zip.len() {
        let file = zip.by_index(index)?;
        let path = file
            .enclosed_name()
            .ok_or_else(|| Error::Error("Invalid archive path".into()))?;
        if path != Path::new("config.json")
            && path != Path::new("history.db")
            && !path.starts_with("plugins")
        {
            return Err(Error::Error("Unexpected file in backup".into()));
        }
        if file
            .unix_mode()
            .is_some_and(|mode| mode & 0o170000 == 0o120000)
        {
            return Err(Error::Error("Symlinks are not supported in backups".into()));
        }
    }
    zip.extract(root)?;
    Ok(())
}

#[tauri::command(async)]
pub async fn webdav(
    operate: &str,
    url: String,
    username: String,
    password: String,
    name: Option<String>,
) -> Result<String, Error> {
    let client = ClientBuilder::new()
        .set_host(url)
        .set_auth(Auth::Basic(username, password))
        .build()?;
    match operate {
        "list" => {
            let mut lists = Vec::new();
            for directory in [BACKUP_DIRECTORY, LEGACY_BACKUP_DIRECTORY] {
                let response = client
                    .list_raw(&format!("/{directory}/"), Depth::Number(1))
                    .await?;
                if response.status().as_u16() == 404 {
                    lists.push(Vec::new());
                    continue;
                }
                response.error_for_status()?;
                let entries = client
                    .list(&format!("/{directory}/"), Depth::Number(1))
                    .await?;
                lists.push(
                    entries
                        .into_iter()
                        .filter_map(|entry| match entry {
                            reqwest_dav::types::list_entities::ListEntity::File(file) => {
                                Some(file.href)
                            }
                            _ => None,
                        })
                        .collect::<Vec<_>>(),
                );
            }
            Ok(serde_json::to_string(&merge_remote_backups(
                &lists[0], &lists[1],
            ))?)
        }
        "get" => {
            let remote = remote_path(name, false)?;
            let response = client.get(&remote).await?.error_for_status()?;
            let root = app_config_dir()?;
            std::fs::create_dir_all(&root)?;
            let archive = backup_paths(&root).archive;
            std::fs::write(&archive, response.bytes().await?)?;
            restore_backup(&root, &archive)?;
            Ok(String::new())
        }
        "put" => {
            let remote = remote_path(name, true)?;
            client
                .mkcol(&format!("/{BACKUP_DIRECTORY}"))
                .await
                .unwrap_or_default();
            let root = app_config_dir()?;
            let archive = backup_paths(&root).archive;
            write_backup(&root, &archive)?;
            client.put(&remote, std::fs::read(archive)?).await?;
            Ok(String::new())
        }
        "delete" => {
            let remote = remote_path(name, false)?;
            client.delete(&remote).await?;
            Ok(String::new())
        }
        _ => Err(Error::Error("Unknown WebDAV operation".into())),
    }
}

#[tauri::command(async)]
pub async fn local(operate: &str, path: String) -> Result<String, Error> {
    let root = app_config_dir()?;
    match operate {
        "put" => write_backup(&root, Path::new(&path))?,
        "get" => restore_backup(&root, Path::new(&path))?,
        _ => return Err(Error::Error("Unknown local backup operation".into())),
    }
    Ok(String::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backup_roundtrip_only_changes_the_requested_profile() {
        let temporary = std::env::temp_dir();
        let root = temporary.join(format!(
            "aries-backup-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let aries = root.join("com.aries.translate");
        let other = root.join("other-profile");
        std::fs::create_dir_all(aries.join("plugins/translate/plugin.demo")).unwrap();
        std::fs::create_dir_all(&other).unwrap();
        std::fs::write(aries.join("config.json"), r#"{"theme":"dark"}"#).unwrap();
        std::fs::write(aries.join("history.db"), "history").unwrap();
        std::fs::write(
            aries.join("plugins/translate/plugin.demo/main.js"),
            "plugin",
        )
        .unwrap();
        std::fs::write(other.join("config.json"), "untouched").unwrap();
        let archive = root.join("backup.zip");
        write_backup(&aries, &archive).unwrap();
        std::fs::write(aries.join("config.json"), "changed").unwrap();
        restore_backup(&aries, &archive).unwrap();
        assert_eq!(
            std::fs::read_to_string(aries.join("config.json")).unwrap(),
            r#"{"theme":"dark"}"#
        );
        assert_eq!(
            std::fs::read_to_string(other.join("config.json")).unwrap(),
            "untouched"
        );
        assert_eq!(
            std::fs::read_to_string(aries.join("history.db")).unwrap(),
            "history"
        );
        assert_eq!(
            std::fs::read_to_string(aries.join("plugins/translate/plugin.demo/main.js")).unwrap(),
            "plugin"
        );
        assert!(root
            .canonicalize()
            .unwrap()
            .starts_with(temporary.canonicalize().unwrap()));
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn all_backup_paths_use_the_given_application_directory() {
        let root = Path::new("test-profile/com.aries.translate");
        let paths = backup_paths(root);
        assert_eq!(paths.archive, root.join("archive.zip"));
        assert_eq!(paths.config, root.join("config.json"));
        assert_eq!(paths.database, root.join("history.db"));
        assert_eq!(paths.plugins, root.join("plugins"));
    }
    #[test]
    fn remote_merge_preserves_same_named_files_in_different_directories() {
        let list = merge_remote_backups(
            &["/aries/a.zip".into(), "/aries/a.zip".into()],
            &["/pot-app/a.zip".into(), "/pot-app/".into()],
        );
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].path, "aries/a.zip");
        assert!(list[1].legacy);
    }
    #[test]
    fn remote_paths_write_only_new_directory_and_reject_traversal() {
        assert_eq!(
            remote_path(Some("a.zip".into()), true).unwrap(),
            "/aries/a.zip"
        );
        assert_eq!(
            remote_path(Some("pot-app/a.zip".into()), false).unwrap(),
            "/pot-app/a.zip"
        );
        for name in [
            "../a.zip",
            "aries/../a.zip",
            "other/a.zip",
            "aries/%2e%2e.zip",
        ] {
            assert!(remote_path(Some(name.into()), false).is_err());
        }
    }
}
