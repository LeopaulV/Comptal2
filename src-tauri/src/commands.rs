use crate::paths;
use serde::Serialize;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};

/// État de session : identifiant unique généré au démarrage du process,
/// utilisé pour nommer les fichiers de logs JSONL (AAAA-MM-JJ_HH-mm-ss).
pub struct Session {
    pub id: String,
}

impl Session {
    pub fn new() -> Self {
        Self {
            id: chrono::Local::now().format("%Y-%m-%d_%H-%M-%S").to_string(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub session_id: String,
    pub data_root: String,
    pub app_version: String,
    pub dev: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: String,
    pub is_dir: bool,
}

#[tauri::command]
pub fn get_session_info(app: AppHandle, session: State<Session>) -> SessionInfo {
    SessionInfo {
        session_id: session.id.clone(),
        data_root: paths::data_root(&app).to_string_lossy().to_string(),
        app_version: app.package_info().version.to_string(),
        dev: cfg!(debug_assertions),
    }
}

#[tauri::command]
pub fn read_text_file(app: AppHandle, rel: String) -> Result<String, String> {
    let path = paths::resolve(&app, &rel)?;
    fs::read_to_string(&path).map_err(|e| format!("Lecture {rel}: {e}"))
}

#[tauri::command]
pub fn write_text_file(app: AppHandle, rel: String, content: String) -> Result<(), String> {
    let path = paths::resolve(&app, &rel)?;
    ensure_parent(&path)?;
    fs::write(&path, content).map_err(|e| format!("Écriture {rel}: {e}"))
}

#[tauri::command]
pub fn append_text_line(app: AppHandle, rel: String, line: String) -> Result<(), String> {
    let path = paths::resolve(&app, &rel)?;
    ensure_parent(&path)?;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Ouverture {rel}: {e}"))?;
    file.write_all(line.as_bytes())
        .and_then(|_| file.write_all(b"\n"))
        .map_err(|e| format!("Append {rel}: {e}"))
}

#[tauri::command]
pub fn read_dir(app: AppHandle, rel: String) -> Result<Vec<FsEntry>, String> {
    let path = paths::resolve(&app, &rel)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    list_dir(&path)
}

#[tauri::command]
pub fn path_exists(app: AppHandle, rel: String) -> Result<bool, String> {
    Ok(paths::resolve(&app, &rel)?.exists())
}

#[tauri::command]
pub fn mkdirs(app: AppHandle, rel: String) -> Result<(), String> {
    let path = paths::resolve(&app, &rel)?;
    fs::create_dir_all(&path).map_err(|e| format!("mkdirs {rel}: {e}"))
}

#[tauri::command]
pub fn delete_file(app: AppHandle, rel: String) -> Result<(), String> {
    let path = paths::resolve(&app, &rel)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Suppression {rel}: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_dir(app: AppHandle, rel: String) -> Result<(), String> {
    if rel.trim().is_empty() {
        return Err("Suppression de la racine de données refusée".into());
    }
    let path = paths::resolve(&app, &rel)?;
    let root = paths::data_root(&app);
    let same_as_root = path == root
        || match (path.canonicalize(), root.canonicalize()) {
            (Ok(resolved), Ok(root_c)) => resolved == root_c,
            _ => false,
        };
    if same_as_root {
        return Err("Suppression de la racine de données refusée".into());
    }
    if path.exists() {
        fs::remove_dir_all(&path).map_err(|e| format!("Suppression dossier {rel}: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn copy_dir(app: AppHandle, src_rel: String, dst_rel: String) -> Result<(), String> {
    let src = paths::resolve(&app, &src_rel)?;
    let dst = paths::resolve(&app, &dst_rel)?;
    copy_dir_recursive(&src, &dst).map_err(|e| format!("Copie {src_rel} -> {dst_rel}: {e}"))
}

/// Compresse un dossier de données (relatif) vers un fichier ZIP (chemin absolu
/// choisi par l'utilisateur via une boîte de dialogue).
#[tauri::command]
pub fn zip_dir(app: AppHandle, src_rel: String, dest_abs: String) -> Result<(), String> {
    let src = paths::resolve(&app, &src_rel)?;
    if !src.is_dir() {
        return Err(format!("Dossier introuvable: {src_rel}"));
    }
    let file = fs::File::create(Path::new(&dest_abs))
        .map_err(|e| format!("Création ZIP {dest_abs}: {e}"))?;
    let mut writer = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    zip_dir_recursive(&src, &src, &mut writer, options)
        .map_err(|e| format!("Compression {src_rel}: {e}"))?;
    writer.finish().map_err(|e| format!("Finalisation ZIP: {e}"))?;
    Ok(())
}

/// Décompresse un ZIP (chemin absolu) vers un dossier de données (relatif).
#[tauri::command]
pub fn unzip_to(app: AppHandle, zip_abs: String, dest_rel: String) -> Result<(), String> {
    let dest = paths::resolve(&app, &dest_rel)?;
    fs::create_dir_all(&dest).map_err(|e| format!("mkdirs {dest_rel}: {e}"))?;
    let file =
        fs::File::open(Path::new(&zip_abs)).map_err(|e| format!("Ouverture {zip_abs}: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Lecture ZIP {zip_abs}: {e}"))?;
    archive
        .extract(&dest)
        .map_err(|e| format!("Extraction ZIP: {e}"))?;
    Ok(())
}

// ----- Accès externes (lecture seule) : migration depuis Comptal2 -----

/// Garde-fou limité : le chemin absolu vient du dialog frontend (`save`).
/// On n'accepte que `.csv` (export) et on n'écrit que si le dossier parent
/// existe déjà — pas de `create_dir_all` récursif hors de ce parent.
#[tauri::command]
pub fn write_external_text_file(abs: String, content: String) -> Result<(), String> {
    let mut path = PathBuf::from(&abs);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if ext.is_empty() {
        path.set_extension("csv");
    } else if ext != "csv" {
        return Err("Seul un fichier .csv est autorisé".into());
    }
    let parent = path.parent().ok_or_else(|| "Chemin externe invalide".to_string())?;
    if !parent.exists() || !parent.is_dir() {
        return Err("Dossier parent introuvable".into());
    }
    fs::write(&path, content).map_err(|e| format!("Écriture externe {abs}: {e}"))
}

#[tauri::command]
pub fn read_external_text_file(abs: String) -> Result<String, String> {
    let mut content = String::new();
    fs::File::open(Path::new(&abs))
        .and_then(|mut f| f.read_to_string(&mut content))
        .map_err(|e| format!("Lecture externe {abs}: {e}"))?;
    Ok(content)
}

#[tauri::command]
pub fn read_external_dir(abs: String) -> Result<Vec<FsEntry>, String> {
    let path = PathBuf::from(&abs);
    if !path.exists() {
        return Ok(vec![]);
    }
    list_dir(&path)
}

#[tauri::command]
pub fn external_exists(abs: String) -> bool {
    Path::new(&abs).exists()
}

#[tauri::command]
pub fn write_binary_file(app: AppHandle, rel: String, data: Vec<u8>) -> Result<(), String> {
    let path = paths::resolve(&app, &rel)?;
    ensure_parent(&path)?;
    fs::write(&path, data).map_err(|e| format!("Écriture binaire {rel}: {e}"))
}

#[tauri::command]
pub fn resolve_data_path(app: AppHandle, rel: String) -> Result<String, String> {
    Ok(paths::resolve(&app, &rel)?.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_path(app: AppHandle, abs: String) -> Result<(), String> {
    let requested = PathBuf::from(&abs);
    let canonical = paths::canonicalize_existing(&requested)?;
    let root = paths::data_root(&app)
        .canonicalize()
        .map_err(|e| format!("Racine données: {e}"))?;
    if !paths::is_under(&root, &canonical) {
        return Err("Ouverture hors de la zone de données refusée".into());
    }
    tauri_plugin_opener::open_path(canonical, None::<&str>).map_err(|e| e.to_string())
}

// ----- Helpers internes -----

fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Création parents: {e}"))?;
    }
    Ok(())
}

fn list_dir(path: &Path) -> Result<Vec<FsEntry>, String> {
    let mut entries = Vec::new();
    for entry in fs::read_dir(path).map_err(|e| format!("Lecture dossier: {e}"))? {
        let entry = entry.map_err(|e| format!("Entrée dossier: {e}"))?;
        entries.push(FsEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            is_dir: entry.path().is_dir(),
        });
    }
    entries.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(entries)
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let target = dst.join(entry.file_name());
        if entry.path().is_dir() {
            copy_dir_recursive(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}

fn zip_dir_recursive(
    root: &Path,
    dir: &Path,
    writer: &mut zip::ZipWriter<fs::File>,
    options: zip::write::SimpleFileOptions,
) -> std::io::Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let rel_name = path
            .strip_prefix(root)
            .expect("chemin sous la racine")
            .to_string_lossy()
            .replace('\\', "/");
        if path.is_dir() {
            writer.add_directory(format!("{rel_name}/"), options)?;
            zip_dir_recursive(root, &path, writer, options)?;
        } else {
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");
            // Fichiers journal SQLite : fusionnés via wal_checkpoint avant export.
            if name.ends_with("-wal") || name.ends_with("-shm") {
                continue;
            }
            writer.start_file(rel_name, options)?;
            let mut file = fs::File::open(&path)?;
            std::io::copy(&mut file, writer)?;
        }
    }
    Ok(())
}
