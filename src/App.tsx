import { useState, useEffect, useCallback, useRef } from "react";
import "./index.css";
import {
  listDirectory, listRecycleBin, autocompletePath, getDrives, getHomeDir, createDirectory, createFile,
  deletePath, renamePath, copyFile, searchDirectory, openTerminal, openInVscode, openFileDefault,
  compressToZip, extractZip, getFavorites, setFavorite, getTags, getFileProperties,
  FileEntry, DirectoryListing, formatSize, formatDate, getPathSegments, joinPath,
  GIT_STATUS_COLORS,
} from "./api";
import FileIcon from "./FileIcon";
import PreviewPane from "./PreviewPane";
import PropertiesModal from "./PropertiesModal";
import CommandPalette from "./CommandPalette";
import DiskAnalyzerModal from "./DiskAnalyzerModal";
import DuplicatesModal from "./DuplicatesModal";
import ChecksumModal from "./ChecksumModal";
import GrepSearchModal from "./GrepSearchModal";
import BatchRenameModal from "./BatchRenameModal";
import FileDiffModal from "./FileDiffModal";
import EncryptModal from "./EncryptModal";
import OperationProgressModal, { OperationState } from "./OperationProgressModal";
import {
  ChevronLeft, ChevronRight, ChevronUp, RefreshCw, Plus, X, LayoutGrid,
  List, Home, HardDrive, Clock, Search, MoreVertical,
  FolderPlus, FilePlus, Copy, Scissors, Clipboard, Trash2,
  Eye, EyeOff, Loader2, PanelRight, Terminal, Code2, Star, Sun, Moon, Edit3, GitBranch, AlertTriangle, Info,
  AlertCircle, CheckCircle2, ExternalLink, FileArchive, Archive, Command, PieChart, CopyCheck, ShieldCheck,
  Columns, BookmarkPlus, Layers, FileText, Sliders, Pin, GitCompare, Lock, Unlock, FolderKanban, FolderMinus,
} from "lucide-react";

