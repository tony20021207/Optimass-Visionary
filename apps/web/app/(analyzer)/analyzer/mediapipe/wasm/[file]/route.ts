import { isWasmFile, readMediapipeWasm } from "@optimass/pose-capture/server";

// MediaPipe's WASM runtime, served from our own origin so it always matches the installed JS version.
export async function GET(_req: Request, ctx: RouteContext<"/analyzer/mediapipe/wasm/[file]">) {
  const { file } = await ctx.params;
  if (!isWasmFile(file)) return new Response("Not found", { status: 404 });
  const { body, contentType } = await readMediapipeWasm(file);
  return new Response(body as BodyInit, {
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
