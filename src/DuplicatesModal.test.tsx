import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import DuplicatesModal from "./DuplicatesModal";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    findDuplicates: vi.fn().mockResolvedValue([
      {
        size: 5242880,
        paths: ["C:\\Videos\\video.mp4", "C:\\Backup\\video.mp4"],
      },
    ]),
    deletePath: vi.fn().mockResolvedValue(undefined),
  };
});

describe("DuplicatesModal Component Tests", () => {
  it("renders duplicate file groups and selects duplicates automatically", async () => {
    render(
      <DuplicatesModal
        currentPath="C:\\"
        onClose={() => {}}
        onRefresh={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Duplicate File Finder/i)).not.toBeNull();
      expect(screen.getByText("C:\\Videos\\video.mp4")).not.toBeNull();
      expect(screen.getByText("C:\\Backup\\video.mp4")).not.toBeNull();
    });

    const autoBtn = screen.getByText("Auto-Select Duplicates (Keep 1st Copy)");
    fireEvent.click(autoBtn);

    await waitFor(() => {
      expect(screen.getByText("Selected 1 items for deletion")).not.toBeNull();
    });
  });
});
