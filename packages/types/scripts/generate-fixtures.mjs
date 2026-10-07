// Generates synthetic PoseSequence fixtures in src/fixtures/.
// These are geometric stick figures for testing engines, NOT recordings and NOT clinical references.
// Run: pnpm --filter @optimass/types fixtures
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../src/fixtures/", import.meta.url));
const FPS = 15;
const IMAGE = { width: 720, height: 1280 };
const r4 = (n) => Math.round(n * 1e4) / 1e4;
const rad = (d) => (d * Math.PI) / 180;

const NAMES = [
  "nose", "left_eye_inner", "left_eye", "left_eye_outer", "right_eye_inner", "right_eye", "right_eye_outer",
  "left_ear", "right_ear", "mouth_left", "mouth_right", "left_shoulder", "right_shoulder", "left_elbow",
  "right_elbow", "left_wrist", "right_wrist", "left_pinky", "right_pinky", "left_index", "right_index",
  "left_thumb", "right_thumb", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle",
  "left_heel", "right_heel", "left_foot_index", "right_foot_index",
];

// Segment lengths in normalized image height units.
const SHIN = 0.2, THIGH = 0.2, TORSO = 0.26, UPPER_ARM = 0.14;

/** Depth curve for `reps` reps: 0 standing → 1 bottom, smooth cosine with a short lockout between reps. */
function depthAt(t, repSeconds, reps) {
  const lead = 0.5;
  const tt = t - lead;
  if (tt < 0 || tt >= repSeconds * reps) return 0;
  const phase = (tt % repSeconds) / repSeconds;
  return (1 - Math.cos(phase * 2 * Math.PI)) / 2;
}

function frame(i, points, visibility) {
  const hipMid = { x: (points.left_hip.x + points.right_hip.x) / 2, y: (points.left_hip.y + points.right_hip.y) / 2 };
  const scale = 1.75; // ~meters per unit of image height for a 1.75 m lifter filling the frame
  const landmarks = NAMES.map((n) => ({ x: r4(points[n].x), y: r4(points[n].y), z: r4(points[n].z ?? 0), visibility: r4(visibility(n)) }));
  const worldLandmarks = NAMES.map((n) => ({
    x: r4((points[n].x - hipMid.x) * scale * (IMAGE.width / IMAGE.height)),
    y: r4((points[n].y - hipMid.y) * scale),
    z: r4((points[n].z ?? 0) * scale),
    visibility: r4(visibility(n)),
  }));
  return { frameIndex: i, timestampMs: Math.round((i * 1000) / FPS), landmarks, worldLandmarks };
}

function head(p, nose, facing) {
  // facing: +1 right, -1 left (sagittal), 0 toward camera (frontal)
  const s = 0.012;
  const o = (dx, dy) => ({ x: nose.x + dx, y: nose.y + dy, z: 0 });
  p.nose = o(0, 0);
  if (facing === 0) {
    p.left_eye_inner = o(s, -s); p.left_eye = o(2 * s, -s); p.left_eye_outer = o(3 * s, -s);
    p.right_eye_inner = o(-s, -s); p.right_eye = o(-2 * s, -s); p.right_eye_outer = o(-3 * s, -s);
    p.left_ear = o(4.5 * s, -0.5 * s); p.right_ear = o(-4.5 * s, -0.5 * s);
    p.mouth_left = o(1.5 * s, 1.5 * s); p.mouth_right = o(-1.5 * s, 1.5 * s);
  } else {
    const f = facing;
    for (const side of ["left", "right"]) {
      p[`${side}_eye_inner`] = o(-0.5 * s * f, -s); p[`${side}_eye`] = o(-s * f, -s); p[`${side}_eye_outer`] = o(-1.5 * s * f, -s);
      p[`${side}_ear`] = o(-5 * s * f, -0.5 * s); p[`mouth_${side}`] = o(-0.5 * s * f, 1.5 * s);
    }
  }
}

function hand(p, side, wrist, dir) {
  p[`${side}_wrist`] = wrist;
  p[`${side}_pinky`] = { x: wrist.x + 0.015 * dir.x, y: wrist.y + 0.015 * dir.y, z: 0 };
  p[`${side}_index`] = { x: wrist.x + 0.02 * dir.x, y: wrist.y + 0.02 * dir.y, z: 0 };
  p[`${side}_thumb`] = { x: wrist.x + 0.012 * dir.x, y: wrist.y + 0.012 * dir.y, z: 0 };
}

