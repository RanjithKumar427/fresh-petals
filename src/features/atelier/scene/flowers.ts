// Flower heads built from parametric petals. Each builder returns merged
// geometry grouped by material (petals / green parts / details) with the
// bloom opening toward local +Y and its base at the origin.
import {
  BufferGeometry,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  Euler,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { paint, rng, stemGeometry, surfaceGeometry } from "./geometry";

export type FlowerParts = {
  petals?: BufferGeometry;
  green?: BufferGeometry;
  detail?: BufferGeometry;
  /** Approximate radius of the head, used for spacing and framing. */
  radius: number;
};

export type Quality = { petalSegU: number; petalSegV: number; detail: number };

const m4 = new Matrix4();
const q = new Quaternion();
const up = new Vector3(0, 1, 0);

/** Places a surface around the flower axis: angle phi, distance r, height y. */
function around(geometry: BufferGeometry, phi: number, r: number, y = 0, tilt = 0): BufferGeometry {
  q.setFromEuler(new Euler(tilt, phi + Math.PI, 0, "YXZ"));
  m4.compose(new Vector3(Math.sin(phi) * r, y, Math.cos(phi) * r), q, new Vector3(1, 1, 1));
  return geometry.applyMatrix4(m4);
}

function merge(list: BufferGeometry[]): BufferGeometry | undefined {
  const usable = list.filter(Boolean);
  if (!usable.length) return undefined;
  // mergeGeometries needs matching attribute sets: drop uv/normal mismatches.
  for (const g of usable) {
    if (g.getAttribute("uv")) g.deleteAttribute("uv");
    if (!g.index) g.setIndex([...Array(g.getAttribute("position").count).keys()]);
  }
  // Parts already carry their own normals; merging keeps them.
  const merged = mergeGeometries(usable, false);
  for (const g of usable) g.dispose();
  return merged;
}

export type Palette = { base: string; mid: string; tip: string; edge?: string; core?: string };

// ---------------------------------------------------------------------
export function rose(palette: Palette, quality: Quality, seed = 1): FlowerParts {
  // Built ring by ring, the way a florist would describe a rose: a tightly
  // wrapped bud, cupped middle petals, then outer petals that open and roll
  // their tips back. Each ring is offset by half a step so petals overlap.
  const random = rng(seed);
  // Cup is calibrated to the ring radius (cup ≈ halfWidth / 2r) so each
  // petal wraps the bud like a cylinder instead of folding through it.
  const all = [
    { count: 3, r: 0.035, length: 0.14, width: 0.13, lean: -0.05, curl: 0.02, cup: 0.95, roll: 0.0, y: 0.05 },
    { count: 4, r: 0.045, length: 0.18, width: 0.18, lean: 0.05, curl: 0.06, cup: 0.95, roll: 0.04, y: 0.035 },
    { count: 5, r: 0.056, length: 0.22, width: 0.23, lean: 0.2, curl: 0.14, cup: 0.9, roll: 0.14, y: 0.02 },
    { count: 6, r: 0.068, length: 0.26, width: 0.27, lean: 0.45, curl: 0.3, cup: 0.8, roll: 0.28, y: 0.0 },
    { count: 7, r: 0.08, length: 0.3, width: 0.3, lean: 0.74, curl: 0.5, cup: 0.65, roll: 0.4, y: -0.02 },
    { count: 8, r: 0.092, length: 0.33, width: 0.32, lean: 1.0, curl: 0.7, cup: 0.5, roll: 0.46, y: -0.04 },
  ];
  const rings = quality.detail > 1 ? all : [all[0], all[2], all[3], all[5]];
  const petals: BufferGeometry[] = [];
  rings.forEach((ring, ringIndex) => {
    const k = ringIndex / (rings.length - 1);
    const offset = ringIndex * 0.5 + random() * 0.3;
    for (let i = 0; i < ring.count; i++) {
      const g = surfaceGeometry({
        shape: "round",
        length: ring.length * (0.95 + random() * 0.1),
        width: ring.width * (0.95 + random() * 0.1),
        lean: ring.lean + (random() - 0.5) * 0.08,
        curl: ring.curl,
        cup: ring.cup,
        tipRoll: ring.roll,
        ruffle: 0.01 * k,
        segU: quality.petalSegU,
        segV: quality.petalSegV + (k < 0.5 ? 2 : 0),
        base: palette.core && k < 0.5 ? palette.core : palette.base,
        mid: palette.core && k < 0.3 ? palette.core : palette.mid,
        tip: palette.tip,
        edge: palette.edge,
        seed: i + ringIndex * 10,
      });
      around(g, ((i + offset) / ring.count) * Math.PI * 2, ring.r, ring.y);
      petals.push(g);
    }
  });

  const green: BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const g = surfaceGeometry({
      shape: "pointed",
      length: 0.2,
      width: 0.065,
      lean: 1.75,
      curl: 0.55,
      cup: 0.3,
      segU: 6,
      segV: 3,
      base: "#4f6b45",
      mid: "#5f7d52",
      tip: "#6d8a5c",
    });
    around(g, (i / 5) * Math.PI * 2 + 0.3, 0.035, -0.08);
    green.push(g);
  }
  const hip = paint(new SphereGeometry(0.075, 12, 8), "#587650");
  hip.scale(1, 0.85, 1).translate(0, -0.1, 0);
  green.push(hip);

  return { petals: merge(petals), green: merge(green), radius: 0.34 };
}

