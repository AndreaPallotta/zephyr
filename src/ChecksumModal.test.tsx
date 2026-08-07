import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ChecksumModal from "./ChecksumModal";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    computeChecksum: vi.fn().mockResolvedValue({
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      md5: "d41d8cd98f00b204e9800998ecf8427e",
    }),
  };
});

describe("ChecksumModal Component Tests", () => {
  it("renders SHA-256 and MD5 checksums and verifies hash matches", async () => {
    render(<ChecksumModal filePath="C:\\test.iso" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/File Checksum Verifier/i)).not.toBeNull();
      expect(screen.getByText("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")).not.toBeNull();
      expect(screen.getByText("d41d8cd98f00b204e9800998ecf8427e")).not.toBeNull();
    });

    const input = screen.getByPlaceholderText("Paste expected SHA-256 or MD5 hash...");
    fireEvent.change(input, { target: { value: "d41d8cd98f00b204e9800998ecf8427e" } });

    await waitFor(() => {
      expect(screen.getByText("Checksum Matches Expected Hash!")).not.toBeNull();
    });
  });
});
