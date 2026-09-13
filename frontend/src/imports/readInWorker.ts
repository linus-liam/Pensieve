import type { RawMaterial } from "../../../backend/src/imports/materials";
import type { MaterialView } from "../../../backend/src/imports/readMaterial";

export async function readInWorker(record: RawMaterial): Promise<MaterialView> {
  if (typeof Worker === "undefined") return (await import("../../../backend/src/imports/readMaterial")).readMaterial(record);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./read.worker.ts", import.meta.url), { type: "module" });
    const finish = () => { clearTimeout(timeout); worker.terminate(); };
    const timeout = setTimeout(() => { finish(); reject(new Error("文件读取超过一分钟，未继续保存；请拆分后重试。")); }, 60000);
    worker.onmessage = (event: MessageEvent<{ view?: MaterialView; error?: string }>) => {
      finish();
      if (event.data.error || !event.data.view) reject(new Error(event.data.error || "原件读取未完成。"));
      else resolve(event.data.view);
    };
    worker.onerror = () => { finish(); reject(new Error("无法启动本机文件读取，请刷新页面后重试。")); };
    worker.postMessage(record);
  });
}
