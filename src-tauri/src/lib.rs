// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::path::Path;
use std::process::Command;
use std::time::UNIX_EPOCH;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// ─── Types ──────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
    pub extension: String,
    pub hidden: bool,
    pub git_status: Option<String>,
    pub is_git_repo: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DirectoryListing {
    pub path: String,
    pub entries: Vec<FileEntry>,
    pub parent: Option<String>,
    pub is_git_repo: bool,
    pub git_branch: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ChecksumResult {
    pub md5: String,
    pub sha256: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DuplicateGroup {
    pub size: u64,
    pub paths: Vec<String>,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn build_entry(path: &Path, show_hidden: bool, git_map: &std::collections::HashMap<String, String>) -> Option<FileEntry> {
    let name = path.file_name()?.to_string_lossy().to_string();
    let hidden = name.starts_with('.');
    if !show_hidden && hidden {
        return None;
    }

    let (is_dir, size, modified) = match path.metadata().or_else(|_| path.symlink_metadata()) {
        Ok(meta) => {
            let is_d = meta.is_dir();
            let sz = if meta.is_file() { meta.len() } else { 0 };
            let mtime = meta
                .modified()
                .ok()
                .and_then(|m| m.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            (is_d, sz, mtime)
        }
        Err(_) => {
            let is_d = path.is_dir();
            (is_d, 0, 0)
        }
    };

    let is_git_repo = is_dir && path.join(".git").exists();
    let extension = if !is_dir {
        Path::new(&name).extension().unwrap_or_default().to_string_lossy().to_lowercase()
    } else {
        String::new()
    };
    let git_status = git_map.get(&name).cloned();
    Some(FileEntry { name, path: path.to_string_lossy().to_string(), is_dir, size, modified, extension, hidden, git_status, is_git_repo })
}

fn get_git_branch(dir: &Path) -> Option<String> {
    let mut cmd = Command::new("git");
    cmd.args(["branch", "--show-current"]).current_dir(dir);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);
    let out = cmd.output().ok()?;
    if out.status.success() {
        let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !name.is_empty() { return Some(name); }
    }
    None
}

fn git_status_map(dir: &Path) -> (bool, std::collections::HashMap<String, String>) {
    // Only check if dir itself contains .git folder (do not walk up parent directories)
    if !dir.join(".git").exists() {
        return (false, Default::default());
    }

    let mut cmd = Command::new("git");
    cmd.args(["status", "--porcelain", "-uno", "."])
       .current_dir(dir);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let Ok(out) = cmd.output() else { return (true, Default::default()); };
    if !out.status.success() { return (true, Default::default()); }

    let text = String::from_utf8_lossy(&out.stdout);
    let mut map = std::collections::HashMap::new();
    for line in text.lines() {
        if line.len() < 4 { continue; }
        let xy = &line[..2];
        let status = if xy == "??" { "??".to_string() } else { xy.trim().to_string() };
        let rel_path = line[3..].trim().trim_matches('"');
        let first_component = rel_path.split(['/', '\\']).next().unwrap_or("");
        if !first_component.is_empty() {
            map.insert(first_component.to_string(), status);
        }
    }
    (true, map)
}

// ─── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
fn list_directory(path: String, show_hidden: bool) -> Result<DirectoryListing, String> {
    let mut clean_path = path.trim().to_string();
    if clean_path.len() == 2 && clean_path.ends_with(':') {
        clean_path.push('\\');
    }
    let dir = Path::new(&clean_path).to_path_buf();
    if !dir.exists() { return Err(format!("Path does not exist: {}", clean_path)); }
    if !dir.is_dir() { return Err(format!("Not a directory: {}", clean_path)); }

    // If reading the directory fails (e.g. Windows junctions with Deny ACLs like 'Local Settings'),
    // attempt to resolve the symlink/junction target to read the real directory.
    let (effective_dir, read_entries) = match fs::read_dir(&dir) {
        Ok(entries) => (dir.clone(), entries),
        Err(orig_err) => {
            if let Ok(target) = fs::read_link(&dir) {
                let clean_target = target.to_string_lossy()
                    .strip_prefix(r"\\?\")
                    .unwrap_or(&target.to_string_lossy())
                    .to_string();
                let target_path = Path::new(&clean_target).to_path_buf();
                if let Ok(target_entries) = fs::read_dir(&target_path) {
                    clean_path = clean_target;
                    (target_path, target_entries)
                } else {
                    return Err(format!("Unable to read folder: {}", orig_err));
                }
            } else {
                return Err(format!("Unable to read folder: {}", orig_err));
            }
        }
    };

    let (is_git_repo, git_map) = git_status_map(&effective_dir);
    let git_branch = if is_git_repo { get_git_branch(&effective_dir) } else { None };

    let mut entries: Vec<FileEntry> = read_entries
        .filter_map(|e| e.ok())
        .filter_map(|e| build_entry(&e.path(), show_hidden, &git_map))
        .collect();

    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir { a.name.to_lowercase().cmp(&b.name.to_lowercase()) }
        else if a.is_dir { std::cmp::Ordering::Less }
        else { std::cmp::Ordering::Greater }
    });

    let parent = effective_dir.parent().map(|p| p.to_string_lossy().to_string());
    Ok(DirectoryListing { path: clean_path, entries, parent, is_git_repo, git_branch })
}

// ─── Recycle Bin ─────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn get_user_sid() -> Option<String> {
    let mut cmd = Command::new("whoami");
    cmd.args(["/user", "/fo", "csv", "/nh"]);
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    let out = cmd.output().ok()?;
    if !out.status.success() { return None; }
    let text = String::from_utf8_lossy(&out.stdout);
    // Output: "DOMAIN\\User","S-1-5-21-..."
    let sid = text.trim().rsplit(',').next()?
        .trim_matches('"').trim().to_string();
    if sid.starts_with("S-") { Some(sid) } else { None }
}

#[cfg(target_os = "windows")]
fn parse_dollar_i(path: &Path) -> Option<(String, String, u64, u64)> {
    // Parse $I file: version(8) + size(8) + deletion_time(8) + name_len(4) + name(UTF-16LE)
    let data = fs::read(path).ok()?;
    if data.len() < 28 { return None; }

    let version = u64::from_le_bytes(data[0..8].try_into().ok()?);
    if version != 2 { return None; } // Only support v2 format (Win10+)

    let original_size = u64::from_le_bytes(data[8..16].try_into().ok()?);
    let deletion_filetime = u64::from_le_bytes(data[16..24].try_into().ok()?);
    // Convert FILETIME (100ns intervals since 1601-01-01) to Unix timestamp
    let deletion_unix = if deletion_filetime > 116444736000000000 {
        (deletion_filetime - 116444736000000000) / 10000000
    } else { 0 };

    let _name_len = u32::from_le_bytes(data[24..28].try_into().ok()?) as usize;
    // Read UTF-16LE string from offset 28
    let name_bytes = &data[28..];
    let u16_chars: Vec<u16> = name_bytes.chunks_exact(2)
        .map(|c| u16::from_le_bytes([c[0], c[1]]))
        .take_while(|&c| c != 0)
        .collect();
    let original_path = String::from_utf16(&u16_chars).ok()?;

    Some((original_path.clone(),
          Path::new(&original_path).file_name()?.to_string_lossy().to_string(),
          original_size,
          deletion_unix))
}

#[tauri::command]
fn list_recycle_bin() -> Result<DirectoryListing, String> {
    #[cfg(not(target_os = "windows"))]
    { return Err("Recycle Bin is only supported on Windows".to_string()); }

    #[cfg(target_os = "windows")]
    {
        let sid = get_user_sid().ok_or("Failed to get user SID")?;
        let drives = get_drives();
        let mut entries = Vec::new();

        for drive in &drives {
            let bin_path = Path::new(drive).join("$Recycle.Bin").join(&sid);
            if !bin_path.exists() { continue; }

            let Ok(dir_entries) = fs::read_dir(&bin_path) else { continue; };
            for entry in dir_entries.filter_map(|e| e.ok()) {
                let fname = entry.file_name().to_string_lossy().to_string();
                if !fname.starts_with("$I") { continue; }

                let i_path = entry.path();
                let Some((_original_path, original_name, size, deleted_time)) = parse_dollar_i(&i_path) else { continue; };

                // The $R file is the actual data file
                let r_name = fname.replacen("$I", "$R", 1);
                let r_path = bin_path.join(&r_name);
                let is_dir = r_path.is_dir();

                let extension = if !is_dir {
                    Path::new(&original_name).extension()
                        .unwrap_or_default().to_string_lossy().to_lowercase()
                } else {
                    String::new()
                };

                entries.push(FileEntry {
                    name: original_name,
                    path: r_path.to_string_lossy().to_string(),
                    is_dir,
                    size,
                    modified: deleted_time,
                    extension,
                    hidden: false,
                    git_status: None,
                    is_git_repo: false,
                });
            }
        }

        entries.sort_by(|a, b| b.modified.cmp(&a.modified)); // Most recently deleted first

        Ok(DirectoryListing {
            path: "shell:RecycleBinFolder".to_string(),
            entries,
            parent: None,
            is_git_repo: false,
            git_branch: None,
        })
    }
}

#[tauri::command]
fn autocomplete_path(input: String) -> Vec<String> {
    if input.trim().is_empty() { return Vec::new(); }
    let p = Path::new(&input);

    let (dir, prefix) = if input.ends_with('/') || input.ends_with('\\') || p.is_dir() {
        (p, "".to_string())
    } else if let Some(parent) = p.parent() {
        let prefix = p.file_name().map(|s| s.to_string_lossy().to_lowercase()).unwrap_or_default();
        (parent, prefix)
    } else {
        return Vec::new();
    };

    let Ok(entries) = fs::read_dir(dir) else { return Vec::new(); };
    let mut matches = Vec::new();

    for entry in entries.filter_map(|e| e.ok()) {
        let name = entry.file_name().to_string_lossy().to_string();
        if prefix.is_empty() || name.to_lowercase().starts_with(&prefix) {
            let full_path = entry.path().to_string_lossy().to_string();
            let is_dir = entry.path().is_dir();
            matches.push(if is_dir { format!("{}\\", full_path.trim_end_matches(['/', '\\'])) } else { full_path });
            if matches.len() >= 10 { break; }
        }
    }
    matches
}

#[tauri::command]
fn get_drives() -> Vec<String> {
    #[cfg(target_os = "windows")]
    { (b'A'..=b'Z').map(|c| format!("{}:\\", c as char)).filter(|d| Path::new(d).exists()).collect() }
    #[cfg(not(target_os = "windows"))]
    { vec!["/".to_string()] }
}

#[tauri::command]
fn get_home_dir() -> String {
    #[cfg(target_os = "windows")]
    { std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users".to_string()) }
    #[cfg(not(target_os = "windows"))]
    { std::env::var("HOME").unwrap_or_else(|_| "/home".to_string()) }
}

#[tauri::command]
fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_file(path: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() { let _ = fs::create_dir_all(parent); }
    fs::write(&path, "").map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_path(path: String) -> Result<(), String> {
    let p = Path::new(&path);

    // If deleting an item from Windows $Recycle.Bin ($R...), also delete matching $I metadata file
    if let Some(fname) = p.file_name().map(|s| s.to_string_lossy().to_string()) {
        if fname.starts_with("$R") {
            if let Some(parent) = p.parent() {
                let i_name = fname.replacen("$R", "$I", 1);
                let i_path = parent.join(i_name);
                if i_path.exists() {
                    if i_path.is_dir() { let _ = fs::remove_dir_all(&i_path); }
                    else { let _ = fs::remove_file(&i_path); }
                }
            }
        }
    }

    if p.is_dir() { fs::remove_dir_all(p).map_err(|e| e.to_string()) }
    else { fs::remove_file(p).map_err(|e| e.to_string()) }
}

#[tauri::command]
fn rename_path(from: String, to: String) -> Result<(), String> {
    fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[tauri::command]
fn copy_file(from: String, to: String) -> Result<(), String> {
    let src = Path::new(&from);
    let dst = Path::new(&to);
    if src.is_dir() { copy_dir_recursive(src, dst) }
    else {
        if let Some(parent) = dst.parent() { let _ = fs::create_dir_all(parent); }
        fs::copy(&from, &to).map(|_| ()).map_err(|e| e.to_string())
    }
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let dst_path = dst.join(entry.file_name());
        if entry.path().is_dir() { copy_dir_recursive(&entry.path(), &dst_path)?; }
        else { fs::copy(entry.path(), dst_path).map_err(|e| e.to_string())?; }
    }
    Ok(())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn search_directory(root: String, query: String, show_hidden: bool) -> Vec<FileEntry> {
    let mut results = Vec::new();
    search_recursive(Path::new(&root), &query.to_lowercase(), show_hidden, &mut results, 0);
    results
}

fn search_recursive(dir: &Path, query: &str, show_hidden: bool, results: &mut Vec<FileEntry>, depth: usize) {
    if depth > 6 { return; }
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.filter_map(|e| e.ok()) {
        let name = entry.file_name().to_string_lossy().to_string();
        if !show_hidden && name.starts_with('.') { continue; }
        if name.to_lowercase().contains(query) {
            if let Some(fe) = build_entry(&entry.path(), show_hidden, &Default::default()) {
                results.push(fe);
            }
        }
        if entry.path().is_dir() {
            search_recursive(&entry.path(), query, show_hidden, results, depth + 1);
        }
    }
}

#[tauri::command]
fn compute_checksum(path: String) -> Result<ChecksumResult, String> {
    let mut file = fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut sha256 = Sha256::new();
    let mut md5_state = md5_simple::Md5::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        sha256.update(&buf[..n]);
        md5_state.update(&buf[..n]);
    }
    Ok(ChecksumResult {
        sha256: hex::encode(sha256.finalize()),
        md5: hex::encode(md5_state.finalize()),
    })
}

#[tauri::command]
fn open_terminal(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("wt.exe").args(["--startingDirectory", &path])
            .spawn()
            .or_else(|_| Command::new("cmd.exe").args(["/c", "start", "cmd.exe"]).current_dir(&path).spawn())
            .map(|_| ()).map_err(|e| e.to_string())
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").args(["-a", "Terminal", &path]).spawn().map(|_| ()).map_err(|e| e.to_string())
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xterm").current_dir(&path).spawn().map(|_| ()).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn open_file_default(path: String) -> Result<(), String> {
    if path == "shell:RecycleBinFolder" {
        #[cfg(target_os = "windows")]
        {
            let mut cmd = Command::new("cmd.exe");
            cmd.args(["/c", "start", "shell:RecycleBinFolder"]);
            cmd.creation_flags(0x08000000);
            return cmd.spawn().map(|_| ()).map_err(|e| format!("Failed to open Recycle Bin: {}", e));
        }
        #[cfg(not(target_os = "windows"))]
        {
            return Err("Recycle Bin is only supported on Windows".into());
        }
    }
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File '{}' does not exist.", path));
    }
    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("cmd.exe");
        cmd.args(["/c", "start", "", &path]);
        cmd.creation_flags(0x08000000);
        cmd.spawn().map(|_| ()).map_err(|e| format!("Failed to open file: {}", e))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = Command::new("open");
        cmd.arg(&path);
        cmd.spawn().map(|_| ()).map_err(|e| format!("Failed to open file: {}", e))
    }
}

#[tauri::command]
fn open_in_vscode(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Path '{}' does not exist.", path));
    }

    #[cfg(target_os = "windows")]
    {
        let mut check = Command::new("cmd.exe");
        check.args(["/c", "where", "code"]);
        check.creation_flags(0x08000000);
        let is_installed = check.output().map(|o| o.status.success()).unwrap_or(false);

        if !is_installed {
            return Err("VS Code ('code' command) is not installed or not found in system PATH.".into());
        }

        let mut cmd = Command::new("cmd.exe");
        cmd.args(["/c", "code", &path]);
        cmd.creation_flags(0x08000000);
        cmd.spawn().map(|_| ()).map_err(|e| format!("Failed to launch VS Code: {}", e))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("code")
            .arg(&path)
            .spawn()
            .map(|_| ())
            .map_err(|_| "VS Code ('code' command) is not installed or not found in system PATH.".into())
    }
}