// ---------------------------------------------------------------------
export function lily(palette: Palette, quality: Quality, seed = 2): FlowerParts {
  const random = rng(seed);
  const petals: BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const outer = i % 2 === 0;
    const g = surfaceGeometry({
      shape: "pointed",
      length: outer ? 0.6 : 0.56,
      width: outer ? 0.19 : 0.23,
      lean: 0.55 + random() * 0.08,
      curl: 1.55 + random() * 0.25,
      cup: outer ? 0.5 : 0.7,
      twist: (random() - 0.5) * 0.5,
      ruffle: outer ? 0.03 : 0.07,
      segU: quality.petalSegU + 2,
      segV: quality.petalSegV,
      base: palette.core ?? "#c4d494",
      mid: palette.mid,
      tip: palette.tip,
      edge: palette.edge,
      seed: i + seed,
    });
    around(g, (i / 6) * Math.PI * 2, 0.02, outer ? 0 : 0.01);
    petals.push(g);
  }

  const green: BufferGeometry[] = [];
  const detail: BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const tipPoint = new Vector3(Math.cos(a) * 0.12, 0.34 + random() * 0.04, Math.sin(a) * 0.12);
    green.push(
      paint(stemGeometry([new Vector3(0, 0, 0), new Vector3(Math.cos(a) * 0.03, 0.18, Math.sin(a) * 0.03), tipPoint], 0.0055, 4, 10), "#d9e2b6")
    );
    const anther = paint(new SphereGeometry(0.026, 8, 6), "#8f3d22");
    anther.scale(0.45, 1, 0.3);
    anther.rotateZ(Math.PI / 2);
    anther.rotateY(-a);
    anther.translate(tipPoint.x, tipPoint.y + 0.01, tipPoint.z);
    detail.push(anther);
  }
  green.push(paint(stemGeometry([new Vector3(0, 0, 0), new Vector3(0.01, 0.2, 0.01), new Vector3(0.02, 0.4, 0)], 0.008, 5, 10), "#cbd9a2"));
  const stigma = paint(new SphereGeometry(0.02, 8, 6), "#b8c98c");
  stigma.translate(0.02, 0.41, 0);
  green.push(stigma);

  return { petals: merge(petals), green: merge(green), detail: merge(detail), radius: 0.42 };
}

// ---------------------------------------------------------------------
export function gerbera(palette: Palette, quality: Quality, seed = 3): FlowerParts {
  const random = rng(seed);
  const petals: BufferGeometry[] = [];
  const rings = [
    { count: quality.detail > 1 ? 26 : 20, length: 0.34, width: 0.085, lean: 1.32, r: 0.105, tone: 0 },
    { count: quality.detail > 1 ? 22 : 16, length: 0.25, width: 0.065, lean: 1.12, r: 0.09, tone: 1 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const g = surfaceGeometry({
        shape: "narrow",
        length: ring.length * (0.94 + random() * 0.12),
        width: ring.width,
        lean: ring.lean + (random() - 0.5) * 0.12,
        curl: 0.22 + random() * 0.12,
        cup: 0.35,
        twist: (random() - 0.5) * 0.3,
        segU: Math.max(6, quality.petalSegU - 2),
        segV: 3,
        base: ring.tone ? palette.base : palette.mid,
        mid: palette.mid,
        tip: ring.tone ? palette.mid : palette.tip,
        edge: palette.edge,
        seed: i,
      });
      around(g, ((i + ring.tone * 0.5) / ring.count) * Math.PI * 2, ring.r, ring.tone * 0.012);
      petals.push(g);
    }
  }
  const detail: BufferGeometry[] = [];
  const disc = paint(new SphereGeometry(0.095, 16, 10), "#3d2f1b", 0.08, seed);
  disc.scale(1, 0.38, 1).translate(0, 0.018, 0);
  detail.push(disc);
  const ring = paint(new TorusGeometry(0.078, 0.014, 6, 32), "#b98a33", 0.1, seed);
  ring.rotateX(Math.PI / 2).translate(0, 0.03, 0);
  detail.push(ring);

  const green: BufferGeometry[] = [];
  const calyx = paint(new SphereGeometry(0.09, 12, 8), "#5d7a4f");
  calyx.scale(1, 0.45, 1).translate(0, -0.03, 0);
  green.push(calyx);

  return { petals: merge(petals), detail: merge(detail), green: merge(green), radius: 0.4 };
}

