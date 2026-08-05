import { FileEntry } from "./api";
import {
  Folder, FolderGit2, File, FileText, FileImage, FileVideo, FileAudio,
  FileCode, FileArchive, FileJson, FileType, Terminal,
  Package, Table,
} from "lucide-react";

interface FileIconProps {
  entry: FileEntry;
  size?: number;
  color?: string;
}

const EXT_MAP: Record<string, { icon: React.ComponentType<any>; color: string }> = {
  // Code
  rs: { icon: FileCode, color: "#f0883e" },
  zy: { icon: FileCode, color: "#38bdf8" },
  ts: { icon: FileCode, color: "#3178c6" },
  tsx: { icon: FileCode, color: "#3178c6" },
  js: { icon: FileCode, color: "#f7df1e" },
  jsx: { icon: FileCode, color: "#61dafb" },
  py: { icon: FileCode, color: "#3572A5" },
  go: { icon: FileCode, color: "#00ADD8" },
  c: { icon: FileCode, color: "#555555" },
  cpp: { icon: FileCode, color: "#f34b7d" },
  cs: { icon: FileCode, color: "#178600" },
  html: { icon: FileCode, color: "#e34c26" },
  css: { icon: FileCode, color: "#563d7c" },
  // Data
  json: { icon: FileJson, color: "#cbcb41" },
  toml: { icon: FileJson, color: "#9c4221" },
  yaml: { icon: FileJson, color: "#cb171e" },
  yml: { icon: FileJson, color: "#cb171e" },
  xml: { icon: FileCode, color: "#e37933" },
  csv: { icon: Table, color: "#3fb950" },
  // Text
  md: { icon: FileText, color: "#8b949e" },
  txt: { icon: FileText, color: "#8b949e" },
  log: { icon: FileText, color: "#484f58" },
  // Images
  png: { icon: FileImage, color: "#bc8cff" },
  jpg: { icon: FileImage, color: "#bc8cff" },
  jpeg: { icon: FileImage, color: "#bc8cff" },
  gif: { icon: FileImage, color: "#bc8cff" },
  svg: { icon: FileImage, color: "#f0883e" },
  webp: { icon: FileImage, color: "#bc8cff" },
  // Video
  mp4: { icon: FileVideo, color: "#f85149" },
  mkv: { icon: FileVideo, color: "#f85149" },
  mov: { icon: FileVideo, color: "#f85149" },
  avi: { icon: FileVideo, color: "#f85149" },
  // Audio
  mp3: { icon: FileAudio, color: "#3fb950" },
  wav: { icon: FileAudio, color: "#3fb950" },
  flac: { icon: FileAudio, color: "#3fb950" },
  // Archives
  zip: { icon: FileArchive, color: "#d29922" },
  tar: { icon: FileArchive, color: "#d29922" },
  gz: { icon: FileArchive, color: "#d29922" },
  "7z": { icon: FileArchive, color: "#d29922" },
  // Executables
  exe: { icon: Terminal, color: "#3fb950" },
  sh: { icon: Terminal, color: "#3fb950" },
  bat: { icon: Terminal, color: "#3fb950" },
  // Packages
  deb: { icon: Package, color: "#f0883e" },
  rpm: { icon: Package, color: "#f0883e" },
  // Docs
  pdf: { icon: FileType, color: "#f85149" },
};

export default function FileIcon({ entry, size = 16, color }: FileIconProps) {
  if (entry.is_dir) {
    if (entry.is_git_repo) {
      return <FolderGit2 size={size} color={color || "#f0883e"} strokeWidth={1.5} className="file-icon" />;
    }
    return <Folder size={size} color={color || "#38bdf8"} strokeWidth={1.5} className="file-icon" />;
  }
  const match = EXT_MAP[entry.extension?.toLowerCase()];
  if (match) {
    const Icon = match.icon;
    return <Icon size={size} color={color || match.color} strokeWidth={1.5} className="file-icon" />;
  }
  return <File size={size} color={color || "#8b949e"} strokeWidth={1.5} className="file-icon" />;
}