use std::io::Write;
use zip::write::SimpleFileOptions;

#[tauri::command]
fn compress_to_zip(path: String, output_zip: String) -> Result<(), String> {
    let src_path = Path::new(&path);
    let zip_file = fs::File::create(&output_zip).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(zip_file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    if src_path.is_file() {
        let name = src_path.file_name().unwrap().to_string_lossy().to_string();
        zip.start_file(name, options).map_err(|e| e.to_string())?;
        let mut buffer = Vec::new();
        fs::File::open(src_path).map_err(|e| e.to_string())?.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
        zip.write_all(&buffer).map_err(|e| e.to_string())?;
    } else if src_path.is_dir() {
        let parent = src_path.parent().unwrap_or(src_path);
        let it = walkdir_recursive(src_path);
        for entry_path in it {
            let relative_name = entry_path.strip_prefix(parent).unwrap_or(&entry_path).to_string_lossy().replace("\\", "/");
            if entry_path.is_dir() {
                let _ = zip.add_directory(relative_name, options);
            } else {
                zip.start_file(relative_name, options).map_err(|e| e.to_string())?;
                let mut buffer = Vec::new();
                fs::File::open(&entry_path).map_err(|e| e.to_string())?.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
                zip.write_all(&buffer).map_err(|e| e.to_string())?;
            }
        }
    }
    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

fn walkdir_recursive(dir: &Path) -> Vec<std::path::PathBuf> {
    let mut files = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            files.push(path.clone());
            if path.is_dir() {
                files.extend(walkdir_recursive(&path));
            }
        }
    }
    files
}

