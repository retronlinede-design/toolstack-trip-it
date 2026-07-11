import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ModalShell } from "./index.jsx";

describe("modal interaction layering", () => {
  it("renders backdrop and interactive panel as separate layers", () => {
    const modal = ModalShell({ title: "Export", description: "Test", onClose: () => {}, children: <button type="button">Export backup</button> });
    const [backdrop, positioner] = modal.props.children;
    expect(modal.props.className).toBe("modal-root");
    expect(backdrop.props.className).toContain("modal-backdrop");
    expect(positioner.props.className).toBe("modal-positioner");
    expect(positioner.props.children.props.className).toContain("modal-panel");
  });

  it("backdrop closes independently without wrapping panel content", () => {
    const onClose = vi.fn();
    const modal = ModalShell({ title: "Help", onClose, children: <button type="button">Inside</button> });
    const [backdrop, positioner] = modal.props.children;
    backdrop.props.onClick();
    expect(onClose).toHaveBeenCalledOnce();
    expect(positioner.props.onClick).toBeUndefined();
    expect(positioner.props.children.props.onClick).toBeUndefined();
  });

  it("declares active pointer events on panels and non-intercepting positioners", () => {
    const css = readFileSync(new URL("../../index.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.modal-positioner[^}]*pointer-events:\s*none/s);
    expect(css).toMatch(/\.ts-modal, \.modal-panel[^}]*pointer-events:\s*auto/s);
    expect(css).toMatch(/\.ts-modal-backdrop > \.absolute\.inset-0[^}]*z-index:\s*0/s);
  });

  it("covers export, preview, help, email, month and vehicle modal structures", () => {
    const source = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");
    expect(source).toContain("setExportModalOpen(false)");
    expect(source).toContain("setPreviewOpen(false)");
    expect(source).toContain("ToolStack • Help Pack v1");
    expect(source).toContain("ToolStack • Email");
    expect(source).toContain("ToolStack • Month picker");
    expect(source).toContain("vehicleModal.open");
    expect(source).toContain("<ConfirmModal");
    expect(source).toContain("<ImportWorkflowModal");
  });
});
