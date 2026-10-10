import { describe, expect, it } from "vitest";
import { boxToFrame, frameToBox } from "./video-geometry";

describe("video letterbox mapping", () => {
  // A portrait 1080x1920 clip in a 800x450 player: the frame is 253 px wide, centred.
  const box = [800, 450] as const;
  const frame = [1080, 1920] as const;

  it("maps the frame centre to the player centre and back", () => {
    expect(frameToBox({ x: 0.5, y: 0.5 }, ...box, ...frame)).toEqual({ x: 400, y: 225 });
    expect(boxToFrame(400, 225, ...box, ...frame)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("ignores taps on the black bars", () => {
    expect(boxToFrame(50, 225, ...box, ...frame)).toBeNull();
  });

  it("round-trips a point", () => {
    const p = frameToBox({ x: 0.2, y: 0.9 }, ...box, ...frame);
    const back = boxToFrame(p.x, p.y, ...box, ...frame)!;
    expect(back.x).toBeCloseTo(0.2);
    expect(back.y).toBeCloseTo(0.9);
  });

  it("returns null before the player has a size", () => {
    expect(boxToFrame(0, 0, 0, 0, 0, 0)).toBeNull();
  });
});
