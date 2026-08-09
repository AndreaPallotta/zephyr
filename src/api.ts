import { invoke } from "@tauri-apps/api/core";

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  extension: string;
  hidden: boolean;
  git_status?: string;
  is_git_repo?: boolean;
}

export interface DirectoryListing {
  path: string;
  entries: FileEntry[];
  parent: string | null;
  is_git_repo: boolean;
  git_branch?: string | null;
}

export interface ChecksumResult {
  md5: string;
  sha256: string;
}

export interface DuplicateGroup {
  size: number;
  paths: string[];
}

export const listDirectory = (path: string, showHidden: boolean): Promise<DirectoryListing> =>
  invoke("list_directory", { path, showHidden });

export const listRecycleBin = (): Promise<DirectoryListing> =>
  invoke("list_recycle_bin");

export const autocompletePath = (input: string): Promise<string[]> =>
  invoke("autocomplete_path", { input });

export const getDrives = (): Promise<string[]> =>
  invoke("get_drives");

export const getHomeDir = (): Promise<string> =>
  invoke("get_home_dir");

export const createDirectory = (path: string): Promise<void> =>
  invoke("create_directory", { path });

export const createFile = (path: string): Promise<void> =>
  invoke("create_file", { path });

export const deletePath = (path: string): Promise<void> =>
  invoke("delete_path", { path });

export const renamePath = (from: string, to: string): Promise<void> =>
  invoke("rename_path", { from, to });

export const copyFile = (from: string, to: string): Promise<void> =>
  invoke("copy_file", { from, to });

export const readTextFile = (path: string): Promise<string> =>
  invoke("read_text_file", { path });

export const searchDirectory = (root: string, query: string, showHidden: boolean): Promise<FileEntry[]> =>
  invoke("search_directory", { root, query, showHidden });

export const computeChecksum = (path: string): Promise<ChecksumResult> =>
  invoke("compute_checksum", { path });

export const openTerminal = (path: string): Promise<void> =>
  invoke("open_terminal", { path });

export const openInVscode = (path: string): Promise<void> =>
  invoke("open_in_vscode", { path });

export const openFileDefault = (path: string): Promise<void> =>
  invoke("open_file_default", { path });

export const compressToZip = (path: string, outputZip: string): Promise<void> =>
  invoke("compress_to_zip", { path, outputZip });

export const extractZip = (zipPath: string, targetDir: string): Promise<void> =>
  invoke("extract_zip", { zipPath, targetDir });

export interface ContentMatch {
  path: string;
  line_number: number;
  line_text: string;
}

export const searchFileContents = (root: string, query: string, isRegex: boolean): Promise<ContentMatch[]> =>
  invoke("search_file_contents", { root, query, isRegex });

export const findDuplicates = (root: string): Promise<DuplicateGroup[]> =>
  invoke("find_duplicates", { root });

export const getFavorites = (): Promise<string[]> =>
  invoke("get_favorites");

export const setFavorite = (path: string, starred: boolean): Promise<void> =>
  invoke("set_favorite", { path, starred });

export const getTags = (): Promise<Record<string, string>> =>
  invoke("get_tags");

export const setTag = (path: string, color: string | null): Promise<void> =>
  invoke("set_tag", { path, color });

export interface FolderSizeResult {
  size: number;
  file_count: number;
  dir_count: number;
  cached: boolean;
}

export interface DriveInfo {
  path: string;
  label: string;
  is_network: boolean;
  free_space: number;
  total_space: number;
}

export interface FileProperties {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  size_on_disk: number;
  created: number;
  modified: number;
  accessed: number;
  readonly: boolean;
  hidden: boolean;
  extension: string;
  line_count?: number;
}

export const getFolderSize = (path: string): Promise<FolderSizeResult> =>
  invoke("get_folder_size", { path });

export const getFileProperties = (path: string): Promise<FileProperties> =>
  invoke("get_file_properties", { path });

export const getDrivesInfo = (): Promise<DriveInfo[]> =>
  invoke("get_drives_info");

// ─── Utilities ───────────────────────────────────────────────────────────────

export function formatSize(bytes: number): string {
  if (bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDate(unix: number): string {
  if (!unix) return "";
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function getPathSegments(path: string): { label: string; path: string }[] {
  if (path === "shell:RecycleBinFolder") {
    return [{ label: "Recycle Bin", path: "shell:RecycleBinFolder" }];
  }
  if (path.startsWith("workspace:")) {
    const name = path.slice(10);
    return [{ label: `Workspace: ${name}`, path }];
  }
  const sep = path.includes("\\") ? "\\" : "/";
  const parts = path.split(sep).filter(Boolean);
  return parts.map((label, i) => ({
    label,
    path: parts.slice(0, i + 1).join(sep) + (i === 0 && sep === "\\" ? sep : ""),
  }));
}

export function joinPath(base: string, name: string): string {
  const sep = base.includes("\\") ? "\\" : "/";
  return base.replace(/[\\/]+$/, "") + sep + name;
}

export const GIT_STATUS_COLORS: Record<string, string> = {
  "M": "#d29922",   // modified - yellow
  "A": "#3fb950",   // added - green
  "D": "#f85149",   // deleted - red
  "R": "#38bdf8",   // renamed - blue
  "??": "#8b949e",  // untracked - gray
  "!": "#484f58",   // ignored
};

export const TAG_COLORS = [
  { label: "Red",    value: "#f85149" },
  { label: "Orange", value: "#f0883e" },
  { label: "Yellow", value: "#d29922" },
  { label: "Green",  value: "#3fb950" },
  { label: "Blue",   value: "#38bdf8" },
  { label: "Purple", value: "#bc8cff" },
];
