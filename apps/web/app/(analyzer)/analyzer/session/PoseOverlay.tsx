"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { POSE_LANDMARK } from "@optimass/types";
import type { PoseFrame, PoseLandmarkName, PoseSequence } from "@optimass/types";
import { DEFAULT_MIN_VISIBILITY } from "@optimass/pose-capture";
import { frameToBox } from "./video-geometry";

const BONES: [PoseLandmarkName, PoseLandmarkName][] = [
  ["left_ear", "left_shoulder"],
  ["right_ear", "right_shoulder"],
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
];
const JOINTS = [...new Set(BONES.flat())];

/** Frames further than this from the playhead aren't drawn (the body wasn't found there). */
const MAX_GAP_MS = 120;

/** The frame closest to time t, by binary search over ordered timestamps. */
export function frameAt(frames: readonly PoseFrame[], tMs: number): PoseFrame | null {
  if (frames.length === 0) return null;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid]!.timestampMs < tMs) lo = mid + 1;
    else hi = mid;
  }
  const best = lo > 0 && tMs - frames[lo - 1]!.timestampMs < frames[lo]!.timestampMs - tMs ? frames[lo - 1]! : frames[lo]!;
  return Math.abs(best.timestampMs - tMs) <= MAX_GAP_MS ? best : null;
}

/** Draws the tracked skeleton over a playing video. Faint lines mark joints MediaPipe wasn't sure about. */
export function PoseOverlay({ videoRef, sequence }: { videoRef: RefObject<HTMLVideoElement | null>; sequence: PoseSequence }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    let raf = 0;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = video.clientWidth;
      const h = video.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const frame = frameAt(sequence.frames, video.currentTime * 1000);
      if (!frame) return;
      const at = (name: PoseLandmarkName) => {
        const l = frame.landmarks[POSE_LANDMARK[name]]!;
        return { ...frameToBox(l, w, h, video.videoWidth, video.videoHeight), seen: l.visibility >= DEFAULT_MIN_VISIBILITY };
      };
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (const [a, b] of BONES) {
        const p = at(a);
        const q = at(b);
        ctx.strokeStyle = p.seen && q.seen ? "rgba(52, 211, 153, 0.95)" : "rgba(255, 255, 255, 0.35)";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
      for (const name of JOINTS) {
        const p = at(name);
        ctx.fillStyle = p.seen ? "#ffffff" : "rgba(255, 255, 255, 0.35)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [videoRef, sequence]);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 size-full" />;
}
