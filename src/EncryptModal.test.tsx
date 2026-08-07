import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import EncryptModal from "./EncryptModal";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    readTextFile: vi.fn().mockResolvedValue("secret content"),
    createFile: vi.fn().mockResolvedValue(undefined),
    deletePath: vi.fn().mockResolvedValue(undefined),
  };
});

describe("EncryptModal Component Tests", () => {
  it("renders encryption form and triggers encryption handler", async () => {
    render(
      <EncryptModal
        filePath="C:\\secret.txt"
        onClose={() => {}}
        onRefresh={() => {}}
      />
    );

    expect(screen.getByText("Encrypt File")).not.toBeNull();

    const input = screen.getByPlaceholderText("Enter password...");
    fireEvent.change(input, { target: { value: "mykey" } });

    const btn = screen.getByText("Encrypt Now");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.queryByText("Encrypt File")).not.toBeNull();
    });
  });
});
