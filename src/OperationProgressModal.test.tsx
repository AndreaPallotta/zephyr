import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import OperationProgressModal, { OperationState } from "./OperationProgressModal";

describe("OperationProgressModal", () => {
  it("renders operation title, current file, and percentage stats", () => {
    const mockState: OperationState = {
      type: "copy",
      title: "Copying 5 items...",
      currentFile: "/Users/test/large_file.iso",
      totalItems: 5,
      completedItems: 2,
      totalBytes: 1000000,
      copiedBytes: 500000,
      startTime: Date.now() - 2000,
    };
    const onCancel = vi.fn();

    render(<OperationProgressModal operation={mockState} onCancel={onCancel} />);

    expect(screen.getByText("Copying 5 items...")).toBeDefined();
    expect(screen.getByText("/Users/test/large_file.iso")).toBeDefined();
    expect(screen.getByText("50%")).toBeDefined();
  });
});
