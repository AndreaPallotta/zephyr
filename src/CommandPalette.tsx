import { useState, useEffect } from "react";
import { Search, Folder, HardDrive, Sun, Terminal, Code2, FolderPlus, FilePlus, LucideIcon } from "lucide-react";

interface CommandPaletteProps {
  onClose: () => void;
  onNavigate: (path: string) => void;
  onAction: (action: string) => void;
  homeDir: string;
  drives: string[];
}

interface CommandItem {
  label: string;
  path?: string;
  action?: string;
  icon: LucideIcon;
}

export default function CommandPalette({ onClose, onNavigate, onAction, homeDir, drives }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items: CommandItem[] = [
    { label: "Go to Home", path: homeDir, icon: Folder },
    ...drives.map(d => ({ label: `Go to Drive ${d}`, path: d, icon: HardDrive })),
    { label: "Create New Folder", action: "newdir", icon: FolderPlus },
    { label: "Create New File", action: "newfile", icon: FilePlus },
    { label: "Open Terminal Here", action: "terminal", icon: Terminal },
    { label: "Open in VS Code", action: "vscode", icon: Code2 },
    { label: "Toggle Theme", action: "theme", icon: Sun },
  ].filter(item => item.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      }
      if (e.key === "Enter" && items[selectedIndex]) {
        e.preventDefault();
        const sel = items[selectedIndex];
        if (sel.path) onNavigate(sel.path);
        else if (sel.action) onAction(sel.action);
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedIndex, onClose, onNavigate, onAction]);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
      zIndex: 10000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh"
    }} onClick={onClose}>
      <div style={{
        width: 560, maxWidth: "90vw", background: "var(--bg-surface)",
        border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.7)", overflow: "hidden", display: "flex", flexDirection: "column"
      }} onClick={e => e.stopPropagation()}>
        {/* Search Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            autoFocus
            placeholder="Type a command or directory..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "var(--text-primary)", fontSize: 14, fontWeight: 500
            }}
          />
          <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)" }}>ESC to exit</span>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: 320, overflowY: "auto", padding: 6 }}>
          {items.map((item, idx) => {
            const Icon = item.icon;
            const isSel = idx === selectedIndex;
            return (
              <div
                key={item.label}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => {
                  if (item.path) onNavigate(item.path);
                  else if (item.action) onAction(item.action);
                  onClose();
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: 13,
                  background: isSel ? "var(--bg-active)" : "transparent",
                  color: isSel ? "var(--accent)" : "var(--text-primary)",
                }}
              >
                <Icon size={16} />
                <span style={{ flex: 1, fontWeight: isSel ? 600 : 400 }}>{item.label}</span>
                {item.path && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.path}</span>}
              </div>
            );
          })}
          {items.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              No matching commands or directories.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
