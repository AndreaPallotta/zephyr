import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import FileDiffModal from "./FileDiffModal";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    readTextFile: vi.fn().mockImplementation((path: string) => {
      if (path.includes("fileA")) return Promise.resolve("line 1\nline 2");
      return Promise.resolve("line 1\nline 3");
    }),
  };
});

describe("FileDiffModal Component Tests", () => {
  it("renders side-by-side file contents and diff lines", async () => {
    render(
      <FileDiffModal
        pathA="C:\\fileA.txt"
        pathB="C:\\fileB.txt"
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Visual File Comparison/i)).not.toBeNull();
      expect(screen.getByText("line 2")).not.toBeNull();
      expect(screen.getByText("line 3")).not.toBeNull();
    });
  });
});
