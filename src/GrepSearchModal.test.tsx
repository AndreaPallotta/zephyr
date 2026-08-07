import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import GrepSearchModal from "./GrepSearchModal";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    searchFileContents: vi.fn().mockResolvedValue([
      { path: "C:\\Projects\\app.rs", line_number: 42, line_text: "fn main() { println!(\"magic\"); }" }
    ]),
  };
});

describe("GrepSearchModal Component Tests", () => {
  it("renders search input and displays matching file line content", async () => {
    render(
      <GrepSearchModal
        currentPath="C:\\Projects"
        onClose={() => {}}
        onSelectFile={() => {}}
      />
    );

    const input = screen.getByPlaceholderText("Search text or code content across files...");
    fireEvent.change(input, { target: { value: "magic" } });

    await waitFor(() => {
      expect(screen.getByText("app.rs — Line 42")).not.toBeNull();
      expect(screen.getByText("fn main() { println!(\"magic\"); }")).not.toBeNull();
    });
  });
});
