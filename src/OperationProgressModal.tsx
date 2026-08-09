import { Loader2, X } from "lucide-react";
import { formatSize } from "./api";

export interface OperationState {
  type: "copy" | "cut" | "delete" | "zip" | "unzip";
  title: string;
  currentFile: string;
  totalItems: number;
  completedItems: number;
  totalBytes: number;
  copiedBytes: number;
  startTime: number;
}

interface Props {
  operation: OperationState;
  onCancel: () => void;
}

export default function OperationProgressModal({ operation, onCancel }: Props) {
  const { title, currentFile, totalItems, completedItems, totalBytes, copiedBytes, startTime } = operation;

  const elapsedTime = (Date.now() - startTime) / 1000; // in seconds
  const bytesPerSec = elapsedTime > 0.2 ? copiedBytes / elapsedTime : 0;

  const bytePercent = totalBytes > 0 ? Math.min(100, Math.round((copiedBytes / totalBytes) * 100)) : 0;
  const itemPercent = totalItems > 0 ? Math.min(100, Math.round((completedItems / totalItems) * 100)) : 0;
  const displayPercent = totalBytes > 0 ? bytePercent : itemPercent;

  const remainingBytes = totalBytes - copiedBytes;
  const remainingSec = bytesPerSec > 0 && remainingBytes > 0 ? Math.ceil(remainingBytes / bytesPerSec) : 0;

  const formatEta = (sec: number) => {
    if (sec <= 0 || !isFinite(sec)) return "Calculating...";
    if (sec < 60) return `${sec}s remaining`;
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}m ${s}s remaining`;
  };

  const speedText = bytesPerSec > 0 ? `${formatSize(bytesPerSec)}/s` : "Preparing...";

  return (
    <div className="modal-overlay">
      <div className="modal fade-in" style={{ width: 440, padding: "20px 24px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            <Loader2 size={18} className="spin" color="var(--accent)" />
            <span>{title}</span>
          </div>
          <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Current File Path */}
        <div style={{
          fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis", marginBottom: 14,
          background: "var(--bg-elevated)", padding: "6px 10px", borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)"
        }} title={currentFile}>
          {currentFile || "Processing items..."}
        </div>

        {/* Main Progress Bar */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 6, height: 10, overflow: "hidden", marginBottom: 12, border: "1px solid var(--border)" }}>
          <div style={{
            width: `${displayPercent}%`, height: "100%", background: "var(--accent)",
            transition: "width 0.2s ease-out", borderRadius: 6
          }} />
        </div>

        {/* Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Progress: </span>
            <strong style={{ color: "var(--text-primary)" }}>{displayPercent}%</strong>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ color: "var(--text-muted)" }}>Speed: </span>
            <strong style={{ color: "var(--text-primary)" }}>{speedText}</strong>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Processed: </span>
            <strong style={{ color: "var(--text-primary)" }}>
              {totalBytes > 0 ? `${formatSize(copiedBytes)} / ${formatSize(totalBytes)}` : `${completedItems} / ${totalItems} items`}
            </strong>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ color: "var(--text-muted)" }}>ETA: </span>
            <strong style={{ color: "var(--accent)" }}>{formatEta(remainingSec)}</strong>
          </div>
        </div>

        {/* Action Controls */}
        <div className="modal-actions">
          <button className="btn danger" onClick={onCancel} style={{ fontSize: 12 }}>
            Cancel Operation
          </button>
        </div>
      </div>
    </div>
  );
}
