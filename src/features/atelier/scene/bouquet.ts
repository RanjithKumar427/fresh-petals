// The hand-tied sculpture: flower items arranged on a dome, stems crossing
// at the tie point, a two-layer paper wrap, a satin ribbon and bow.
// Every item carries two poses — assembled (the bouquet) and arranged (laid
// out on the worktable) — so the "inside the bouquet" scene can separate
// and regather it by interpolation, reversibly.
import {
  BufferGeometry,
  CanvasTexture,
  DataTexture,
  Euler,
  SRGBColorSpace,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  Color,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { rng, stemGeometry, surfaceGeometry } from "./geometry";
import { eucalyptus, gerbera, gypsophila, lily, rose, roseLeaf, tulip, type FlowerParts, type Palette, type Quality } from "./flowers";

export type Pose = { position: Vector3; quaternion: Quaternion; scale: number };

export type BouquetItem = {
  kind: string;
  object: Object3D;
  /** Flower head (bends on its "neck" to face up when laid on the table). */
  head?: Object3D;
  headAssembled?: Quaternion;
  headWide?: Quaternion;
  headTall?: Quaternion;
  /** Stem mesh with a "straight" morph target used when laid out. */
  stem?: Mesh;
  leaf?: { mesh: Object3D; bent: Vector3; straight: Vector3 };
  focal?: boolean;
  scaleHint?: number;
  stemLength?: number;
  assembled: Pose;
  /** Arranged poses for wide (row) and tall (grid) frames. */
  arrangedWide: Pose;
  arrangedTall: Pose;
  phase: number;
  order: number;
};

export type Bouquet = {
  root: Group;
  items: BouquetItem[];
  wrap: BouquetItem;
  ribbon: BouquetItem;
  table: Mesh;
  focal: Object3D;
  materials: Material[];
  geometries: BufferGeometry[];
  textures: (DataTexture | CanvasTexture)[];
};

const PALETTES: Record<string, Palette> = {
  roseDeep: { base: "#6f2433", core: "#5d1b2a", mid: "#9a3b4a", tip: "#b8545f", edge: "#85303f" },
  roseDusty: { base: "#b77670", core: "#a1605c", mid: "#d9a39c", tip: "#efc9c1", edge: "#cc8f88" },
  roseBlush: { base: "#dcb9a6", core: "#d2a792", mid: "#f1ded2", tip: "#fbf1e8", edge: "#e8c8b8" },
  lilyWhite: { base: "#c4d494", core: "#c0d08e", mid: "#f6efe3", tip: "#fffcf6", edge: "#efe3d3" },
  lilyBlush: { base: "#c6d39a", core: "#c3cf95", mid: "#f0c3bd", tip: "#fae3dd", edge: "#eab2ab" },
  gerberaApricot: { base: "#c9774b", mid: "#e5935f", tip: "#f0ad7f", edge: "#dd8a58" },
  gerberaPeach: { base: "#dca183", mid: "#efbb9c", tip: "#f7d3bd", edge: "#e9b092" },
  tulipBlush: { base: "#d2c98c", core: "#d6d196", mid: "#eeaeaa", tip: "#f6cbc5", edge: "#e49a97" },
};

type Spec = {
  kind: "rose" | "lily" | "gerbera" | "tulip" | "gyps" | "euca";
  palette?: keyof typeof PALETTES;
  az: number; // degrees around the bouquet, 0 = facing the viewer
  el: number; // degrees above horizontal on the dome
  scale: number;
  leaf?: boolean;
  focal?: boolean;
};

// The composition: a focal deep rose, supporting roses and lilies, warm
// gerberas low at the front, tulips rising at the back, baby's breath and
// eucalyptus softening the edges.
const SPECS: Spec[] = [
  { kind: "rose", palette: "roseDeep", az: 4, el: 58, scale: 1.5, leaf: true, focal: true },
  { kind: "rose", palette: "roseDusty", az: -34, el: 40, scale: 1.35, leaf: true },
  { kind: "rose", palette: "roseBlush", az: 36, el: 42, scale: 1.35, leaf: true },
  { kind: "rose", palette: "roseBlush", az: -8, el: 84, scale: 1.25 },
  { kind: "rose", palette: "roseDusty", az: 132, el: 62, scale: 1.2 },
  { kind: "lily", palette: "lilyWhite", az: -66, el: 26, scale: 1.4 },
  { kind: "lily", palette: "lilyBlush", az: 70, el: 22, scale: 1.35 },
  { kind: "gerbera", palette: "gerberaApricot", az: 14, el: 18, scale: 1.25 },
  { kind: "gerbera", palette: "gerberaPeach", az: -24, el: 12, scale: 1.2 },
  { kind: "gerbera", palette: "gerberaApricot", az: 100, el: 44, scale: 1.1 },
  { kind: "tulip", palette: "tulipBlush", az: -52, el: 70, scale: 1.3 },
  { kind: "tulip", palette: "tulipBlush", az: 58, el: 72, scale: 1.25 },
  { kind: "tulip", palette: "tulipBlush", az: -128, el: 58, scale: 1.2 },
  { kind: "gyps", az: -98, el: 44, scale: 1.35 },
  { kind: "gyps", az: 96, el: 66, scale: 1.3 },
  { kind: "gyps", az: 176, el: 72, scale: 1.3 },
  { kind: "euca", az: 150, el: 30, scale: 1.3 },
  { kind: "euca", az: -150, el: 34, scale: 1.3 },
  { kind: "euca", az: 30, el: 86, scale: 1.1 },
];

const DOME_CENTER = new Vector3(0, 1.28, 0.08);
const DOME_RADIUS = 0.98;
const TIE = new Vector3(0, 0, 0);
const UP = new Vector3(0, 1, 0);

function grainTexture(): DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const random = rng(99);
  for (let i = 0; i < size * size; i++) {
    const v = 150 + random() * 105;
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.needsUpdate = true;
  return tex;
}

/** A sheet of paper wrapped around the stems: full at the tie, opening
 *  toward the front as it rises, with a scalloped, softly folded edge. */
function wrapSheet(opts: {
  height: number;
  baseRadius: number;
  topRadius: number;
  openFront: number;
  scallop: number;
  folds: number;
  y0: number;
  segS?: number;
  segH?: number;
  down?: boolean;
}): BufferGeometry {
  const segS = opts.segS ?? 64;
  const segH = opts.segH ?? 18;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segH; i++) {
    const h = i / segH;
    const span = Math.PI * 2 * (1 - opts.openFront * smooth(0.42, 0.96, h));
    for (let j = 0; j <= segS; j++) {
      const s = j / segS;
      const theta = Math.PI + (s - 0.5) * span;
      const fold = 1 + opts.folds * Math.sin(theta * 7 + h * 2.3) * (0.3 + h);
      const r = (opts.baseRadius + (opts.topRadius - opts.baseRadius) * Math.pow(h, opts.down ? 1 : 1.25)) * fold;
      let y = opts.y0 + (opts.down ? -1 : 1) * h * opts.height;
      y += opts.scallop * Math.sin(theta * 5 + 0.8) * smooth(0.82, 1, h);
      positions.push(Math.sin(theta) * r, y, Math.cos(theta) * r);
    }
  }
  const row = segS + 1;
  for (let i = 0; i < segH; i++) {
    for (let j = 0; j < segS; j++) {
      const a = i * row + j;
      indices.push(a, a + row, a + 1, a + row, a + row + 1, a + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  // Planar-ish UVs for the grain texture.
  const uvs: number[] = [];
  for (let i = 0; i <= segH; i++) for (let j = 0; j <= segS; j++) uvs.push(j / segS, i / segH);
  g.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function pose(position: Vector3, quaternion: Quaternion, scale = 1): Pose {
  return { position, quaternion, scale };
}

/** Lets the browser handle input/paint between flowers so the build never
 *  becomes one long main-thread task. */
const yieldToMain = () =>
  new Promise<void>((resolve) => {
    const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
    if (scheduler?.yield) scheduler.yield().then(resolve);
    else setTimeout(resolve, 0);
  });

export async function buildBouquet(quality: Quality, highQuality: boolean): Promise<Bouquet> {
  const random = rng(20261001);
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const petalMaterial = highQuality
    ? new MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.58,
        metalness: 0,
        sheen: 0.65,
        sheenRoughness: 0.55,
        sheenColor: new Color("#fff1ea"),
        side: DoubleSide,
      })
    : new MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, side: DoubleSide });
  const greenMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0, side: DoubleSide });
  const detailMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
  const stemMaterial = new MeshStandardMaterial({ color: new Color("#5b7a51"), roughness: 0.55, metalness: 0 });
  const grain = grainTexture();
  const paperMaterial = new MeshStandardMaterial({
    color: new Color("#e2b0a8"),
    roughness: 0.94,
    metalness: 0,
    side: DoubleSide,
    bumpMap: grain,
    bumpScale: 0.35,
  });
  const tissueMaterial = new MeshStandardMaterial({
    color: new Color("#f6efe4"),
    roughness: 0.9,
    metalness: 0,
    side: DoubleSide,
    bumpMap: grain,
    bumpScale: 0.25,
  });
  const ribbonMaterial = new MeshStandardMaterial({ color: new Color("#7c243e"), roughness: 0.38, metalness: 0.05, side: DoubleSide });
  const tableMaterial = new MeshStandardMaterial({ color: new Color("#fbf9f4"), roughness: 0.96, metalness: 0, bumpMap: grain, bumpScale: 0.1 });
  materials.push(petalMaterial, greenMaterial, detailMaterial, stemMaterial, paperMaterial, tissueMaterial, ribbonMaterial, tableMaterial);

  const root = new Group();
  root.name = "bouquet";

  const leafGeometry = roseLeaf(quality);
  geometries.push(leafGeometry);

  const items: BouquetItem[] = [];
  let focal: Object3D = root;

  for (let index = 0; index < SPECS.length; index++) {
    const spec = SPECS[index];
    await yieldToMain();
    const parts: FlowerParts =
      spec.kind === "rose"
        ? rose(PALETTES[spec.palette!], quality, index + 11)
        : spec.kind === "lily"
          ? lily(PALETTES[spec.palette!], quality, index + 21)
          : spec.kind === "gerbera"
            ? gerbera(PALETTES[spec.palette!], quality, index + 31)
            : spec.kind === "tulip"
              ? tulip(PALETTES[spec.palette!], quality, index + 41)
              : spec.kind === "gyps"
                ? gypsophila(quality, index + 51)
                : eucalyptus(quality, index + 61);

    const group = new Group();
    group.name = `${spec.kind}-${index}`;
    const head = new Group();
    head.scale.setScalar(spec.scale);
    group.add(head);
    for (const [geometry, material] of [
      [parts.petals, spec.kind === "euca" ? greenMaterial : petalMaterial],
      [parts.green, greenMaterial],
      [parts.detail, detailMaterial],
    ] as const) {
      if (!geometry) continue;
      geometries.push(geometry);
      const mesh = new Mesh(geometry, material);
      mesh.castShadow = highQuality;
      head.add(mesh);
    }

    // Assembled placement on the dome.
    const az = (spec.az * Math.PI) / 180;
    const el = (spec.el * Math.PI) / 180;
    const dir = new Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    const headPos = DOME_CENTER.clone().addScaledVector(dir, DOME_RADIUS);
    const axis = headPos.clone().sub(TIE).normalize();
    // Heads lean a little further out than the stem line, like a real dome.
    const faceAxis = axis.clone().lerp(dir, 0.45).normalize();

    // Stem: from the head down to the tie, then gathered with the others
    // and running downward in a tight bundle (hand-tied), built in the
    // item's local frame so it travels with the head when separated.
    const qItem = new Quaternion().setFromUnitVectors(UP, faceAxis);
    const qInv = qItem.clone().invert();
    const tieLocal = TIE.clone().sub(headPos).applyQuaternion(qInv);
    const down = new Vector3(dir.x * 0.1 + (random() - 0.5) * 0.04, -1, dir.z * 0.1 + (random() - 0.5) * 0.04)
      .normalize()
      .multiplyScalar(1.12);
    const endLocal = TIE.clone().add(down).sub(headPos).applyQuaternion(qInv);
    const midLocal = new Vector3(0, -0.05, 0).lerp(tieLocal, 0.55);
    const stem = stemGeometry(
      [new Vector3(0, -0.04, 0), midLocal, tieLocal, tieLocal.clone().lerp(endLocal, 0.5), endLocal],
      spec.kind === "gyps" || spec.kind === "euca" ? 0.011 : 0.017,
      6,
      18
    );
    // Straight version of the same stem (identical topology) as a morph
    // target: stems straighten as they are laid out on the table.
    const bentPoints = [new Vector3(0, -0.04, 0), midLocal, tieLocal, tieLocal.clone().lerp(endLocal, 0.5), endLocal];
    let stemLength = 0;
    for (let i = 1; i < bentPoints.length; i++) stemLength += bentPoints[i].distanceTo(bentPoints[i - 1]);
    const straight = stemGeometry(
      [0, 0.25, 0.5, 0.75, 1].map((t) => new Vector3(0, -0.04 - stemLength * t, 0)),
      spec.kind === "gyps" || spec.kind === "euca" ? 0.011 : 0.017,
      6,
      18
    );
    stem.morphAttributes.position = [straight.getAttribute("position")];
    stem.morphAttributes.normal = [straight.getAttribute("normal")];
    geometries.push(stem);
    const stemMesh = new Mesh(stem, stemMaterial);
    stemMesh.castShadow = highQuality;
    stemMesh.updateMorphTargets();
    group.add(stemMesh);

    let leaf: BouquetItem["leaf"];
    if (spec.leaf) {
      const leafMesh = new Mesh(leafGeometry, greenMaterial);
      const along = 0.35 + random() * 0.15;
      const bentPos = new Vector3(0, -0.05, 0).lerp(tieLocal, along);
      leafMesh.position.copy(bentPos);
      leafMesh.rotation.y = random() * Math.PI * 2;
      leafMesh.scale.setScalar(1.1);
      leafMesh.castShadow = highQuality;
      group.add(leafMesh);
      leaf = { mesh: leafMesh, bent: bentPos, straight: new Vector3(0, -0.05 - bentPos.length(), 0) };
    }

    // Spin is applied to the head only, so the stem geometry stays aligned.
    head.rotation.y = random() * Math.PI * 2;
    const qAssembled = qItem;

    const item: BouquetItem = {
      kind: spec.kind,
      object: group,
      head,
      headAssembled: head.quaternion.clone(),
      stem: stemMesh,
      leaf,
      focal: spec.focal,
      scaleHint: spec.scale,
      stemLength,
      assembled: pose(headPos, qAssembled, 1),
      arrangedWide: pose(new Vector3(), new Quaternion(), 1),
      arrangedTall: pose(new Vector3(), new Quaternion(), 1),
      phase: random() * Math.PI * 2,
      order: index,
    };
    items.push(item);
    root.add(group);
    if (spec.focal) focal = head;
  }

  // Worktable layouts: the florist's fan. Stems lie flat on the table and
  // converge toward the viewer; heads bend up on their necks to face the
  // camera. The focal rose sits at the centre, fillers at the edges.
  const fanRank = (item: BouquetItem) =>
    item.focal ? 0 : ["rose", "gerbera", "lily", "tulip", "gyps", "euca"].indexOf(item.kind) + 1;
  const sorted = [...items].sort((a, b) => fanRank(a) - fanRank(b) || a.order - b.order);
  const n = sorted.length;
  // Centre-out slot order: 0 -> middle, then alternating left/right.
  const slots: number[] = [];
  const middle = Math.floor(n / 2);
  for (let k = 0; slots.length < n; k++) {
    if (k === 0) slots.push(middle);
    else {
      if (middle - k >= 0) slots.push(middle - k);
      if (slots.length < n && middle + k < n) slots.push(middle + k);
    }
  }
  const faceUp = new Vector3(0, 1, 0.55).normalize();
  const layout = (spanDeg: number, origin: Vector3, reach: number, tierStep: number, scale: number) =>
    sorted.map((item, i) => {
      const slot = slots[i];
      const a = ((slot / Math.max(1, n - 1)) * 2 - 1) * ((spanDeg * Math.PI) / 180);
      // Stem lies on the paper: its end rests on the table and the head
      // rises only by the stem's gentle slope.
      const d = new Vector3(Math.sin(a), 0.06, -Math.cos(a)).normalize();
      // Every stem end meets at the fan's origin, so heads sit at their
      // own stem length (a slight rhythm added for alternate slots).
      const stemLen = (item.stemLength ?? reach) * 0.97 + (slot % 2) * tierStep * 0.25;
      const position = origin
        .clone()
        .add(new Vector3(0, 0.03, 0))
        .addScaledVector(d, stemLen);
      const q = new Quaternion().setFromUnitVectors(UP, d);
      const face = new Quaternion().setFromUnitVectors(UP, faceUp).multiply(new Quaternion().setFromAxisAngle(UP, (item.order * 1.7) % (Math.PI * 2)));
      const headLocal = q.clone().invert().multiply(face);
      return { item, pose: pose(position, q, scale), head: headLocal };
    });
  const TABLE_Y = -1.08;
  for (const entry of layout(62, new Vector3(0, TABLE_Y, 1.55), 2.3, 0.34, 0.95)) {
    entry.item.arrangedWide = entry.pose;
    entry.item.headWide = entry.head;
  }
  for (const entry of layout(40, new Vector3(0, TABLE_Y, 1.9), 3.1, 0.5, 0.98)) {
    entry.item.arrangedTall = entry.pose;
    entry.item.headTall = entry.head;
  }

  // Paper wrap: outer paper + inner tissue above the tie, a sleeve below.
  const wrapGroup = new Group();
  const outerUpper = wrapSheet({ height: 1.3, baseRadius: 0.17, topRadius: 1.28, openFront: 0.34, scallop: 0.07, folds: 0.05, y0: -0.02 });
  const tissue = wrapSheet({ height: 1.46, baseRadius: 0.16, topRadius: 1.2, openFront: 0.42, scallop: 0.1, folds: 0.07, y0: 0.0, segS: 56 });
  const sleeve = wrapSheet({ height: 1.04, baseRadius: 0.17, topRadius: 0.46, openFront: 0, scallop: 0.05, folds: 0.07, y0: -0.02, down: true, segH: 10 });
  geometries.push(outerUpper, tissue, sleeve);
  const outerMesh = new Mesh(outerUpper, paperMaterial);
  const tissueMesh = new Mesh(tissue, tissueMaterial);
  const sleeveMesh = new Mesh(sleeve, paperMaterial);
  for (const m of [outerMesh, tissueMesh, sleeveMesh]) {
    m.castShadow = highQuality;
    m.receiveShadow = highQuality;
    wrapGroup.add(m);
  }
  root.add(wrapGroup);
  const wrap: BouquetItem = {
    kind: "wrap",
    object: wrapGroup,
    assembled: pose(new Vector3(0, 0, 0), new Quaternion(), 1),
    arrangedWide: pose(new Vector3(-2.05, -1.08 + 0.38, -0.2), new Quaternion().setFromEuler(new Euler(0, 1.25, 1.52)), 0.74),
    arrangedTall: pose(new Vector3(-1.2, -1.08 + 0.36, -1.0), new Quaternion().setFromEuler(new Euler(0, 1.2, 1.52)), 0.66),
    phase: 0,
    order: 99,
  };

  // Ribbon: a band at the tie, a bow and two tails in FreshPetals maroon.
  const ribbonGroup = new Group();
  const band = new TorusGeometry(0.175, 0.03, 8, 40);
  band.scale(1, 1, 0.55);
  band.rotateX(Math.PI / 2);
  const loopL = new TorusGeometry(0.12, 0.024, 8, 28, Math.PI * 1.7);
  loopL.scale(1.25, 0.7, 0.5);
  loopL.rotateZ(Math.PI * 0.62);
  loopL.translate(-0.13, 0.04, 0.2);
  const loopR = new TorusGeometry(0.12, 0.024, 8, 28, Math.PI * 1.7);
  loopR.scale(1.25, 0.7, 0.5);
  loopR.rotateZ(-Math.PI * 0.62 + Math.PI);
  loopR.translate(0.13, 0.04, 0.2);
  const knot = new SphereGeometry(0.05, 12, 8);
  knot.scale(1, 0.8, 0.7);
  knot.translate(0, 0.01, 0.2);
  const tailL = surfaceGeometry({ shape: "ribbon", length: 0.62, width: 0.075, lean: Math.PI - 0.25, curl: 0.35, cup: 0.15, twist: 0.9, segU: 12, segV: 2, base: "#7c243e", mid: "#7c243e", tip: "#7c243e" });
  tailL.translate(-0.02, 0.0, 0.2);
  const tailR = surfaceGeometry({ shape: "ribbon", length: 0.55, width: 0.075, lean: Math.PI + 0.3, curl: -0.3, cup: 0.15, twist: -0.8, segU: 12, segV: 2, base: "#7c243e", mid: "#7c243e", tip: "#7c243e" });
  tailR.translate(0.02, 0.0, 0.2);
  const parts = [band, loopL, loopR, knot, tailL, tailR];
  for (const g of parts) {
    if (g.getAttribute("uv")) g.deleteAttribute("uv");
    if (g.getAttribute("color")) g.deleteAttribute("color");
    if (!g.index) g.setIndex([...Array(g.getAttribute("position").count).keys()]);
  }
  const ribbonGeometry = mergeGeometries(parts, false);
  ribbonGeometry.computeVertexNormals();
  parts.forEach((g) => g.dispose());
  geometries.push(ribbonGeometry);
  const ribbonMesh = new Mesh(ribbonGeometry, ribbonMaterial);
  ribbonMesh.castShadow = highQuality;
  ribbonGroup.add(ribbonMesh);
  root.add(ribbonGroup);
  const ribbon: BouquetItem = {
    kind: "ribbon",
    object: ribbonGroup,
    assembled: pose(new Vector3(0, -0.02, 0), new Quaternion(), 1),
    arrangedWide: pose(new Vector3(1.75, -1.08 + 0.05, 1.35), new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0.5)), 1.25),
    arrangedTall: pose(new Vector3(0.95, -1.08 + 0.05, 1.95), new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0.5)), 1.1),
    phase: 0,
    order: 100,
  };

  // Worktable paper, only visible while the bouquet is laid out.
  const plane = new BufferGeometry();
  const w = 7.2;
  const d = 4.6;
  plane.setAttribute("position", new Float32BufferAttribute([-w / 2, 0, -d / 2, w / 2, 0, -d / 2, w / 2, 0, d / 2, -w / 2, 0, d / 2], 3));
  plane.setAttribute("normal", new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  plane.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  plane.setIndex([0, 2, 1, 0, 3, 2]);
  geometries.push(plane);
  tableMaterial.alphaMap = featherTexture();
  tableMaterial.transparent = true;
  const table = new Mesh(plane, tableMaterial);
  table.position.set(0.1, -1.085, 0.1);
  table.rotation.y = -0.06;
  table.receiveShadow = highQuality;
  table.visible = false;
  root.add(table);

  // Put everything in its assembled pose.
  for (const item of [...items, wrap, ribbon]) applyPose(item.object, item.assembled);

  return { root, items, wrap, ribbon, table, focal, materials, geometries, textures: [grain, tableMaterial.alphaMap as CanvasTexture] };
}

/** Soft-edged alpha mask so the worktable paper has no hard edges. */
function featherTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 256, 256);
  ctx.filter = "blur(3px)";
  ctx.fillStyle = "#fff";
  ctx.fillRect(10, 10, 236, 236);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

const tmpQ = new Quaternion();
const tmpV = new Vector3();

export function applyPose(object: Object3D, p: Pose) {
  object.position.copy(p.position);
  object.quaternion.copy(p.quaternion);
  object.scale.setScalar(p.scale);
}

/** Interpolates an item between two poses with a lifted arc so items never
 *  pass through each other on the way. */
export function blendPose(object: Object3D, a: Pose, b: Pose, t: number, lift = 0.35) {
  tmpV.copy(a.position).lerp(b.position, t);
  const arc = Math.sin(t * Math.PI);
  tmpV.y += arc * lift;
  tmpV.z += arc * lift * 0.8;
  object.position.copy(tmpV);
  tmpQ.copy(a.quaternion).slerp(b.quaternion, t);
  object.quaternion.copy(tmpQ);
  object.scale.setScalar(a.scale + (b.scale - a.scale) * t);
}
