import { readMaterial } from "../../../backend/src/imports/readMaterial";
import type { RawMaterial } from "../../../backend/src/imports/materials";

self.onmessage = async (event: MessageEvent<RawMaterial>) => {
  try { self.postMessage({ view: await readMaterial(event.data) }); }
  catch (error) { self.postMessage({ error: (error as Error).message }); }
};
