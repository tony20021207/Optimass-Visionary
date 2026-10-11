// Server-only: reads MediaPipe's WASM files so the web app can serve them from its own origin.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { WASM_FILES } from "./config";

type WasmFile = (typeof WASM_FILES)[number];

export const isWasmFile = (name: string): name is WasmFile => (WASM_FILES as readonly string[]).includes(name);

/**
 * Reads one of tasks-vision's WASM runtime files from this package's install. Found by path rather than
 * require.resolve, which the bundler would try to compile. `appDir` is the web app's folder (Next's cwd).
 */
export async function readMediapipeWasm(name: WasmFile, appDir = process.cwd()): Promise<{ body: Uint8Array; contentType: string }> {
  const file = path.resolve(appDir, "../../packages/pose-capture/node_modules/@mediapipe/tasks-vision/wasm", name);
  return { body: new Uint8Array(await readFile(file)), contentType: name.endsWith(".wasm") ? "application/wasm" : "text/javascript" };
}
