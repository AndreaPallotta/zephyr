import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import FileIcon from "./FileIcon";
import { FileEntry } from "./api";

describe("FileIcon Component Tests", () => {
  it("renders folder icon for directories", () => {
    const entry: FileEntry = {
      name: "Projects",
      path: "/Projects",
      is_dir: true,
      size: 0,
      modified: 1700000000,
      extension: "",
      hidden: false,
    };
    const { container } = render(<FileIcon entry={entry} size={24} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders code icon for typescript files", () => {
    const entry: FileEntry = {
      name: "App.tsx",
      path: "/App.tsx",
      is_dir: false,
      size: 1024,
      modified: 1700000000,
      extension: "tsx",
      hidden: false,
    };
    const { container } = render(<FileIcon entry={entry} size={24} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders image icon for png files", () => {
    const entry: FileEntry = {
      name: "logo.png",
      path: "/logo.png",
      is_dir: false,
      size: 2048,
      modified: 1700000000,
      extension: "png",
      hidden: false,
    };
    const { container } = render(<FileIcon entry={entry} size={24} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
