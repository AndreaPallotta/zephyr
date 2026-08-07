import { useState, useEffect } from "react";
import { X, FileText, Loader2, ArrowRight } from "lucide-react";
import { searchFileContents, ContentMatch } from "./api";

interface GrepSearchModalProps {
  currentPath: string;
  onClose: () => void;
  onSelectFile: (path: string) => void;
}

export default function GrepSearchModal({ currentPath, onClose, onSelectFile }: GrepSearchModalProps) {
  const [query, setQuery] = useState("");
  const [isRegex, setIsRegex] = useState(false);
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<ContentMatch[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setMatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      searchFileContents(currentPath, query.trim(), isRegex)
        .then(res => {
          setMatches(res);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [currentPath, query, isRegex]);

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
            <FileText size={16} color="var(--accent)" />
            <span>Deep Code & Content Search (Grep)</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={14} /></button>
        </div>

        {/* Search Bar */}
        <div style={{ padding: 14, borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", background: "var(--bg-surface)" }}>
          <input
            autoFocus
            placeholder="Search text or code content across files..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", padding: "8px 12px", color: "var(--text-primary)",
              fontSize: 13, outline: "none"
            }}
          />
          <button
            onClick={() => setIsRegex(r => !r)}
            style={{
              background: isRegex ? "rgba(56,189,248,0.2)" : "var(--bg-elevated)",
              border: `1px solid ${isRegex ? "var(--accent)" : "var(--border)"}`,
              color: isRegex ? "var(--accent)" : "var(--text-muted)",
              padding: "6px 12px", borderRadius: "var(--radius-sm)", fontSize: 11, cursor: "pointer", fontWeight: 600
            }}
          >
            .* Regex
          </button>
        </div>

        {/* Results */}
        <div style={{ padding: 14, flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40, color: "var(--text-muted)", gap: 10, fontSize: 12 }}>
              <Loader2 size={16} className="spin" /> Searching file contents...
            </div>
          )}
          {!loading && query && matches.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              No matches found for "{query}".
            </div>
          )}
          {!loading && matches.map((m, idx) => {
            const fileName = m.path.split(/[\\/]/).pop() || m.path;
            return (
              <div
                key={idx}
                onClick={() => { onSelectFile(m.path); onClose(); }}
                style={{
                  background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
                  padding: "10px 14px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
                  <span>{fileName} — Line {m.line_number}</span>
                  <ArrowRight size={12} color="var(--text-muted)" />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.path}</div>
                <code style={{ fontSize: 11, color: "var(--text-primary)", background: "rgba(0,0,0,0.3)", padding: "4px 8px", borderRadius: 4, marginTop: 4 }}>
                  {m.line_text}
                </code>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
