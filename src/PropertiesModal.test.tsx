import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PropertiesModal from "./PropertiesModal";
import * as api from "./api";

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    getFileProperties: vi.fn(),
  };
});

describe("PropertiesModal Component Tests", () => {
  it("renders loader while properties are loading", async () => {
    (api.getFileProperties as any).mockReturnValue(new Promise(() => {}));
    render(<PropertiesModal path="/test/file.txt" onClose={() => {}} />);
    expect(screen.getByText(/Loading properties.../i)).not.toBeNull();
  });

  it("renders file metadata correctly once loaded", async () => {
    (api.getFileProperties as any).mockResolvedValue({
      name: "sample.rs",
      path: "C:\\projects\\sample.rs",
      is_dir: false,
      size: 2048,
      size_on_disk: 4096,
      created: 1700000000,
      modified: 1700000000,
      accessed: 1700000000,
      readonly: false,
      hidden: false,
      extension: "rs",
      line_count: 42,
    });

    render(<PropertiesModal path="C:\\projects\\sample.rs" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("sample.rs")).not.toBeNull();
      expect(screen.getByText("42 lines")).not.toBeNull();
      expect(screen.getByText("Normal")).not.toBeNull();
    });
  });

  it("calls onClose when clicking OK button or close icon", async () => {
    (api.getFileProperties as any).mockResolvedValue({
      name: "test.txt",
      path: "/test.txt",
      is_dir: false,
      size: 100,
      size_on_disk: 4096,
      created: 1700000000,
      modified: 1700000000,
      accessed: 1700000000,
      readonly: false,
      hidden: false,
      extension: "txt",
    });

    const onClose = vi.fn();
    render(<PropertiesModal path="/test.txt" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText("OK")).not.toBeNull();
    });

    fireEvent.click(screen.getByText("OK"));
    expect(onClose).toHaveBeenCalled();
  });
});
