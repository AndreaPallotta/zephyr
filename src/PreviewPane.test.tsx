import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PreviewPane from "./PreviewPane";
import * as api from "./api";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
  invoke: vi.fn().mockImplementation(() => Promise.resolve({})),
}));

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    getFolderSize: vi.fn(),
    readTextFile: vi.fn(),
    getTags: vi.fn(),
    getFavorites: vi.fn(),
    setFavorite: vi.fn(),
  };
});

describe("PreviewPane Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getFolderSize as any).mockResolvedValue({
      size: 1048576,
      file_count: 24,
      dir_count: 3,
      cached: true,
    });
    (api.readTextFile as any).mockResolvedValue("console.log('Hello Zephyr');");
    (api.getTags as any).mockResolvedValue({});
    (api.getFavorites as any).mockResolvedValue([]);
    (api.setFavorite as any).mockResolvedValue(undefined);
  });

  it("renders folder summary card with size, file count, and cache indicator", async () => {
    const folderEntry = {
      name: "Documents",
      path: "C:\\Users\\test\\Documents",
      is_dir: true,
      size: 0,
      modified: 1700000000,
      extension: "",
      hidden: false,
    };

    render(
      <PreviewPane
        entry={folderEntry}
        currentDir="C:\\Users\\test"
        onClose={() => {}}
        onNavigate={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText("Documents").length).toBeGreaterThan(0);
    });
  });

  it("renders text file contents for code/text files", async () => {
    const fileEntry = {
      name: "script.js",
      path: "/script.js",
      is_dir: false,
      size: 50,
      modified: 1700000000,
      extension: "js",
      hidden: false,
    };

    render(
      <PreviewPane
        entry={fileEntry}
        currentDir="/"
        onClose={() => {}}
        onNavigate={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("console.log('Hello Zephyr');")).not.toBeNull();
    });
  });

  it("renders formatted Markdown for .md files", async () => {
    (api.readTextFile as any).mockResolvedValue("# Zephyr\n## Feature\n- Item 1");

    const mdEntry = {
      name: "README.md",
      path: "/README.md",
      is_dir: false,
      size: 100,
      modified: 1700000000,
      extension: "md",
      hidden: false,
    };

    render(
      <PreviewPane
        entry={mdEntry}
        currentDir="/"
        onClose={() => {}}
        onNavigate={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Zephyr")).not.toBeNull();
      expect(screen.getByText("Feature")).not.toBeNull();
      expect(screen.getByText("Item 1")).not.toBeNull();
    });
  });

  it("renders HTML5 audio player for audio files", async () => {
    const audioEntry = {
      name: "song.mp3",
      path: "/song.mp3",
      is_dir: false,
      size: 2000000,
      modified: 1700000000,
      extension: "mp3",
      hidden: false,
    };

    render(
      <PreviewPane
        entry={audioEntry}
        currentDir="/"
        onClose={() => {}}
        onNavigate={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText("song.mp3").length).toBeGreaterThan(0);
    });
  });

  it("toggles favorite state on star button click", async () => {
    const fileEntry = {
      name: "script.js",
      path: "/script.js",
      is_dir: false,
      size: 50,
      modified: 1700000000,
      extension: "js",
      hidden: false,
    };

    render(
      <PreviewPane
        entry={fileEntry}
        currentDir="/"
        onClose={() => {}}
        onNavigate={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByTitle("Favorite")).not.toBeNull();
    });

    const starBtn = screen.getByTitle("Favorite");
    fireEvent.click(starBtn);

    await waitFor(() => {
      expect(api.setFavorite).toHaveBeenCalledWith("/script.js", true);
    });
  });
});
