import { useState, useEffect } from "react";
import { FileProperties, getFileProperties, formatSize, formatDate } from "./api";
import FileIcon from "./FileIcon";
import { X, Loader2, AlertCircle } from "lucide-react";

interface PropertiesModalProps {
  path: string;
  onClose: () => void;
}

export default function PropertiesModal({ path, onClose }: PropertiesModalProps) {
  const [props, setProps] = useState<FileProperties | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFileProperties(path)
      .then(setProps)
      .catch(err => setError(typeof err === "string" ? err : "Failed to load properties"))
      .finally(() => setLoading(false));
  }, [path]);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center"
    }} onClick={onClose}>
      <div style={{
        width: 440, maxWidth: "90vw", background: "var(--bg-surface)",
        border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.5)", color: "var(--text-primary)",
        display: "flex", flexDirection: "column", overflow: "hidden"
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-elevated)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Properties</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={14} /></button>
        </div>

        {/* Content */}
        <div style={{ padding: 18, minHeight: 200 }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 40, color: "var(--text-muted)", fontSize: 12 }}>
              <Loader2 size={16} className="spin" /> Loading properties...
            </div>
          )}
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--red)", fontSize: 12, padding: 20 }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}
          {props && !loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Title Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <FileIcon entry={{ name: props.name, path: props.path, is_dir: props.is_dir, size: props.size, modified: props.modified, extension: props.extension, hidden: props.hidden }} size={36} />
                <div style={{ overflow: "hidden" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{props.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{props.is_dir ? "File Folder" : `${props.extension.toUpperCase() || "File"} Document`}</div>
                </div>
              </div>

              {/* Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11 }}>
                <Row label="Location" value={props.path} />
                <Row label="Size" value={props.is_dir ? "—" : `${formatSize(props.size)} (${props.size.toLocaleString()} bytes)`} />
                {!props.is_dir && <Row label="Size on disk" value={`${formatSize(props.size_on_disk)} (${props.size_on_disk.toLocaleString()} bytes)`} />}
                {props.line_count !== undefined && props.line_count !== null && <Row label="Line Count" value={`${props.line_count.toLocaleString()} lines`} />}
                <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />
                <Row label="Created" value={formatDate(props.created)} />
                <Row label="Modified" value={formatDate(props.modified)} />
                <Row label="Accessed" value={formatDate(props.accessed)} />
                <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />
                <Row label="Attributes" value={`${props.readonly ? "Read-only " : ""}${props.hidden ? "Hidden" : "Normal"}`} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", background: "var(--bg-elevated)" }}>
          <button onClick={onClose} style={{ background: "var(--accent)", color: "white", border: "none", padding: "6px 18px", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>OK</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{ color: "var(--text-muted)", width: 90, flexShrink: 0 }}>{label}:</span>
      <span style={{ color: "var(--text-primary)", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}