#[tauri::command]
fn extract_zip(zip_path: String, target_dir: String) -> Result<(), String> {
    let file = fs::File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    let target = Path::new(&target_dir);

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => target.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
            }
            let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContentMatch {
    pub path: String,
    pub line_number: usize,
    pub line_text: String,
}

#[tauri::command]
fn search_file_contents(root: String, query: String, is_regex: bool) -> Vec<ContentMatch> {
    let mut matches = Vec::new();
    if query.is_empty() { return matches; }
    let query_lower = query.to_lowercase();
    grep_recursive(Path::new(&root), &query_lower, is_regex, &mut matches, 0);
    matches
}

fn grep_recursive(dir: &Path, query: &str, is_regex: bool, matches: &mut Vec<ContentMatch>, depth: usize) {
    if depth > 5 || matches.len() >= 200 { return; }
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                let ext_lower = ext.to_lowercase();
                if ["txt", "md", "rs", "ts", "tsx", "js", "jsx", "py", "json", "html", "css", "log", "toml", "yaml", "xml", "csv", "zy", "c", "cpp", "h", "go", "java"].contains(&ext_lower.as_str()) {
                    if let Ok(content) = fs::read_to_string(&path) {
                        for (idx, line) in content.lines().enumerate() {
                            if matches.len() >= 200 { break; }
                            if line.to_lowercase().contains(query) {
                                matches.push(ContentMatch {
                                    path: path.to_string_lossy().to_string(),
                                    line_number: idx + 1,
                                    line_text: line.trim().to_string(),
                                });
                            }
                        }
                    }
                }
            }
        } else if path.is_dir() {
            let name = path.file_name().unwrap_or_default().to_string_lossy();
            if !name.starts_with('.') && name != "node_modules" && name != "target" {
                grep_recursive(&path, query, is_regex, matches, depth + 1);
            }
        }
    }
}

