import { useState, useEffect, useCallback, useRef } from "react";
import "./index.css";
import {
  listDirectory, autocompletePath, getDrives, getHomeDir, createDirectory, createFile,
  deletePath, renamePath, copyFile, searchDirectory, openTerminal, openInVscode,
  getFavorites, setFavorite, getTags,
  FileEntry, DirectoryListing, formatSize, formatDate, getPathSegments, joinPath,
  GIT_STATUS_COLORS,
} from "./api";
import FileIcon from "./FileIcon";
import PreviewPane from "./PreviewPane";
import {
  ChevronLeft, ChevronRight, ChevronUp, RefreshCw, Plus, X, LayoutGrid,
  List, Home, HardDrive, Clock, Search, MoreVertical,
  FolderPlus, FilePlus, Copy, Scissors, Clipboard, Trash2,
  Eye, EyeOff, Loader2, PanelRight, Terminal, Code2, Star, Sun, Moon, Edit3, GitBranch, AlertTriangle,
} from "lucide-react";

interface Tab { id: string; path: string; history: string[]; historyIndex: number; }
type ViewMode = "list" | "grid";
type Theme = "dark" | "light";

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState("");
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showHidden, setShowHidden] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null);
  const [drives, setDrives] = useState<string[]>([]);
  const [homeDir, setHomeDir] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FileEntry[] | null>(null);
  const [clipboard, setClipboard] = useState<{ entries: string[]; op: "copy" | "cut" } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; entry?: FileEntry } | null>(null);
  const [modal, setModal] = useState<{ type: "rename" | "newdir" | "newfile" | "delete"; entry?: FileEntry } | null>(null);
  const [modalInput, setModalInput] = useState("");
  const [recentDirs, setRecentDirs] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [tags, setTags] = useState<Record<string, string>>({});
  const [filterExt, setFilterExt] = useState("");
  const [theme, setTheme] = useState<Theme>("dark");
  const [editingPath, setEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState("");
  const [pathSuggestions, setPathSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pathInputRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const currentPath = activeTab?.path ?? "";

  // ─── Theme ────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([getDrives(), getHomeDir(), getFavorites(), getTags()]).then(([d, h, favs, t]) => {
      setDrives(d);
      setHomeDir(h);
      setFavorites(favs);
      setTags(t);
      const id = crypto.randomUUID();
      setTabs([{ id, path: h, history: [h], historyIndex: 0 }]);
      setActiveTabId(id);
    });
  }, []);

  // ─── Navigate ─────────────────────────────────────────────────────────────
  const navigate = useCallback((path: string, tabId?: string) => {
    const tid = tabId ?? activeTabId;
    setTabs(prev => prev.map(t => {
      if (t.id !== tid) return t;
      const newHistory = t.history.slice(0, t.historyIndex + 1).concat(path);
      return { ...t, path, history: newHistory, historyIndex: newHistory.length - 1 };
    }));
    setSelected(new Set());
    setSearchQuery("");
    setSearchResults(null);
    setFilterExt("");
    setRecentDirs(prev => [path, ...prev.filter(p => p !== path)].slice(0, 8));
  }, [activeTabId]);

  // ─── Load listing with Error Fallback ────────────────────────────────────
  useEffect(() => {
    if (!currentPath) return;
    setLoading(true);
    listDirectory(currentPath, showHidden)
      .then(data => {
        setListing(data);
        setLoading(false);
        setErrorToast(null);
      })
      .catch(err => {
        setLoading(false);
        const msg = typeof err === "string" ? err : "Path does not exist";
        setErrorToast(msg);
        setTimeout(() => setErrorToast(null), 3500);

        // Revert to previous path if available
        if (activeTab && activeTab.historyIndex > 0) {
          const prevIndex = activeTab.historyIndex - 1;
          const prevPath = activeTab.history[prevIndex];
          setTabs(prev => prev.map(t => t.id === activeTabId ? {
            ...t,
            path: prevPath,
            history: t.history.slice(0, prevIndex + 1),
            historyIndex: prevIndex
          } : t));
        }
      });
  }, [currentPath, showHidden]);

  // ─── Path Autocomplete ───────────────────────────────────────────────────
  useEffect(() => {
    if (!editingPath || !pathInput.trim()) {
      setPathSuggestions([]);
      setSuggestionIndex(-1);
      return;
    }
    autocompletePath(pathInput.trim())
      .then(suggs => {
        setPathSuggestions(suggs);
        setSuggestionIndex(-1);
      })
      .catch(() => {
        setPathSuggestions([]);
        setSuggestionIndex(-1);
      });
  }, [editingPath, pathInput]);

  // ─── Search ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim() || !currentPath) { setSearchResults(null); return; }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      searchDirectory(currentPath, searchQuery.trim(), showHidden).then(setSearchResults);
    }, 300);
  }, [searchQuery, currentPath, showHidden]);

  // ─── Nav helpers ──────────────────────────────────────────────────────────
  const canGoBack = (activeTab?.historyIndex ?? 0) > 0;
  const canGoForward = (activeTab?.historyIndex ?? 0) < (activeTab?.history.length ?? 1) - 1;

  const goBack = useCallback(() => {
    if (!activeTab || !canGoBack) return;
    const newIndex = activeTab.historyIndex - 1;
    const path = activeTab.history[newIndex];
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, path, historyIndex: newIndex } : t));
    setSelected(new Set()); setSearchResults(null);
  }, [activeTab, canGoBack, activeTabId]);

  const goForward = useCallback(() => {
    if (!activeTab || !canGoForward) return;
    const newIndex = activeTab.historyIndex + 1;
    const path = activeTab.history[newIndex];
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, path, historyIndex: newIndex } : t));
    setSelected(new Set()); setSearchResults(null);
  }, [activeTab, canGoForward, activeTabId]);

  const goUp = () => { if (listing?.parent) navigate(listing.parent); };

  const refresh = useCallback(() => {
    setLoading(true);
    listDirectory(currentPath, showHidden).then(setListing).finally(() => setLoading(false));
    getTags().then(setTags);
    getFavorites().then(setFavorites);
  }, [currentPath, showHidden]);

  // ─── Mouse Side Buttons (Mouse 3/4 for Back & Forward) ────────────────────
  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        goBack();
      } else if (e.button === 4) {
        goForward();
      }
    };
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [goBack, goForward]);

  // ─── Tabs ─────────────────────────────────────────────────────────────────
  const newTab = () => {
    const id = crypto.randomUUID();
    const path = homeDir || currentPath;
    setTabs(prev => [...prev, { id, path, history: [path], historyIndex: 0 }]);
    setActiveTabId(id);
  };
  const closeTab = (id: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      if (next.length === 0) return prev;
      if (activeTabId === id) setActiveTabId(next[next.length - 1].id);
      return next;
    });
  };

  // ─── File ops ─────────────────────────────────────────────────────────────
  const handleOpen = (entry: FileEntry) => {
    if (entry.is_dir) navigate(entry.path);
    else { setPreviewEntry(entry); }
  };
  const handleCopy = () => { if (selected.size) { setClipboard({ entries: Array.from(selected), op: "copy" }); setCtxMenu(null); } };
  const handleCut  = () => { if (selected.size) { setClipboard({ entries: Array.from(selected), op: "cut"  }); setCtxMenu(null); } };
  const handlePaste = async () => {
    if (!clipboard || !currentPath) return;
    for (const src of clipboard.entries) {
      const name = src.split(/[\\/]/).pop()!;
      await copyFile(src, joinPath(currentPath, name));
      if (clipboard.op === "cut") await deletePath(src);
    }
    if (clipboard.op === "cut") setClipboard(null);
    refresh(); setCtxMenu(null);
  };
  const handleDelete = async (entry?: FileEntry) => {
    const targets = entry ? [entry.path] : Array.from(selected);
    for (const p of targets) await deletePath(p);
    refresh(); setModal(null); setCtxMenu(null);
  };
  const handleRename = async () => {
    if (!modal?.entry || !modalInput.trim()) return;
    const sep = modal.entry.path.includes("\\") ? "\\" : "/";
    const dir = modal.entry.path.split(sep).slice(0, -1).join(sep);
    await renamePath(modal.entry.path, dir + sep + modalInput.trim());
    refresh(); setModal(null);
  };
  const handleNewDir  = async () => { if (!modalInput.trim()) return; await createDirectory(joinPath(currentPath, modalInput.trim())); refresh(); setModal(null); };
  const handleNewFile = async () => { if (!modalInput.trim()) return; await createFile(joinPath(currentPath, modalInput.trim())); refresh(); setModal(null); };

  const handleToggleFav = async (path: string) => {
    const isFav = favorites.includes(path);
    await setFavorite(path, !isFav);
    setFavorites(await getFavorites());
  };

  // ─── Context menu ─────────────────────────────────────────────────────────
  const openCtxMenu = (e: React.MouseEvent, entry?: FileEntry) => {
    e.preventDefault(); e.stopPropagation();
    if (entry && !selected.has(entry.path)) { setSelected(new Set([entry.path])); setPreviewEntry(entry); }
    setCtxMenu({ x: e.clientX, y: e.clientY, entry });
  };

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
      if (isInput) return;
      if (e.key === "F5") { e.preventDefault(); refresh(); }
      if (e.key === "Backspace") { e.preventDefault(); goUp(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "t") { e.preventDefault(); newTab(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "c") { if (selected.size) handleCopy(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "x") { if (selected.size) handleCut(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "v") { if (clipboard) handlePaste(); }
      if (e.key === "Delete") { if (selected.size) setModal({ type: "delete" }); }
      if (e.key === "F2") {
        if (selected.size === 1) {
          const entry = displayEntries.find(en => selected.has(en.path));
          if (entry) { setModalInput(entry.name); setModal({ type: "rename", entry }); }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, clipboard, listing]);

  // ─── Derived state ────────────────────────────────────────────────────────
  let displayEntries = searchResults ?? (listing?.entries ?? []);
  if (filterExt) displayEntries = displayEntries.filter(e => !e.is_dir && e.extension === filterExt);
  const segments = getPathSegments(currentPath);
  const showPreview = previewEntry !== null;

  // Unique extensions for filter dropdown
  const availableExts = Array.from(new Set((listing?.entries ?? []).filter(e => !e.is_dir && e.extension).map(e => e.extension))).sort();

  return (
    <div className="app" data-theme={theme}
      onClick={() => { setCtxMenu(null); }}
      style={{ gridTemplateColumns: `var(--sidebar-width) 1fr${showPreview ? " var(--preview-width)" : ""}` }}>

      {/* ── Toolbar ── */}
      <div className="toolbar">
        <button className="toolbar-btn" onClick={goBack} disabled={!canGoBack} title="Back (Alt+Left / Mouse4)"><ChevronLeft size={16} /></button>
        <button className="toolbar-btn" onClick={goForward} disabled={!canGoForward} title="Forward (Alt+Right / Mouse5)"><ChevronRight size={16} /></button>
        <button className="toolbar-btn" onClick={goUp} disabled={!listing?.parent} title="Up (Backspace)"><ChevronUp size={16} /></button>
        <button className="toolbar-btn" onClick={refresh} title="Refresh (F5)"><RefreshCw size={14} /></button>
        <div className="toolbar-sep" />

        {/* Breadcrumb / Path Input with Autocomplete & Keyboard Selection */}
        <div style={{ position: "relative", flex: 1, display: "flex" }}>
          <div className="breadcrumb-bar" style={{ width: "100%" }} onClick={() => { if (!editingPath) { setEditingPath(true); setPathInput(currentPath); } }}>
            {editingPath ? (
              <input
                ref={pathInputRef}
                className="breadcrumb-input"
                value={pathInput}
                onChange={e => setPathInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSuggestionIndex(prev => Math.min(prev + 1, pathSuggestions.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSuggestionIndex(prev => Math.max(prev - 1, -1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const targetPath = (suggestionIndex >= 0 && suggestionIndex < pathSuggestions.length)
                      ? pathSuggestions[suggestionIndex]
                      : pathInput.trim();
                    if (targetPath) navigate(targetPath);
                    setEditingPath(false);
                  } else if (e.key === "Escape") {
                    setEditingPath(false);
                  } else if (e.key === "Tab" && pathSuggestions.length > 0) {
                    e.preventDefault();
                    const targetPath = (suggestionIndex >= 0 && suggestionIndex < pathSuggestions.length)
                      ? pathSuggestions[suggestionIndex]
                      : pathSuggestions[0];
                    setPathInput(targetPath);
                  }
                }}
                onBlur={() => setTimeout(() => setEditingPath(false), 200)}
                autoFocus
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, overflow: "hidden" }}>
                  {segments.map((seg, i) => (
                    <span key={seg.path} className="breadcrumb-segment">
                      {i > 0 && <span className="breadcrumb-sep">/</span>}
                      <button onClick={e => { e.stopPropagation(); navigate(seg.path); }}>{seg.label}</button>
                    </span>
                  ))}
                </div>
                <button style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", padding: 2 }}
                  title="Click to Edit / Copy Path"
                  onClick={e => { e.stopPropagation(); setEditingPath(true); setPathInput(currentPath); }}>
                  <Edit3 size={12} />
                </button>
              </>
            )}
          </div>

          {editingPath && pathSuggestions.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000,
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: "0 0 var(--radius-md) var(--radius-md)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              maxHeight: 200, overflowY: "auto", marginTop: 2,
            }}>
              {pathSuggestions.map((sugg, idx) => (
                <div key={sugg}
                  style={{
                    padding: "6px 10px", cursor: "pointer", fontSize: 12,
                    color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    background: idx === suggestionIndex ? "var(--bg-active)" : "transparent",
                  }}
                  onMouseEnter={() => setSuggestionIndex(idx)}
                  onMouseDown={e => { e.preventDefault(); navigate(sugg); setEditingPath(false); }}>
                  {sugg}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="toolbar-sep" />

        {/* Search */}
        <div className="search-bar">
          <Search size={12} color="var(--text-muted)" />
          <input placeholder="Search..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onClick={e => e.stopPropagation()} />
          {searchQuery && <button style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}
            onClick={() => { setSearchQuery(""); setSearchResults(null); }}><X size={11} color="var(--text-muted)" /></button>}
        </div>

        <div className="toolbar-sep" />

        {/* Filter by extension */}
        {availableExts.length > 0 && (
          <select value={filterExt} onChange={e => setFilterExt(e.target.value)}
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: filterExt ? "var(--accent)" : "var(--text-muted)", fontSize: 11, padding: "2px 6px", height: 26 }}>
            <option value="">All types</option>
            {availableExts.map(ext => <option key={ext} value={ext}>.{ext}</option>)}
          </select>
        )}

        <div className="toolbar-sep" />

        <button className="toolbar-btn" title="Open Terminal here" onClick={() => openTerminal(currentPath)}><Terminal size={14} /></button>
        <button className="toolbar-btn" title="Open in VS Code" onClick={() => openInVscode(currentPath)}><Code2 size={14} /></button>
        <button className="toolbar-btn" title={showPreview ? "Hide Preview" : "Show Preview"}
          onClick={() => setPreviewEntry(showPreview ? null : previewEntry)}
          style={{ color: showPreview ? "var(--accent)" : undefined }}>
          <PanelRight size={14} />
        </button>
        <button className="toolbar-btn" title={showHidden ? "Hide hidden files" : "Show hidden files"} onClick={() => setShowHidden(s => !s)}>
          {showHidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button className="toolbar-btn" title="New Folder" onClick={() => { setModalInput(""); setModal({ type: "newdir" }); }}><FolderPlus size={14} /></button>
        <button className="toolbar-btn" title="New File" onClick={() => { setModalInput(""); setModal({ type: "newfile" }); }}><FilePlus size={14} /></button>
        <div className="toolbar-sep" />
        <button className="toolbar-btn" title="Toggle theme" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs-bar">
        {tabs.map(tab => (
          <div key={tab.id} className={`tab ${tab.id === activeTabId ? "active" : ""}`} onClick={() => setActiveTabId(tab.id)}>
            <span className="tab-name">{tab.path.split(/[\\/]/).pop() || tab.path}</span>
            <button className="tab-close" onClick={e => { e.stopPropagation(); closeTab(tab.id); }}><X size={11} /></button>
          </div>
        ))}
        <button className="tab-new" onClick={newTab} title="New Tab (Ctrl+T)"><Plus size={14} /></button>
      </div>

      {/* ── Sidebar ── */}
      <div className="sidebar">
        <div className="sidebar-section">
          <div className="sidebar-section-label">Quick Access</div>
          <div className={`sidebar-item ${currentPath === homeDir ? "active" : ""}`} onClick={() => navigate(homeDir)}>
            <Home size={14} /><span>Home</span>
          </div>
        </div>

        {favorites.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-label">Favorites</div>
            {favorites.map(p => (
              <div key={p} className={`sidebar-item ${currentPath === p ? "active" : ""}`} onClick={() => navigate(p)}>
                <Star size={13} fill="var(--yellow)" color="var(--yellow)" />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.split(/[\\/]/).pop() || p}</span>
              </div>
            ))}
          </div>
        )}

        {recentDirs.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-label">Recent</div>
            {recentDirs.slice(0, 6).map(p => (
              <div key={p} className={`sidebar-item ${currentPath === p ? "active" : ""}`} onClick={() => navigate(p)}>
                <Clock size={13} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.split(/[\\/]/).pop() || p}</span>
              </div>
            ))}
          </div>
        )}

        <div className="sidebar-section">
          <div className="sidebar-section-label">Drives</div>
          {drives.map(d => (
            <div key={d} className={`sidebar-item ${currentPath.startsWith(d) ? "active" : ""}`} onClick={() => navigate(d)}>
              <HardDrive size={14} /><span>{d}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main ── */}
      <div className="main-area" onContextMenu={e => openCtxMenu(e)}>
        {/* View controls + git indicator */}
        <div className="content-header">
          {listing?.is_git_repo && (
            <span style={{ fontSize: 11, background: "rgba(240,136,62,0.12)", color: "var(--orange)", padding: "2px 8px", borderRadius: 10, border: "1px solid rgba(240,136,62,0.3)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <GitBranch size={11} /> {listing.git_branch || "git repo"}
            </span>
          )}
          {searchResults && (
            <span style={{ fontSize: 12, color: "var(--accent)" }}>{searchResults.length} results for "{searchQuery}"</span>
          )}
          {filterExt && (
            <span style={{ fontSize: 11, color: "var(--orange)", background: "rgba(240,136,62,0.1)", padding: "2px 8px", borderRadius: 10, border: "1px solid rgba(240,136,62,0.2)" }}>
              .{filterExt} <button onClick={() => setFilterExt("")} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", marginLeft: 2, padding: 0 }}>×</button>
            </span>
          )}
          {loading && (
            <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Loader2 size={12} className="spin" /> Loading...
            </span>
          )}
          <div className="view-controls">
            <button className={`view-btn ${viewMode === "list" ? "active" : ""}`} onClick={() => setViewMode("list")} title="List View"><List size={14} /></button>
            <button className={`view-btn ${viewMode === "grid" ? "active" : ""}`} onClick={() => setViewMode("grid")} title="Grid View"><LayoutGrid size={14} /></button>
          </div>
        </div>

        {loading && displayEntries.length === 0 && (
          <div className="loading"><Loader2 size={16} className="spin" /><span>Loading...</span></div>
        )}

        {!loading && displayEntries.length === 0 && (
          <div className="empty-state fade-in">
            <Search size={40} />
            <p>{searchQuery ? "No files match your search." : filterExt ? `No .${filterExt} files here.` : "This folder is empty."}</p>
          </div>
        )}

        {/* List View */}
        {displayEntries.length > 0 && viewMode === "list" && (
          <div className="file-list" onContextMenu={e => e.stopPropagation()}>
            <div className="file-list-header">
              <span>Name</span><span>Type</span><span>Modified</span><span>Size</span>
            </div>
            {displayEntries.map(entry => {
              const tagColor = tags[entry.path];
              const gitColor = entry.git_status ? GIT_STATUS_COLORS[entry.git_status] : undefined;
              return (
                <div key={entry.path}
                  className={`file-row ${selected.has(entry.path) ? "selected" : ""}`}
                  style={tagColor ? { borderLeft: `3px solid ${tagColor}` } : undefined}
                  onClick={e => { e.stopPropagation(); setSelected(new Set([entry.path])); setPreviewEntry(entry); }}
                  onDoubleClick={() => handleOpen(entry)}
                  onContextMenu={e => openCtxMenu(e, entry)}>
                  <div className="file-name">
                    {gitColor && <span style={{ width: 6, height: 6, borderRadius: "50%", background: gitColor, flexShrink: 0, display: "inline-block" }} title={`git: ${entry.git_status}`} />}
                    <FileIcon entry={entry} size={15} />
                    <span className="file-name-text">{entry.name}</span>
                    {favorites.includes(entry.path) && <Star size={11} fill="var(--yellow)" color="var(--yellow)" style={{ flexShrink: 0 }} />}
                  </div>
                  <span className="file-ext">{entry.is_dir ? "Folder" : entry.extension?.toUpperCase() || "File"}</span>
                  <span className="file-modified">{formatDate(entry.modified)}</span>
                  <span className="file-size">{formatSize(entry.size)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Grid View */}
        {displayEntries.length > 0 && viewMode === "grid" && (
          <div className="file-grid" onContextMenu={e => e.stopPropagation()}>
            {displayEntries.map(entry => {
              const tagColor = tags[entry.path];
              return (
                <div key={entry.path}
                  className={`file-grid-item ${selected.has(entry.path) ? "selected" : ""}`}
                  style={tagColor ? { outline: `2px solid ${tagColor}` } : undefined}
                  onClick={e => { e.stopPropagation(); setSelected(new Set([entry.path])); setPreviewEntry(entry); }}
                  onDoubleClick={() => handleOpen(entry)}
                  onContextMenu={e => openCtxMenu(e, entry)}>
                  <FileIcon entry={entry} size={32} />
                  <span className="file-grid-name">{entry.name}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Status Bar */}
        <div className="status-bar">
          <span>{displayEntries.length} items</span>
          {selected.size > 0 && <span>{selected.size} selected</span>}
          {clipboard && <span style={{ color: "var(--accent)" }}>{clipboard.op === "copy" ? "Copy" : "Cut"} — {clipboard.entries.length} item(s)</span>}
          {listing?.is_git_repo && <span style={{ color: "var(--orange)" }}>● git: {listing.git_branch || "repo"}</span>}
          <span className="status-bar-right">{currentPath}</span>
        </div>
      </div>

      {/* ── Preview Pane ── */}
      {showPreview && (
        <PreviewPane
          entry={previewEntry}
          currentDir={currentPath}
          onClose={() => setPreviewEntry(null)}
          onNavigate={navigate}
        />
      )}

      {/* ── Error Toast Banner ── */}
      {errorToast && (
        <div style={{
          position: "fixed", bottom: 36, right: 20, zIndex: 3000,
          background: "rgba(248,81,73,0.95)", color: "white", padding: "8px 14px",
          borderRadius: "var(--radius-md)", fontSize: 12, fontWeight: 500,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />
          <span>{errorToast}</span>
        </div>
      )}

      {/* ── Context Menu ── */}
      {ctxMenu && (
        <div className="context-menu fade-in" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={e => e.stopPropagation()}>
          {ctxMenu.entry && (
            <>
              <div className="context-menu-item" onClick={() => handleOpen(ctxMenu.entry!)}><Eye size={13} /> Open</div>
              <div className="context-menu-item" onClick={() => { setModalInput(ctxMenu.entry!.name); setModal({ type: "rename", entry: ctxMenu.entry }); setCtxMenu(null); }}>
                <MoreVertical size={13} /> Rename
              </div>
              <div className="context-menu-item" onClick={() => { handleToggleFav(ctxMenu.entry!.path); setCtxMenu(null); }}>
                <Star size={13} /> {favorites.includes(ctxMenu.entry.path) ? "Unfavorite" : "Favorite"}
              </div>
              <div className="context-menu-sep" />
            </>
          )}
          <div className="context-menu-item" onClick={handleCopy}><Copy size={13} /> Copy</div>
          <div className="context-menu-item" onClick={handleCut}><Scissors size={13} /> Cut</div>
          {clipboard && <div className="context-menu-item" onClick={handlePaste}><Clipboard size={13} /> Paste</div>}
          <div className="context-menu-sep" />
          <div className="context-menu-item" onClick={() => { openTerminal(currentPath); setCtxMenu(null); }}><Terminal size={13} /> Open Terminal Here</div>
          <div className="context-menu-item" onClick={() => { openInVscode(ctxMenu.entry?.path ?? currentPath); setCtxMenu(null); }}><Code2 size={13} /> Open in VS Code</div>
          <div className="context-menu-sep" />
          <div className="context-menu-item" onClick={() => { setModalInput(""); setModal({ type: "newdir" }); setCtxMenu(null); }}><FolderPlus size={13} /> New Folder</div>
          <div className="context-menu-item" onClick={() => { setModalInput(""); setModal({ type: "newfile" }); setCtxMenu(null); }}><FilePlus size={13} /> New File</div>
          {ctxMenu.entry && (
            <>
              <div className="context-menu-sep" />
              <div className="context-menu-item danger" onClick={() => { setModal({ type: "delete", entry: ctxMenu.entry }); setCtxMenu(null); }}>
                <Trash2 size={13} /> Delete
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal fade-in" onClick={e => e.stopPropagation()}>
            {modal.type === "rename" && <>
              <div className="modal-title">Rename</div>
              <input className="modal-input" value={modalInput} onChange={e => setModalInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleRename(); }} autoFocus />
              <div className="modal-actions">
                <button className="btn" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn primary" onClick={handleRename}>Rename</button>
              </div>
            </>}
            {modal.type === "newdir" && <>
              <div className="modal-title">New Folder</div>
              <input className="modal-input" placeholder="Folder name" value={modalInput}
                onChange={e => setModalInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleNewDir(); }} autoFocus />
              <div className="modal-actions">
                <button className="btn" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn primary" onClick={handleNewDir}>Create</button>
              </div>
            </>}
            {modal.type === "newfile" && <>
              <div className="modal-title">New File</div>
              <input className="modal-input" placeholder="File name" value={modalInput}
                onChange={e => setModalInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleNewFile(); }} autoFocus />
              <div className="modal-actions">
                <button className="btn" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn primary" onClick={handleNewFile}>Create</button>
              </div>
            </>}
            {modal.type === "delete" && <>
              <div className="modal-title">Delete{modal.entry ? ` "${modal.entry.name}"` : ` ${selected.size} items`}?</div>
              <p style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 4 }}>This will permanently delete the item(s). This cannot be undone.</p>
              <div className="modal-actions">
                <button className="btn" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn danger" onClick={() => handleDelete(modal.entry)}>Delete</button>
              </div>
            </>}
          </div>
        </div>
      )}
    </div>
  );
}
