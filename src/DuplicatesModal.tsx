import { useState, useEffect } from "react";
import { X, Copy, Trash2, Loader2, Square } from "lucide-react";
import { findDuplicates, deletePath, formatSize, DuplicateGroup } from "./api";

interface DuplicatesModalProps {
  currentPath: string;
  onClose: () => void;
  onRefresh: () => void;
}

export default function DuplicatesModal({ currentPath, onClose, onRefresh }: DuplicatesModalProps) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [selectedToDelete, setSelectedToDelete] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    findDuplicates(currentPath)
      .then(res => {
        setGroups(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentPath]);

  const toggleSelect = (path: string) => {
    setSelectedToDelete(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const autoSelectDuplicates = () => {
    const toDelete = new Set<string>();
    for (const group of groups) {
      // Keep the 1st path, select all rest for deletion
      for (let i = 1; i < group.paths.length; i++) {
        toDelete.add(group.paths[i]);
      }
    }
    setSelectedToDelete(toDelete);
  };

  const handleDeleteSelected = async () => {
    for (const path of Array.from(selectedToDelete)) {
      try {
        await deletePath(path);
      } catch {
        // Continue deleting others if one fails
      }
    }
    onRefresh();
    onClose();
  };

  const totalWastedBytes = groups.reduce((acc, g) => acc + (g.size * (g.paths.length - 1)), 0);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
      zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center"
    }} onClick={onClose}>
      <div style={{
        width: 720, maxWidth: "92vw", maxHeight: "85vh", background: "var(--bg-surface)",
        border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.7)", color: "var(--text-primary)",
        display: "flex", flexDirection: "column", overflow: "hidden"
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-elevated)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
            <Copy size={16} color="var(--orange)" />
            <span>Duplicate File Finder — {currentPath.split(/[\\/]/).pop() || currentPath}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={14} /></button>
        </div>

        {/* Content */}
        <div style={{ padding: 20, flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, color: "var(--text-muted)", gap: 10, fontSize: 13 }}>
              <Loader2 size={18} className="spin" /> Scanning folder tree for duplicate files...
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>
                  Found <strong style={{ color: "var(--text-primary)" }}>{groups.length} duplicate groups</strong> (Wasted space: <strong style={{ color: "var(--orange)" }}>{formatSize(totalWastedBytes)}</strong>)
                </span>
                <button
                  onClick={autoSelectDuplicates}
                  style={{
                    background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--accent)",
                    padding: "4px 12px", borderRadius: "var(--radius-sm)", fontSize: 11, cursor: "pointer", fontWeight: 500
                  }}
                >
                  Auto-Select Duplicates (Keep 1st Copy)
                </button>
              </div>

              {groups.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                  No duplicate files detected in this directory tree.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {groups.map((group, idx) => (
                    <div key={idx} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                        <span>File Size: <strong style={{ color: "var(--text-primary)" }}>{formatSize(group.size)}</strong></span>
                        <span>{group.paths.length} copies</span>
                      </div>
                      {group.paths.map(p => {
                        const isSelected = selectedToDelete.has(p);
                        return (
                          <div
                            key={p}
                            onClick={() => toggleSelect(p)}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                              borderRadius: 4, cursor: "pointer", fontSize: 11,
                              background: isSelected ? "rgba(248,81,73,0.12)" : "transparent",
                              color: isSelected ? "var(--red)" : "var(--text-primary)",
                            }}
                          >
                            {isSelected ? <CheckCircle2Icon color="var(--red)" /> : <Square size={13} color="var(--text-muted)" />}
                            <span style={{ flex: 1, wordBreak: "break-all" }}>{p}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {selectedToDelete.size > 0 && (
          <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-elevated)" }}>
            <span style={{ fontSize: 12, color: "var(--red)", fontWeight: 500 }}>Selected {selectedToDelete.size} items for deletion</span>
            <button
              onClick={handleDeleteSelected}
              style={{
                background: "var(--red)", color: "white", border: "none", padding: "6px 16px",
                borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 500, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6
              }}
            >
              <Trash2 size={13} /> Delete Selected Duplicates
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckCircle2Icon({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
