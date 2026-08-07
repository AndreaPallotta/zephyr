import { useState } from "react";
import { X, Edit3, Check } from "lucide-react";
import { renamePath, FileEntry } from "./api";

interface BatchRenameModalProps {
  entries: FileEntry[];
  onClose: () => void;
  onRefresh: () => void;
}

export default function BatchRenameModal({ entries, onClose, onRefresh }: BatchRenameModalProps) {
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [pattern, setPattern] = useState("file_{n}");
  const [mode, setMode] = useState<"pattern" | "findReplace">("pattern");

  const computeNewName = (entry: FileEntry, index: number) => {
    const ext = entry.extension ? `.${entry.extension}` : "";
    const baseName = entry.is_dir ? entry.name : entry.name.slice(0, -(ext.length));

    if (mode === "pattern") {
      const formatted = pattern.replace("{n}", String(index + 1));
      return `${prefix}${formatted}${suffix}${ext}`;
    } else {
      let newBase = baseName;
      if (findText) {
        newBase = baseName.split(findText).join(replaceText);
      }
      return `${prefix}${newBase}${suffix}${ext}`;
    }
  };

  const handleApplyRename = async () => {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const newName = computeNewName(entry, i);
      if (newName !== entry.name) {
        const sep = entry.path.includes("\\") ? "\\" : "/";
        const dir = entry.path.split(sep).slice(0, -1).join(sep);
        try {
          await renamePath(entry.path, dir + sep + newName);
        } catch {
          // Continue renaming remaining items
        }
      }
    }
    onRefresh();
    onClose();
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
      zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center"
    }} onClick={onClose}>
      <div style={{
        width: 640, maxWidth: "92vw", maxHeight: "85vh", background: "var(--bg-surface)",
        border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.7)", color: "var(--text-primary)",
        display: "flex", flexDirection: "column", overflow: "hidden"
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-elevated)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
            <Edit3 size={16} color="var(--accent)" />
            <span>Batch Renamer ({entries.length} items)</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={14} /></button>
        </div>

        {/* Form Controls */}
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Mode Switcher */}
          <div style={{ display: "flex", gap: 8, background: "var(--bg-elevated)", padding: 4, borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
            <button
              onClick={() => setMode("pattern")}
              style={{
                flex: 1, padding: "6px 12px", border: "none", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 500, cursor: "pointer",
                background: mode === "pattern" ? "var(--bg-active)" : "transparent",
                color: mode === "pattern" ? "var(--accent)" : "var(--text-muted)"
              }}
            >
              Numbering Pattern
            </button>
            <button
              onClick={() => setMode("findReplace")}
              style={{
                flex: 1, padding: "6px 12px", border: "none", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 500, cursor: "pointer",
                background: mode === "findReplace" ? "var(--bg-active)" : "transparent",
                color: mode === "findReplace" ? "var(--accent)" : "var(--text-muted)"
              }}
            >
              Find & Replace
            </button>
          </div>

          {mode === "pattern" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Naming Pattern (`&#123;n&#125;` will be replaced by index):</label>
              <input
                value={pattern}
                onChange={e => setPattern(e.target.value)}
                style={{
                  background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                  padding: "8px 10px", color: "var(--text-primary)", fontSize: 12, outline: "none"
                }}
              />
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Find Text:</label>
                <input
                  value={findText}
                  onChange={e => setFindText(e.target.value)}
                  style={{
                    background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                    padding: "8px 10px", color: "var(--text-primary)", fontSize: 12, outline: "none"
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Replace With:</label>
                <input
                  value={replaceText}
                  onChange={e => setReplaceText(e.target.value)}
                  style={{
                    background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                    padding: "8px 10px", color: "var(--text-primary)", fontSize: 12, outline: "none"
                  }}
                />
              </div>
            </div>
          )}

          {/* Prefix / Suffix */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Add Prefix:</label>
              <input
                placeholder="Optional prefix"
                value={prefix}
                onChange={e => setPrefix(e.target.value)}
                style={{
                  background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                  padding: "6px 10px", color: "var(--text-primary)", fontSize: 12, outline: "none"
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Add Suffix:</label>
              <input
                placeholder="Optional suffix"
                value={suffix}
                onChange={e => setSuffix(e.target.value)}
                style={{
                  background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                  padding: "6px 10px", color: "var(--text-primary)", fontSize: 12, outline: "none"
                }}
              />
            </div>
          </div>

          {/* Live Preview List */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>Live Rename Preview:</div>
            <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {entries.map((entry, idx) => {
                const newName = computeNewName(entry, idx);
                return (
                  <div key={entry.path} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, background: "var(--bg-elevated)", padding: "6px 10px", borderRadius: 4, border: "1px solid var(--border)" }}>
                    <span style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "45%" }}>{entry.name}</span>
                    <span style={{ color: "var(--accent)" }}>➔</span>
                    <span style={{ color: "var(--green)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "45%", textAlign: "right" }}>{newName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--bg-elevated)" }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "6px 14px", borderRadius: "var(--radius-sm)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleApplyRename} style={{ background: "var(--accent)", color: "white", border: "none", padding: "6px 18px", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={13} /> Apply Rename
          </button>
        </div>
      </div>
    </div>
  );
}
