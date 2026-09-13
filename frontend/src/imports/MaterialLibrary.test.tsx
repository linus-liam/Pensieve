import { webcrypto } from "node:crypto";
import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ZipWriter, Uint8ArrayReader, Uint8ArrayWriter } from "@zip.js/zip.js";
import { MaterialLibrary } from "./MaterialLibrary";
import { api } from "../api/client";
import { makeMaterial, materialBackup, summary, toBase64, type MaterialInput, type RawMaterial } from "../../../backend/src/imports/materials";
vi.mock("../api/client", () => ({ api: { listMaterials: vi.fn(), getMaterial: vi.fn(), importMaterial: vi.fn(), restoreMaterial: vi.fn() } }));
vi.mock("../local", () => ({ localMode: true, mobileMode: false }));
const encode = (s: string) => new TextEncoder().encode(s);
function file(name: string, bytes: Uint8Array) { const f = new File([new Uint8Array(bytes).buffer], name); Object.defineProperty(f, "arrayBuffer", { value: async () => new Uint8Array(bytes).buffer }); Object.defineProperty(f, "text", { value: async () => new TextDecoder().decode(bytes) }); return f; }
let saved: RawMaterial | undefined;
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("crypto", webcrypto); saved = undefined;
  vi.mocked(api.listMaterials).mockImplementation(async () => saved ? [summary(saved)] : []);
  vi.mocked(api.importMaterial).mockImplementation(async (input: MaterialInput) => { saved = await makeMaterial(input); return { material: summary(saved), duplicate: false }; });
  vi.mocked(api.getMaterial).mockImplementation(async () => saved!);
});
afterEach(() => vi.unstubAllGlobals());
function mount() { return render(<MantineProvider><MaterialLibrary onSettings={vi.fn()} /></MantineProvider>); }

it("previews Markdown verbatim before saving and preserves the preview after a failed write", async () => {
  const { container } = mount(); const user = userEvent.setup();
  const original = encode("\uFEFF# 原始标题\r\n  合成文字  ");
  await user.upload(container.querySelector('input[type="file"]')!, file("合成.md", original));
  await screen.findByRole("button", { name: "保存原件" });
  expect(api.importMaterial).not.toHaveBeenCalled();
  expect(container.querySelector("pre")?.textContent).toBe("\uFEFF# 原始标题\r\n  合成文字  ");
  vi.mocked(api.importMaterial).mockRejectedValueOnce(new Error("磁盘空间不足"));
  await user.click(screen.getByRole("button", { name: "保存原件" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("磁盘空间不足");
  expect(screen.getByRole("button", { name: "保存原件" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "保存原件" }));
  await screen.findByText("原件已校验");
  expect(saved?.base64).toBe(toBase64(original));
});
it("shows that saving ZIP includes all original files and does not silently omit unsupported attachments", async () => {
  const writer = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false });
  await writer.add("合成.txt", new Uint8ArrayReader(encode("ZIP 中的原话")), { useWebWorkers: false });
  await writer.add("附件.bin", new Uint8ArrayReader(new Uint8Array([0, 1, 255])), { useWebWorkers: false });
  const original = await writer.close();
  const { container } = mount(); const user = userEvent.setup();
  await user.upload(container.querySelector('input[type="file"]')!, file("export.zip", original));
  await screen.findByRole("button", { name: "保存整个 ZIP" });
  expect(screen.getByText(/将保存整个 ZIP，包括其中所有聊天/)).toBeInTheDocument();
  expect(screen.getByText(/1 个文件仅保留在 ZIP/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "保存整个 ZIP" }));
  await screen.findByText("原件已校验");
  expect(saved?.base64).toBe(toBase64(original));
});
it("verifies portable backup checksums before exposing a restore action", async () => {
  const original = await makeMaterial({ name: "synthetic.txt", kind: "text", origin: "file", base64: toBase64(encode("原件")), source: "", source_date: null });
  const backup = await materialBackup(original); const broken = { ...backup, sha256: "damaged" };
  const { container } = mount(); const user = userEvent.setup();
  const picker = container.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
  await user.upload(picker, file("broken.json", encode(JSON.stringify(broken))));
  expect(await screen.findByRole("alert")).toHaveTextContent("清单校验失败");
  expect(api.restoreMaterial).not.toHaveBeenCalled();
  await user.upload(picker, file("good.json", encode(JSON.stringify(backup))));
  await screen.findByRole("button", { name: "恢复这份原件" });
  expect(api.restoreMaterial).not.toHaveBeenCalled();
  vi.mocked(api.restoreMaterial).mockImplementation(async () => { saved = original; return { material: summary(original), duplicate: false }; });
  await user.click(screen.getByRole("button", { name: "恢复这份原件" }));
  await waitFor(() => expect(api.restoreMaterial).toHaveBeenCalledWith(backup));
});