#[tauri::command]
fn find_duplicates(root: String) -> Vec<DuplicateGroup> {
    let mut size_map: std::collections::HashMap<u64, Vec<String>> = Default::default();
    collect_files(Path::new(&root), &mut size_map, 0);
    size_map.into_iter()
        .filter(|(size, paths)| *size > 0 && paths.len() > 1)
        .map(|(size, paths)| DuplicateGroup { size, paths })
        .collect()
}

fn collect_files(dir: &Path, map: &mut std::collections::HashMap<u64, Vec<String>>, depth: usize) {
    if depth > 4 { return; }
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            if let Ok(meta) = path.metadata() {
                map.entry(meta.len()).or_default().push(path.to_string_lossy().to_string());
            }
        } else if path.is_dir() {
            collect_files(&path, map, depth + 1);
        }
    }
}

// ─── Favorites & Tags (persisted to app data) ────────────────────────────────

fn data_file(name: &str) -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    let base = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    #[cfg(not(target_os = "windows"))]
    let base = std::env::var("HOME").map(|h| format!("{}/.config", h)).unwrap_or_else(|_| ".".into());
    let dir = Path::new(&base).join("Zephyr");
    let _ = fs::create_dir_all(&dir);
    dir.join(name)
}

#[tauri::command]
fn get_favorites() -> Vec<String> {
    let path = data_file("favorites.json");
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn set_favorite(path: String, starred: bool) -> Result<(), String> {
    let mut favs = get_favorites();
    if starred { if !favs.contains(&path) { favs.push(path); } }
    else { favs.retain(|p| p != &path); }
    let file = data_file("favorites.json");
    fs::write(file, serde_json::to_string(&favs).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_tags() -> serde_json::Value {
    let path = data_file("tags.json");
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(serde_json::json!({}))
}

#[tauri::command]
fn set_tag(path: String, color: Option<String>) -> Result<(), String> {
    let mut tags: serde_json::Map<String, serde_json::Value> = get_tags()
        .as_object().cloned().unwrap_or_default();
    match color {
        Some(c) => { tags.insert(path, serde_json::Value::String(c)); }
        None => { tags.remove(&path); }
    }
    let file = data_file("tags.json");
    fs::write(file, serde_json::to_string(&tags).unwrap()).map_err(|e| e.to_string())
}

// ─── Simple MD5 implementation ───────────────────────────────────────────────

mod md5_simple {
    pub struct Md5 { state: [u32; 4], count: [u32; 2], buf: [u8; 64], digest: [u8; 16] }
    impl Md5 {
        pub fn new() -> Self {
            Self { state: [0x67452301,0xefcdab89,0x98badcfe,0x10325476], count: [0;2], buf: [0;64], digest: [0;16] }
        }
        pub fn update(&mut self, data: &[u8]) { md5_update(self, data); }
        pub fn finalize(mut self) -> [u8; 16] { md5_final(&mut self); self.digest }
    }

    const S: [u32; 64] = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
    const K: [u32; 64] = [0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391];

    fn md5_transform(state: &mut [u32; 4], block: &[u8; 64]) {
        let (mut a, mut b, mut c, mut d) = (state[0], state[1], state[2], state[3]);
        let mut m = [0u32; 16];
        for i in 0..16 { m[i] = u32::from_le_bytes(block[i*4..i*4+4].try_into().unwrap()); }
        for i in 0usize..64 {
            let (f, g) = match i {
                0..=15 => ((b & c) | (!b & d), i),
                16..=31 => ((d & b) | (!d & c), (5*i+1)%16),
                32..=47 => (b ^ c ^ d, (3*i+5)%16),
                _ => (c ^ (b | !d), (7*i)%16),
            };
            let temp = d; d = c; c = b;
            b = b.wrapping_add((a.wrapping_add(f).wrapping_add(K[i]).wrapping_add(m[g])).rotate_left(S[i]));
            a = temp;
        }
        state[0] = state[0].wrapping_add(a); state[1] = state[1].wrapping_add(b);
        state[2] = state[2].wrapping_add(c); state[3] = state[3].wrapping_add(d);
    }

    fn md5_update(ctx: &mut Md5, data: &[u8]) {
        let mut idx = ((ctx.count[0] >> 3) & 0x3f) as usize;
        ctx.count[0] = ctx.count[0].wrapping_add((data.len() as u32) << 3);
        if ctx.count[0] < (data.len() as u32) << 3 { ctx.count[1] = ctx.count[1].wrapping_add(1); }
        ctx.count[1] = ctx.count[1].wrapping_add((data.len() as u32) >> 29);
        for &byte in data {
            ctx.buf[idx] = byte; idx += 1;
            if idx == 64 { md5_transform(&mut ctx.state, &ctx.buf.clone()); idx = 0; }
        }
    }

    fn md5_final(ctx: &mut Md5) {
        let mut bits = [0u8; 8];
        for i in 0..4 { bits[i] = (ctx.count[0] >> (i*8)) as u8; bits[i+4] = (ctx.count[1] >> (i*8)) as u8; }
        let idx = ((ctx.count[0] >> 3) & 0x3f) as usize;
        let pad_len = if idx < 56 { 56 - idx } else { 120 - idx };
        let mut pad = vec![0u8; pad_len]; pad[0] = 0x80;
        md5_update(ctx, &pad); md5_update(ctx, &bits);
        for i in 0..4 { for j in 0..4 { ctx.digest[i*4+j] = (ctx.state[i] >> (j*8)) as u8; } }
    }
}

// ─── Cache & Extended Types ──────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FolderSizeResult {
    pub size: u64,
    pub file_count: usize,
    pub dir_count: usize,
    pub cached: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DriveInfo {
    pub path: String,
    pub label: String,
    pub is_network: bool,
    pub free_space: u64,
    pub total_space: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileProperties {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub size_on_disk: u64,
    pub created: u64,
    pub modified: u64,
    pub accessed: u64,
    pub readonly: bool,
    pub hidden: bool,
    pub extension: String,
    pub line_count: Option<usize>,
}

struct CacheEntry {
    size: u64,
    file_count: usize,
    dir_count: usize,
    mtime: u64,
}

static FOLDER_SIZE_CACHE: std::sync::OnceLock<std::sync::Arc<std::sync::Mutex<std::collections::HashMap<String, CacheEntry>>>> = std::sync::OnceLock::new();

fn get_cache() -> &'static std::sync::Arc<std::sync::Mutex<std::collections::HashMap<String, CacheEntry>>> {
    FOLDER_SIZE_CACHE.get_or_init(|| std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())))
}

// ─── Smart Cached Folder Size Calculation ─────────────────────────────────────

#[tauri::command]
fn get_folder_size(path: String) -> Result<FolderSizeResult, String> {
    let p = Path::new(&path);
    if !p.exists() || !p.is_dir() {
        return Err("Path is not a valid directory".into());
    }

    let metadata = p.metadata().map_err(|e| e.to_string())?;
    let mtime = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    // Fast Cache Check
    {
        let cache = get_cache().lock().unwrap();
        if let Some(entry) = cache.get(&path) {
            if entry.mtime == mtime && mtime != 0 {
                return Ok(FolderSizeResult {
                    size: entry.size,
                    file_count: entry.file_count,
                    dir_count: entry.dir_count,
                    cached: true,
                });
            }
        }
    }

    // Recursive calculation
    let mut total_size: u64 = 0;
    let mut file_count: usize = 0;
    let mut dir_count: usize = 0;
    let mut stack = vec![p.to_path_buf()];

    while let Some(current_dir) = stack.pop() {
        if let Ok(entries) = fs::read_dir(&current_dir) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                if let Ok(meta) = entry_path.metadata() {
                    if meta.is_dir() {
                        dir_count += 1;
                        // Avoid deep recurse into hidden/system dirs like .git or node_modules for speed if stack is large
                        let name = entry_path.file_name().unwrap_or_default().to_string_lossy();
                        if name != "node_modules" && name != ".git" && name != "AppData" && name != "Cache" && name != "Temp" && name != "$Recycle.Bin" && name != "System Volume Information" && file_count < 15_000 && stack.len() < 100 {
                            stack.push(entry_path);
                        }
                    } else {
                        file_count += 1;
                        total_size += meta.len();
                    }
                }
            }
        }
    }

    // Update Cache
    {
        let mut cache = get_cache().lock().unwrap();
        cache.insert(path, CacheEntry {
            size: total_size,
            file_count,
            dir_count,
            mtime,
        });
    }

    Ok(FolderSizeResult {
        size: total_size,
        file_count,
        dir_count,
        cached: false,
    })
}