/** Side view, lifter facing image-right, left side nearest the camera. Back squat with bar on the upper back. */
function squatSagittal(d) {
  const p = {};
  const shinA = rad(35 * d), thighA = rad(95 * d), trunkA = rad(45 * d);
  for (const [side, dz, dx] of [["left", -0.05, 0], ["right", 0.05, 0.006]]) {
    const ankle = { x: 0.5 + dx, y: 0.88, z: dz };
    const knee = { x: ankle.x + SHIN * Math.sin(shinA), y: ankle.y - SHIN * Math.cos(shinA), z: dz };
    const hip = { x: knee.x - THIGH * Math.sin(thighA), y: knee.y - THIGH * Math.cos(thighA), z: dz };
    const shoulder = { x: hip.x + TORSO * Math.sin(trunkA), y: hip.y - TORSO * Math.cos(trunkA), z: dz };
    // Hands hold the bar just behind the shoulder: elbow points down/back.
    const elbow = { x: shoulder.x - UPPER_ARM * 0.7, y: shoulder.y + UPPER_ARM * 0.7, z: dz };
    const wrist = { x: shoulder.x - 0.02, y: shoulder.y - 0.01, z: dz };
    Object.assign(p, {
      [`${side}_ankle`]: ankle, [`${side}_knee`]: knee, [`${side}_hip`]: hip, [`${side}_shoulder`]: shoulder, [`${side}_elbow`]: elbow,
      [`${side}_heel`]: { x: ankle.x - 0.03, y: ankle.y + 0.02, z: dz }, [`${side}_foot_index`]: { x: ankle.x + 0.09, y: ankle.y + 0.025, z: dz },
    });
    hand(p, side, wrist, { x: 1, y: -0.3 });
  }
  const sh = p.left_shoulder;
  head(p, { x: sh.x + 0.05 + 0.02 * d, y: sh.y - 0.09 }, 1);
  return p;
}

/** Frontal view, lifter facing the camera (their left = image right). `valgus` 0..1 pulls knees medially at depth. */
function squatFrontal(d, valgus) {
  const p = {};
  const drop = (THIGH + SHIN) * (1 - Math.cos(rad(55 * d))) ; // vertical shortening of the leg as it flexes
  for (const [side, sx] of [["left", 1], ["right", -1]]) {
    const ankle = { x: 0.5 + sx * 0.11, y: 0.88, z: 0 };
    const hip = { x: 0.5 + sx * 0.09, y: ankle.y - SHIN - THIGH + drop, z: 0 };
    const kneeOut = 0.03 * d; // knees track over toes
    const kneeIn = 0.07 * d * valgus;
    const knee = { x: (ankle.x + hip.x) / 2 + sx * (kneeOut - kneeIn), y: (ankle.y + hip.y) / 2 + drop * 0.1, z: -0.05 * d };
    const shoulder = { x: 0.5 + sx * 0.12, y: hip.y - TORSO * Math.cos(rad(30 * d)), z: 0.04 * d };
    const elbow = { x: shoulder.x + sx * 0.06, y: shoulder.y + 0.08, z: 0.05 };
    const wrist = { x: shoulder.x + sx * 0.05, y: shoulder.y - 0.005, z: 0.03 };
    Object.assign(p, {
      [`${side}_ankle`]: ankle, [`${side}_knee`]: knee, [`${side}_hip`]: hip, [`${side}_shoulder`]: shoulder, [`${side}_elbow`]: elbow,
      [`${side}_heel`]: { x: ankle.x, y: ankle.y + 0.015, z: 0.03 }, [`${side}_foot_index`]: { x: ankle.x + sx * 0.03, y: ankle.y + 0.03, z: -0.08 },
    });
    hand(p, side, wrist, { x: sx * -0.3, y: -1 });
  }
  head(p, { x: 0.5, y: p.left_shoulder.y - 0.09 }, 0);
  return p;
}

function sequence({ id, exerciseId, cameraView, seconds, repSeconds, reps, pose, visibility }) {
  const n = Math.round(seconds * FPS);
  const frames = [];
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    const repIndex = Math.floor((t - 0.5) / repSeconds);
    frames.push(frame(i, pose(depthAt(t, repSeconds, reps), repIndex), visibility));
  }
  return { id, exerciseId, cameraView, fps: FPS, image: IMAGE, source: "fixture", frames };
}

const sagittalVis = (n) => (n.startsWith("right_") ? 0.55 : 0.98);
const frontalVis = (n) => (/(eye|ear|mouth)/.test(n) ? 0.9 : 0.99);

const fixtures = {
  "squat-sagittal-2reps": sequence({
    id: "fixture-squat-sagittal-2reps", exerciseId: "barbell_back_squat", cameraView: "sagittal",
    seconds: 6, repSeconds: 2.5, reps: 2, pose: (d) => squatSagittal(d), visibility: sagittalVis,
  }),
  "squat-frontal-valgus": sequence({
    id: "fixture-squat-frontal-valgus", exerciseId: "barbell_back_squat", cameraView: "frontal",
    // Rep 0 tracks well; rep 1 shows medial knee collapse at depth.
    seconds: 6, repSeconds: 2.5, reps: 2, pose: (d, rep) => squatFrontal(d, rep === 1 ? 1 : 0), visibility: frontalVis,
  }),
  "standing-frontal-static": sequence({
    id: "fixture-standing-frontal-static", exerciseId: "barbell_back_squat", cameraView: "frontal",
    seconds: 1, repSeconds: 1, reps: 0, pose: () => squatFrontal(0, 0), visibility: frontalVis,
  }),
};

for (const [name, seq] of Object.entries(fixtures)) {
  writeFileSync(`${OUT}${name}.json`, JSON.stringify(seq) + "\n");
  console.log(`wrote ${name}.json (${seq.frames.length} frames)`);
}
