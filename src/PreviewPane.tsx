import { useState, useEffect } from "react";
import {
  FileEntry, ChecksumResult, DuplicateGroup, FolderSizeResult, getFolderSize,
  readTextFile, computeChecksum, findDuplicates,
  formatSize, formatDate, getTags, setTag, setFavorite, getFavorites,
  TAG_COLORS,
} from "./api";
import FileIcon from "./FileIcon";
import { X, Calendar, HardDrive, FileType, Star, Loader2, Copy, Check, AlertTriangle } from "lucide-react";

interface PreviewPaneProps {
  entry: FileEntry | null;
  currentDir: string;
  onClose: () => void;
  onNavigate?: (path: string) => void;
}

const TEXT_EXTENSIONS = new Set([
  "txt","md","rs","zy","ts","tsx","js","jsx","py","go","c","cpp","cs","html","css",
  "json","toml","yaml","yml","xml","sh","bat","log","env","gitignore","sql","graphql",
  "lock","ini","cfg","conf","dockerfile","makefile","cmake","gradle","properties",
]);
const IMAGE_EXTENSIONS = new Set(["png","jpg","jpeg","gif","webp","svg","bmp","ico"]);

function useCopyText() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return { copied, copy };
}

export default function PreviewPane({ entry, currentDir, onClose, onNavigate }: PreviewPaneProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [checksum, setChecksum] = useState<ChecksumResult | null>(null);
  const [loadingChecksum, setLoadingChecksum] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [tags, setTags] = useState<Record<string, string>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [textError, setTextError] = useState<string | null>(null);
  const sha256Copy = useCopyText();
  const md5Copy = useCopyText();

  // Load tags & favorites on mount
  useEffect(() => {
    getTags().then(setTags);
    getFavorites().then(setFavorites);
  }, []);

  // Load text preview when entry changes
  useEffect(() => {
    setTextContent(null); setTextError(null); setChecksum(null);
    if (!entry || entry.is_dir) return;
    const ext = entry.extension?.toLowerCase();
    if (TEXT_EXTENSIONS.has(ext)) {
      setLoadingText(true);
      readTextFile(entry.path)
        .then(t => setTextContent(t.slice(0, 10000)))
        .catch(() => setTextError("Cannot read file."))
        .finally(() => setLoadingText(false));
    }
  }, [entry?.path]);

  if (!entry) return (
    <div style={paneStyle}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text-muted)" }}>
        <FileType size={36} opacity={0.2} />
        <span style={{ fontSize: 12 }}>Select a file to preview</span>
      </div>
    </div>
  );

  const ext = entry.extension?.toLowerCase();
  const isImage = IMAGE_EXTENSIONS.has(ext);
  const isText = TEXT_EXTENSIONS.has(ext);
  const isFav = favorites.includes(entry.path);
  const tagColor = tags[entry.path];

  const toggleFav = async () => {
    await setFavorite(entry.path, !isFav);
    setFavorites(await getFavorites());
  };

  const handleSetTag = async (color: string | null) => {
    await setTag(entry.path, color);
    setTags(await getTags());
  };

  const handleChecksum = () => {
    if (checksum || loadingChecksum || entry.is_dir) return;
    setLoadingChecksum(true);
    computeChecksum(entry.path).then(setChecksum).finally(() => setLoadingChecksum(false));
  };

  const handleDuplicates = () => {
    setShowDuplicates(true);
    setLoadingDuplicates(true);
    findDuplicates(currentDir).then(setDuplicates).finally(() => setLoadingDuplicates(false));
  };

  const [folderStats, setFolderStats] = useState<FolderSizeResult | null>(null);
  const [loadingFolderStats, setLoadingFolderStats] = useState(false);

  // Load folder stats when folder entry changes
  useEffect(() => {
    setFolderStats(null);
    if (entry && entry.is_dir) {
      setLoadingFolderStats(true);
      getFolderSize(entry.path)
        .then(setFolderStats)
        .catch(() => {})
        .finally(() => setLoadingFolderStats(false));
    }
  }, [entry?.path]);

  return (
    <div style={paneStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <FileIcon entry={entry} size={15} />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: 500 }}>
          {entry.name}
        </span>
        <button onClick={toggleFav} title={isFav ? "Unfavorite" : "Favorite"} style={iconBtnStyle}>
          <Star size={13} fill={isFav ? "#d29922" : "none"} color={isFav ? "#d29922" : "var(--text-muted)"} />
        </button>
        <button onClick={onClose} style={iconBtnStyle}><X size={13} /></button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {isImage && (
          <div style={{ padding: 12, display: "flex", justifyContent: "center" }}>
            <img
              src={`https://asset.localhost/${entry.path.replace(/\\/g, "/")}`}
              alt={entry.name}
              style={{ maxWidth: "100%", borderRadius: 6, border: "1px solid var(--border)" }}
            />
          </div>
        )}
        {isText && (
          <>
            {loadingText && <Loading text="Loading preview..." />}
            {textError && <div style={{ padding: 12, color: "var(--red)", fontSize: 12 }}>{textError}</div>}
            {textContent !== null && (
              <pre style={preStyle}>
                {textContent}
                {textContent.length >= 10000 && <span style={{ color: "var(--text-muted)" }}>{"\n\n...truncated"}</span>}
              </pre>
            )}
          </>
        )}
        {!isImage && !isText && !entry.is_dir && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 10, color: "var(--text-muted)" }}>
            <FileIcon entry={entry} size={48} />
            <span style={{ fontSize: 12 }}>No preview available</span>
          </div>
        )}
        {entry.is_dir && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
            <FileIcon entry={entry} size={54} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{entry.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Folder Directory</div>
            </div>

            {loadingFolderStats && <Loading text="Calculating folder size..." />}
            {folderStats && (
              <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "12px 14px", width: "100%", fontSize: 11, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-muted)" }}>Calculated Size</span>
                  <span style={{ fontWeight: 600, color: "var(--accent)" }}>{formatSize(folderStats.size)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-muted)" }}>Files Count</span>
                  <span style={{ color: "var(--text-secondary)" }}>{folderStats.file_count.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-muted)" }}>Subfolders</span>
                  <span style={{ color: "var(--text-secondary)" }}>{folderStats.dir_count.toLocaleString()}</span>
                </div>
                {folderStats.cached && (
                  <div style={{ fontSize: 10, color: "var(--green)", textAlign: "right", fontStyle: "italic", paddingTop: 2 }}>
                    Cached size hit
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tags */}
      <Section label="Label">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 2 }}>
          {TAG_COLORS.map(t => (
            <button key={t.value} title={t.label} onClick={() => handleSetTag(tagColor === t.value ? null : t.value)}
              style={{ width: 18, height: 18, borderRadius: "50%", background: t.value, border: tagColor === t.value ? "2px solid white" : "2px solid transparent", cursor: "pointer" }} />
          ))}
          {tagColor && (
            <button onClick={() => handleSetTag(null)} style={{ fontSize: 10, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>Clear</button>
          )}
        </div>
      </Section>

      {/* Properties */}
      <Section label="Properties">
        {[
          { icon: <FileType size={11} />, label: "Type", value: entry.is_dir ? "Folder" : (entry.extension?.toUpperCase() || "File") },
          { icon: <HardDrive size={11} />, label: "Size", value: entry.is_dir ? "—" : formatSize(entry.size) },
          { icon: <Calendar size={11} />, label: "Modified", value: formatDate(entry.modified) },
        ].map(({ icon, label, value }) => (
          <PropRow key={label} icon={icon} label={label} value={value} />
        ))}
      </Section>

      {/* Checksum */}
      {!entry.is_dir && (
        <Section label="Checksums">
          {!checksum && !loadingChecksum && (
            <button onClick={handleChecksum} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
              Compute checksums...
            </button>
          )}
          {loadingChecksum && <Loading text="Computing..." />}
          {checksum && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <HashRow label="SHA256" value={checksum.sha256} onCopy={() => sha256Copy.copy(checksum.sha256)} copied={sha256Copy.copied} />
              <HashRow label="MD5" value={checksum.md5} onCopy={() => md5Copy.copy(checksum.md5)} copied={md5Copy.copied} />
            </div>
          )}
        </Section>
      )}

      {/* Duplicates */}
      <Section label="Duplicates">
        {!showDuplicates && (
          <button onClick={handleDuplicates} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
            Find duplicates in folder...
          </button>
        )}
        {loadingDuplicates && <Loading text="Scanning..." />}
        {showDuplicates && !loadingDuplicates && duplicates.length === 0 && (
          <span style={{ fontSize: 11, color: "var(--green)" }}>No duplicates found.</span>
        )}
        {showDuplicates && !loadingDuplicates && duplicates.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {duplicates.slice(0, 5).map((g, i) => (
              <div key={i} style={{ fontSize: 11 }}>
                <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>{formatSize(g.size)} — {g.paths.length} copies</div>
                {g.paths.map(p => (
                  <div key={p} style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingLeft: 8, cursor: onNavigate ? "pointer" : "default" }}
                    onClick={() => onNavigate?.(p)} title={p}>
                    <AlertTriangle size={9} style={{ marginRight: 4 }} />{p.split(/[\\/]/).pop()}
                  </div>
                ))}
              </div>
            ))}
            {duplicates.length > 5 && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>+{duplicates.length - 5} more groups</span>}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "10px 12px" }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function PropRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0", fontSize: 11, color: "var(--text-secondary)" }}>
      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{icon}</span>
      <span style={{ color: "var(--text-muted)", flexShrink: 0, width: 56 }}>{label}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

function HashRow({ label, value, onCopy, copied }: { label: string; value: string; onCopy: () => void; copied: boolean }) {
  return (
    <div style={{ fontSize: 10 }}>
      <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <code style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</code>
        <button onClick={onCopy} style={iconBtnStyle} title="Copy">
          {copied ? <Check size={11} color="var(--green)" /> : <Copy size={11} />}
        </button>
      </div>
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
      <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />{text}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const paneStyle: React.CSSProperties = {
  width: "var(--preview-width)",
  background: "var(--bg-surface)",
  borderLeft: "1px solid var(--border)",
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  overflow: "hidden",
  gridRow: 3,
};

const headerStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  padding: "8px 10px", borderBottom: "1px solid var(--border)", flexShrink: 0,
};

const iconBtnStyle: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  color: "var(--text-muted)", display: "flex", alignItems: "center",
  padding: 3, borderRadius: 4,
};

const preStyle: React.CSSProperties = {
  padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: "11px",
  lineHeight: 1.6, color: "var(--text-secondary)", whiteSpace: "pre-wrap",
  wordBreak: "break-all", margin: 0, overflow: "auto",
};
