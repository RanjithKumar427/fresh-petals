// The homepage's signature scene: three photographic petals — bouquets,
// wedding garlands, pooja flowers — fanned from one base like the petals of
// a single flower. Each petal is a cupped, curled surface carrying its
// range's photograph; choosing a range (hovering or focusing its link, or
// pointing at its petal) turns that petal towards the visitor and lets the
// other two fall back. Scrolling past folds the petals together.
//
// Plain WebGL (1 or 2), no library: one shader, one shared mesh, three
// textures taken from the <img> elements the page has already loaded (no
// extra download). Rendering is on demand — only while something is moving —
// and stops when the hero is off-screen or the tab is hidden.
// Everything a customer needs is in the HTML; this canvas is decorative
// (aria-hidden) and the page works the same without it.
import { PETAL_ASPECT, PETAL_OFFSET, PETAL_SCALE, PETAL_SPREAD, petalHalfWidth, petalPhotoBox } from "../shared/petalShape";

export type PetalScene = {
  /** Emphasise one petal (0, 1, 2) or none (-1). */
  setActive(index: number): void;
  /** 0 = open, 1 = folded (scroll progress past the hero). */
  setFold(fold: number): void;
  /** Pointer position in the canvas, -1..1 each way, or null when it leaves. */
  setPointer(x: number | null, y?: number): void;
  setVisible(visible: boolean): void;
  /** Which petal is under a canvas-relative CSS pixel point (-1 for none). */
  pick(px: number, py: number): number;
  resize(): void;
  destroy(): void;
};

export type PetalSceneOptions = {
  canvas: HTMLCanvasElement;
  images: HTMLImageElement[];
  reducedMotion: boolean;
  /** "low": fewer vertices and a lower pixel ratio, for small or weak devices. */
  quality: "high" | "low";
  /** Called once, after the first frame with all textures is on screen. */
  onReady?: () => void;
  onLost?: () => void;
};

type Mat4 = Float32Array;

const VERT = `
attribute vec3 aPos; attribute vec3 aNormal; attribute vec2 aUV;
uniform mat4 uModel; uniform mat4 uViewProj; uniform vec3 uEye;
// The photograph stays upright: the petal's own (x, y) turned by its fan
// angle, then placed in the box it covers (src/shared/petalShape.ts).
uniform vec2 uTexRot; uniform vec4 uTexBox;
varying vec2 vUV; varying vec2 vTex; varying vec3 vN; varying vec3 vView;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vN = mat3(uModel) * aNormal;
  vView = uEye - world.xyz;
  vec2 q = vec2(uTexRot.x * aPos.x - uTexRot.y * aPos.y, uTexRot.y * aPos.x + uTexRot.x * aPos.y);
  // Rows are uploaded top first, so t = 0 is the top of the photograph.
  vTex = vec2(0.5 + (q.x - uTexBox.x) / uTexBox.z, 0.5 - (q.y - uTexBox.y) / uTexBox.w);
  vUV = aUV;
  gl_Position = uViewProj * world;
}`;

