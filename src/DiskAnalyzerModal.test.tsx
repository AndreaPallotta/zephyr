import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import DiskAnalyzerModal from "./DiskAnalyzerModal";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    listDirectory: vi.fn().mockResolvedValue({
      path: "C:\\Projects",
      parent: "C:\\",
      entries: [
        { name: "node_modules", path: "C:\\Projects\\node_modules", is_dir: true, size: 0, modified: 1700000000, extension: "", hidden: false },
        { name: "src", path: "C:\\Projects\\src", is_dir: true, size: 0, modified: 1700000000, extension: "", hidden: false },
      ],
      is_git_repo: false,
    }),
    getFolderSize: vi.fn().mockResolvedValue({ size: 104857600, file_count: 50, dir_count: 10, cached: false }),
  };
});

describe("DiskAnalyzerModal Component Tests", () => {
  it("renders disk space breakdown and folder size items", async () => {
    render(
      <DiskAnalyzerModal
        currentPath="C:\\Projects"
        onClose={() => {}}
        onNavigate={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Disk Space Analyzer/i)).not.toBeNull();
      expect(screen.getByText("node_modules")).not.toBeNull();
      expect(screen.getByText("src")).not.toBeNull();
    });
  });
});
