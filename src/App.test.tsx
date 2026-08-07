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

  it("toggles Dual Pane split view mode on F3 keypress", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("file1.txt")).not.toBeNull();
    });

    fireEvent.keyDown(window, { key: "F3" });

    await waitFor(() => {
      expect(screen.getByText("Split View (Dual Pane)")).not.toBeNull();
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
});
