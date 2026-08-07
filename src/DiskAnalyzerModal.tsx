import { useState, useEffect } from "react";
import { X, PieChart, Loader2, ArrowRight } from "lucide-react";
import { listDirectory, getFolderSize, formatSize, FileEntry } from "./api";

interface DiskAnalyzerModalProps {
  currentPath: string;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

interface SizeItem {
  entry: FileEntry;
  size: number;
  percent: number;
  color: string;
}

const PALETTE = [
  "#38bdf8", "#818cf8", "#c084fc", "#f472b6", "#fb7185",
  "#34d399", "#fbbf24", "#f97316", "#2dd4bf", "#a78bfa"
];

export default function DiskAnalyzerModal({ currentPath, onClose, onNavigate }: DiskAnalyzerModalProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SizeItem[]>([]);
  const [totalSize, setTotalSize] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    listDirectory(currentPath, false).then(async data => {
      const sizePromises = data.entries.map(async (entry) => {
        if (entry.is_dir) {
          try {
            const res = await getFolderSize(entry.path);
            return { entry, size: res.size };
          } catch {
            return { entry, size: 0 };
          }
        } else {
          return { entry, size: entry.size };
        }
      });

      const results = await Promise.all(sizePromises);
      if (!isMounted) return;

      const total = results.reduce((acc, curr) => acc + curr.size, 0);
      setTotalSize(total);

      const sorted = results
        .sort((a, b) => b.size - a.size)
        .slice(0, 12)
        .map((item, idx) => ({
          entry: item.entry,
          size: item.size,
          percent: total > 0 ? (item.size / total) * 100 : 0,
          color: PALETTE[idx % PALETTE.length],
        }));

      setItems(sorted);
      setLoading(false);
    }).catch(() => setLoading(false));

    return () => { isMounted = false; };
  }, [currentPath]);

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
            <PieChart size={16} color="var(--accent)" />
            <span>Disk Space Analyzer — {currentPath.split(/[\\/]/).pop() || currentPath}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={14} /></button>
        </div>

        {/* Content */}
        <div style={{ padding: 20, flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, color: "var(--text-muted)", gap: 10, fontSize: 13 }}>
              <Loader2 size={18} className="spin" /> Analyzing folder structure and disk consumption...
            </div>
          ) : (
            <>
              {/* Summary Bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>Total Scanned Size: <strong style={{ color: "var(--text-primary)" }}>{formatSize(totalSize)}</strong></span>
                <span style={{ fontSize: 11, color: "var(--accent)" }}>Click any folder block to navigate</span>
              </div>

              {/* Visual Proportion Bar */}
              <div style={{ height: 28, width: "100%", background: "var(--bg-elevated)", borderRadius: 6, display: "flex", overflow: "hidden", border: "1px solid var(--border)" }}>
                {items.map(item => (
                  <div
                    key={item.entry.path}
                    title={`${item.entry.name}: ${formatSize(item.size)} (${item.percent.toFixed(1)}%)`}
                    style={{
                      width: `${Math.max(item.percent, 1.5)}%`,
                      background: item.color,
                      height: "100%",
                      transition: "width 0.3s ease",
                    }}
                  />
                ))}
              </div>

              {/* Grid Cards Breakdown */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginTop: 6 }}>
                {items.map(item => (
                  <div
                    key={item.entry.path}
                    onClick={() => {
                      if (item.entry.is_dir) {
                        onNavigate(item.entry.path);
                        onClose();
                      }
                    }}
                    style={{
                      padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)", cursor: item.entry.is_dir ? "pointer" : "default",
                      display: "flex", flexDirection: "column", gap: 6, borderLeft: `4px solid ${item.color}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.entry.name}</span>
                      {item.entry.is_dir && <ArrowRight size={12} color="var(--text-muted)" />}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
                      <span>{formatSize(item.size)}</span>
                      <span>{item.percent.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