const FRAG = `
precision mediump float;
uniform sampler2D uTex; uniform float uEmph; uniform vec3 uLight;
varying vec2 vUV; varying vec2 vTex; varying vec3 vN; varying vec3 vView;
void main() {
  vec3 n = normalize(vN);
  vec3 base;
  if (gl_FrontFacing) { base = texture2D(uTex, vTex).rgb; } else { n = -n; base = vec3(0.94, 0.87, 0.86); }
  float lum = dot(base, vec3(0.299, 0.587, 0.114));
  base = mix(vec3(lum), base, mix(0.72, 1.0, uEmph));
  float diff = max(dot(n, uLight), 0.0);
  vec3 col = base * (0.74 + 0.34 * diff) * mix(0.86, 1.0, uEmph);
  float s = abs(vUV.x * 2.0 - 1.0);
  col *= mix(1.0, 0.86, smoothstep(0.55, 1.0, s));
  col += vec3(1.0, 0.95, 0.92) * smoothstep(0.86, 1.0, s) * 0.10;
  col *= mix(0.8, 1.0, smoothstep(0.0, 0.34, vUV.y));
  vec3 h = normalize(uLight + normalize(vView));
  col += vec3(1.0, 0.97, 0.94) * pow(max(dot(n, h), 0.0), 42.0) * 0.09;
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------- matrices
const identity = (): Mat4 => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function mul(a: Mat4, b: Mat4): Mat4 {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
function perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2);
  const o = new Float32Array(16);
  o[0] = f / aspect; o[5] = f; o[10] = (far + near) / (near - far); o[11] = -1; o[14] = (2 * far * near) / (near - far);
  return o;
}
function lookAt(eye: number[], target: number[]): Mat4 {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = zz, xy = 0, xz = -zx; // up × z with up = (0,1,0)
  l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1]);
}
function model(theta: number, phi: number, scale: number, dz: number, dx = 0): Mat4 {
  const c = Math.cos(theta), s = Math.sin(theta), cp = Math.cos(phi), sp = Math.sin(phi);
  // Rz(theta) · Rx(phi) · S(scale), then moved sideways (dx) and towards the viewer (dz).
  return new Float32Array([
    c * scale, s * scale, 0, 0,
    -s * cp * scale, c * cp * scale, sp * scale, 0,
    s * sp * scale, -c * sp * scale, cp * scale, 0,
    dx, 0, dz, 1,
  ]);
}
function project(m: Mat4, x: number, y: number, z: number): [number, number, number] {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w];
}

// ---------------------------------------------------------------- geometry
const W = PETAL_ASPECT / 2; // half the bounding width for a height of 1
function surface(u: number, v: number): [number, number, number] {
  const s = 2 * u - 1;
  const hw = petalHalfWidth(v) * W;
  const z = 0.55 * hw * s * s + 0.05 * Math.sin(Math.PI * v) - 0.08 * Math.pow(Math.max(0, v - 0.68) / 0.32, 2);
  return [s * hw, v, z];
}

function buildMesh(nu: number, nv: number) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const e = 1e-3;
  for (let j = 0; j <= nv; j++) {
    // Denser towards the base, where the outline changes fastest.
    const v = Math.pow(j / nv, 1.15);
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const p = surface(u, v);
      const du = surface(Math.min(1, u + e), v), du0 = surface(Math.max(0, u - e), v);
      const dv = surface(u, Math.min(1, v + e)), dv0 = surface(u, Math.max(0, v - e));
      const tx = [du[0] - du0[0], du[1] - du0[1], du[2] - du0[2]];
      const ty = [dv[0] - dv0[0], dv[1] - dv0[1], dv[2] - dv0[2]];
      let n = [tx[1] * ty[2] - tx[2] * ty[1], tx[2] * ty[0] - tx[0] * ty[2], tx[0] * ty[1] - tx[1] * ty[0]];
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      n = n.map((c) => c / l);
      if (n[2] < 0) n = n.map((c) => -c);
      pos.push(...p); nor.push(...n); uv.push(u, v);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  return { nu, nv, pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idx: new Uint16Array(idx) };
}

// ---------------------------------------------------------------- the scene
const FOV = (28 * Math.PI) / 180;
const SPREAD = PETAL_SPREAD;
const LIGHT = (() => { const l = [-0.45, 0.62, 0.64]; const n = Math.hypot(...l); return new Float32Array(l.map((c) => c / n)); })();

type PetalState = { emph: number; phi: number; scale: number; dz: number };

// Yields to the browser between setup steps, so no single task is long.
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export async function createPetalScene(options: PetalSceneOptions): Promise<PetalScene | null> {
  const { canvas, images, reducedMotion, quality } = options;
  const attrs: WebGLContextAttributes = { alpha: true, antialias: true, premultipliedAlpha: true, depth: true, powerPreference: "low-power", preserveDrawingBuffer: false };
  const context = (canvas.getContext("webgl2", attrs) || canvas.getContext("webgl", attrs)) as WebGLRenderingContext | null;
  if (!context) return null;
  const gl: WebGLRenderingContext = context;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
    return shader;
  };
  let program: WebGLProgram;
  try {
    program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  } catch {
    return null;
  }
  gl.useProgram(program);
  await nextFrame();

  const mesh = quality === "low" ? buildMesh(16, 26) : buildMesh(26, 42);
  const buffer = (data: Float32Array, name: string, size: number) => {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    return b;
  };
  const buffers = [buffer(mesh.pos, "aPos", 3), buffer(mesh.nor, "aNormal", 3), buffer(mesh.uv, "aUV", 2)];
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);

  const u = (name: string) => gl.getUniformLocation(program, name);
  const uModel = u("uModel"), uViewProj = u("uViewProj"), uEye = u("uEye"), uEmph = u("uEmph"), uLight = u("uLight"), uTex = u("uTex");
  const uTexRot = u("uTexRot"), uTexBox = u("uTexBox");
  gl.uniform3fv(uLight, LIGHT);
  gl.uniform1i(uTex, 0);

  // Textures from the page's own, already loaded photographs: decoded and
  // scaled off the main thread where the browser can, one per frame.
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  const size = quality === "low" ? 360 : 540;
  const textures: WebGLTexture[] = [];
  for (const image of images) {
    let source: TexImageSource = image;
    if (typeof createImageBitmap === "function") {
      try {
        source = await createImageBitmap(image, { resizeWidth: Math.min(size, image.naturalWidth), resizeQuality: "medium" });
      } catch {
        source = image;
      }
    }
    if (canvas.isConnected === false) return null;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
    if ("close" in source && typeof source.close === "function") source.close();
    textures.push(t);
    await nextFrame();
  }

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);

  // ---- state
  const thetas = [SPREAD, 0, -SPREAD];
  const offsets = [-PETAL_OFFSET, 0, PETAL_OFFSET];
  const photoBoxes = thetas.map((theta) => {
    const box = petalPhotoBox(theta);
    return { rot: new Float32Array([Math.cos(theta), Math.sin(theta)]), box: new Float32Array([box.ox, box.oy, box.sx, box.sy]) };
  });
  const rest = (i: number, active: number): PetalState => {
    const base = i === 1 ? PETAL_SCALE.centre : PETAL_SCALE.side;
    if (active === -1) return { emph: 1, phi: i === 1 ? -0.02 : -0.16, scale: base, dz: i === 1 ? 0.08 : 0 };
    if (active === i) return { emph: 1, phi: 0.1, scale: base * 1.06, dz: 0.22 };
    return { emph: 0, phi: -0.24, scale: base * 0.95, dz: i === 1 ? 0.04 : -0.04 };
  };
  let active = -1;
  let fold = 0;
  let foldTarget = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const petals = [0, 1, 2].map((i) => rest(i, -1));
  let visible = true;
  let raf = 0;
  let last = 0;
  let ready = false;
  let destroyed = false;
  let dpr = 1;
  let distance = 4;
  let viewProj = identity();
  const models: Mat4[] = [identity(), identity(), identity()];

  const modelFor = (i: number) => {
    const p = petals[i];
    const t = thetas[i] * (1 - 0.62 * fold);
    return model(t, p.phi - 0.32 * fold, p.scale * (1 - 0.06 * fold), p.dz, offsets[i] * (1 - 0.7 * fold));
  };

  // Fit the camera so the open fan fills the canvas: the base on the bottom
  // edge (hidden by the canvas's soft lower fade), the tips and the sides
  // inside the frame, whichever limit the canvas's shape makes tighter.
  let targetY = 0.56;
  function fit(aspect: number) {
    const points: number[][] = [];
    // The open fan at rest fills the stage; the canvas is larger than the
    // stage (PetalHero.astro), so a petal turned forward has room to grow.
    for (let i = 0; i < 3; i++) for (const state of [rest(i, -1)]) {
      const m = model(thetas[i], state.phi, state.scale, state.dz, offsets[i]);
      for (let k = 0; k <= 24; k++) for (const uu of [0, 0.5, 1]) {
        const p = surface(uu, k / 24);
        points.push(project(m, p[0], p[1], p[2]));
      }
    }
    const yMin = Math.min(...points.map((p) => p[1]));
    const yMax = Math.max(...points.map((p) => p[1]));
    const xMax = Math.max(...points.map((p) => Math.abs(p[0])));
    const top = 0.8, side = 0.84;
    // Start from the flat (orthographic) fit, then step back until the
    // perspective view of every state fits too.
    let half = Math.max((yMax - yMin) / (top + 1), xMax / (side * aspect));
    for (let n = 0; n < 40; n++) {
      const d = half / Math.tan(FOV / 2);
      const ty = yMin + half;
      const vp = mul(perspective(FOV, aspect, 0.1, 50), lookAt([0, ty, d], [0, ty, 0]));
      const ok = points.every((p) => {
        const q = project(vp, p[0], p[1], p[2]);
        return Math.abs(q[0]) <= side && q[1] <= top;
      });
      distance = d;
      targetY = ty;
      if (ok) break;
      half *= 1.03;
    }
  }

  function resize() {
    const cap = quality === "low" ? 1.25 : 2;
    dpr = Math.min(window.devicePixelRatio || 1, cap);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    fit(canvas.clientWidth / Math.max(1, canvas.clientHeight));
    wake();
  }

  function draw() {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const yaw = reducedMotion ? 0 : pointer.x * 0.09;
    const pitch = reducedMotion ? 0 : -pointer.y * 0.05;
    const target = [0, targetY, 0];
    const eye = [Math.sin(yaw) * distance, target[1] + Math.sin(pitch) * distance, Math.cos(yaw) * distance];
    viewProj = mul(perspective(FOV, aspect, 0.1, 50), lookAt(eye, target));
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(uViewProj, false, viewProj);
    gl.uniform3fv(uEye, new Float32Array(eye));
    // Back to front: the emphasised petal last.
    const order = [0, 2, 1].sort((a, b) => petals[a].dz - petals[b].dz);
    for (const i of order) {
      models[i] = modelFor(i);
      gl.uniformMatrix4fv(uModel, false, models[i]);
      gl.uniform1f(uEmph, petals[i].emph);
      gl.uniform2fv(uTexRot, photoBoxes[i].rot);
      gl.uniform4fv(uTexBox, photoBoxes[i].box);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textures[i]);
      gl.drawElements(gl.TRIANGLES, mesh.idx.length, gl.UNSIGNED_SHORT, 0);
    }
  }

  // Exponential smoothing; returns whether anything is still moving.
  function step(dt: number): boolean {
    const k = (rate: number) => (reducedMotion ? 1 : 1 - Math.exp(-dt * rate));
    let moving = false;
    const approach = (from: number, to: number, rate: number) => {
      const next = from + (to - from) * k(rate);
      if (Math.abs(to - next) > 1e-4) moving = true;
      return Math.abs(to - next) > 1e-4 ? next : to;
    };
    petals.forEach((p, i) => {
      const goal = rest(i, active);
      p.emph = approach(p.emph, goal.emph, 9);
      p.phi = approach(p.phi, goal.phi, 7);
      p.scale = approach(p.scale, goal.scale, 7);
      p.dz = approach(p.dz, goal.dz, 7);
    });
    fold = approach(fold, foldTarget, 6);
    pointer.x = approach(pointer.x, pointer.tx, 4);
    pointer.y = approach(pointer.y, pointer.ty, 4);
    return moving;
  }

  function frame(now: number) {
    raf = 0;
    if (destroyed || !visible) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    const moving = step(dt);
    draw();
    if (!ready) { ready = true; options.onReady?.(); }
    if (moving) raf = requestAnimationFrame(frame);
    else last = 0;
  }

  function wake() {
    if (!raf && visible && !destroyed) raf = requestAnimationFrame(frame);
  }

  const onLost = (event: Event) => {
    event.preventDefault();
    destroy();
    options.onLost?.();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(raf);
    canvas.removeEventListener("webglcontextlost", onLost);
    if (!gl.isContextLost()) {
      textures.forEach((t) => gl.deleteTexture(t));
      buffers.forEach((b) => gl.deleteBuffer(b));
      gl.deleteBuffer(ibo);
      gl.deleteProgram(program);
    }
  }

  // Which petal is under a point: the front-most triangle containing it.
  function pick(px: number, py: number): number {
    if (!ready) return -1;
    const x = (px / canvas.clientWidth) * 2 - 1;
    const y = 1 - (py / canvas.clientHeight) * 2;
    const stride = 2;
    let best = -1, bestZ = Infinity;
    for (let i = 0; i < 3; i++) {
      const m = mul(viewProj, models[i]);
      const { nu, nv } = mesh;
      const at = (ii: number, jj: number) => {
        const k = (jj * (nu + 1) + ii) * 3;
        return project(m, mesh.pos[k], mesh.pos[k + 1], mesh.pos[k + 2]);
      };
      for (let j = 0; j < nv; j += stride) for (let ii = 0; ii < nu; ii += stride) {
        const j2 = Math.min(nv, j + stride), i2 = Math.min(nu, ii + stride);
        const a = at(ii, j), b = at(i2, j), c = at(ii, j2), d = at(i2, j2);
        for (const [p, q, r] of [[a, b, d], [a, d, c]]) {
          const den = (q[1] - r[1]) * (p[0] - r[0]) + (r[0] - q[0]) * (p[1] - r[1]);
          if (!den) continue;
          const l1 = ((q[1] - r[1]) * (x - r[0]) + (r[0] - q[0]) * (y - r[1])) / den;
          const l2 = ((r[1] - p[1]) * (x - r[0]) + (p[0] - r[0]) * (y - r[1])) / den;
          const l3 = 1 - l1 - l2;
          if (l1 >= 0 && l2 >= 0 && l3 >= 0) {
            const z = l1 * p[2] + l2 * q[2] + l3 * r[2];
            if (z < bestZ) { bestZ = z; best = i; }
          }
        }
      }
    }
    return best;
  }

  resize();

  return {
    setActive(index) { if (index !== active) { active = index; wake(); } },
    setFold(value) {
      const next = reducedMotion ? 0 : Math.max(0, Math.min(1, value));
      if (Math.abs(next - foldTarget) > 1e-3) { foldTarget = next; wake(); }
    },
    setPointer(x, y = 0) {
      if (reducedMotion) return;
      pointer.tx = x ?? 0; pointer.ty = x === null ? 0 : y;
      wake();
    },
    setVisible(value) {
      visible = value;
      if (value) wake(); else { cancelAnimationFrame(raf); raf = 0; last = 0; }
    },
    pick,
    resize,
    destroy,
  };
}
