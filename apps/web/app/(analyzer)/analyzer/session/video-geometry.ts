// A <video> letterboxes its frame inside the element (object-contain), so a tap on the element has to be
// mapped onto the frame itself before it means "this spot on the body".

interface Fit {
  left: number;
  top: number;
  width: number;
  height: number;
}

function fit(boxW: number, boxH: number, frameW: number, frameH: number): Fit {
  if (!frameW || !frameH) return { left: 0, top: 0, width: boxW, height: boxH };
  const scale = Math.min(boxW / frameW, boxH / frameH);
  const width = frameW * scale;
  const height = frameH * scale;
  return { left: (boxW - width) / 2, top: (boxH - height) / 2, width, height };
}

/** Element-relative pixels → 0..1 frame fractions, or null when the tap lands on the black bars. */
export function boxToFrame(px: number, py: number, boxW: number, boxH: number, frameW: number, frameH: number) {
  const f = fit(boxW, boxH, frameW, frameH);
  const x = (px - f.left) / f.width;
  const y = (py - f.top) / f.height;
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return null; // also rejects NaN from an unmeasured box
  return { x, y };
}

/** 0..1 frame fractions → element-relative pixels. */
export function frameToBox(point: { x: number; y: number }, boxW: number, boxH: number, frameW: number, frameH: number) {
  const f = fit(boxW, boxH, frameW, frameH);
  return { x: f.left + point.x * f.width, y: f.top + point.y * f.height };
}
