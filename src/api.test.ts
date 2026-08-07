import { describe, it, expect, vi } from "vitest";
import * as api from "./api";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockImplementation((cmd: string) => {
    if (cmd === "list_directory") return Promise.resolve({ path: "C:\\", entries: [] });
    if (cmd === "autocomplete_path") return Promise.resolve([]);
    if (cmd === "search_directory") return Promise.resolve([]);
    if (cmd === "get_drives") return Promise.resolve(["C:\\"]);
    if (cmd === "get_home_dir") return Promise.resolve("C:\\Users\\Test");
    if (cmd === "get_favorites") return Promise.resolve([]);
    if (cmd === "get_tags") return Promise.resolve({});
    if (cmd === "read_text_file") return Promise.resolve("content");
    if (cmd === "get_folder_size") return Promise.resolve({ size: 1024 });
    if (cmd === "get_file_properties") return Promise.resolve({ name: "file.txt" });
    if (cmd === "compute_checksum") return Promise.resolve({ sha256: "abc", md5: "xyz" });
    if (cmd === "search_file_contents") return Promise.resolve([]);
    if (cmd === "find_duplicates") return Promise.resolve([]);
    return Promise.resolve(undefined);
  }),
}));

describe("Zephyr API Helpers Unit Tests", () => {
  it("formats file sizes accurately", () => {
    expect(api.formatSize(0)).toBe("");
    expect(api.formatSize(512)).toBe("512 B");
    expect(api.formatSize(1024)).toBe("1.0 KB");
    expect(api.formatSize(1048576)).toBe("1.0 MB");
    expect(api.formatSize(1073741824)).toBe("1.00 GB");
  });

  it("formats date timestamps into human readable strings", () => {
    const formatted = api.formatDate(1700000000);
    expect(typeof formatted).toBe("string");
    expect(formatted.length).toBeGreaterThan(0);
  });

  it("splits Windows and POSIX paths into breadcrumb segments", () => {
    const windowsSegments = api.getPathSegments("C:\\Users\\test\\Desktop");
    expect(windowsSegments).toEqual([
      { label: "C:", path: "C:\\" },
      { label: "Users", path: "C:\\Users" },
      { label: "test", path: "C:\\Users\\test" },
      { label: "Desktop", path: "C:\\Users\\test\\Desktop" },
    ]);

    const posixSegments = api.getPathSegments("/home/user/projects");
    expect(posixSegments.length).toBe(3);
    expect(posixSegments[0].label).toBe("home");
  });

  it("joins paths cleanly handling path separators", () => {
    expect(api.joinPath("C:\\Users", "test")).toBe("C:\\Users\\test");
    expect(api.joinPath("/home/user", "file.txt")).toBe("/home/user/file.txt");
  });

  it("invokes Tauri IPC functions", async () => {
    await expect(api.listDirectory("C:\\", false)).resolves.toBeDefined();
    await expect(api.autocompletePath("C:\\")).resolves.toBeDefined();
    await expect(api.getDrives()).resolves.toBeDefined();
    await expect(api.getHomeDir()).resolves.toBeDefined();
    await expect(api.createDirectory("C:\\new")).resolves.toBeUndefined();
    await expect(api.createFile("C:\\new.txt")).resolves.toBeUndefined();
    await expect(api.deletePath("C:\\del.txt")).resolves.toBeUndefined();
    await expect(api.renamePath("C:\\a", "C:\\b")).resolves.toBeUndefined();
    await expect(api.copyFile("C:\\a", "C:\\b")).resolves.toBeUndefined();
    await expect(api.readTextFile("C:\\a.txt")).resolves.toBe("content");
    await expect(api.searchDirectory("C:\\", "query", false)).resolves.toBeDefined();
    await expect(api.computeChecksum("C:\\a.txt")).resolves.toBeDefined();
    await expect(api.openTerminal("C:\\")).resolves.toBeUndefined();
    await expect(api.openInVscode("C:\\")).resolves.toBeUndefined();
    await expect(api.openFileDefault("C:\\a.txt")).resolves.toBeUndefined();
    await expect(api.compressToZip("C:\\a", "C:\\a.zip")).resolves.toBeUndefined();
    await expect(api.extractZip("C:\\a.zip", "C:\\a")).resolves.toBeUndefined();
    await expect(api.searchFileContents("C:\\", "q", false)).resolves.toBeDefined();
    await expect(api.findDuplicates("C:\\")).resolves.toBeDefined();
    await expect(api.getFavorites()).resolves.toBeDefined();
    await expect(api.setFavorite("C:\\a", true)).resolves.toBeUndefined();
    await expect(api.getTags()).resolves.toBeDefined();
    await expect(api.setTag("C:\\a", "red")).resolves.toBeUndefined();
    await expect(api.getFolderSize("C:\\a")).resolves.toBeDefined();
    await expect(api.getFileProperties("C:\\a.txt")).resolves.toBeDefined();
  });
});