interface Tab { id: string; path: string; history: string[]; historyIndex: number; }
type ViewMode = "list" | "grid";
type Theme = "dark" | "light";

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState("");
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("zephyr_view_mode") as ViewMode) || "list";
  });
  const [showHidden, setShowHidden] = useState<boolean>(() => {
    return localStorage.getItem("zephyr_show_hidden") === "true";
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null);
  const [drives, setDrives] = useState<string[]>([]);
  const [homeDir, setHomeDir] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FileEntry[] | null>(null);
  const [clipboard, setClipboard] = useState<{ entries: string[]; op: "copy" | "cut" } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; entry?: FileEntry } | null>(null);
  const [sidebarCtxMenu, setSidebarCtxMenu] = useState<{ x: number; y: number; type: "workspace" | "favorite" | "bookmark"; target: string } | null>(null);
  const [modal, setModal] = useState<{ type: "rename" | "newdir" | "newfile" | "delete" | "newworkspace"; entry?: FileEntry } | null>(null);
  const [modalInput, setModalInput] = useState("");
  const [recentDirs, setRecentDirs] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [tags, setTags] = useState<Record<string, string>>({});
  const [filterExt, setFilterExt] = useState("");
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("zephyr_theme") as Theme) || "dark";
  });
  const [editingPath, setEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState("");
  const [pathSuggestions, setPathSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string; type: "error" | "success" | "info"; message: string } | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [showDiskAnalyzer, setShowDiskAnalyzer] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [checksumPath, setChecksumPath] = useState<string | null>(null);
  const [showGrep, setShowGrep] = useState(false);
  const [showBatchRename, setShowBatchRename] = useState(false);
  const [gridIconSize, setGridIconSize] = useState<number>(() => {
    const saved = localStorage.getItem("zephyr_grid_icon_size");
    return saved ? parseInt(saved, 10) : 64;
  });
  const [stash, setStash] = useState<FileEntry[]>([]);
  const [dualPane, setDualPane] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "code" | "images" | "docs" | "archives">("all");
  const [pinnedFolders, setPinnedFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("zephyr_pinned_folders");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [diffFiles, setDiffFiles] = useState<[string, string] | null>(null);
  const [encryptPath, setEncryptPath] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<"cyan" | "purple" | "emerald" | "orange" | "pink">(() => {
    return (localStorage.getItem("zephyr_accent_color") as any) || "cyan";
  });
  const [workspaces, setWorkspaces] = useState<{ [name: string]: string[] }>(() => {
    try {
      const saved = localStorage.getItem("zephyr_workspaces");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { "My Project": [] };
  });

  const [sortColumn, setSortColumn] = useState<"name" | "type" | "modified" | "size">(
    () => (localStorage.getItem("zephyr_sort_column") as any) || "name"
  );
  const [sortAsc, setSortAsc] = useState<boolean>(
    () => localStorage.getItem("zephyr_sort_asc") !== "false"
  );
  const [showPropertiesPath, setShowPropertiesPath] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem("zephyr_sidebar_width");
    return saved ? parseInt(saved, 10) : 220;
  });
  const [previewWidth, setPreviewWidth] = useState<number>(() => {
    const saved = localStorage.getItem("zephyr_preview_width");
    return saved ? parseInt(saved, 10) : 300;
  });
  const [panelOpen, setPanelOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem("zephyr_panel_open");
    return saved !== null ? saved === "true" : true;
  });
  const [operationState, setOperationState] = useState<OperationState | null>(null);
  const cancelOpRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem("zephyr_workspaces", JSON.stringify(workspaces));
    } catch {}
  }, [workspaces]);

  useEffect(() => {
    try {
      localStorage.setItem("zephyr_pinned_folders", JSON.stringify(pinnedFolders));
    } catch {}
  }, [pinnedFolders]);

  useEffect(() => {
    try {
      localStorage.setItem("zephyr_theme", theme);
      localStorage.setItem("zephyr_accent_color", accentColor);
      localStorage.setItem("zephyr_view_mode", viewMode);
      localStorage.setItem("zephyr_show_hidden", String(showHidden));
      localStorage.setItem("zephyr_grid_icon_size", String(gridIconSize));
      localStorage.setItem("zephyr_sidebar_width", String(sidebarWidth));
      localStorage.setItem("zephyr_preview_width", String(previewWidth));
      localStorage.setItem("zephyr_panel_open", String(panelOpen));
      localStorage.setItem("zephyr_sort_column", sortColumn);
      localStorage.setItem("zephyr_sort_asc", String(sortAsc));
    } catch {}
  }, [theme, accentColor, viewMode, showHidden, gridIconSize, sidebarWidth, previewWidth, panelOpen, sortColumn, sortAsc]);

  const showToast = useCallback((message: string, type: "error" | "success" | "info" = "error") => {
    const id = crypto.randomUUID();
    setToast({ id, type, message });
    setTimeout(() => {
      setToast(prev => (prev?.id === id ? null : prev));
    }, type === "error" ? 8000 : 4000);
  }, []);

  const startResizeSidebar = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (me: MouseEvent) => {
      setSidebarWidth(Math.max(160, Math.min(450, startW + (me.clientX - startX))));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startResizePreview = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = previewWidth;
    const onMove = (me: MouseEvent) => {
      setPreviewWidth(Math.max(200, Math.min(600, startW + (startX - me.clientX))));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pathInputRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const currentPath = activeTab?.path ?? "";

  // ─── Theme & Accent Color ───────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    const colors: Record<string, string> = {
      cyan: "#38bdf8",
      purple: "#bc8cff",
      emerald: "#34d399",
      orange: "#fb923c",
      pink: "#f472b6",
    };
    const c = colors[accentColor] || "#38bdf8";
    document.documentElement.style.setProperty("--accent", c);
  }, [theme, accentColor]);

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
    setPreviewEntry(null);
    setLoading(true);
    setTabs(prev => prev.map(t => {
      if (t.id !== tid) return t;
      const newHistory = t.history.slice(0, t.historyIndex + 1).concat(path);
      return { ...t, path, history: newHistory, historyIndex: newHistory.length - 1 };
    }));
    setSelected(new Set());
    setSearchQuery("");
    setSearchResults(null);
    setFilterExt("");
    setCategoryFilter("all");
    setRecentDirs(prev => [path, ...prev.filter(p => p !== path)].slice(0, 8));
  }, [activeTabId]);

  // ─── Load listing with Error Fallback ────────────────────────────────────
  useEffect(() => {
    if (!currentPath) return;
    setLoading(true);

    if (currentPath === "shell:RecycleBinFolder") {
      listRecycleBin()
        .then(data => {
          setListing(data);
          setLoading(false);
          setErrorToast(null);
        })
        .catch(err => {
          setLoading(false);
          setErrorToast(typeof err === "string" ? err : "Failed to load Recycle Bin");
        });
      return;
    }

    if (currentPath.startsWith("workspace:")) {
      const wsName = currentPath.slice(10);
      const paths = workspaces[wsName] || [];
      if (paths.length === 0) {
        setListing({
          path: currentPath,
          entries: [],
          parent: null,
          is_git_repo: false,
        });
        setLoading(false);
        setErrorToast(null);
        return;
      }
      Promise.all(
        paths.map(async (p) => {
          try {
            const props = await getFileProperties(p).catch(() => null);
            if (props) {
              return {
                name: props.name,
                path: p,
                is_dir: props.is_dir,
                size: props.size,
                modified: props.modified,
                extension: props.extension,
                hidden: false,
              } as FileEntry;
            }
          } catch {}
          const fileName = p.split(/[\\/]/).pop() || p;
          return {
            name: fileName,
            path: p,
            is_dir: false,
            size: 0,
            modified: 0,
            extension: fileName.split(".").pop() || "",
            hidden: false,
          } as FileEntry;
        })
      ).then(entries => {
        setListing({
          path: currentPath,
          entries,
          parent: null,
          is_git_repo: false,
        });
        setLoading(false);
        setErrorToast(null);
      }).catch(() => {
        setLoading(false);
      });
      return;
    }

    listDirectory(currentPath, showHidden)
      .then(data => {
        setListing(data);
        setLoading(false);
        setErrorToast(null);
        if (data.path && data.path !== currentPath) {
          setTabs(prev => prev.map(t => t.id === activeTabId ? {
            ...t,
            path: data.path,
            history: t.history.map((h, i) => i === t.historyIndex ? data.path : h)
          } : t));
        }
      })
      .catch(err => {
        setLoading(false);
        const msg = typeof err === "string" ? err : "Failed to load directory";
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
          listDirectory(prevPath, showHidden).then(setListing).catch(() => {});
        }
      });
  }, [currentPath, showHidden, workspaces]);

  // ─── Path Autocomplete & Selection ──────────────────────────────────────
  useEffect(() => {
    if (editingPath && pathInputRef.current) {
      pathInputRef.current.focus();
      pathInputRef.current.select();
    }
  }, [editingPath]);

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
    if (!currentPath) return;
    setLoading(true);

    if (currentPath === "shell:RecycleBinFolder") {
      listRecycleBin()
        .then(data => { setListing(data); setErrorToast(null); })
        .catch(err => { setErrorToast(typeof err === "string" ? err : "Failed to load Recycle Bin"); })
        .finally(() => setLoading(false));
      return;
    }

    if (currentPath.startsWith("workspace:")) {
      const wsName = currentPath.slice(10);
      const paths = workspaces[wsName] || [];
      if (paths.length === 0) {
        setListing({
          path: currentPath,
          entries: [],
          parent: null,
          is_git_repo: false,
        });
        setLoading(false);
        setErrorToast(null);
        return;
      }
      Promise.all(
        paths.map(async (p) => {
          try {
            const props = await getFileProperties(p).catch(() => null);
            if (props) {
              return {
                name: props.name,
                path: p,
                is_dir: props.is_dir,
                size: props.size,
                modified: props.modified,
                extension: props.extension,
                hidden: false,
              } as FileEntry;
            }
          } catch {}
          return null;
        })
      ).then(results => {
        const validEntries = results.filter((e): e is FileEntry => e !== null);
        setListing({
          path: currentPath,
          entries: validEntries,
          parent: null,
          is_git_repo: false,
        });
        setErrorToast(null);
      }).catch(() => {})
      .finally(() => setLoading(false));
      return;
    }

    listDirectory(currentPath, showHidden)
      .then(data => { setListing(data); setErrorToast(null); })
      .catch(err => { setErrorToast(typeof err === "string" ? err : "Failed to load directory"); })
      .finally(() => setLoading(false));

    getTags().then(setTags);
    getFavorites().then(setFavorites);
  }, [currentPath, showHidden, workspaces]);

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
  const handleItemClick = (e: React.MouseEvent, entry: FileEntry) => {
    setCtxMenu(null);
    e.stopPropagation();

    // Fast-path double click handling to ensure instant response on all platforms
    if (e.detail === 2) {
      handleOpen(entry);
      return;
    }

    if (e.shiftKey && lastSelectedPath) {
      const startIndex = displayEntries.findIndex(item => item.path === lastSelectedPath);
      const endIndex = displayEntries.findIndex(item => item.path === entry.path);
      if (startIndex !== -1 && endIndex !== -1) {
        const [minIdx, maxIdx] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
        const rangePaths = displayEntries.slice(minIdx, maxIdx + 1).map(item => item.path);
        setSelected(prev => new Set([...Array.from(prev), ...rangePaths]));
        setPreviewEntry(entry);
        return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(entry.path)) {
          next.delete(entry.path);
        } else {
          next.add(entry.path);
        }
        return next;
      });
      setLastSelectedPath(entry.path);
      setPreviewEntry(entry);
      return;
    }

    setSelected(new Set([entry.path]));
    setLastSelectedPath(entry.path);
    setPreviewEntry(entry);
  };

  const handleOpen = (entry: FileEntry) => {
    if (entry.is_dir) {
      navigate(entry.path);
    } else {
      setPreviewEntry(entry);
      openFileDefault(entry.path).catch(err => {
        showToast(typeof err === "string" ? err : "Failed to open file", "error");
      });
    }
  };
  const handleCopy = () => { if (selected.size) { setClipboard({ entries: Array.from(selected), op: "copy" }); setCtxMenu(null); } };
  const handleCut  = () => { if (selected.size) { setClipboard({ entries: Array.from(selected), op: "cut"  }); setCtxMenu(null); } };
  const handlePaste = async () => {
    if (!clipboard || !currentPath) return;
    cancelOpRef.current = false;
    const opType = clipboard.op === "copy" ? "copy" : "cut";
    const startTime = Date.now();
    const totalItems = clipboard.entries.length;
    let completedItems = 0;
    let totalBytes = 0;
    let copiedBytes = 0;

    for (const src of clipboard.entries) {
      try {
        const props = await getFileProperties(src);
        totalBytes += props.size;
      } catch {}
    }

    setOperationState({
      type: opType,
      title: `${opType === "copy" ? "Copying" : "Moving"} ${totalItems} item(s)...`,
      currentFile: "",
      totalItems,
      completedItems: 0,
      totalBytes,
      copiedBytes: 0,
      startTime,
    });

    try {
      for (const src of clipboard.entries) {
        if (cancelOpRef.current) break;
        const name = src.split(/[\\/]/).pop()!;
        const dest = joinPath(currentPath, name);

        setOperationState(prev => prev ? { ...prev, currentFile: name } : null);

        let srcSize = 0;
        try {
          const props = await getFileProperties(src);
          srcSize = props.size;
        } catch {}

        await copyFile(src, dest);
        if (clipboard.op === "cut") await deletePath(src);

        completedItems += 1;
        copiedBytes += srcSize;

        setOperationState(prev => prev ? { ...prev, completedItems, copiedBytes } : null);
      }

      if (!cancelOpRef.current) {
        if (clipboard.op === "cut") setClipboard(null);
        showToast(opType === "copy" ? "Pasted successfully" : "Moved successfully", "success");
      } else {
        showToast("Operation cancelled", "info");
      }
    } catch (err) {
      showToast(typeof err === "string" ? err : "Failed to paste item(s)", "error");
    } finally {
      setOperationState(null);
      setCtxMenu(null);
      refresh();
    }
  };

  const handleDelete = async (entry?: FileEntry) => {
    const targets = (selected.size > 1 || !entry) ? Array.from(selected) : [entry.path];
    if (!targets.length) return;
    cancelOpRef.current = false;
    const startTime = Date.now();
    const totalItems = targets.length;
    let completedItems = 0;
    let totalBytes = 0;

    for (const p of targets) {
      try {
        const props = await getFileProperties(p);
        totalBytes += props.size;
      } catch {}
    }

    setOperationState({
      type: "delete",
      title: `Deleting ${totalItems} item(s)...`,
      currentFile: "",
      totalItems,
      completedItems: 0,
      totalBytes,
      copiedBytes: 0,
      startTime,
    });

    try {
      for (const p of targets) {
        if (cancelOpRef.current) break;
        const name = p.split(/[\\/]/).pop()!;
        setOperationState(prev => prev ? { ...prev, currentFile: name } : null);

        let itemSize = 0;
        try {
          const props = await getFileProperties(p);
          itemSize = props.size;
        } catch {}

        try {
          await deletePath(p);
        } catch (e) {
          console.warn("Failed to delete path:", p, e);
        }
        completedItems += 1;

        setOperationState(prev => prev ? { ...prev, completedItems, copiedBytes: prev.copiedBytes + itemSize } : null);
      }

      if (!cancelOpRef.current) {
        showToast("Deleted successfully", "success");
      } else {
        showToast("Delete cancelled", "info");
      }
    } catch (err) {
      showToast(typeof err === "string" ? err : "Failed to delete item(s)", "error");
    } finally {
      setWorkspaces(prev => {
        const updated = { ...prev };
        for (const wsKey in updated) {
          updated[wsKey] = updated[wsKey].filter(p => !targets.includes(p));
        }
        return updated;
      });
      setOperationState(null);
      setModal(null);
      setCtxMenu(null);
      refresh();
    }
  };
  const handleRename = async () => {
    if (!modal?.entry || !modalInput.trim()) return;
    const sep = modal.entry.path.includes("\\") ? "\\" : "/";
    const dir = modal.entry.path.split(sep).slice(0, -1).join(sep);
    try {
      await renamePath(modal.entry.path, dir + sep + modalInput.trim());
      refresh(); setModal(null);
    } catch (err) {
      showToast(typeof err === "string" ? err : "Failed to rename item", "error");
    }
  };
  const handleNewDir  = async () => {
    if (!modalInput.trim()) return;
    try {
      await createDirectory(joinPath(currentPath, modalInput.trim()));
      refresh(); setModal(null);
    } catch (err) {
      showToast(typeof err === "string" ? err : "Failed to create folder", "error");
    }
  };
  const handleNewFile = async () => {
    if (!modalInput.trim()) return;
    try {
      await createFile(joinPath(currentPath, modalInput.trim()));
      refresh(); setModal(null);
    } catch (err) {
      showToast(typeof err === "string" ? err : "Failed to create file", "error");
    }
  };
  const handleCreateWorkspace = () => {
    const name = modalInput.trim();
    if (!name) return;
    setWorkspaces(prev => ({
      ...prev,
      [name]: prev[name] || []
    }));
    setModal(null);
    showToast(`Created workspace "${name}"`, "success");
  };

  const handleOpenVscode = (path: string) => {
    openInVscode(path).catch(err => {
      showToast(typeof err === "string" ? err : "Failed to launch VS Code", "error");
    });
  };

  const handleOpenTerminal = (path: string) => {
    openTerminal(path).catch(err => {
      showToast(typeof err === "string" ? err : "Failed to launch Terminal", "error");
    });
  };

  const handleCompressZip = async () => {
    const target = ctxMenu?.entry?.path ?? Array.from(selected)[0] ?? currentPath;
    if (!target) return;
    const outputZip = target.replace(/[\/\\]+$/, "") + ".zip";
    try {
      await compressToZip(target, outputZip);
      showToast(`Compressed to ${outputZip.split(/[\\/]/).pop()}`, "success");
      refresh();
    } catch (err) {
      showToast(typeof err === "string" ? err : "Failed to compress to zip", "error");
    }
    setCtxMenu(null);
  };

  const handleExtractZip = async () => {
    const target = ctxMenu?.entry?.path ?? Array.from(selected)[0];
    if (!target || !target.endsWith(".zip")) return;
    const targetDir = target.slice(0, -4);
    try {
      await extractZip(target, targetDir);
      showToast(`Extracted to ${targetDir.split(/[\\/]/).pop()}`, "success");
      refresh();
    } catch (err) {
      showToast(typeof err === "string" ? err : "Failed to extract zip archive", "error");
    }
    setCtxMenu(null);
  };

  const handleToggleFav = async (path: string) => {
    const isFav = favorites.includes(path);
    await setFavorite(path, !isFav);
    setFavorites(await getFavorites());
  };

  // ─── Context menu ─────────────────────────────────────────────────────────
  const openCtxMenu = (e: React.MouseEvent, entry?: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    if (entry) {
      if (!selected.has(entry.path)) {
        setSelected(new Set([entry.path]));
        setPreviewEntry(entry);
      }
    }
    const menuWidth = 220;
    const menuHeight = entry ? (entry.is_dir ? 680 : 700) : 260;
    const clientX = Number.isFinite(e.clientX) ? e.clientX : 100;
    const clientY = Number.isFinite(e.clientY) ? e.clientY : 100;
    const x = Math.max(0, Math.min(clientX, (window.innerWidth || 1024) - menuWidth));
    const y = Math.max(0, Math.min(clientY, (window.innerHeight || 768) - menuHeight));
    setCtxMenu({ x, y, entry });
  };

  // Close context menu on global click or Escape
  useEffect(() => {
    if (!ctxMenu) return;
    const handleClose = () => setCtxMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setCtxMenu(null); };
    window.addEventListener("click", handleClose);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [ctxMenu]);

  useEffect(() => {
    if (!sidebarCtxMenu) return;
    const handleClose = () => setSidebarCtxMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setSidebarCtxMenu(null); };
    window.addEventListener("click", handleClose);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sidebarCtxMenu]);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
      if (isInput) return;
      if (e.key === "Escape") {
        setModal(null);
        setCtxMenu(null);
        setShowPropertiesPath(null);
        setShowPalette(false);
        setShowDiskAnalyzer(false);
        setShowDuplicates(false);
        setChecksumPath(null);
        setShowGrep(false);
        setShowBatchRename(false);
        setDiffFiles(null);
        setEncryptPath(null);
      }
      if (e.key === "F3") {
        e.preventDefault();
        setDualPane(d => !d);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "k" || e.key.toLowerCase() === "p")) {
        e.preventDefault();
        setShowPalette(p => !p);
      }
      if (e.key === "F5") { e.preventDefault(); refresh(); }
      if (e.key === "Backspace") { e.preventDefault(); goUp(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "t") { e.preventDefault(); newTab(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (displayEntries.length > 0) {
          setSelected(new Set(displayEntries.map(entry => entry.path)));
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") { if (selected.size) { e.preventDefault(); handleCopy(); } }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") { if (selected.size) { e.preventDefault(); handleCut(); } }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") { if (clipboard) { e.preventDefault(); handlePaste(); } }
      if (e.key === "Delete") { if (selected.size) { e.preventDefault(); setModal({ type: "delete" }); } }
      if (e.altKey && e.key === "Enter") {
        e.preventDefault();
        const target = Array.from(selected)[0] ?? currentPath;
        if (target) setShowPropertiesPath(target);
      }
      if (e.key === "F2") {
        if (selected.size === 1) {
          const entry = displayEntries.find(en => selected.has(en.path));
          if (entry) { setModalInput(entry.name); setModal({ type: "rename", entry }); }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, clipboard, listing, currentPath]);

  const handleSort = (col: "name" | "type" | "modified" | "size") => {
    if (sortColumn === col) {
      setSortAsc(a => !a);
    } else {
      setSortColumn(col);
      setSortAsc(true);
    }
  };

  // ─── Derived state ────────────────────────────────────────────────────────
  // Filter entries based on search, extension, and category
  let displayEntries = listing?.entries ?? [];
  if (filterExt) displayEntries = displayEntries.filter(e => e.is_dir || e.extension.toLowerCase() === filterExt.toLowerCase());
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    displayEntries = displayEntries.filter(e => e.name.toLowerCase().includes(q));
  }
  if (categoryFilter === "code") {
    displayEntries = displayEntries.filter(e => e.is_dir || ["rs", "ts", "tsx", "js", "jsx", "py", "json", "html", "css", "toml", "yaml"].includes(e.extension.toLowerCase()));
  } else if (categoryFilter === "images") {
    displayEntries = displayEntries.filter(e => e.is_dir || ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(e.extension.toLowerCase()));
  } else if (categoryFilter === "docs") {
    displayEntries = displayEntries.filter(e => e.is_dir || ["pdf", "md", "txt", "doc", "docx"].includes(e.extension.toLowerCase()));
  } else if (categoryFilter === "archives") {
    displayEntries = displayEntries.filter(e => e.is_dir || ["zip", "rar", "tar", "gz", "7z"].includes(e.extension.toLowerCase()));
  }

  displayEntries.sort((a, b) => {
    if (a.is_dir && !b.is_dir) return -1;
    if (!a.is_dir && b.is_dir) return 1;

    let res = 0;
    if (sortColumn === "name") {
      res = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    } else if (sortColumn === "type") {
      const typeA = a.is_dir ? "Folder" : a.extension;
      const typeB = b.is_dir ? "Folder" : b.extension;
      res = typeA.localeCompare(typeB, undefined, { sensitivity: "base" });
    } else if (sortColumn === "modified") {
      res = a.modified - b.modified;
    } else if (sortColumn === "size") {
      res = a.size - b.size;
    }
    return sortAsc ? res : -res;
  });

  const segments = getPathSegments(currentPath);
  const showPreview = panelOpen;

  // Unique extensions for filter dropdown
  const availableExts = Array.from(new Set((listing?.entries ?? []).filter(e => !e.is_dir && e.extension).map(e => e.extension))).sort();

  return (
    <div className="app" data-theme={theme}
      onClick={() => { setCtxMenu(null); }}
      style={{ gridTemplateColumns: `${sidebarWidth}px 4px 1fr${showPreview ? ` 4px ${previewWidth}px` : ""}` }}>

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
                onFocus={e => e.currentTarget.select()}
                onClick={e => {
                  e.stopPropagation();
                  e.currentTarget.select();
                }}
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

        <button className="toolbar-btn" title="Deep Content Search (Grep)" onClick={() => setShowGrep(true)}><FileText size={14} /></button>
        <button className="toolbar-btn" title="Dual Pane View (F3)" onClick={() => setDualPane(d => !d)}><Columns size={14} /></button>
        <button className="toolbar-btn" title="Disk Space Analyzer" onClick={() => setShowDiskAnalyzer(true)}><PieChart size={14} /></button>
        <button className="toolbar-btn" title="Find Duplicate Files" onClick={() => setShowDuplicates(true)}><CopyCheck size={14} /></button>
        <button className="toolbar-btn" title="Command Palette (Ctrl+K)" onClick={() => setShowPalette(true)}><Command size={14} /></button>
        {/* Accent Color Palette Selector */}
        <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "0 4px" }}>
          {(["cyan", "purple", "emerald", "orange", "pink"] as const).map(c => {
            const hex = c === "cyan" ? "#38bdf8" : c === "purple" ? "#c084fc" : c === "emerald" ? "#34d399" : c === "orange" ? "#fb923c" : "#f472b6";
            return (
              <span
                key={c}
                onClick={() => {
                  setAccentColor(c);
                  document.documentElement.style.setProperty("--accent", hex);
                }}
                style={{
                  width: 10, height: 10, borderRadius: "50%", background: hex, cursor: "pointer",
                  border: accentColor === c ? "2px solid white" : "none", flexShrink: 0
                }}
                title={`Accent: ${c}`}
              />
            );
          })}
        </div>
        {viewMode === "grid" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 6px" }}>
            <Sliders size={12} color="var(--text-muted)" />
            <input
              type="range" min="36" max="140" value={gridIconSize}
              onChange={e => setGridIconSize(Number(e.target.value))}
              title={`Grid Icon Size: ${gridIconSize}px`}
              style={{ width: 64, cursor: "pointer" }}
            />
          </div>
        )}
        <button className="toolbar-btn" title="Open Terminal here" onClick={() => handleOpenTerminal(currentPath)}><Terminal size={14} /></button>
        <button className="toolbar-btn" title="Open in VS Code" onClick={() => handleOpenVscode(currentPath)}><Code2 size={14} /></button>
        <button className="toolbar-btn" title={showPreview ? "Hide Preview" : "Show Preview"}
          onClick={() => {
            if (panelOpen) {
              setPanelOpen(false);
            } else {
              setPanelOpen(true);
              if (!previewEntry) {
                const target = Array.from(selected)[0];
                const entry = displayEntries.find(e => e.path === target) ?? displayEntries[0] ?? null;
                setPreviewEntry(entry);
              }
            }
          }}
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
          <div key={tab.id} className={`tab ${tab.id === activeTabId ? "active" : ""}`}
            onClick={() => setActiveTabId(tab.id)}
            onMouseDown={e => {
              if (e.button === 1) { // Middle click closes tab
                e.preventDefault();
                e.stopPropagation();
                closeTab(tab.id);
              }
            }}>
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
          <div className={`sidebar-item ${currentPath === "shell:RecycleBinFolder" ? "active" : ""}`} onClick={() => navigate("shell:RecycleBinFolder")}>
            <Trash2 size={14} color="var(--red)" /><span>Recycle Bin</span>
          </div>
        </div>

        {favorites.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-label">Favorites</div>
            {favorites.map(p => (
              <div
                key={p}
                className={`sidebar-item ${currentPath === p ? "active" : ""}`}
                onClick={() => navigate(p)}
                onContextMenu={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSidebarCtxMenu({ x: e.clientX, y: e.clientY, type: "favorite", target: p });
                }}
              >
                <Star size={13} fill="var(--yellow)" color="var(--yellow)" />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.split(/[\\/]/).pop() || p}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pinned Bookmarks Section */}
        {pinnedFolders.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">Bookmarks</div>
            {pinnedFolders.map(folder => (
              <div
                key={folder}
                className="sidebar-item"
                onClick={() => navigate(folder)}
                onContextMenu={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSidebarCtxMenu({ x: e.clientX, y: e.clientY, type: "bookmark", target: folder });
                }}
              >
                <Pin size={14} color="var(--accent)" />
                <span className="sidebar-item-text">{folder.split(/[\\/]/).pop() || folder}</span>
              </div>
            ))}
          </div>
        )}

        {/* Virtual Workspaces Section */}
        <div className="sidebar-section">
          <div className="sidebar-section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Workspaces</span>
            <button
              onClick={e => {
                e.stopPropagation();
                setModalInput("");
                setModal({ type: "newworkspace" });
              }}
              title="Create New Workspace"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", display: "flex", alignItems: "center", padding: "2px 4px", borderRadius: 4 }}
            >
              <Plus size={14} />
            </button>
          </div>
          {Object.keys(workspaces).map(wsName => {
            const count = workspaces[wsName].length;
            const isWsActive = currentPath === `workspace:${wsName}`;
            return (
              <div
                key={wsName}
                className={`sidebar-item ${isWsActive ? "active" : ""}`}
                onClick={() => navigate(`workspace:${wsName}`)}
                onContextMenu={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSidebarCtxMenu({ x: e.clientX, y: e.clientY, type: "workspace", target: wsName });
                }}
                title={`Workspace: ${wsName} (${count} items)`}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                  <FolderKanban size={14} color="var(--accent)" />
                  <span className="sidebar-item-text" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wsName}</span>
                </div>
                <span style={{
                  fontSize: 10,
                  background: isWsActive ? "var(--accent)" : "rgba(56, 189, 248, 0.15)",
                  color: isWsActive ? "#0f172a" : "var(--accent)",
                  padding: "1px 6px",
                  borderRadius: 10,
                  fontWeight: 600,
                  flexShrink: 0
                }}>
                  {count} {count === 1 ? "item" : "items"}
                </span>
              </div>
            );
          })}
        </div>

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

      {/* ── Sidebar Resizer Handle ── */}
      <div className="resizer-handle" onMouseDown={startResizeSidebar} title="Drag to resize sidebar" />

      {/* ── Main ── */}
      <div className="main-area" onContextMenu={e => openCtxMenu(e)} style={{ position: "relative" }}>
        {loading && (
          <div className="nav-loading-bar-container">
            <div className="nav-loading-bar" />
          </div>
        )}
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
          {/* Category Filter Chips Bar */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {(["all", "code", "images", "docs", "archives"] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                style={{
                  background: categoryFilter === cat ? "var(--bg-active)" : "transparent",
                  border: `1px solid ${categoryFilter === cat ? "var(--accent)" : "var(--border)"}`,
                  color: categoryFilter === cat ? "var(--accent)" : "var(--text-muted)",
                  padding: "2px 8px", borderRadius: 12, fontSize: 11, cursor: "pointer", textTransform: "capitalize", fontWeight: 500
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="view-controls">
            <button className={`view-btn ${viewMode === "list" ? "active" : ""}`} onClick={() => setViewMode("list")} title="List View"><List size={14} /></button>
            <button className={`view-btn ${viewMode === "grid" ? "active" : ""}`} onClick={() => setViewMode("grid")} title="Grid View"><LayoutGrid size={14} /></button>
          </div>
        </div>

        {loading && displayEntries.length === 0 && (
          <div className="loading" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--text-muted)", padding: 40 }}>
            <Loader2 size={24} className="spin" color="var(--accent)" />
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Loading directory...</span>
          </div>
        )}

        {!loading && displayEntries.length === 0 && (
          <div className="empty-state fade-in">
            <Search size={40} />
            <p>{searchQuery ? "No files match your search." : filterExt ? `No .${filterExt} files here.` : "This folder is empty."}</p>
          </div>
        )}

        {/* List View */}
        {displayEntries.length > 0 && viewMode === "list" && (
          <div className="file-list">
            <div className="file-list-header">
              <span onClick={() => handleSort("name")} style={{ cursor: "pointer", userSelect: "none" }}>
                Name {sortColumn === "name" && (sortAsc ? "▲" : "▼")}
              </span>
              <span onClick={() => handleSort("type")} style={{ cursor: "pointer", userSelect: "none" }}>
                Type {sortColumn === "type" && (sortAsc ? "▲" : "▼")}
              </span>
              <span onClick={() => handleSort("modified")} style={{ cursor: "pointer", userSelect: "none" }}>
                Modified {sortColumn === "modified" && (sortAsc ? "▲" : "▼")}
              </span>
              <span onClick={() => handleSort("size")} style={{ cursor: "pointer", userSelect: "none" }}>
                Size {sortColumn === "size" && (sortAsc ? "▲" : "▼")}
              </span>
            </div>
            {displayEntries.map(entry => {
              if (!entry || !entry.path) return null;
              const tagColor = tags?.[entry.path];
              const gitColor = entry.git_status ? GIT_STATUS_COLORS[entry.git_status] : undefined;
              const isSelected = selected?.has(entry.path) ?? false;
              const isFav = favorites?.includes(entry.path) ?? false;
              return (
                <div key={entry.path}
                  className={`file-row ${isSelected ? "selected" : ""}`}
                  style={tagColor ? { borderLeft: `3px solid ${tagColor}` } : undefined}
                  onClick={e => handleItemClick(e, entry)}
                  onDoubleClick={() => handleOpen(entry)}
                  onContextMenu={e => openCtxMenu(e, entry)}>
                  <div className="file-name">
                    {gitColor && <span style={{ width: 6, height: 6, borderRadius: "50%", background: gitColor, flexShrink: 0, display: "inline-block" }} title={`git: ${entry.git_status}`} />}
                    <FileIcon entry={entry} size={15} />
                    <span className="file-name-text">{entry.name}</span>
                    {isFav && <Star size={11} fill="var(--yellow)" color="var(--yellow)" style={{ flexShrink: 0 }} />}
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
          <div className="file-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(80, gridIconSize + 40)}px, 1fr))` }}>
            {displayEntries.map(entry => {
              if (!entry || !entry.path) return null;
              const tagColor = tags?.[entry.path];
              const isSelected = selected?.has(entry.path) ?? false;
              return (
                <div key={entry.path}
                  className={`file-grid-item ${isSelected ? "selected" : ""}`}
                  style={tagColor ? { outline: `2px solid ${tagColor}` } : undefined}
                  onClick={e => handleItemClick(e, entry)}
                  onDoubleClick={() => handleOpen(entry)}
                  onContextMenu={e => openCtxMenu(e, entry)}>
                  <FileIcon entry={entry} size={gridIconSize} />
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
          {dualPane && <span style={{ color: "var(--accent)", fontWeight: 600 }}>Split View (Dual Pane)</span>}
          {listing?.is_git_repo && <span style={{ color: "var(--orange)" }}>● git: {listing.git_branch || "repo"}</span>}
          <span className="status-bar-right">{currentPath}</span>
        </div>
      </div>

      {/* ── Preview Resizer Handle ── */}
      {showPreview && <div className="resizer-handle" onMouseDown={startResizePreview} title="Drag to resize preview pane" />}

      {/* ── Preview Pane ── */}
      {showPreview && (
        <PreviewPane
          entry={previewEntry}
          currentDir={currentPath}
          onClose={() => setPanelOpen(false)}
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
          {ctxMenu.entry ? (
            <>
              <div className="context-menu-item" onClick={() => { handleOpen(ctxMenu.entry!); setCtxMenu(null); }}><Eye size={13} /> Open</div>
              <div className="context-menu-item" onClick={() => { setModalInput(ctxMenu.entry!.name); setModal({ type: "rename", entry: ctxMenu.entry }); setCtxMenu(null); }}>
                <MoreVertical size={13} /> Rename
              </div>
              <div className="context-menu-item" onClick={() => { handleToggleFav(ctxMenu.entry!.path); setCtxMenu(null); }}>
                <Star size={13} /> {favorites.includes(ctxMenu.entry.path) ? "Unfavorite" : "Favorite"}
              </div>
              <div className="context-menu-sep" />
              <div className="context-menu-item" onClick={handleCopy}><Copy size={13} /> Copy</div>
              <div className="context-menu-item" onClick={handleCut}><Scissors size={13} /> Cut</div>
              {clipboard && <div className="context-menu-item" onClick={handlePaste}><Clipboard size={13} /> Paste</div>}
              <div className="context-menu-item" onClick={() => {
                if (ctxMenu.entry) setStash(prev => [...prev, ctxMenu.entry!]);
                setCtxMenu(null);
                showToast("Added to Stash Tray", "success");
              }}><BookmarkPlus size={13} /> Add to Stash Tray</div>
              {ctxMenu.entry.is_dir && (
                <div className="context-menu-item" onClick={() => {
                  setPinnedFolders(prev => Array.from(new Set([...prev, ctxMenu.entry!.path])));
                  setCtxMenu(null);
                  showToast("Pinned folder to Sidebar Bookmarks", "success");
                }}><Pin size={13} /> Pin to Sidebar</div>
              )}
              <div className="context-menu-item" onClick={() => {
                navigator.clipboard.writeText(ctxMenu.entry!.path);
                setCtxMenu(null);
                showToast("Copied full path to clipboard", "success");
              }}><Copy size={13} /> Copy Full Path</div>
              <div className="context-menu-item" onClick={() => {
                navigator.clipboard.writeText(ctxMenu.entry!.name);
                setCtxMenu(null);
                showToast("Copied filename to clipboard", "success");
              }}><Copy size={13} /> Copy Filename</div>
              {selected.size === 2 && (
                <div className="context-menu-item" onClick={() => {
                  const selArray = Array.from(selected);
                  setDiffFiles([selArray[0], selArray[1]]);
                  setCtxMenu(null);
                }}><GitCompare size={13} /> Compare Files (Diff)</div>
              )}
              {!ctxMenu.entry.is_dir && (
                <div className="context-menu-item" onClick={() => {
                  setEncryptPath(ctxMenu.entry!.path);
                  setCtxMenu(null);
                }}>{ctxMenu.entry.name.endsWith(".enc") ? <Unlock size={13} /> : <Lock size={13} />} {ctxMenu.entry.name.endsWith(".enc") ? "Decrypt File" : "Encrypt File"}</div>
              )}
              {Object.keys(workspaces).map(wsName => {
                const isInWs = (workspaces[wsName] || []).includes(ctxMenu.entry!.path);
                return (
                  <div key={wsName} className={`context-menu-item ${isInWs ? "danger" : ""}`} onClick={() => {
                    if (isInWs) {
                      setWorkspaces(prev => ({
                        ...prev,
                        [wsName]: (prev[wsName] || []).filter(p => p !== ctxMenu.entry!.path)
                      }));
                      setCtxMenu(null);
                      showToast(`Removed from '${wsName}' Workspace`, "info");
                    } else {
                      setWorkspaces(prev => ({
                        ...prev,
                        [wsName]: Array.from(new Set([...(prev[wsName] || []), ctxMenu.entry!.path]))
                      }));
                      setCtxMenu(null);
                      showToast(`Added to '${wsName}' Workspace`, "success");
                    }
                  }}>
                    {isInWs ? <FolderMinus size={13} /> : <FolderKanban size={13} />}
                    {isInWs ? `Remove from '${wsName}' Workspace` : `Add to '${wsName}' Workspace`}
                  </div>
                );
              })}
              <div className="context-menu-sep" />
              <div className="context-menu-item" onClick={() => { setShowBatchRename(true); setCtxMenu(null); }}><Edit3 size={13} /> Batch Rename Selected</div>
              {/* Only show Open Terminal Here for folders */}
              {ctxMenu.entry.is_dir && (
                <div className="context-menu-item" onClick={() => { handleOpenTerminal(ctxMenu.entry!.path); setCtxMenu(null); }}><Terminal size={13} /> Open Terminal Here</div>
              )}
              {!ctxMenu.entry.is_dir && (
                <>
                  <div className="context-menu-item" onClick={() => { handleOpen(ctxMenu.entry!); setCtxMenu(null); }}><ExternalLink size={13} /> Open with Default App</div>
                  <div className="context-menu-item" onClick={() => { setChecksumPath(ctxMenu.entry!.path); setCtxMenu(null); }}><ShieldCheck size={13} /> Compute Checksum</div>
                </>
              )}
              {/* Open in VS Code opens the folder or file */}
              <div className="context-menu-item" onClick={() => { handleOpenVscode(ctxMenu.entry!.path); setCtxMenu(null); }}><Code2 size={13} /> Open in VS Code</div>
              <div className="context-menu-sep" />
              <div className="context-menu-item" onClick={handleCompressZip}><FileArchive size={13} /> Compress to Zip</div>
              {ctxMenu.entry.name.endsWith(".zip") && (
                <div className="context-menu-item" onClick={handleExtractZip}><Archive size={13} /> Extract Archive</div>
              )}
              <div className="context-menu-sep" />
              <div className="context-menu-item" onClick={() => { setShowPropertiesPath(ctxMenu.entry!.path); setCtxMenu(null); }}><Info size={13} /> Properties</div>
              <div className="context-menu-sep" />
              <div className="context-menu-item danger" onClick={() => { setModal({ type: "delete", entry: ctxMenu.entry }); setCtxMenu(null); }}>
                <Trash2 size={13} /> Delete
              </div>
            </>
          ) : (
            <>
              {selected.size > 0 && (
                <>
                  <div className="context-menu-item danger" onClick={() => { setModal({ type: "delete" }); setCtxMenu(null); }}>
                    <Trash2 size={13} /> Delete {selected.size} Selected Item(s)
                  </div>
                  <div className="context-menu-item" onClick={handleCopy}><Copy size={13} /> Copy {selected.size} Item(s)</div>
                  <div className="context-menu-item" onClick={handleCut}><Scissors size={13} /> Cut {selected.size} Item(s)</div>
                  <div className="context-menu-sep" />
                </>
              )}
              {clipboard && <div className="context-menu-item" onClick={handlePaste}><Clipboard size={13} /> Paste</div>}
              <div className="context-menu-item" onClick={() => { handleOpenTerminal(currentPath); setCtxMenu(null); }}><Terminal size={13} /> Open Terminal Here</div>
              <div className="context-menu-item" onClick={() => { handleOpenVscode(currentPath); setCtxMenu(null); }}><Code2 size={13} /> Open in VS Code</div>
              <div className="context-menu-sep" />
              <div className="context-menu-item" onClick={() => { setModalInput(""); setModal({ type: "newdir" }); setCtxMenu(null); }}><FolderPlus size={13} /> New Folder</div>
              <div className="context-menu-item" onClick={() => { setModalInput(""); setModal({ type: "newfile" }); setCtxMenu(null); }}><FilePlus size={13} /> New File</div>
              <div className="context-menu-sep" />
              <div className="context-menu-item" onClick={() => { setShowPropertiesPath(currentPath); setCtxMenu(null); }}><Info size={13} /> Properties</div>
              <div className="context-menu-item" onClick={() => { refresh(); setCtxMenu(null); }}><RefreshCw size={13} /> Refresh</div>
            </>
          )}
        </div>
      )}

      {/* ── Sidebar Context Menu ── */}
      {sidebarCtxMenu && (
        <div className="context-menu fade-in" style={{ left: sidebarCtxMenu.x, top: sidebarCtxMenu.y }} onClick={e => e.stopPropagation()}>
          {sidebarCtxMenu.type === "workspace" && (
            <>
              <div className="context-menu-item" onClick={() => {
                const wsName = sidebarCtxMenu.target;
                setWorkspaces(prev => ({ ...prev, [wsName]: [] }));
                setSidebarCtxMenu(null);
                showToast(`Cleared items from '${wsName}'`, "info");
              }}>
                <RefreshCw size={13} /> Clear Workspace Items
              </div>
              <div className="context-menu-sep" />
              <div className="context-menu-item danger" onClick={() => {
                const wsName = sidebarCtxMenu.target;
                setWorkspaces(prev => {
                  const updated = { ...prev };
                  delete updated[wsName];
                  return updated;
                });
                if (currentPath === `workspace:${wsName}`) navigate(homeDir);
                setSidebarCtxMenu(null);
                showToast(`Deleted workspace '${wsName}'`, "success");
              }}>
                <Trash2 size={13} /> Delete Workspace
              </div>
            </>
          )}

          {sidebarCtxMenu.type === "favorite" && (
            <div className="context-menu-item danger" onClick={async () => {
              const path = sidebarCtxMenu.target;
              await setFavorite(path, false);
              setFavorites(await getFavorites());
              setSidebarCtxMenu(null);
              showToast("Removed from Favorites", "success");
            }}>
              <Star size={13} /> Remove from Favorites
            </div>
          )}

          {sidebarCtxMenu.type === "bookmark" && (
            <div className="context-menu-item danger" onClick={() => {
              const folder = sidebarCtxMenu.target;
              setPinnedFolders(prev => prev.filter(p => p !== folder));
              setSidebarCtxMenu(null);
              showToast("Unpinned Bookmark", "success");
            }}>
              <Pin size={13} /> Unpin Bookmark
            </div>
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
            {modal.type === "newworkspace" && <>
              <div className="modal-title">Create Workspace</div>
              <input className="modal-input" placeholder="Workspace name (e.g. Frontend, Project X)" value={modalInput}
                onChange={e => setModalInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleCreateWorkspace(); }} autoFocus />
              <div className="modal-actions">
                <button className="btn" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn primary" onClick={handleCreateWorkspace}>Create</button>
              </div>
            </>}
            {modal.type === "delete" && <>
              <div className="modal-title">Delete{(modal.entry && selected.size <= 1) ? ` "${modal.entry.name}"` : ` ${selected.size} items`}?</div>
              <p style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 4 }}>This will permanently delete the item(s). This cannot be undone.</p>
              <div className="modal-actions">
                <button className="btn" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn danger" onClick={() => handleDelete(modal.entry)}>Delete</button>
              </div>
            </>}
          </div>
        </div>
      )}

      {/* ── Toast Popup Banner ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === "error" ? "rgba(30, 15, 20, 0.95)" : toast.type === "success" ? "rgba(15, 30, 20, 0.95)" : "rgba(15, 25, 35, 0.95)",
          border: `1px solid ${toast.type === "error" ? "rgba(248,81,73,0.5)" : toast.type === "success" ? "rgba(63,185,80,0.5)" : "rgba(56,189,248,0.5)"}`,
          color: "var(--text-primary)",
          padding: "10px 16px",
          borderRadius: "var(--radius-md)",
          fontSize: 12,
          fontWeight: 500,
          boxShadow: "0 12px 36px rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          backdropFilter: "blur(12px)",
          maxWidth: 560,
          maxHeight: 200,
          overflowY: "auto",
        }}>
          {toast.type === "error" ? <AlertCircle size={16} color="var(--red)" style={{ flexShrink: 0 }} /> : toast.type === "success" ? <CheckCircle2 size={16} color="var(--green)" style={{ flexShrink: 0 }} /> : <Info size={16} color="var(--accent)" style={{ flexShrink: 0 }} />}
          <span style={{ flex: 1, wordBreak: "break-word", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{toast.message}</span>
          <button onClick={() => setToast(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 2, flexShrink: 0 }}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Command Palette ── */}
      {showPalette && (
        <CommandPalette
          onClose={() => setShowPalette(false)}
          onNavigate={navigate}
          onAction={action => {
            if (action === "newdir") { setModalInput(""); setModal({ type: "newdir" }); }
            if (action === "newfile") { setModalInput(""); setModal({ type: "newfile" }); }
            if (action === "terminal") handleOpenTerminal(currentPath);
            if (action === "vscode") handleOpenVscode(currentPath);
            if (action === "theme") setTheme(t => t === "dark" ? "light" : "dark");
          }}
          homeDir={homeDir}
          drives={drives}
        />
      )}

      {/* ── Disk Analyzer ── */}
      {showDiskAnalyzer && (
        <DiskAnalyzerModal
          currentPath={currentPath}
          onClose={() => setShowDiskAnalyzer(false)}
          onNavigate={navigate}
        />
      )}

      {/* ── Stash Tray (Bottom Shelf) ── */}
      {stash.length > 0 && (
        <div style={{
          position: "fixed", bottom: 12, left: "50%", transform: "translateX(-50%)",
          background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
          padding: "10px 16px", boxShadow: "0 12px 36px rgba(0,0,0,0.5)", zIndex: 9000,
          display: "flex", alignItems: "center", gap: 14
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
            <Layers size={15} color="var(--accent)" />
            <span>Stash Tray ({stash.length} items)</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={async () => {
                for (const item of stash) {
                  const name = item.name;
                  const dst = joinPath(currentPath, name);
                  try { await copyFile(item.path, dst); } catch {}
                }
                refresh();
                setStash([]);
                showToast("Copied stash items here", "success");
              }}
              style={{ background: "var(--accent)", color: "white", border: "none", padding: "4px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight: 500 }}
            >
              Copy Here
            </button>
            <button
              onClick={() => setStash([])}
              style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", padding: "4px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer" }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── File Diff Modal ── */}
      {diffFiles && (
        <FileDiffModal
          pathA={diffFiles[0]}
          pathB={diffFiles[1]}
          onClose={() => setDiffFiles(null)}
        />
      )}

      {/* ── Encrypt Modal ── */}
      {encryptPath && (
        <EncryptModal
          filePath={encryptPath}
          onClose={() => setEncryptPath(null)}
          onRefresh={refresh}
        />
      )}

      {/* ── Grep Content Search Modal ── */}
      {showGrep && (
        <GrepSearchModal
          currentPath={currentPath}
          onClose={() => setShowGrep(false)}
          onSelectFile={p => { setShowPropertiesPath(p); }}
        />
      )}

      {/* ── Batch Rename Modal ── */}
      {showBatchRename && (
        <BatchRenameModal
          entries={ctxMenu?.entry ? [ctxMenu.entry] : Array.from(selected).map(p => displayEntries.find((e: FileEntry) => e.path === p)!).filter(Boolean)}
          onClose={() => setShowBatchRename(false)}
          onRefresh={refresh}
        />
      )}

      {/* ── Duplicate Finder ── */}
      {showDuplicates && (
        <DuplicatesModal
          currentPath={currentPath}
          onClose={() => setShowDuplicates(false)}
          onRefresh={refresh}
        />
      )}

      {/* ── Checksum Verifier ── */}
      {checksumPath && (
        <ChecksumModal
          filePath={checksumPath}
          onClose={() => setChecksumPath(null)}
        />
      )}

      {/* ── Operation Progress Modal ── */}
      {operationState && (
        <OperationProgressModal
          operation={operationState}
          onCancel={() => { cancelOpRef.current = true; }}
        />
      )}

      {/* ── Properties Dialog ── */}
      {showPropertiesPath && (
        <PropertiesModal path={showPropertiesPath} onClose={() => setShowPropertiesPath(null)} />
      )}
    </div>
  );
}
