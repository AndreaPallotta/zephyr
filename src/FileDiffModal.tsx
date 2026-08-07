import { useState, useEffect } from "react";
import { X, GitCompare, Loader2 } from "lucide-react";
import { readTextFile } from "./api";

interface FileDiffModalProps {
  pathA: string;
  pathB: string;
  onClose: () => void;
}

export default function FileDiffModal({ pathA, pathB, onClose }: FileDiffModalProps) {
  const [loading, setLoading] = useState(true);
  const [textA, setTextA] = useState("");
  const [textB, setTextB] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      readTextFile(pathA).catch(() => "Failed to read File A"),
      readTextFile(pathB).catch(() => "Failed to read File B"),
    ]).then(([a, b]) => {
      setTextA(a);
      setTextB(b);
      setLoading(false);
    });
  }, [pathA, pathB]);

  const linesA = textA.split("\n");
  const linesB = textB.split("\n");
  const maxLines = Math.max(linesA.length, linesB.length);

  const nameA = pathA.split(/[\\/]/).pop() || pathA;
  const nameB = pathB.split(/[\\/]/).pop() || pathB;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
      zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center"
    }} onClick={onClose}>
      <div style={{
        width: 860, maxWidth: "94vw", maxHeight: "88vh", background: "var(--bg-surface)",
        border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.8)", color: "var(--text-primary)",
        display: "flex", flexDirection: "column", overflow: "hidden"
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-elevated)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
            <GitCompare size={16} color="var(--accent)" />
            <span>Visual File Comparison — {nameA} vs {nameB}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={14} /></button>
        </div>

        {/* Diff Columns */}
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, color: "var(--text-muted)", gap: 10, fontSize: 12 }}>
            <Loader2 size={16} className="spin" /> Reading and comparing file contents...
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", flex: 1, overflowY: "auto", fontFamily: "monospace", fontSize: 11 }}>
            {/* File A Side */}
            <div style={{ borderRight: "1px solid var(--border)", background: "rgba(0,0,0,0.15)" }}>
              <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)", fontWeight: 600, color: "var(--accent)" }}>
                {nameA} ({linesA.length} lines)
              </div>
              <div>
                {Array.from({ length: maxLines }).map((_, idx) => {
                  const lineA = linesA[idx];
                  const lineB = linesB[idx];
                  const isDifferent = lineA !== lineB;
                  return (
                    <div key={idx} style={{
                      display: "flex", gap: 8, padding: "2px 8px",
                      background: isDifferent ? (lineA !== undefined ? "rgba(248,81,73,0.15)" : "transparent") : "transparent",
                      color: isDifferent && lineA !== undefined ? "var(--red)" : "var(--text-primary)"
                    }}>
                      <span style={{ width: 28, color: "var(--text-muted)", userSelect: "none" }}>{idx + 1}</span>
                      <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{lineA ?? ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* File B Side */}
            <div style={{ background: "rgba(0,0,0,0.15)" }}>
              <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)", fontWeight: 600, color: "var(--green)" }}>
                {nameB} ({linesB.length} lines)
              </div>
              <div>
                {Array.from({ length: maxLines }).map((_, idx) => {
                  const lineA = linesA[idx];
                  const lineB = linesB[idx];
                  const isDifferent = lineA !== lineB;
                  return (
                    <div key={idx} style={{
                      display: "flex", gap: 8, padding: "2px 8px",
                      background: isDifferent ? (lineB !== undefined ? "rgba(46,160,67,0.15)" : "transparent") : "transparent",
                      color: isDifferent && lineB !== undefined ? "var(--green)" : "var(--text-primary)"
                    }}>
                      <span style={{ width: 28, color: "var(--text-muted)", userSelect: "none" }}>{idx + 1}</span>
                      <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{lineB ?? ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