// ─── Extended File Properties ────────────────────────────────────────────────

#[tauri::command]
fn get_file_properties(path: String) -> Result<FileProperties, String> {
    let p = Path::new(&path);
    let metadata = p.metadata().map_err(|e| e.to_string())?;

    let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();
    let is_dir = metadata.is_dir();
    let size = metadata.len();
    // Size on disk approximation (aligned to 4KB clusters)
    let size_on_disk = if is_dir { 0 } else { ((size + 4095) / 4096) * 4096 };

    let created = metadata.created().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);
    let modified = metadata.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);
    let accessed = metadata.accessed().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);

    let readonly = metadata.permissions().readonly();
    let hidden = name.starts_with('.');

    let extension = if !is_dir {
        p.extension().unwrap_or_default().to_string_lossy().to_lowercase()
    } else {
        String::new()
    };

    let line_count = if !is_dir && size < 5 * 1024 * 1024 {
        fs::read_to_string(p).ok().map(|content| content.lines().count())
    } else {
        None
    };

    Ok(FileProperties {
        name,
        path,
        is_dir,
        size,
        size_on_disk,
        created,
        modified,
        accessed,
        readonly,
        hidden,
        extension,
        line_count,
    })
}

// ─── Enhanced Drive & Network Shares ──────────────────────────────────────────

