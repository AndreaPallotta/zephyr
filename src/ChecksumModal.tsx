import { useState, useEffect } from "react";
import { X, ShieldCheck, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import { computeChecksum, ChecksumResult } from "./api";

interface ChecksumModalProps {
  filePath: string;
  onClose: () => void;
}

export default function ChecksumModal({ filePath, onClose }: ChecksumModalProps) {
  const [loading, setLoading] = useState(true);
  const [checksums, setChecksums] = useState<ChecksumResult | null>(null);
  const [expectedHash, setExpectedHash] = useState("");
  const [copiedSha256, setCopiedSha256] = useState(false);
  const [copiedMd5, setCopiedMd5] = useState(false);

  useEffect(() => {
    setLoading(true);
    computeChecksum(filePath)
      .then(res => {
        setChecksums(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filePath]);

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fileName = filePath.split(/[\\/]/).pop() || filePath;
  const matchResult = expectedHash.trim()
    ? checksums?.sha256.toLowerCase() === expectedHash.trim().toLowerCase() ||
      checksums?.md5.toLowerCase() === expectedHash.trim().toLowerCase()
    : null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
      zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center"
    }} onClick={onClose}>
      <div style={{
        width: 520, maxWidth: "92vw", background: "var(--bg-surface)",
        border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.7)", color: "var(--text-primary)",
        display: "flex", flexDirection: "column", overflow: "hidden"
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-elevated)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
            <ShieldCheck size={16} color="var(--accent)" />
            <span>File Checksum Verifier</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={14} /></button>
        </div>

        {/* Content */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            File: <strong style={{ color: "var(--text-primary)" }}>{fileName}</strong>
          </div>

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 30, color: "var(--text-muted)", gap: 10, fontSize: 12 }}>
              <Loader2 size={16} className="spin" /> Computing SHA-256 and MD5 hashes...
            </div>
          ) : checksums ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* SHA-256 */}
              <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--text-muted)" }}>
                  <span>SHA-256</span>
                  <button onClick={() => copyToClipboard(checksums.sha256, setCopiedSha256)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                    {copiedSha256 ? <Check size={12} color="var(--green)" /> : <Copy size={12} />}
                    {copiedSha256 ? "Copied" : "Copy"}
                  </button>
                </div>
                <code style={{ fontSize: 11, color: "var(--text-primary)", wordBreak: "break-all", background: "rgba(0,0,0,0.2)", padding: 6, borderRadius: 4 }}>
                  {checksums.sha256}
                </code>
              </div>

              {/* MD5 */}
              <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--text-muted)" }}>
                  <span>MD5</span>
                  <button onClick={() => copyToClipboard(checksums.md5, setCopiedMd5)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                    {copiedMd5 ? <Check size={12} color="var(--green)" /> : <Copy size={12} />}
                    {copiedMd5 ? "Copied" : "Copy"}
                  </button>
                </div>
                <code style={{ fontSize: 11, color: "var(--text-primary)", wordBreak: "break-all", background: "rgba(0,0,0,0.2)", padding: 6, borderRadius: 4 }}>
                  {checksums.md5}
                </code>
              </div>

              {/* Verify Match Input */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Verify against expected hash:</label>
                <input
                  placeholder="Paste expected SHA-256 or MD5 hash..."
                  value={expectedHash}
                  onChange={e => setExpectedHash(e.target.value)}
                  style={{
                    background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                    padding: "8px 10px", color: "var(--text-primary)", fontSize: 12, outline: "none"
                  }}
                />
                {matchResult !== null && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, marginTop: 4,
                    color: matchResult ? "var(--green)" : "var(--red)"
                  }}>
                    {matchResult ? <Check size={14} /> : <AlertCircle size={14} />}
                    <span>{matchResult ? "Checksum Matches Expected Hash!" : "Checksum Mismatch — Hash Does Not Match!"}</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