// ---------------------------------------------------------------------
export function tulip(palette: Palette, quality: Quality, seed = 4): FlowerParts {
  const random = rng(seed);
  const petals: BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const outer = i % 2 === 0;
    const g = surfaceGeometry({
      shape: "round",
      length: outer ? 0.44 : 0.41,
      width: outer ? 0.33 : 0.29,
      lean: outer ? 0.14 : 0.04,
      curl: -0.42 - random() * 0.1,
      cup: outer ? 1.55 : 1.75,
      tipRoll: 0.04,
      segU: quality.petalSegU,
      segV: quality.petalSegV,
      base: palette.core ?? "#d9dc9c",
      mid: palette.mid,
      tip: palette.tip,
      edge: palette.edge,
      seed: i + seed,
    });
    around(g, (i / 6) * Math.PI * 2, outer ? 0.07 : 0.045);
    petals.push(g);
  }
  return { petals: merge(petals), radius: 0.24 };
}

// ---------------------------------------------------------------------
/** Baby's breath: branching twigs carrying clouds of tiny florets. */
export function gypsophila(quality: Quality, seed = 5): FlowerParts {
  const random = rng(seed);
  const green: BufferGeometry[] = [];
  const florets: BufferGeometry[] = [];
  const twigs = quality.detail > 1 ? 9 : 6;
  for (let t = 0; t < twigs; t++) {
    const a = random() * Math.PI * 2;
    const reach = 0.18 + random() * 0.22;
    const end = new Vector3(Math.cos(a) * reach, 0.18 + random() * 0.28, Math.sin(a) * reach);
    const mid = end.clone().multiplyScalar(0.45).add(new Vector3(0, 0.06, 0));
    green.push(paint(stemGeometry([new Vector3(0, -0.05, 0), mid, end], 0.0045, 4, 8), "#7c8f67"));
    const perTwig = quality.detail > 1 ? 9 : 6;
    for (let f = 0; f < perTwig; f++) {
      const spread = 0.09;
      const p = end
        .clone()
        .add(new Vector3((random() - 0.5) * spread * 2, (random() - 0.3) * spread, (random() - 0.5) * spread * 2));
      const flo = paint(
        new IcosahedronGeometry(0.017 + random() * 0.012, quality.detail > 1 ? 1 : 0),
        random() > 0.8 ? "#f3dfdb" : "#fbf7ef",
        0.04,
        f + t * 13
      );
      flo.translate(p.x, p.y, p.z);
      florets.push(flo);
      if (f % 3 === 0) {
        green.push(paint(stemGeometry([end, end.clone().lerp(p, 0.5), p], 0.0025, 3, 4), "#86986f"));
      }
    }
  }
  return { petals: merge(florets), green: merge(green), radius: 0.4 };
}

// ---------------------------------------------------------------------
/** Eucalyptus sprig: a curving stem with paired round leaves. */
export function eucalyptus(quality: Quality, seed = 6): FlowerParts {
  const random = rng(seed);
  const green: BufferGeometry[] = [];
  const leaves: BufferGeometry[] = [];
  const pts = [new Vector3(0, -0.05, 0), new Vector3(0.04, 0.3, 0.02), new Vector3(0.02, 0.62, -0.03), new Vector3(-0.05, 0.9, 0)];
  green.push(paint(stemGeometry(pts, 0.009, 5, 16), "#7b8d83"));
  const pairs = quality.detail > 1 ? 7 : 5;
  for (let i = 0; i < pairs; i++) {
    const u = 0.08 + (i / pairs) * 0.86;
    const y = u * 0.9;
    const size = 0.16 - u * 0.06;
    for (const sideSign of [-1, 1]) {
      const leaf = surfaceGeometry({
        shape: "roundleaf",
        length: size,
        width: size * 0.95,
        lean: 1.05 + random() * 0.3,
        curl: 0.2,
        cup: 0.25,
        segU: 6,
        segV: 4,
        base: "#8aa196",
        mid: "#9fb4a8",
        tip: "#b3c4b9",
      });
      around(leaf, (i * 1.7 + (sideSign > 0 ? 0 : Math.PI)) % (Math.PI * 2), 0.01, y);
      leaves.push(leaf);
    }
  }
  return { petals: merge(leaves), green: merge(green), radius: 0.3 };
}

// ---------------------------------------------------------------------
/** A pair of folded rose leaves for the stem. */
export function roseLeaf(_quality: Quality, seed = 7): BufferGeometry {
  const random = rng(seed);
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const leaf = surfaceGeometry({
      shape: "leaf",
      length: 0.27 - i * 0.04,
      width: 0.15,
      lean: 0.85 + random() * 0.35,
      curl: 0.5,
      cup: -0.05,
      fold: 0.35,
      segU: 8,
      segV: 4,
      base: "#3f5d44",
      mid: "#52745a",
      tip: "#6a8b6b",
    });
    around(leaf, (i - 1) * 0.7, 0, i * 0.06);
    parts.push(leaf);
  }
  return merge(parts)!;
}

export { up };
