// One shared WebGL renderer for every atelier scene on the page.
//
// The canvas is fixed behind the page content. Each 3D section contains a
// "scene box" element; the camera's view offset is computed so the
// sculpture is framed inside whichever box is on screen — the bouquet
// therefore scrolls with its box like any DOM element, is occluded by the
// opaque sections around it, and matches its pre-rendered poster exactly
// (the poster is a render of the same box framing).
//
// Rendering runs only while a box is on screen and the document is
// visible; otherwise the loop stops completely.
import {
  CanvasTexture,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { applyPose, blendPose, buildBouquet, type Bouquet } from "./bouquet";

export type Tier = "high" | "mid";
export type Phase = "hero" | "inside" | "final";

export type StageOptions = {
  container: HTMLElement;
  tier: Tier;
  onReady: () => void;
  onFail: (reason: string) => void;
};

export type Stage = {
  dispose: () => void;
  capture?: (phase: Phase, pad: number, pixelRatio: number, progress?: number) => string;
  /** Development only: draw one frame synchronously (automation tabs can
   *  report document.hidden, which pauses requestAnimationFrame). */
  renderNow?: (timeSeconds?: number) => void;
  /** Development only: show only the focal rose (true) or everything. */
  solo?: (on: boolean) => void;
};

type Box = { el: HTMLElement; section: HTMLElement; phase: Phase };

const FOV = 28;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function radialTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(60,42,30,0.55)");
  g.addColorStop(0.45, "rgba(60,42,30,0.22)");
  g.addColorStop(1, "rgba(60,42,30,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export async function createStage(options: StageOptions): Promise<Stage> {
  const { container, tier } = options;
  const high = tier === "high";

  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: high ? "high-performance" : "default",
    preserveDrawingBuffer: false,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = high;
  renderer.shadowMap.type = PCFShadowMap;
  let dprCap = high ? 1.75 : 1.5;
  let dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  renderer.setPixelRatio(dpr);
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("role", "presentation");
  canvas.className = "atelier-canvas";
  container.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 60);

  // Morning-light rig: warm key from the upper left, rosy fill, a soft rim
  // from behind that makes petal edges glow, and a warm ivory sky.
  scene.add(new HemisphereLight(new Color("#fff7ee"), new Color("#e8cfc2"), 1.45));
  const key = new DirectionalLight(new Color("#ffead6"), 2.3);
  key.position.set(-2.2, 7, 6.2);
  if (high) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4.5;
    key.shadow.camera.right = 4.5;
    key.shadow.camera.top = 4.5;
    key.shadow.camera.bottom = -4.5;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.025;
    key.shadow.radius = 8;
    key.shadow.blurSamples = 16;
  }
  scene.add(key);
  const fill = new DirectionalLight(new Color("#f4d6cf"), 0.75);
  fill.position.set(4.5, 2, 3.5);
  scene.add(fill);
  const rim = new DirectionalLight(new Color("#fff2e4"), 1.15);
  rim.position.set(1.5, 4.5, -5);
  scene.add(rim);

  const quality = high ? { petalSegU: 12, petalSegV: 8, detail: 2 } : { petalSegU: 8, petalSegV: 5, detail: 1 };
  const bouquet: Bouquet = await buildBouquet(quality, high);
  scene.add(bouquet.root);

  // Soft contact shadow under the bouquet (cheap, every tier) plus a real
  // shadow-catcher on capable devices.
  const blobTexture = radialTexture();
  const blobMaterial = new MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false, opacity: 0.9 });
  const blob = new Mesh(new PlaneGeometry(2.8, 1.5), blobMaterial);
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(0.05, -1.07, 0.05);
  bouquet.root.add(blob);
  let catcher: Mesh | null = null;
  if (high) {
    catcher = new Mesh(new PlaneGeometry(6, 4), new ShadowMaterial({ opacity: 0.055 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = -1.075;
    catcher.receiveShadow = true;
    bouquet.root.add(catcher);
  }
  const tableMaterial = bouquet.table.material as MeshStandardMaterial;
  tableMaterial.transparent = true;

  // Compile every shader up front without blocking the main thread
  // (KHR_parallel_shader_compile where available), so the first live frame
  // is not one long task. All conditionally visible meshes are visible here.
  bouquet.table.visible = true;
  try {
    await renderer.compileAsync(scene, camera);
  } catch {
    /* older drivers: shaders compile on first render instead */
  }

  // ---------------------------------------------------------------------
  const boxes: Box[] = [...document.querySelectorAll<HTMLElement>("[data-scene-box]")].map((el) => ({
    el,
    phase: el.dataset.sceneBox as Phase,
    section: (el.closest("[data-scene-section]") as HTMLElement) ?? el,
  }));

  let alive = true;
  let raf = 0;
  let startTime = 0;
  let lastRender = 0;
  let pointerX = 0;
  let pointerY = 0;
  let smoothX = 0;
  let smoothY = 0;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const frameTimes: number[] = [];
  let driftEnabled = true;
  let readyFired = false;
  let size = { w: 0, h: 0 };

  const focalWorld = new Vector3();
  const tmp = new Vector3();

  function resize() {
    // Sized from the fixed container (never window.innerWidth, which grows
    // with any horizontal overflow); CSS stretches the canvas to 100%.
    const w = container.clientWidth || document.documentElement.clientWidth;
    const h = container.clientHeight || window.innerHeight;
    if (w === size.w && h === size.h) return;
    size = { w, h };
    renderer.setSize(w, h, false);
  }

  function activeBox(): { box: Box; rect: DOMRect } | null {
    const vh = window.innerHeight;
    let best: { box: Box; rect: DOMRect; d: number } | null = null;
    for (const box of boxes) {
      const rect = box.el.getBoundingClientRect();
      const margin = rect.height * 0.35;
      if (rect.bottom < -margin || rect.top > vh + margin) continue;
      const d = Math.abs(rect.top + rect.height / 2 - vh / 2);
      if (!best || d < best.d) best = { box, rect, d };
    }
    return best ? { box: best.box, rect: best.rect } : null;
  }

  type Shot = { target: Vector3; dir: Vector3; height: number };

  function shotFor(phase: Phase, aspect: number, separation = 0): Shot {
    if (phase === "hero") {
      return aspect < 0.95
        ? { target: new Vector3(0.02, 0.78, 0), dir: new Vector3(0.1, 0.2, 1), height: 4.55 }
        : { target: new Vector3(0.0, 0.98, 0), dir: new Vector3(0.08, 0.2, 1), height: 3.45 };
    }
    if (phase === "inside") {
      // Front view of the bouquet easing into a view down onto the table.
      const e = smooth(0, 1, separation);
      const wide = aspect > 1.2;
      const from = wide
        ? { target: new Vector3(0, 0.62, 0), dir: new Vector3(0, 0.3, 1), height: 4.3 }
        : { target: new Vector3(0, 0.7, 0), dir: new Vector3(0, 0.28, 1), height: 5.6 };
      const to = wide
        ? { target: new Vector3(0, -1.0, -0.2), dir: new Vector3(0, 1.5, 1), height: 3.9 }
        : { target: new Vector3(0, -1.0, 0.35), dir: new Vector3(0, 2.2, 1), height: 5.0 };
      return {
        target: from.target.clone().lerp(to.target, e),
        dir: from.dir.clone().lerp(to.dir, e),
        height: from.height + (to.height - from.height) * e,
      };
    }
    bouquet.focal.getWorldPosition(focalWorld);
    return { target: focalWorld.clone().add(new Vector3(0.05, -0.12, 0)), dir: new Vector3(-0.45, 0.32, 1), height: 1.75 };
  }

  function progress(box: Box, vh: number) {
    const rect = box.section.getBoundingClientRect();
    if (box.phase === "hero") return clamp01(-rect.top / Math.max(1, rect.height));
    if (box.phase === "inside") {
      const pinned = box.section.dataset.pinned === "true" && rect.height > vh * 1.2;
      return pinned ? clamp01(-rect.top / (rect.height - vh)) : clamp01((vh - rect.top) / (rect.height + vh));
    }
    return clamp01((vh - rect.top) / (rect.height + vh));
  }

  let lastSeparation = 0;

  /** Scene pose for a phase. rest=true gives the exact poster pose. */
  function pose(phase: Phase, p: number, aspect: number, time: number, rest: boolean) {
    const root = bouquet.root;
    const drift = rest || !driftEnabled ? 0 : smooth(0, 1.6, time);
    let separation = 0;
    root.position.set(0, 0, 0);
    if (phase === "hero") {
      const e = rest ? 0 : p;
      root.rotation.set(-0.02 + (rest ? 0 : smoothY * 0.05), -0.2 + e * 0.75 + (rest ? 0 : smoothX * 0.14), 0);
      root.position.set(-e * 0.5, e * 1.1, 0);
    } else if (phase === "inside") {
      separation = rest ? 1 : smooth(0.1, 0.42, p) * (1 - smooth(0.64, 0.94, p));
      root.rotation.set(0, rest ? 0 : (-0.12 + p * 0.24) * (1 - separation), 0);
    } else {
      root.rotation.set(0.04 + (rest ? 0 : smoothY * 0.04), 0.35 + (rest ? 0 : smoothX * 0.1 + (p - 0.5) * 0.25), 0);
    }

    const wide = aspect > 1.2;
    const all = bouquet.items;
    const n = all.length;
    all.forEach((item, i) => {
      const target = wide ? item.arrangedWide : item.arrangedTall;
      const delay = (item.order / n) * 0.35;
      const t = smooth(0, 1, clamp01((separation - delay) / 0.65));
      if (t <= 0) applyPose(item.object, item.assembled);
      else blendPose(item.object, item.assembled, target, t, 0.45);
      const headTarget = wide ? item.headWide : item.headTall;
      if (item.head && item.headAssembled && headTarget) item.head.quaternion.copy(item.headAssembled).slerp(headTarget, t);
      if (item.stem?.morphTargetInfluences) item.stem.morphTargetInfluences[0] = t;
      if (item.leaf) item.leaf.mesh.position.copy(item.leaf.bent).lerp(item.leaf.straight, t);
      if (drift > 0 && t < 0.5) {
        const s = time * 0.55 + item.phase;
        item.object.rotateY(Math.sin(s) * 0.06 * drift);
        item.object.position.x += Math.sin(s * 0.8) * 0.012 * drift;
        item.object.position.z += Math.cos(s * 0.7) * 0.01 * drift;
      }
      void i;
    });
    for (const item of [bouquet.wrap, bouquet.ribbon]) {
      const target = wide ? item.arrangedWide : item.arrangedTall;
      const t = smooth(0, 1, clamp01((separation - 0.05) / 0.7));
      if (t <= 0) applyPose(item.object, item.assembled);
      else blendPose(item.object, item.assembled, target, t, 0.2);
    }
    lastSeparation = separation;
    bouquet.table.visible = separation > 0.01;
    tableMaterial.opacity = smooth(0, 0.4, separation);
    blob.visible = separation < 0.3;
    blobMaterial.opacity = 0.9 * (1 - smooth(0, 0.3, separation));
    if (catcher) catcher.visible = separation < 0.3;
  }

  function frameCamera(rect: { left: number; top: number; width: number; height: number }, phase: Phase, viewW: number, viewH: number) {
    const aspect = rect.width / Math.max(1, rect.height);
    camera.aspect = aspect;
    const shot = shotFor(phase, aspect, phase === "inside" ? lastSeparation : 0);
    const distance = shot.height / 2 / Math.tan((FOV * Math.PI) / 360);
    tmp.copy(shot.dir).normalize().multiplyScalar(distance);
    camera.position.copy(shot.target).add(tmp);
    camera.lookAt(shot.target);
    camera.setViewOffset(rect.width, rect.height, -rect.left, -rect.top, viewW, viewH);
    camera.updateProjectionMatrix();
    return aspect;
  }

  let forceVisible = false;

  function frame(now: number) {
    raf = 0;
    if (!alive) return;
    if (!startTime) startTime = now;
    const found = activeBox();
    if (!found || (document.hidden && !forceVisible)) {
      container.dataset.active = "false";
      return;
    }
    container.dataset.active = "true";

    // Throttle mid-tier devices to ~30fps while drifting.
    const minGap = high ? 0 : 30;
    if (now - lastRender < minGap) {
      schedule();
      return;
    }
    const dt = lastRender ? now - lastRender : 16;
    lastRender = now;

    smoothX += (pointerX - smoothX) * 0.06;
    smoothY += (pointerY - smoothY) * 0.06;

    const vh = size.h || window.innerHeight;
    const aspect = found.rect.width / Math.max(1, found.rect.height);
    const p = progress(found.box, vh);
    const time = (now - startTime) / 1000;
    pose(found.box.phase, p, aspect, time, false);
    bouquet.root.updateMatrixWorld(true);
    frameCamera(found.rect, found.box.phase, size.w, vh);
    // Draw only inside the box plus its poster padding — exactly the area
    // the poster covers — so the sculpture never drifts over nearby text.
    const pad = parseFloat(getComputedStyle(found.box.el).getPropertyValue("--pad")) || 0;
    const sx = found.rect.left - found.rect.width * pad;
    const sw = found.rect.width * (1 + 2 * pad);
    const sh = found.rect.height * (1 + 2 * pad);
    const sy = vh - (found.rect.bottom + found.rect.height * pad);
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);
    renderer.setScissor(sx, sy, sw, sh);
    renderer.render(scene, camera);

    if (!readyFired) {
      readyFired = true;
      options.onReady();
    }

    // Adaptive quality: sustained slow frames lower the pixel ratio, then
    // switch off the idle drift.
    frameTimes.push(dt);
    if (frameTimes.length >= 50) {
      const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      frameTimes.length = 0;
      const budget = high ? 26 : 45;
      if (avg > budget && dpr > 1) {
        dpr = Math.max(1, dpr - 0.25);
        dprCap = dpr;
        renderer.setPixelRatio(dpr);
        size = { w: 0, h: 0 };
        resize();
      } else if (avg > budget * 1.6) {
        driftEnabled = false;
      }
    }

    const settling = Math.abs(pointerX - smoothX) > 0.002 || Math.abs(pointerY - smoothY) > 0.002;
    if (driftEnabled || settling) schedule();
  }

  function schedule() {
    if (!raf && alive) raf = requestAnimationFrame(frame);
  }

  const onScroll = () => schedule();
  const onResize = () => {
    resize();
    schedule();
  };
  const onPointer = (event: PointerEvent) => {
    if (!finePointer) return;
    pointerX = (event.clientX / window.innerWidth) * 2 - 1;
    pointerY = (event.clientY / window.innerHeight) * 2 - 1;
    schedule();
  };
  const onVisibility = () => {
    if (!document.hidden) schedule();
  };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    options.onFail("webgl-context-lost");
    dispose();
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("pointermove", onPointer, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onContextLost);

  resize();
  schedule();

  function dispose() {
    if (!alive) return;
    alive = false;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pointermove", onPointer);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    for (const g of bouquet.geometries) g.dispose();
    for (const m of bouquet.materials) m.dispose();
    for (const t of bouquet.textures) t.dispose();
    blob.geometry.dispose();
    blobMaterial.dispose();
    blobTexture.dispose();
    if (catcher) {
      catcher.geometry.dispose();
      (catcher.material as ShadowMaterial).dispose();
    }
    renderer.dispose();
    canvas.remove();
  }

  const stage: Stage = { dispose };

  if (import.meta.env.DEV) {
    stage.solo = (on) => {
      const focalItem = bouquet.items.find((item) => item.object.children.includes(bouquet.focal));
      for (const item of [...bouquet.items, bouquet.wrap, bouquet.ribbon]) item.object.visible = !on || item === focalItem;
      blob.visible = !on;
      if (catcher) catcher.visible = !on;
    };
    stage.renderNow = (timeSeconds) => {
      forceVisible = true;
      lastRender = 0;
      if (timeSeconds !== undefined) startTime = performance.now() - timeSeconds * 1000;
      frame(performance.now());
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      forceVisible = false;
    };
    // Development-only: renders a box's framing (plus padding) at rest into
    // a PNG data URL, used to produce the static posters.
    stage.capture = (phase, pad, pixelRatio, progress) => {
      const box = boxes.find((b) => b.phase === phase);
      if (!box) throw new Error(`no box for ${phase}`);
      const rect = box.el.getBoundingClientRect();
      const w = Math.round(rect.width * (1 + pad * 2));
      const h = Math.round(rect.height * (1 + pad * 2));
      const aspect = rect.width / rect.height;
      pose(phase, progress ?? 0, aspect, 0, progress === undefined);
      bouquet.root.updateMatrixWorld(true);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(w, h, false);
      renderer.setScissorTest(false);
      frameCamera({ left: rect.width * pad, top: rect.height * pad, width: rect.width, height: rect.height }, phase, w, h);
      renderer.render(scene, camera);
      const url = canvas.toDataURL("image/png");
      renderer.setPixelRatio(dpr);
      size = { w: 0, h: 0 };
      resize();
      schedule();
      return url;
    };
  }

  return stage;
}
