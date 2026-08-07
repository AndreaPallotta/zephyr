import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CommandPalette from "./CommandPalette";

describe("CommandPalette Component Tests", () => {
  it("renders command items and navigates when selected", () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    const onAction = vi.fn();

    const home = "C:\\Users\\Test";

    render(
      <CommandPalette
        onClose={onClose}
        onNavigate={onNavigate}
        onAction={onAction}
        homeDir={home}
        drives={["C:\\"]}
      />
    );

    expect(screen.getByText("Go to Home")).not.toBeNull();
    expect(screen.getByText("Go to Drive C:\\")).not.toBeNull();

    fireEvent.click(screen.getByText("Go to Home"));
    expect(onNavigate).toHaveBeenCalledWith(home);
    expect(onClose).toHaveBeenCalled();
  });

  it("filters items based on user query", () => {
    render(
      <CommandPalette
        onClose={() => {}}
        onNavigate={() => {}}
        onAction={() => {}}
        homeDir="C:\\Users\\Test"
        drives={["C:\\"]}
      />
    );

    const input = screen.getByPlaceholderText("Type a command or directory...");
    fireEvent.change(input, { target: { value: "VS Code" } });

    expect(screen.getByText("Open in VS Code")).not.toBeNull();
    expect(screen.queryByText("Go to Home")).toBeNull();
  });

  it("navigates keyboard selection on ArrowDown, ArrowUp, and Enter keydown", () => {
    const onAction = vi.fn();
    const onClose = vi.fn();

    render(
      <CommandPalette
        onClose={onClose}
        onNavigate={() => {}}
        onAction={onAction}
        homeDir="C:\\Users\\Test"
        drives={[]}
      />
    );

    const input = screen.getByPlaceholderText("Type a command or directory...");
    fireEvent.change(input, { target: { value: "New Folder" } });

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowUp" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(onAction).toHaveBeenCalledWith("newdir");
    expect(onClose).toHaveBeenCalled();
  });
});
