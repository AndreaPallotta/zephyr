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
    let metadata = path.metadata().ok()?;
    let name = path.file_name()?.to_string_lossy().to_string();
    let hidden = name.starts_with('.');
    if !show_hidden && hidden {
        return None;
    }
    let is_dir = metadata.is_dir();
    let is_git_repo = is_dir && path.join(".git").exists();
    let size = if metadata.is_file() { metadata.len() } else { 0 };
    let modified = metadata
        .modified().ok()?
        .duration_since(UNIX_EPOCH).ok()?
        .as_secs();
    let extension = if metadata.is_file() {
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
    // Quick check: walk up parent directories to find if we're inside a git repository
    let mut is_repo = false;
    let mut curr = Some(dir);
    while let Some(d) = curr {
        if d.join(".git").exists() {
            is_repo = true;
            break;
        }
        curr = d.parent();
    }

    if !is_repo {
        return (false, Default::default());
    }

    let mut cmd = Command::new("git");
    cmd.args(["status", "--porcelain", "-u", "normal", "."])
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
    let dir = Path::new(&path);
    if !dir.exists() { return Err(format!("Path does not exist: {}", path)); }
    if !dir.is_dir() { return Err(format!("Not a directory: {}", path)); }

    let (is_git_repo, git_map) = git_status_map(dir);
    let git_branch = if is_git_repo { get_git_branch(dir) } else { None };

    let mut entries: Vec<FileEntry> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| build_entry(&e.path(), show_hidden, &git_map))
        .collect();

    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir { a.name.to_lowercase().cmp(&b.name.to_lowercase()) }
        else if a.is_dir { std::cmp::Ordering::Less }
        else { std::cmp::Ordering::Greater }
    });

    let parent = dir.parent().map(|p| p.to_string_lossy().to_string());
    Ok(DirectoryListing { path, entries, parent, is_git_repo, git_branch })
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
fn open_in_vscode(path: String) -> Result<(), String> {
    let mut cmd = Command::new("code");
    cmd.arg(&path);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);
    cmd.spawn().map(|_| ()).map_err(|e| e.to_string())
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

// ─── Run ─────────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_directory,
            autocomplete_path,
            get_drives,
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
            find_duplicates,
            get_favorites,
            set_favorite,
            get_tags,
            set_tag,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Zephyr");
}
