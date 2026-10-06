// Procedural botanical geometry — no external models. Every petal and leaf
// is a parametric surface: a curved spine (lean + backward curl), a width
// profile, a cupped cross-section, rolled tips and a gentle ruffle, with
// vertex colours graded base → mid → tip. Local frame for every surface:
// base at the origin, growing along +Y, the inner (concave) face toward +Z.
import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  TubeGeometry,
  Vector3,
} from "three";

export type PetalShape = "round" | "pointed" | "narrow" | "leaf" | "roundleaf" | "ribbon";

export type SurfaceOptions = {
  length: number;
  width: number;
  shape: PetalShape;
  segU?: number;
  segV?: number;
  /** Cross-section curvature: + curls edges toward the inside (+Z). */
  cup?: number;
  /** Initial angle of the spine away from vertical, toward the outside. */
  lean?: number;
  /** Extra backward bend accumulated toward the tip. */
  curl?: number;
  /** Top edge rolling back (roses). */
  tipRoll?: number;
  /** Twist around the spine at the tip. */
  twist?: number;
  /** Edge ripple amplitude. */
  ruffle?: number;
  /** V-fold along the midrib (leaves). */
  fold?: number;
  base: string;
  mid: string;
  tip: string;
  edge?: string;
  seed?: number;
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function halfWidth(shape: PetalShape, u: number, width: number): number {
  const w = width / 2;
  switch (shape) {
    case "round": {
      // Narrow claw at the base, widest a little above the middle, and a
      // genuinely rounded top (quarter ellipse) — no corners to read as spikes.
      const base = 0.2 + 0.8 * smoothstep(0, 0.42, u);
      const top = u < 0.6 ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.6) / 0.4, 2)));
      return w * base * Math.max(top, u < 0.995 ? 0.08 : 0);
    }
    case "pointed": {
      const base = 0.16 + 0.84 * smoothstep(0, 0.28, u);
      const top = u < 0.34 ? 1 : Math.pow(Math.max(0, 1 - (u - 0.34) / 0.66), 1.05);
      return w * base * top;
    }
    case "narrow": {
      const base = 0.35 + 0.65 * smoothstep(0, 0.14, u);
      const top = u < 0.82 ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.82) / 0.18, 2)));
      return w * base * top;
    }
    case "leaf": {
      const base = Math.pow(smoothstep(0, 0.3, u), 0.65);
      const top = Math.pow(Math.max(0, 1 - u), 0.85);
      return w * base * top * 1.35;
    }
    case "roundleaf":
      return w * Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 2)));
    case "ribbon":
      return w * (u < 0.9 ? 1 : 1 - (u - 0.9) * 4);
  }
}

const tmpColor = new Color();
const colorCache = new Map<string, Color>();
function linear(hex: string): Color {
  let c = colorCache.get(hex);
  if (!c) {
    c = new Color(hex); // sRGB string → linear working space
    colorCache.set(hex, c);
  }
  return c;
}

/** One petal / leaf / ribbon surface. */
export function surfaceGeometry(o: SurfaceOptions): BufferGeometry {
  const segU = o.segU ?? 12;
  const segV = o.segV ?? 8;
  const cup = o.cup ?? 0.6;
  const lean = o.lean ?? 0;
  const curl = o.curl ?? 0;
  const tipRoll = o.tipRoll ?? 0;
  const twist = o.twist ?? 0;
  const ruffle = o.ruffle ?? 0;
  const fold = o.fold ?? 0;
  const seed = o.seed ?? 0;

  const cBase = linear(o.base);
  const cMid = linear(o.mid);
  const cTip = linear(o.tip);
  const cEdge = linear(o.edge ?? o.tip);

  // Integrate the spine.
  const spine: Vector3[] = [];
  const tangents: Vector3[] = [];
  const normals: Vector3[] = [];
  const p = new Vector3();
  const du = 1 / segU;
  for (let i = 0; i <= segU; i++) {
    const u = i * du;
    const a = lean + curl * Math.pow(u, 2.1);
    const t = new Vector3(0, Math.cos(a), -Math.sin(a));
    const n = new Vector3(0, Math.sin(a), Math.cos(a));
    spine.push(p.clone());
    tangents.push(t);
    normals.push(n);
    p.addScaledVector(t, du * o.length);
  }

  const positions: number[] = [];
  const colors: number[] = [];
  const side = new Vector3(1, 0, 0);
  const offset = new Vector3();
  const q = new Vector3();

  for (let i = 0; i <= segU; i++) {
    const u = i * du;
    const hw = Math.max(halfWidth(o.shape, u, o.width), 0.0004);
    const s = spine[i];
    const t = tangents[i];
    const n = normals[i];
    const tw = twist * u;
    const cosT = Math.cos(tw);
    const sinT = Math.sin(tw);
    for (let j = 0; j <= segV; j++) {
      const v = (j / segV) * 2 - 1;
      const x = v * hw;
      let off = cup * hw * v * v;
      off -= fold * Math.abs(v) * hw;
      off -= tipRoll * smoothstep(0.52, 1, u) * (0.35 + 0.65 * v * v) * o.width * 0.35;
      off += ruffle * hw * Math.sin(v * Math.PI * 3.2 + seed * 1.7 + u * 4) * smoothstep(0.45, 1, u) * Math.abs(v);
      // Position = spine + side * x + normal * off, twisted about the tangent.
      offset.copy(side).multiplyScalar(x).addScaledVector(n, off);
      // Rodrigues rotation of offset around t by tw.
      q.copy(t).cross(offset);
      const dot = t.dot(offset);
      offset
        .multiplyScalar(cosT)
        .addScaledVector(q, sinT)
        .addScaledVector(t, dot * (1 - cosT));
      positions.push(s.x + offset.x, s.y + offset.y, s.z + offset.z);

      // Colour: base → mid → tip, edges nudged toward the edge colour.
      tmpColor.copy(cBase).lerp(cMid, smoothstep(0, 0.5, u));
      tmpColor.lerp(cTip, smoothstep(0.5, 1, u));
      tmpColor.lerp(cEdge, Math.pow(Math.abs(v), 4) * 0.35 * smoothstep(0.3, 1, u));
      colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  const indices: number[] = [];
  const row = segV + 1;
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * row + j;
      const b = a + row;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A stem as a tapered-looking tube along a gently bent path. */
export function stemGeometry(points: Vector3[], radius: number, radial = 6, tubular = 20): BufferGeometry {
  const curve = new CatmullRomCurve3(points, false, "catmullrom", 0.4);
  return new TubeGeometry(curve, tubular, radius, radial, false);
}

/** Paints a flat vertex colour onto any geometry (for merging by material). */
export function paint(geometry: BufferGeometry, hex: string, variance = 0, seed = 1): BufferGeometry {
  const count = geometry.getAttribute("position").count;
  const c = linear(hex);
  const colors = new Float32Array(count * 3);
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = (s * 16807) % 2147483647;
    const k = 1 + ((s / 2147483647) * 2 - 1) * variance;
    colors[i * 3] = c.r * k;
    colors[i * 3 + 1] = c.g * k;
    colors[i * 3 + 2] = c.b * k;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}

/** Tiny deterministic PRNG so the sculpture is identical on every load
 *  (and therefore identical to its pre-rendered poster). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
