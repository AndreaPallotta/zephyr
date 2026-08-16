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
    computeChecksum: vi.fn(),
    findDuplicates: vi.fn(),
    setTag: vi.fn(),
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

    const favBtn = screen.getByTitle("Favorite");
    fireEvent.click(favBtn);

    expect(api.setFavorite).toHaveBeenCalledWith("/script.js", true);
  });

  it("renders video player for video files", async () => {
    const videoEntry = {
      name: "movie.mp4",
      path: "/movie.mp4",
      is_dir: false,
      size: 5000000,
      modified: 1700000000,
      extension: "mp4",
      hidden: false,
    };

    render(
      <PreviewPane
        entry={videoEntry}
        currentDir="/"
        onClose={() => {}}
        onNavigate={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText("movie.mp4").length).toBeGreaterThan(0);
    });
  });

  it("renders generic no preview card for binary / unsupported files", async () => {
    const binEntry = {
      name: "program.bin",
      path: "/program.bin",
      is_dir: false,
      size: 1024,
      modified: 1700000000,
      extension: "bin",
      hidden: false,
    };

    render(
      <PreviewPane
        entry={binEntry}
        currentDir="/"
        onClose={() => {}}
        onNavigate={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No preview available")).not.toBeNull();
    });
  });

  it("computes and displays checksums on button click", async () => {
    (api.computeChecksum as any).mockResolvedValue({
      sha256: "abc123sha256hash",
      md5: "def456md5hash",
    });

    const fileEntry = {
      name: "data.csv",
      path: "/data.csv",
      is_dir: false,
      size: 200,
      modified: 1700000000,
      extension: "csv",
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
      expect(screen.getByText("Compute checksums...")).not.toBeNull();
    });

    fireEvent.click(screen.getByText("Compute checksums..."));

    await waitFor(() => {
      expect(screen.getByText("abc123sha256hash")).not.toBeNull();
      expect(screen.getByText("def456md5hash")).not.toBeNull();
    });
  });

  it("finds duplicates in folder on button click", async () => {
    (api.findDuplicates as any).mockResolvedValue([
      { size: 1024, paths: ["/docs/file1.txt", "/docs/file2.txt"] }
    ]);
    const onNav = vi.fn();

    const fileEntry = {
      name: "file1.txt",
      path: "/docs/file1.txt",
      is_dir: false,
      size: 1024,
      modified: 1700000000,
      extension: "txt",
      hidden: false,
    };

    render(
      <PreviewPane
        entry={fileEntry}
        currentDir="/docs"
        onClose={() => {}}
        onNavigate={onNav}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Find duplicates in folder...")).not.toBeNull();
    });

    fireEvent.click(screen.getByText("Find duplicates in folder..."));

    await waitFor(() => {
      expect(screen.getByText(/2 copies/)).not.toBeNull();
    });
  });

  it("sets and clears tag color", async () => {
    (api.setTag as any).mockResolvedValue(undefined);

    const fileEntry = {
      name: "report.pdf",
      path: "/report.pdf",
      is_dir: false,
      size: 500,
      modified: 1700000000,
      extension: "pdf",
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
      expect(screen.getByTitle("Red")).not.toBeNull();
    });

    fireEvent.click(screen.getByTitle("Red"));
    expect(api.setTag).toHaveBeenCalledWith("/report.pdf", "#f85149");
  });
});
