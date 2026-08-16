import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary";

function ThrowingComponent() {
  throw new Error("Test Crash Error");
}

describe("ErrorBoundary Component", () => {
  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Normal Application Content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Normal Application Content")).not.toBeNull();
  });

  it("catches errors and renders fallback error UI", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong in Zephyr UI")).not.toBeNull();
    expect(screen.getByText(/Test Crash Error/)).not.toBeNull();

    const reloadBtn = screen.getByText("Reload Zephyr");
    expect(reloadBtn).not.toBeNull();

    spy.mockRestore();
  });
});
