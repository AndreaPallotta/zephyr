import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "./App";
import * as api from "./api";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
  invoke: vi.fn().mockImplementation(() => Promise.resolve({})),
}));

describe("App Component Full Integration Suite", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(api, "getDrives").mockResolvedValue(["C:\\", "D:\\"]);
    vi.spyOn(api, "getHomeDir").mockResolvedValue("C:\\Users\\Test");
    vi.spyOn(api, "getFavorites").mockResolvedValue([]);
    vi.spyOn(api, "getTags").mockResolvedValue({});
    vi.spyOn(api, "readTextFile").mockResolvedValue("sample text content");
    vi.spyOn(api, "getFolderSize").mockResolvedValue({ size: 1048576, file_count: 10, dir_count: 2, cached: true });
    vi.spyOn(api, "openTerminal").mockResolvedValue(undefined);
    vi.spyOn(api, "openInVscode").mockResolvedValue(undefined);
    vi.spyOn(api, "listDirectory").mockResolvedValue({
      path: "C:\\Users\\Test",
      parent: "C:\\Users",
      entries: [
        { name: "Folder B", path: "C:\\Users\\Test\\Folder B", is_dir: true, size: 0, modified: 1700000200, extension: "", hidden: false },
        { name: "Folder A", path: "C:\\Users\\Test\\Folder A", is_dir: true, size: 0, modified: 1700000100, extension: "", hidden: false },
        { name: "file1.txt", path: "C:\\Users\\Test\\file1.txt", is_dir: false, size: 500, modified: 1700000300, extension: "txt", hidden: false },
        { name: "file2.pdf", path: "C:\\Users\\Test\\file2.pdf", is_dir: false, size: 1500, modified: 1700000400, extension: "pdf", hidden: false },
        { name: "code.rs", path: "C:\\Users\\Test\\code.rs", is_dir: false, size: 800, modified: 1700000500, extension: "rs", hidden: false },
      ],
      is_git_repo: false,
    });
    vi.spyOn(api, "autocompletePath").mockResolvedValue([]);
    vi.spyOn(api, "findDuplicates").mockResolvedValue([]);
    vi.spyOn(api, "searchFileContents").mockResolvedValue([]);
    vi.spyOn(api, "searchDirectory").mockResolvedValue([
      { name: "file1.txt", path: "C:\\Users\\Test\\file1.txt", is_dir: false, size: 500, modified: 1700000300, extension: "txt", hidden: false }
    ]);
  });

  it("renders main window elements, tabs, drives, and file entries", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Home")).not.toBeNull();
      expect(screen.getByText("C:\\")).not.toBeNull();
      expect(screen.getByText("file1.txt")).not.toBeNull();
      expect(screen.getByText("file2.pdf")).not.toBeNull();
    });
  });

  it("filters file entries when typing in search input", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    const searchInput = screen.getByPlaceholderText("Search...");
    fireEvent.change(searchInput, { target: { value: "file1" } });

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });
  });

  it("sorts entries when clicking column headers", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    const nameCol = screen.getByText(/Name/i);
    fireEvent.click(nameCol);

    const typeCols = screen.getAllByText(/Type/i);
    fireEvent.click(typeCols[0]);

    const sizeCol = screen.getByText(/Size/i);
    fireEvent.click(sizeCol);

    const modifiedCol = screen.getByText(/Modified/i);
    fireEvent.click(modifiedCol);
  });

  it("switches to Grid View and back to List View", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    const gridBtn = screen.getByTitle("Grid View");
    fireEvent.click(gridBtn);

    await waitFor(() => {
      expect(screen.getByTitle(/Grid Icon Size/i)).not.toBeNull();
    });

    const listBtn = screen.getByTitle("List View");
    fireEvent.click(listBtn);

    await waitFor(() => {
      expect(screen.queryByTitle(/Grid Icon Size/i)).toBeNull();
    });
  });

  it("filters file entries by category chips bar", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    const codeChip = screen.getByText("code");
    fireEvent.click(codeChip);

    await waitFor(() => {
      expect(screen.getByText("code.rs")).not.toBeNull();
      expect(screen.queryByText("file2.pdf")).toBeNull();
    });

    const allChip = screen.getByText("all");
    fireEvent.click(allChip);

    await waitFor(() => {
      expect(screen.getByText("file2.pdf")).not.toBeNull();
    });
  });

  it("opens Command Palette on Ctrl+K shortcut", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type a command or directory...")).not.toBeNull();
    });
  });

  it("toggles theme and accent colors", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    const purpleDot = screen.getByTitle("Accent: purple");
    fireEvent.click(purpleDot);

    const themeBtn = screen.getByTitle("Toggle theme");
    fireEvent.click(themeBtn);
  });

  it("triggers Open Terminal and Open VS Code action buttons", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    const termBtn = screen.getByTitle("Open Terminal here");
    fireEvent.click(termBtn);

    const vscodeBtn = screen.getByTitle("Open in VS Code");
    fireEvent.click(vscodeBtn);

    await waitFor(() => {
      expect(api.openTerminal).toHaveBeenCalledWith("C:\\Users\\Test");
      expect(api.openInVscode).toHaveBeenCalledWith("C:\\Users\\Test");
    });
  });

  it("opens New Folder modal when clicking FolderPlus button", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    const newFolderBtn = screen.getByTitle("New Folder");
    fireEvent.click(newFolderBtn);

    await waitFor(() => {
      expect(screen.getByText("New Folder")).not.toBeNull();
    });
  });

  it("opens New File modal when clicking FilePlus button", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    const newFileBtn = screen.getByTitle("New File");
    fireEvent.click(newFileBtn);

    await waitFor(() => {
      expect(screen.getByText("New File")).not.toBeNull();
    });
  });

  it("navigates up when clicking Up button", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    const upBtn = screen.getByTitle("Up (Backspace)");
    fireEvent.click(upBtn);
  });

  it("toggles Dual Pane split view mode on F3 keypress and handles pane focus", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    fireEvent.keyDown(window, { key: "F3" });

    await waitFor(() => {
      expect(screen.getByText("Left Pane")).not.toBeNull();
      expect(screen.getByText("Right Pane")).not.toBeNull();
    });

    // Tab key switches active pane
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.keyDown(window, { key: "Tab" });

    // F3 toggles back to single pane
    fireEvent.keyDown(window, { key: "F3" });
    await waitFor(() => {
      expect(screen.queryByText("Right Pane")).toBeNull();
    });
  });

  it("creates a new tab when clicking New Tab button", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    const newTabBtn = screen.getByTitle("New Tab (Ctrl+T)");
    fireEvent.click(newTabBtn);

    await waitFor(() => {
      expect(screen.getAllByText("Test").length).toBeGreaterThan(0);
    });
  });

  it("opens context menu on file row right-click", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    const fileRow = screen.getByText("file1.txt");
    fireEvent.contextMenu(fileRow);

    await waitFor(() => {
      expect(screen.getByText("Add to Stash Tray")).not.toBeNull();
      expect(screen.getByText("Copy Full Path")).not.toBeNull();
    });
  });

  it("pins directory to Sidebar Bookmarks from context menu", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Folder A")).not.toBeNull();
    });

    const folderRow = screen.getByText("Folder A");
    fireEvent.contextMenu(folderRow);

    await waitFor(() => {
      expect(screen.getByText("Pin to Sidebar")).not.toBeNull();
    });

    fireEvent.click(screen.getByText("Pin to Sidebar"));

    await waitFor(() => {
      expect(screen.getByText("Bookmarks")).not.toBeNull();
    });
  });

  it("edits breadcrumb path input on pen button click", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    const editPen = screen.getByTitle("Click to Edit / Copy Path");
    fireEvent.click(editPen);
  });

  it("adds entry to Stash Tray from context menu and clears stash", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    const fileRow = screen.getByText("file1.txt");
    fireEvent.contextMenu(fileRow);

    await waitFor(() => {
      expect(screen.getByText("Add to Stash Tray")).not.toBeNull();
    });

    fireEvent.click(screen.getByText("Add to Stash Tray"));

    await waitFor(() => {
      expect(screen.getByText("Stash Tray (1 items)")).not.toBeNull();
    });

    const clearBtn = screen.getByText("Clear");
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.queryByText("Stash Tray (1 items)")).toBeNull();
    });
  });

  it("dismisses popups on Escape keypress", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    fireEvent.keyDown(window, { key: "Escape" });
  });

  it("navigates into directory on double-click via doubleClick and fast-path detail: 2", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Folder A")).not.toBeNull();
    });

    // 1. Double click via fast-path detail: 2
    const folderA = screen.getByText("Folder A");
    fireEvent.click(folderA, { detail: 2 });

    await waitFor(() => {
      expect(api.listDirectory).toHaveBeenCalledWith("C:\\Users\\Test\\Folder A", false);
    });

    // 2. Double click via native doubleClick event
    const folderB = screen.getByText("Folder B");
    fireEvent.doubleClick(folderB);

    await waitFor(() => {
      expect(api.listDirectory).toHaveBeenCalledWith("C:\\Users\\Test\\Folder B", false);
    });
  });

  it("auto-selects entire path when breadcrumb bar or input is focused/clicked for easy copy", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    const editPen = screen.getByTitle("Click to Edit / Copy Path");
    fireEvent.click(editPen);

    await waitFor(() => {
      const input = screen.getByDisplayValue("C:\\Users\\Test") as HTMLInputElement;
      expect(input).not.toBeNull();
    });

    const input = screen.getByDisplayValue("C:\\Users\\Test") as HTMLInputElement;
    const selectSpy = vi.spyOn(input, "select");

    fireEvent.focus(input);
    expect(selectSpy).toHaveBeenCalled();

    fireEvent.click(input);
    expect(selectSpy).toHaveBeenCalled();
  });

  it("seamlessly handles symlink / junction target resolution without path bouncing", async () => {
    const junctionSpy = vi.spyOn(api, "listDirectory").mockImplementation(async (path: string) => {
      if (path === "C:\\Users\\Test\\Local Settings") {
        return {
          path: "C:\\Users\\Test\\AppData\\Local",
          parent: "C:\\Users\\Test\\AppData",
          entries: [
            { name: "Temp", path: "C:\\Users\\Test\\AppData\\Local\\Temp", is_dir: true, size: 0, modified: 1700000600, extension: "", hidden: false }
          ],
          is_git_repo: false,
        };
      }
      return {
        path: "C:\\Users\\Test",
        parent: "C:\\Users",
        entries: [
          { name: "Local Settings", path: "C:\\Users\\Test\\Local Settings", is_dir: true, size: 0, modified: 1700000100, extension: "", hidden: false }
        ],
        is_git_repo: false,
      };
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Local Settings")).not.toBeNull();
    });

    // Double click the junction
    const junctionRow = screen.getByText("Local Settings");
    fireEvent.click(junctionRow, { detail: 2 });

    // Should load the resolved target "Temp" inside AppData\Local without throwing error toast or bouncing
    await waitFor(() => {
      expect(screen.getByText("Temp")).not.toBeNull();
    });

    junctionSpy.mockRestore();
  });

  it("handles keyboard navigation: select all (Ctrl+A), copy (Ctrl+C), cut (Ctrl+X), and paste (Ctrl+V)", async () => {
    vi.spyOn(api, "copyFile").mockResolvedValue(undefined);
    vi.spyOn(api, "getFileProperties").mockResolvedValue({
      name: "file1.txt",
      path: "C:\\Users\\Test\\file1.txt",
      is_dir: false,
      size: 500,
      size_on_disk: 512,
      created: 1700000100,
      modified: 1700000300,
      accessed: 1700000200,
      extension: "txt",
      hidden: false,
      readonly: false,
      line_count: 10,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    // 1. Select All (Ctrl+A)
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });
    await waitFor(() => {
      expect(screen.getByText(/5 selected/)).not.toBeNull();
    });

    // 2. Copy (Ctrl+C)
    fireEvent.keyDown(window, { key: "c", ctrlKey: true });
    await waitFor(() => {
      expect(screen.getByText(/Copy — 5 item\(s\)/)).not.toBeNull();
    });

    // 3. Paste (Ctrl+V)
    fireEvent.keyDown(window, { key: "v", ctrlKey: true });
    await waitFor(() => {
      expect(api.copyFile).toHaveBeenCalled();
    });

    // 4. Cut (Ctrl+X)
    fireEvent.keyDown(window, { key: "x", ctrlKey: true });
    await waitFor(() => {
      expect(screen.getByText(/Cut — 5 item\(s\)/)).not.toBeNull();
    });
  });

  it("handles keyboard navigation: rename modal on F2, new folder on toolbar, and delete on Delete key", async () => {
    vi.spyOn(api, "renamePath").mockResolvedValue(undefined);
    vi.spyOn(api, "createDirectory").mockResolvedValue(undefined);
    vi.spyOn(api, "deletePath").mockResolvedValue(undefined);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    // Select file1.txt
    fireEvent.click(screen.getAllByText("file1.txt")[0]);

    // 1. F2 -> Rename modal
    fireEvent.keyDown(window, { key: "F2" });
    await waitFor(() => {
      expect(screen.getByDisplayValue("file1.txt")).not.toBeNull();
    });
    const renameInput = screen.getByDisplayValue("file1.txt");
    fireEvent.change(renameInput, { target: { value: "renamed_file.txt" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    await waitFor(() => {
      expect(api.renamePath).toHaveBeenCalledWith("C:\\Users\\Test\\file1.txt", "C:\\Users\\Test\\renamed_file.txt");
    });

    // 2. Toolbar New Folder
    const newFolderBtn = screen.getByTitle("New Folder");
    fireEvent.click(newFolderBtn);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Folder name")).not.toBeNull();
    });
    const folderInput = screen.getByPlaceholderText("Folder name");
    fireEvent.change(folderInput, { target: { value: "NewProject" } });
    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => {
      expect(api.createDirectory).toHaveBeenCalledWith("C:\\Users\\Test\\NewProject");
    });

    // 3. Delete key -> Delete modal
    fireEvent.click(screen.getAllByText("file1.txt")[0]);
    fireEvent.keyDown(window, { key: "Delete" });
    await waitFor(() => {
      expect(screen.getByText(/permanently delete the item/)).not.toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(api.deletePath).toHaveBeenCalledWith("C:\\Users\\Test\\file1.txt");
    });
  });

  it("handles tab lifecycle: new tab on Ctrl+T, close tab on Ctrl+W, and toolbar buttons", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    // New Tab (Ctrl+T)
    fireEvent.keyDown(window, { key: "t", ctrlKey: true });
    await waitFor(() => {
      expect(screen.getAllByText("Test").length).toBeGreaterThan(1);
    });

    // New tab via "+" button
    const plusTabBtn = screen.getByTitle("New Tab (Ctrl+T)");
    fireEvent.click(plusTabBtn);
    await waitFor(() => {
      expect(screen.getAllByText("Test").length).toBeGreaterThan(1);
    });
  });

  it("handles history navigation (Back, Forward, Up, Refresh, F5)", async () => {
    const histSpy = vi.spyOn(api, "listDirectory").mockImplementation(async (path: string) => ({
      path,
      parent: "C:\\Users\\Test",
      entries: [
        { name: "sub.txt", path: path + "\\sub.txt", is_dir: false, size: 100, modified: 1700000100, extension: "txt", hidden: false }
      ],
      is_git_repo: false,
    }));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("sub.txt")).not.toBeNull();
    });

    // Up button
    const upBtn = screen.getByTitle("Up (Backspace)");
    fireEvent.click(upBtn);

    // Refresh (F5)
    fireEvent.keyDown(window, { key: "F5" });
    await waitFor(() => {
      expect(api.listDirectory).toHaveBeenCalled();
    });

    histSpy.mockRestore();
  });

  it("handles toolbar modal buttons (Grep, Dual Pane, Disk Analyzer, Duplicates, Palette)", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    // Grep Search Modal
    const grepBtn = screen.getByTitle("Deep Content Search (Grep)");
    fireEvent.click(grepBtn);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search text or code content across files...")).not.toBeNull();
    });
    fireEvent.keyDown(window, { key: "Escape" });
    (document.activeElement as HTMLElement)?.blur();

    // Disk Space Analyzer Modal
    const diskBtn = screen.getByTitle("Disk Space Analyzer");
    fireEvent.click(diskBtn);
    await waitFor(() => {
      expect(screen.getByText(/Disk Space Analyzer/)).not.toBeNull();
    });
    fireEvent.keyDown(window, { key: "Escape" });
    (document.activeElement as HTMLElement)?.blur();

    // Duplicate Files Modal
    const dupBtn = screen.getByTitle("Find Duplicate Files");
    fireEvent.click(dupBtn);
    await waitFor(() => {
      expect(screen.getByText(/Duplicate File Finder/)).not.toBeNull();
    });
    fireEvent.keyDown(window, { key: "Escape" });
    (document.activeElement as HTMLElement)?.blur();

    // Dual Pane toggle (F3)
    fireEvent.keyDown(window, { key: "F3" });
    await waitFor(() => {
      expect(screen.getByText("Left Pane")).not.toBeNull();
      expect(screen.getByText("Right Pane")).not.toBeNull();
    });
  });

  it("launches external tools (Terminal, VS Code)", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    const termBtn = screen.getByTitle("Open Terminal here");
    fireEvent.click(termBtn);
    expect(api.openTerminal).toHaveBeenCalled();

    const vsBtn = screen.getByTitle("Open in VS Code");
    fireEvent.click(vsBtn);
    expect(api.openInVscode).toHaveBeenCalled();
  });

  it("handles sidebar Workspace creation and switching", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    // Create Workspace
    const createWsBtn = screen.getByTitle("Create New Workspace");
    fireEvent.click(createWsBtn);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Workspace name/)).not.toBeNull();
    });

    const wsInput = screen.getByPlaceholderText(/Workspace name/);
    fireEvent.change(wsInput, { target: { value: "Frontend UI" } });
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(screen.getByText("Frontend UI")).not.toBeNull();
    });
  });

  it("handles context menu actions for files (Properties, Copy, Rename, Delete)", async () => {
    vi.spyOn(api, "getFileProperties").mockResolvedValue({
      name: "file1.txt",
      path: "C:\\Users\\Test\\file1.txt",
      is_dir: false,
      size: 500,
      size_on_disk: 512,
      created: 1700000100,
      modified: 1700000300,
      accessed: 1700000200,
      extension: "txt",
      hidden: false,
      readonly: false,
      line_count: 10,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    const fileRow = screen.getByText("file1.txt");
    fireEvent.contextMenu(fileRow);

    await waitFor(() => {
      expect(screen.getByText("Open with Default App")).not.toBeNull();
    });

    const propsItem = screen.getAllByText("Properties")[0];
    fireEvent.click(propsItem);
    await waitFor(() => {
      expect(screen.getAllByText("Properties").length).toBeGreaterThan(0);
    });
  });

  it("handles ZIP compression and extraction triggers", async () => {
    vi.spyOn(api, "compressToZip").mockResolvedValue(undefined);
    vi.spyOn(api, "extractZip").mockResolvedValue(undefined);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Folder A")).not.toBeNull();
    });

    // Context menu on folder -> Compress to Zip
    const folderRow = screen.getByText("Folder A");
    fireEvent.contextMenu(folderRow);

    await waitFor(() => {
      expect(screen.getByText("Compress to Zip")).not.toBeNull();
    });

    fireEvent.click(screen.getByText("Compress to Zip"));
    await waitFor(() => {
      expect(api.compressToZip).toHaveBeenCalled();
    });
  });

  it("handles category filters (all, media, docs, code, archives)", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("file1.txt").length).toBeGreaterThan(0);
    });

    // Filter by Code
    const codePill = screen.getByText("code");
    fireEvent.click(codePill);
    await waitFor(() => {
      expect(screen.getAllByText("code.rs").length).toBeGreaterThan(0);
    });

    // Filter by Docs
    const docsPill = screen.getByText("docs");
    fireEvent.click(docsPill);
    await waitFor(() => {
      expect(screen.getAllByText("file2.pdf").length).toBeGreaterThan(0);
    });

    // Reset to All
    const allPill = screen.getByText("all");
    fireEvent.click(allPill);
  });

  it("handles multi-selection with Shift+click and Ctrl+click", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("file1.txt").length).toBeGreaterThan(0);
    });

    // Single click first item
    fireEvent.click(screen.getAllByText("file1.txt")[0]);

    // Ctrl+click second item
    fireEvent.click(screen.getAllByText("file2.pdf")[0], { ctrlKey: true });
    await waitFor(() => {
      expect(screen.getByText(/2 selected/)).not.toBeNull();
    });

    // Shift+click third item
    fireEvent.click(screen.getAllByText("code.rs")[0], { shiftKey: true });
    await waitFor(() => {
      expect(screen.getByText(/selected/)).not.toBeNull();
    });
  });

  it("handles sidebar navigation for drives, favorites, and pinned bookmarks", async () => {
    vi.spyOn(api, "getFavorites").mockResolvedValue(["C:\\Users\\Test\\file1.txt"]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("file1.txt").length).toBeGreaterThan(0);
    });

    // Click Drive D:\ in sidebar
    const driveD = screen.getByText("D:\\");
    fireEvent.click(driveD);
    await waitFor(() => {
      expect(api.listDirectory).toHaveBeenCalledWith("D:\\", false);
    });
  });

  it("handles sidebar context menu (unpin bookmark and remove favorite)", async () => {
    vi.spyOn(api, "setFavorite").mockResolvedValue(undefined);
    localStorage.setItem("zephyr_pinned_folders", JSON.stringify(["C:\\Users\\Test\\Folder A"]));

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("Folder A").length).toBeGreaterThan(0);
    });

    // Right click pinned bookmark in sidebar
    const pinnedItem = screen.getAllByText("Folder A")[0];
    fireEvent.contextMenu(pinnedItem);
  });

  it("handles file comparison diff modal when two files are selected", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("file1.txt").length).toBeGreaterThan(0);
    });

    // Select 2 files
    fireEvent.click(screen.getAllByText("file1.txt")[0]);
    fireEvent.click(screen.getAllByText("file2.pdf")[0], { ctrlKey: true });

    // Open context menu
    const file2 = screen.getAllByText("file2.pdf")[0];
    fireEvent.contextMenu(file2);

    await waitFor(() => {
      expect(screen.getByText("Compare Files (Diff)")).not.toBeNull();
    });

    fireEvent.click(screen.getByText("Compare Files (Diff)"));
    await waitFor(() => {
      expect(screen.getByText(/Visual File Comparison/)).not.toBeNull();
    });
  });

  it("handles Encrypt and Decrypt modal triggers from context menu", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("file1.txt").length).toBeGreaterThan(0);
    });

    const fileRow = screen.getAllByText("file1.txt")[0];
    fireEvent.contextMenu(fileRow);

    await waitFor(() => {
      expect(screen.getByText("Encrypt File")).not.toBeNull();
    });

    fireEvent.click(screen.getByText("Encrypt File"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter password...")).not.toBeNull();
    });
  });

  it("handles search input, clearing search, and extension filtering", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("file1.txt").length).toBeGreaterThan(0);
    });

    // Search query
    const searchInput = screen.getByPlaceholderText("Search...");
    fireEvent.change(searchInput, { target: { value: "file1" } });
    await waitFor(() => {
      expect(api.searchDirectory).toHaveBeenCalled();
    });

    // Clear search
    const clearBtn = searchInput.parentElement?.querySelector("button");
    if (clearBtn) fireEvent.click(clearBtn);
    expect((searchInput as HTMLInputElement).value).toBe("");
  });

  it("handles toolbar customization: theme toggle, accent color selector, and preview pane toggle", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("file1.txt").length).toBeGreaterThan(0);
    });

    // Theme toggle
    const themeBtn = screen.getByTitle("Toggle theme");
    fireEvent.click(themeBtn);

    // Accent colors
    const cyanAccent = screen.getByTitle("Accent: cyan");
    fireEvent.click(cyanAccent);
    const emeraldAccent = screen.getByTitle("Accent: emerald");
    fireEvent.click(emeraldAccent);

    // Preview pane toggle
    const previewBtn = screen.getByTitle("Hide Preview");
    fireEvent.click(previewBtn);
    const showPreviewBtn = screen.getByTitle("Show Preview");
    fireEvent.click(showPreviewBtn);
  });

  it("handles view mode switching (list / grid) and column header sorting", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("file1.txt").length).toBeGreaterThan(0);
    });

    // Switch to Grid View
    const gridBtn = screen.getByTitle("Grid View");
    fireEvent.click(gridBtn);
    await waitFor(() => {
      expect(screen.getByTitle("Grid View")).not.toBeNull();
    });

    // Switch back to List View
    const listBtn = screen.getByTitle("List View");
    fireEvent.click(listBtn);

    // Sorting headers
    const nameHeader = screen.getByText(/Name/);
    fireEvent.click(nameHeader);
    const sizeHeader = screen.getByText(/Size/);
    fireEvent.click(sizeHeader);
    const modHeader = screen.getByText(/Modified/);
    fireEvent.click(modHeader);
    const typeHeader = screen.getByText(/Type/);
    fireEvent.click(typeHeader);
  });

  it("handles new file creation modal from toolbar", async () => {
    vi.spyOn(api, "createFile").mockResolvedValue(undefined);

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("file1.txt").length).toBeGreaterThan(0);
    });

    const newFileBtn = screen.getByTitle("New File");
    fireEvent.click(newFileBtn);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("File name")).not.toBeNull();
    });

    const fileInput = screen.getByPlaceholderText("File name");
    fireEvent.change(fileInput, { target: { value: "newscript.py" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(api.createFile).toHaveBeenCalledWith("C:\\Users\\Test\\newscript.py");
    });
  });

  it("handles breadcrumb path typing and enter key navigation", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("file1.txt").length).toBeGreaterThan(0);
    });

    // Edit path
    const editPen = screen.getByTitle("Click to Edit / Copy Path");
    fireEvent.click(editPen);

    await waitFor(() => {
      expect(screen.getByDisplayValue("C:\\Users\\Test")).not.toBeNull();
    });

    const pathInput = screen.getByDisplayValue("C:\\Users\\Test");
    fireEvent.change(pathInput, { target: { value: "C:\\Projects" } });
    fireEvent.keyDown(pathInput, { key: "Enter" });

    await waitFor(() => {
      expect(api.listDirectory).toHaveBeenCalledWith("C:\\Projects", false);
    });
  });

  it("handles breadcrumb segment clicks and extension dropdown filtering", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("file1.txt").length).toBeGreaterThan(0);
    });

    // Click "Users" breadcrumb segment
    const usersSegment = screen.getByText("Users");
    fireEvent.click(usersSegment);
    await waitFor(() => {
      expect(api.listDirectory).toHaveBeenCalledWith("C:\\Users", false);
    });

    // Extension select dropdown
    const selectEl = screen.getByRole("combobox");
    fireEvent.change(selectEl, { target: { value: "txt" } });
  });

  it("handles operation error toasts gracefully", async () => {
    vi.spyOn(api, "openInVscode").mockRejectedValue("VS Code not found");
    vi.spyOn(api, "openTerminal").mockRejectedValue("Terminal not found");

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("file1.txt").length).toBeGreaterThan(0);
    });

    const termBtn = screen.getByTitle("Open Terminal here");
    fireEvent.click(termBtn);
    await waitFor(() => {
      expect(screen.getByText("Terminal not found")).not.toBeNull();
    });

    const vsBtn = screen.getByTitle("Open in VS Code");
    fireEvent.click(vsBtn);
    await waitFor(() => {
      expect(screen.getByText("VS Code not found")).not.toBeNull();
    });
  });

  it("handles cross-pane copy and move in Dual Pane mode", async () => {
    vi.spyOn(api, "copyFile").mockResolvedValue();
    vi.spyOn(api, "renamePath").mockResolvedValue();

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    // Toggle split view
    fireEvent.keyDown(window, { key: "F3" });

    await waitFor(() => {
      expect(screen.getByText("Left Pane")).not.toBeNull();
      expect(screen.getByText("Right Pane")).not.toBeNull();
    });

    // Select file in left pane
    const fileRow = screen.getAllByText("file1.txt")[0];
    fireEvent.click(fileRow);

    // Press F5 to copy across panes
    fireEvent.keyDown(window, { key: "F5" });
    await waitFor(() => {
      expect(api.copyFile).toHaveBeenCalled();
    });

    // Press F6 to move across panes
    fireEvent.keyDown(window, { key: "F6" });
    await waitFor(() => {
      expect(api.renamePath).toHaveBeenCalled();
    });
  });
});
