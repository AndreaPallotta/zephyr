# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.3] - 2026-08-17

### Added
- **Dual-Pane Split Explorer**: Added side-by-side dual-pane file browser with split toggle (`Ctrl+Shift+D`), independent navigation states, active pane focus indicator, and direct cross-pane file copy/move operations.

### Security & CI
- Hardened GitHub Actions CI and Release pipelines with explicit permissions, pinned action SHAs, cargo caching, and concurrency groups.

---

## [0.2.2] - 2026-08-16 - [`54bdddd`](https://github.com/AndreaPallotta/zephyr/commit/54bdddd)

### Fixed
- **Double-Click Folder Navigation Reliability**: Fixed folder navigation sometimes requiring duplicate double-clicks by adding fast-path `detail === 2` synthetic event handling and instant transition states.
- **Windows Junction & Symlink Navigation**: Resolved canonical targets for junctions like `C:\Users\<user>\Local Settings` (e.g. `AppData\Local`) with `read_link` fallback and exact target tracking, preventing path flickering and loopback oscillations.
- **Breadcrumb Auto-Selection on Click**: Clicking the breadcrumb edit button now automatically highlights and selects the entire path text for immediate one-keystroke `Ctrl+C` copying.
- **Context Menu Positioning Coordinates**: Added coordinate safeguards and fallback defaults in `App.tsx` to prevent `NaN` coordinates when right-clicking synthetic elements.

### Added
- **Comprehensive Integration Test Suite**: Reached 85.0% statement and line coverage with 79 Vitest integration tests covering full lifecycle, shortcuts, multi-selection, category filtering, and modals.
- **Extended Rust Backend Integration Tests**: 20 `cargo test` integration suites testing real filesystem junction resolution, sorting orders, checksumming, grep searches, file properties, duplicate detection, and size caching.
- **Automated CI Test Pipeline**: Added GitHub Actions CI workflow to run both frontend Vitest and Rust `cargo test` suites automatically on pushes to `main`.

---

## [0.2.1] - 2026-08-09 - [`a17fa39`](https://github.com/AndreaPallotta/zephyr/commit/a17fa39)

### Added
- **Native Windows Recycle Bin**: Custom Rust parser for `$Recycle.Bin` `$I` metadata files. View deleted files natively with original names, sizes, and deletion timestamps, and permanently delete `$R`/`$I` pairs directly inside Zephyr.
- **Virtual Workspaces**: Create, view, and manage custom workspaces. Includes `+` workspace creation modal, interactive pill badges, dynamic context menu (`Add to` / `Remove from`), automatic filtering of non-existent files, and right-click management actions (clear items, delete workspace).
- **Advanced Selection Shortcuts**:
  - `Ctrl+A` / `Cmd+A` to select all files in the current folder, workspace, or Recycle Bin.
  - `Ctrl+Click` / `Cmd+Click` to toggle individual items into selection.
  - `Shift+Click` to select contiguous ranges of files.
- **Sidebar Right-Click Context Menus**: Context menus for Workspaces (delete, clear), Favorites (remove), and Pinned Bookmarks (unpin).
- **Dynamic Accent Color Folder Icons**: Folder icons now adapt dynamically to user-selected accent color themes (Cyan, Purple, Emerald, Orange, Pink).
- **Persistent User Preferences**: Auto-save and restore all preferences (`theme`, `accentColor`, `viewMode`, `showHidden`, `gridIconSize`, `sidebarWidth`, `previewWidth`, `panelOpen`, `sortColumn`, `sortAsc`, `workspaces`, `pinnedFolders`) across application restarts via `localStorage`.

### Fixed
- **CSS Grid Layout Placement**: Added `grid-row: 3` to `.resizer-handle` elements to eliminate auto-placement grid conflicts that displaced the preview panel.
- **React Hooks Ordering**: Resolved React Error #310 in `PreviewPane` by ordering all `useState`/`useEffect` hooks before early returns.
- **Batch Deletion Resilience**: Isolated individual file deletions in `try/catch` blocks so batch deletions complete smoothly even if single files fail or are locked.
- **Error Toast UX**: Expanded error toast banners to `560px` with auto-wrapping (`white-space: pre-wrap`) and extended display time to 8 seconds.

---

## [0.1.0] - 2026-08-04

### Added
- Initial release of Zephyr File Explorer.
- Navigation tree, breadcrumbs, dual pane mode, and multi-tab browsing.
- Spotlight-style Command Palette (`Ctrl+K`).
- Full-text Grep Search modal, Duplicate File Finder, and Disk Space Treemap Analyzer.
- Built-in Zip archive compression and extraction.
- Media previewer for images, markdown, audio, and video files.