#[tauri::command]
fn get_drives_info() -> Vec<DriveInfo> {
    let mut drives = Vec::new();
    #[cfg(target_os = "windows")]
    {
        for letter in b'A'..=b'Z' {
            let drive_str = format!("{}:\\", letter as char);
            let path = Path::new(&drive_str);
            if path.exists() {
                let is_network = letter == b'Z' || letter == b'Y' || letter == b'X'; // Detect remote network mappings
                let label = if is_network { format!("Network Drive ({}:)", letter as char) } else { format!("Local Disk ({}:)", letter as char) };
                drives.push(DriveInfo {
                    path: drive_str,
                    label,
                    is_network,
                    free_space: 0,
                    total_space: 0,
                });
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        drives.push(DriveInfo {
            path: "/".into(),
            label: "Root File System".into(),
            is_network: false,
            free_space: 0,
            total_space: 0,
        });
    }
    drives
}

// ─── Run ─────────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_directory,
            autocomplete_path,
            get_drives,
            get_drives_info,
            get_home_dir,
            create_directory,
            create_file,
            delete_path,
            rename_path,
            copy_file,
            read_text_file,
            search_directory,
            compute_checksum,
            open_terminal,
            open_in_vscode,
            open_file_default,
            find_duplicates,
            get_favorites,
            set_favorite,
            get_tags,
            set_tag,
            get_folder_size,
            get_file_properties,
            compress_to_zip,
            extract_zip,
            search_file_contents,
            list_recycle_bin,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Zephyr");
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_create_and_delete_file() {
        let temp_dir = std::env::temp_dir().join("zephyr_test_create_delete");
        let _ = fs::create_dir_all(&temp_dir);

        let file_path = temp_dir.join("sample.txt").to_string_lossy().to_string();
        let res = create_file(file_path.clone());
        assert!(res.is_ok());
        assert!(Path::new(&file_path).exists());

        let del_res = delete_path(file_path.clone());
        assert!(del_res.is_ok());
        assert!(!Path::new(&file_path).exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_copy_file_and_directory() {
        let temp_dir = std::env::temp_dir().join("zephyr_test_copy");
        let src_dir = temp_dir.join("src_folder");
        let dst_dir = temp_dir.join("dst_folder");

        let _ = fs::create_dir_all(&src_dir);
        fs::write(src_dir.join("file1.txt"), "hello world").unwrap();

        let copy_res = copy_file(
            src_dir.to_string_lossy().to_string(),
            dst_dir.to_string_lossy().to_string(),
        );
        assert!(copy_res.is_ok());

        assert!(dst_dir.join("file1.txt").exists());
        assert_eq!(fs::read_to_string(dst_dir.join("file1.txt")).unwrap(), "hello world");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_folder_size_caching() {
        let temp_dir = std::env::temp_dir().join("zephyr_test_size_cache");
        let _ = fs::create_dir_all(&temp_dir);

        fs::write(temp_dir.join("a.txt"), "1234567890").unwrap(); // 10 bytes
        fs::write(temp_dir.join("b.txt"), "12345").unwrap();      // 5 bytes

        let path_str = temp_dir.to_string_lossy().to_string();

        // First call: calculated
        let res1 = get_folder_size(path_str.clone()).unwrap();
        assert_eq!(res1.size, 15);
        assert_eq!(res1.file_count, 2);
        assert_eq!(res1.cached, false);

        // Second call: cached
        let res2 = get_folder_size(path_str.clone()).unwrap();
        assert_eq!(res2.size, 15);
        assert_eq!(res2.file_count, 2);
        assert_eq!(res2.cached, true);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_file_properties() {
        let temp_dir = std::env::temp_dir().join("zephyr_test_properties");
        let _ = fs::create_dir_all(&temp_dir);

        let file_path = temp_dir.join("code.rs");
        fs::write(&file_path, "fn main() {\n  println!(\"Hello\");\n}\n").unwrap();

        let props = get_file_properties(file_path.to_string_lossy().to_string()).unwrap();
        assert_eq!(props.name, "code.rs");
        assert_eq!(props.extension, "rs");
        assert_eq!(props.is_dir, false);
        assert_eq!(props.line_count, Some(3));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_checksum() {
        let temp_dir = std::env::temp_dir().join("zephyr_test_checksum");
        let _ = fs::create_dir_all(&temp_dir);

        let file_path = temp_dir.join("data.txt");
        fs::write(&file_path, "zephyr").unwrap();

        let checksums = compute_checksum(file_path.to_string_lossy().to_string()).unwrap();
        assert!(!checksums.md5.is_empty());
        assert!(!checksums.sha256.is_empty());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_zip_compress_and_extract() {
        let temp_dir = std::env::temp_dir().join("zephyr_test_zip");
        let src_dir = temp_dir.join("source");
        let extract_dir = temp_dir.join("extracted");
        let zip_file = temp_dir.join("archive.zip");

        let _ = fs::create_dir_all(&src_dir);
        fs::write(src_dir.join("test.txt"), "zip content test").unwrap();

        let comp_res = compress_to_zip(
            src_dir.to_string_lossy().to_string(),
            zip_file.to_string_lossy().to_string(),
        );
        assert!(comp_res.is_ok());
        assert!(zip_file.exists());

        let ext_res = extract_zip(
            zip_file.to_string_lossy().to_string(),
            extract_dir.to_string_lossy().to_string(),
        );
        assert!(ext_res.is_ok());
        assert!(extract_dir.join("source").join("test.txt").exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_search_file_contents() {
        let temp_dir = std::env::temp_dir().join("zephyr_test_grep");
        let _ = fs::create_dir_all(&temp_dir);

        let file_path = temp_dir.join("code.rs");
        fs::write(&file_path, "fn target_function() {\n  println!(\"magic_keyword\");\n}\n").unwrap();

        let matches = search_file_contents(temp_dir.to_string_lossy().to_string(), "magic_keyword".to_string(), false);
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].line_number, 2);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_list_directory_projects() {
        let path = r"C:\Users\andre\OneDrive\Desktop\projects".to_string();
        let listing = list_directory(path, false).expect("list_directory failed");
        assert!(listing.entries.len() > 0, "projects directory returned 0 entries!");
    }

    #[test]
    fn test_list_directory_errors() {
        assert!(list_directory("C:\\non_existent_folder_xyz_12345".to_string(), false).is_err());
    }

    #[test]
    fn test_list_directory_with_symlink_or_junction() {
        let temp_dir = std::env::temp_dir().join("zephyr_test_symlink_nav");
        let target_dir = temp_dir.join("real_target");
        let link_dir = temp_dir.join("link_target");

        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&target_dir);
        fs::write(target_dir.join("hello.txt"), "hello world").unwrap();

        #[cfg(target_os = "windows")]
        {
            let _ = std::os::windows::fs::symlink_dir(&target_dir, &link_dir);
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = std::os::unix::fs::symlink(&target_dir, &link_dir);
        }

        if link_dir.exists() {
            let listing = list_directory(link_dir.to_string_lossy().to_string(), false).unwrap();
            assert!(listing.entries.iter().any(|e| e.name == "hello.txt"));
        }

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_autocomplete_path() {
        let temp_dir = std::env::temp_dir().join("zephyr_test_autocomplete");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(temp_dir.join("subfolder1"));
        let _ = fs::create_dir_all(temp_dir.join("subfolder2"));
        let _ = fs::write(temp_dir.join("alpha.txt"), "a");
        let _ = fs::write(temp_dir.join("alpine.rs"), "b");

        let base_str = format!("{}\\", temp_dir.to_string_lossy());
        let matches = autocomplete_path(base_str);
        assert!(matches.len() >= 4);

        let query = format!("{}\\alp", temp_dir.to_string_lossy());
        let filtered = autocomplete_path(query);
        assert_eq!(filtered.len(), 2);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_get_drives_and_home_dir() {
        let drives = get_drives();
        assert!(!drives.is_empty());

        let drives_info = get_drives_info();
        assert!(!drives_info.is_empty());

        let home = get_home_dir();
        assert!(!home.is_empty());
        assert!(Path::new(&home).exists());
    }

    #[test]
    fn test_create_directory_and_rename_path() {
        let temp_dir = std::env::temp_dir().join("zephyr_test_createdir");
        let _ = fs::remove_dir_all(&temp_dir);

        let nested = temp_dir.join("a").join("b").join("c");
        assert!(create_directory(nested.to_string_lossy().to_string()).is_ok());
        assert!(nested.exists());

        let from_file = nested.join("file_orig.txt");
        let to_file = nested.join("file_renamed.txt");
        let _ = fs::write(&from_file, "rename test");

        assert!(rename_path(from_file.to_string_lossy().to_string(), to_file.to_string_lossy().to_string()).is_ok());
        assert!(!from_file.exists());
        assert!(to_file.exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_read_text_file() {
        let temp_dir = std::env::temp_dir().join("zephyr_test_readtext");
        let _ = fs::create_dir_all(&temp_dir);
        let sample = temp_dir.join("sample.txt");
        let _ = fs::write(&sample, "Hello Zephyr!\nLine 2");

        let content = read_text_file(sample.to_string_lossy().to_string()).unwrap();
        assert_eq!(content, "Hello Zephyr!\nLine 2");

        assert!(read_text_file(temp_dir.join("non_existent.txt").to_string_lossy().to_string()).is_err());
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_search_directory_recursive() {
        let temp_dir = std::env::temp_dir().join("zephyr_test_searchdir");
        let _ = fs::remove_dir_all(&temp_dir);
        let deep = temp_dir.join("level1").join("level2");
        let _ = fs::create_dir_all(&deep);

        let _ = fs::write(temp_dir.join("target_top.txt"), "a");
        let _ = fs::write(deep.join("target_deep.txt"), "b");
        let _ = fs::write(deep.join("other.txt"), "c");

        let results = search_directory(temp_dir.to_string_lossy().to_string(), "target".to_string(), false);
        assert_eq!(results.len(), 2);
        assert!(results.iter().any(|r| r.name == "target_top.txt"));
        assert!(results.iter().any(|r| r.name == "target_deep.txt"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_find_duplicates() {
        let temp_dir = std::env::temp_dir().join("zephyr_test_duplicates");
        let _ = fs::remove_dir_all(&temp_dir);
        let sub = temp_dir.join("subdir");
        let _ = fs::create_dir_all(&sub);

        let _ = fs::write(temp_dir.join("dup1.bin"), "duplicate payload data 12345");
        let _ = fs::write(sub.join("dup2.bin"), "duplicate payload data 12345");
        let _ = fs::write(temp_dir.join("unique.bin"), "unique data 999");

        let groups = find_duplicates(temp_dir.to_string_lossy().to_string());
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].paths.len(), 2);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_favorites_and_tags() {
        let path = "C:\\test\\favorite\\item.txt".to_string();
        let _ = set_favorite(path.clone(), true);
        let favs = get_favorites();
        assert!(favs.contains(&path));

        let _ = set_favorite(path.clone(), false);
        let favs_after = get_favorites();
        assert!(!favs_after.contains(&path));

        let tag_path = "C:\\test\\tag\\item.txt".to_string();
        let _ = set_tag(tag_path.clone(), Some("#38bdf8".to_string()));
        let tags = get_tags();
        assert_eq!(tags.get(&tag_path).and_then(|v| v.as_str()), Some("#38bdf8"));

        let _ = set_tag(tag_path.clone(), None);
        let tags_after = get_tags();
        assert!(tags_after.get(&tag_path).is_none());
    }

    #[test]
    fn test_build_entry_properties() {
        let temp_dir = std::env::temp_dir().join("zephyr_test_build_entry");
        let _ = fs::create_dir_all(&temp_dir);

        let hidden_file = temp_dir.join(".hidden.txt");
        let normal_file = temp_dir.join("document.pdf");
        let _ = fs::write(&hidden_file, "h");
        let _ = fs::write(&normal_file, "n");

        let empty_git = std::collections::HashMap::new();

        let hidden_res = build_entry(&hidden_file, false, &empty_git);
        assert!(hidden_res.is_none());

        let hidden_show = build_entry(&hidden_file, true, &empty_git);
        assert!(hidden_show.is_some());
        assert_eq!(hidden_show.unwrap().hidden, true);

        let normal_entry = build_entry(&normal_file, false, &empty_git).unwrap();
        assert_eq!(normal_entry.extension, "pdf");
        assert_eq!(normal_entry.is_dir, false);
        assert_eq!(normal_entry.hidden, false);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_list_directory_sorting_order() {
        let temp_dir = std::env::temp_dir().join("zephyr_test_sorting");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let _ = fs::write(temp_dir.join("z_file.txt"), "z");
        let _ = fs::write(temp_dir.join("a_file.txt"), "a");
        let _ = fs::create_dir_all(temp_dir.join("m_folder"));
        let _ = fs::create_dir_all(temp_dir.join("b_folder"));

        let listing = list_directory(temp_dir.to_string_lossy().to_string(), false).unwrap();
        assert_eq!(listing.entries.len(), 4);
        // Folders come first alphabetically
        assert_eq!(listing.entries[0].name, "b_folder");
        assert!(listing.entries[0].is_dir);
        assert_eq!(listing.entries[1].name, "m_folder");
        assert!(listing.entries[1].is_dir);
        // Files follow alphabetically
        assert_eq!(listing.entries[2].name, "a_file.txt");
        assert!(!listing.entries[2].is_dir);
        assert_eq!(listing.entries[3].name, "z_file.txt");
        assert!(!listing.entries[3].is_dir);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_git_status_and_branch() {
        let temp_dir = std::env::temp_dir().join("zephyr_test_non_git");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let (is_repo, map) = git_status_map(&temp_dir);
        assert!(!is_repo);
        assert!(map.is_empty());

        let branch = get_git_branch(&temp_dir);
        assert!(branch.is_none());

        let _ = fs::remove_dir_all(&temp_dir);
    }
}

