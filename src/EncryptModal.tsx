import { useState } from "react";
import { X, Lock, Unlock, Check } from "lucide-react";
import { readTextFile, createFile, deletePath } from "./api";

interface EncryptModalProps {
  filePath: string;
  onClose: () => void;
  onRefresh: () => void;
}

export default function EncryptModal({ filePath, onClose, onRefresh }: EncryptModalProps) {
  const [password, setPassword] = useState("");
  const isEncrypted = filePath.endsWith(".enc");
  const fileName = filePath.split(/[\\/]/).pop() || filePath;

  const handleEncryptDecrypt = async () => {
    if (!password) return;
    try {
      if (isEncrypted) {
        // Decrypt
        const content = await readTextFile(filePath);
        // Simple XOR Cipher Decryption with password
        const key = password;
        let decrypted = "";
        for (let i = 0; i < content.length; i++) {
          decrypted += String.fromCharCode(content.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        const targetPath = filePath.slice(0, -4);
        await createFile(targetPath);
        // Delete encrypted file
        await deletePath(filePath);
      } else {
        // Encrypt
        const content = await readTextFile(filePath);
        const key = password;
        let encrypted = "";
        for (let i = 0; i < content.length; i++) {
          encrypted += String.fromCharCode(content.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        const targetPath = filePath + ".enc";
        await createFile(targetPath);
        await deletePath(filePath);
      }
      onRefresh();
      onClose();
    } catch {
      // Fallback close on failure
      onClose();
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
      zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center"
    }} onClick={onClose}>
      <div style={{
        width: 440, maxWidth: "90vw", background: "var(--bg-surface)",
        border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.7)", color: "var(--text-primary)",
        display: "flex", flexDirection: "column", overflow: "hidden"
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-elevated)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
            {isEncrypted ? <Unlock size={16} color="var(--green)" /> : <Lock size={16} color="var(--orange)" />}
            <span>{isEncrypted ? "Decrypt File" : "Encrypt File"}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={14} /></button>
        </div>

        {/* Content */}
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Target: <strong style={{ color: "var(--text-primary)" }}>{fileName}</strong>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Encryption Password Key:</label>
            <input
              type="password"
              autoFocus
              placeholder="Enter password..."
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                padding: "8px 10px", color: "var(--text-primary)", fontSize: 12, outline: "none"
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--bg-elevated)" }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "6px 14px", borderRadius: "var(--radius-sm)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleEncryptDecrypt} style={{ background: isEncrypted ? "var(--green)" : "var(--accent)", color: "white", border: "none", padding: "6px 18px", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={13} /> {isEncrypted ? "Decrypt Now" : "Encrypt Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
