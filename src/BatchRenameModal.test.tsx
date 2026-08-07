import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import BatchRenameModal from "./BatchRenameModal";
import * as api from "./api";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    renamePath: vi.fn().mockResolvedValue(undefined),
  };
});

describe("BatchRenameModal Component Tests", () => {
  it("renders live rename preview and calls renamePath on apply", async () => {
    const entries = [
      { name: "photo1.jpg", path: "C:\\Photos\\photo1.jpg", is_dir: false, size: 100, modified: 1700000000, extension: "jpg", hidden: false },
      { name: "photo2.jpg", path: "C:\\Photos\\photo2.jpg", is_dir: false, size: 100, modified: 1700000000, extension: "jpg", hidden: false },
    ];

    render(
      <BatchRenameModal
        entries={entries}
        onClose={() => {}}
        onRefresh={() => {}}
      />
    );

    expect(screen.getByText("Batch Renamer (2 items)")).not.toBeNull();
    expect(screen.getByText("file_1.jpg")).not.toBeNull();
    expect(screen.getByText("file_2.jpg")).not.toBeNull();

    const applyBtn = screen.getByText("Apply Rename");
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(api.renamePath).toHaveBeenCalled();
    });
  });

  it("switches to Find & Replace mode and replaces text in preview", async () => {
    const entries = [
      { name: "draft_doc.txt", path: "C:\\Docs\\draft_doc.txt", is_dir: false, size: 100, modified: 1700000000, extension: "txt", hidden: false },
    ];

    render(
      <BatchRenameModal
        entries={entries}
        onClose={() => {}}
        onRefresh={() => {}}
      />
    );

    const findReplaceBtn = screen.getByText("Find & Replace");
    fireEvent.click(findReplaceBtn);

    const findTextLabel = screen.getByText("Find Text:");
    const findInput = findTextLabel.nextElementSibling as HTMLInputElement;
    fireEvent.change(findInput, { target: { value: "draft" } });

    const replaceTextLabel = screen.getByText("Replace With:");
    const replaceInput = replaceTextLabel.nextElementSibling as HTMLInputElement;
    fireEvent.change(replaceInput, { target: { value: "final" } });

    await waitFor(() => {
      expect(screen.getByText("final_doc.txt")).not.toBeNull();
    });
  });

  it("applies prefix and suffix inputs", async () => {
    const entries = [
      { name: "item.pdf", path: "C:\\Docs\\item.pdf", is_dir: false, size: 100, modified: 1700000000, extension: "pdf", hidden: false },
    ];

    render(
      <BatchRenameModal
        entries={entries}
        onClose={() => {}}
        onRefresh={() => {}}
      />
    );

    const prefixInput = screen.getByPlaceholderText("Optional prefix");
    fireEvent.change(prefixInput, { target: { value: "PRE_" } });

    const suffixInput = screen.getByPlaceholderText("Optional suffix");
    fireEvent.change(suffixInput, { target: { value: "_POST" } });

    await waitFor(() => {
      expect(screen.getByText("PRE_file_1_POST.pdf")).not.toBeNull();
    });
  });
});
