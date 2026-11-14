/* Lapis 3D kuih (1.14.0).
   lapis3d.svg(pose, label, bob, skin, outfit, golden) returns the same <svg class="lapis"> as lapisSVG(), so every place
   that shows a kuih (and its CSS sizes, silhouettes and animations) works unchanged. Inside it, a 3D kuih is drawn on a
   <canvas> in a <foreignObject>; until that is ready the flat drawing shows, and it stays if 3D graphics are unavailable.
   - The body is the kuih's own outline from mascot.js: round kuih are solids (spun from the outline), pastries are puffed,
     flat cakes are thick slabs. Its art, festive clothes and golden look are wrapped on as a texture.
   - Arms, legs and face use the same pose data as the drawing. Hats, held props, arrows and sparkles stay flat, on top.
   - One WebGL renderer per window draws every kuih in turn and copies each picture to its own canvas, so any number of
     kuih can be on screen. Still pictures are drawn once; only kuih that move (bob = true, a pose change, a stretch
     move) are redrawn, at most 24 times a second when idle. */
(function () {
  'use strict';
  const R = window.LapisRig, T3 = window.THREE;
  const api = { ok: () => false, svg: null, frame: () => false };
  window.lapis3d = api;
  if (!R || !T3 || !T3.SVGLoader || typeof document === 'undefined') return;

  const S = 0.05;                                   // world units per drawing unit
  const MAXW = 600, MAXH = 820;                     // largest picture drawn, in pixels (the egg dance is the biggest)
  // room at the sides of the drawing's frame for hands that reach past it (arm circles reach about 5 units out).
  // Kept small: the 3D picture lies over the page, and a wide one would cover the text next to the kuih.
  const PAD = 6;
  const padded = vb => [vb[0] - PAD, vb[1], vb[2] + 2 * PAD, vb[3]];
  const reduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  /* ---------- the shared renderer ---------- */
  let renderer = null, glOK = null, scene, camera, grad, inkMat, outlineMat, cylGeo, jointGeo, endGeo;
  function gl() {
    if (glOK !== null) return glOK;
    try {
      const c = document.createElement('canvas'); c.width = MAXW; c.height = MAXH;
      // ask quietly first: on a PC without 3D graphics the flat drawings stay, with no errors in the log
      const probe = document.createElement('canvas');
      if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) { glOK = false; return false; }
      renderer = new T3.WebGLRenderer({ canvas: c, antialias: true, alpha: true });
      renderer.setPixelRatio(1); renderer.setSize(MAXW, MAXH, false);
      renderer.outputEncoding = T3.sRGBEncoding; renderer.setClearColor(0x000000, 0); renderer.setScissorTest(true);
      c.addEventListener('webglcontextlost', e => { e.preventDefault(); lost(); });
      scene = new T3.Scene();
      camera = new T3.PerspectiveCamera(15, 1, 1, 100);
      scene.add(new T3.AmbientLight(0xffffff, 0.85));
      const sun = new T3.DirectionalLight(0xffffff, 0.8); sun.position.set(-3, 6, 7); scene.add(sun);
      const rim = new T3.DirectionalLight(0xffd6e0, 0.35); rim.position.set(5, 2, -4); scene.add(rim);
      grad = new T3.DataTexture(new Uint8Array([140, 200, 255]), 3, 1, T3.LuminanceFormat);
      grad.minFilter = grad.magFilter = T3.NearestFilter; grad.needsUpdate = true;
      const ink = new T3.Color(R.INK).convertSRGBToLinear();   // the output is sRGB, so this matches the drawing's ink
      inkMat = new T3.MeshBasicMaterial({ color: ink });
      outlineMat = new T3.MeshBasicMaterial({ color: ink, side: T3.BackSide });
      const rod = 2.25 * S;
      cylGeo = new T3.CylinderGeometry(rod, rod, 1, 10); jointGeo = new T3.SphereGeometry(rod, 10, 7); endGeo = new T3.SphereGeometry(1, 14, 10);
      glOK = true;
    } catch (e) { glOK = false; }
    return glOK;
  }
  // If the graphics card resets, every kuih goes back to its flat drawing.
  function lost() {
    glOK = false;
    ALL.forEach(v => { if (v.svg.isConnected) v.svg.classList.remove('k3on'); });
    ALL.clear();
  }
  api.ok = () => gl();

  /* ---------- body shapes, cached per kuih ---------- */
  // lathe: the outline's half-width at each height, spun round (a circle becomes a ball). torus: a ring.
  // pillow: the flat outline puffed up like pastry. Anything else is a thick slab with rounded edges.
  const SOLID = {
    onde: { t: 'lathe' }, ladoo: { t: 'lathe' }, angku: { t: 'lathe', z: 0.62 }, putu: { t: 'lathe' }, huat: { t: 'lathe' },
    pinjaram: { t: 'lathe' }, putupiring: { t: 'lathe' }, pelita: { t: 'lathe' }, celorot: { t: 'lathe' }, kapit: { t: 'lathe' },
    koci: { t: 'lathe', seg: 4 }, cincin: { t: 'torus', cy: 64, R: 24, r: 13 },
    karipap: { t: 'pillow' }, apambalik: { t: 'pillow' }, vadai: { t: 'pillow', bev: 0.25 }
  };
  // The outline as path data (circles, ellipses and rounded rectangles rewritten as arcs).
  function silPaths(sil) {
    const out = [];
    sil.replace(/<(circle|ellipse|rect|path)\b[^>]*>/g, (tag, kind) => {
      const g = n => { const m = new RegExp('\\s' + n + '="([-\\d.]+)"').exec(tag); return m ? +m[1] : 0; };
      let d;
      if (kind === 'path') { const m = /\sd="([^"]+)"/.exec(tag); d = m ? m[1] : ''; }
      else if (kind === 'rect') {
        const x = g('x'), y = g('y'), w = g('width'), h = g('height'), r = Math.min(g('rx') || g('ry'), w / 2, h / 2), a = `A${r} ${r} 0 0 1 `;
        d = `M${x + r} ${y}H${x + w - r}${a}${x + w} ${y + r}V${y + h - r}${a}${x + w - r} ${y + h}H${x + r}${a}${x} ${y + h - r}V${y + r}${a}${x + r} ${y}Z`;
      } else {
        const cx = g('cx'), cy = g('cy'), rx = kind === 'circle' ? g('r') : g('rx'), ry = kind === 'circle' ? g('r') : g('ry');
        d = `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
      }
      out.push({ d, rule: /evenodd/.test(tag) ? 'evenodd' : 'nonzero' });
      return tag;
    });
    return out;
  }
  // Half-width of the outline at each height, measured from the centre line x = 60.
  function silRows(sil) {
    const sc = 3, W = 120 * sc, H = 150 * sc, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true }); x.scale(sc, sc);   // read back on the CPU: much faster
    silPaths(sil).forEach(p => x.fill(new Path2D(p.d), p.rule));
    const px = x.getImageData(0, 0, W, H).data, rows = [];
    for (let py = 0; py < H; py += sc) {
      let mx = -1;
      for (let qx = 0; qx < W; qx++) if (px[(py * W + qx) * 4 + 3] > 127) mx = Math.max(mx, Math.abs(qx + 0.5 - 60 * sc));
      if (mx >= 0) rows.push([(py + 0.5) / sc, mx / sc]);
    }
    return rows.map((r, i) => [r[0], (rows[Math.max(0, i - 1)][1] + r[1] * 2 + rows[Math.min(rows.length - 1, i + 1)][1]) / 4]);
  }
  // Front-on projection of the art. f < 1 pulls it in a little, so the sides take the kuih's colour, not its ink edge.
  function planarUV(geo, f, cx, cy, remap) {
    const pos = geo.attributes.position, uv = [];
    for (let i = 0; i < pos.count; i++) {
      let sx = pos.getX(i) / S + 60, sy = 100 - pos.getY(i) / S;
      if (remap) [sx, sy] = remap(sx, sy); else { sx = cx + (sx - cx) * f; sy = cy + (sy - cy) * f; }
      uv.push(sx / 120, 1 - sy / 120);
    }
    geo.setAttribute('uv', new T3.Float32BufferAttribute(uv, 2));
  }
  function inflate(geo, by) {   // the ink outline of a solid: its surface pushed out along the normals
    const h = geo.clone(), p = h.attributes.position, n = h.attributes.normal;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * by, p.getY(i) + n.getY(i) * by, p.getZ(i) + n.getZ(i) * by);
    return h;
  }
  // zAt(x, y): how far the front surface stands out at that point, so the face can sit on it
  function solidBody(sid, o) {
    let geo, hull, zAt;
    if (o.t === 'torus') {
      const y = (100 - o.cy) * S, inner = o.R - o.r, outer = o.R + o.r;
      geo = new T3.TorusGeometry(o.R * S, o.r * S, 24, 64); geo.translate(0, y, 0);
      hull = new T3.TorusGeometry(o.R * S, o.r * S + 0.075, 24, 64); hull.translate(0, y, 0);
      const RR = o.R * S, rr = o.r * S;
      zAt = (x, yy) => { const dd = Math.hypot(x, yy - y) - RR; return Math.abs(dd) < rr ? Math.sqrt(rr * rr - dd * dd) : 0; };
      planarUV(geo, 1, 60, o.cy, (sx, sy) => {   // squeeze the ring's art band so neither edge smears
        const dx = sx - 60, dy = sy - o.cy, rho = Math.hypot(dx, dy) || 1, t = Math.max(0, Math.min(1, (rho - inner) / (outer - inner))), r2 = inner + 2 + t * (outer - inner - 5);
        return [60 + dx / rho * r2, o.cy + dy / rho * r2];
      });
    } else {
      const rows = silRows(R.KUIH[sid].sil), top = rows[0][0], bot = rows[rows.length - 1][0], k = o.seg === 4 ? Math.SQRT2 : 1;
      const pts = [new T3.Vector2(0, (100 - bot - 0.5) * S)];
      for (let i = rows.length - 1; i >= 0; i--) pts.push(new T3.Vector2(Math.max(0.002, rows[i][1] * S * k), (100 - rows[i][0]) * S));
      pts.push(new T3.Vector2(0, (100 - top + 0.5) * S));
      geo = new T3.LatheGeometry(pts, o.seg || 56, o.seg === 4 ? Math.PI / 4 : 0);
      const zs = o.z || 1;
      zAt = (x, y) => {   // radius at this height; a pyramid's front is flat
        const sy = 100 - y / S, i = Math.max(0, Math.min(rows.length - 1, Math.round(sy - top))), rad = (rows[i] ? rows[i][1] : 0) * S;
        if (Math.abs(x) >= rad) return 0;
        return (o.seg === 4 ? rad : Math.sqrt(rad * rad - x * x)) * zs;
      };
      if (o.z) geo.scale(1, 1, o.z);
      geo.computeVertexNormals();
      hull = inflate(geo, 0.075);
      if (o.seg === 4) { geo = geo.toNonIndexed(); geo.computeVertexNormals(); }   // flat pyramid faces
      planarUV(geo, 0.92, 60, (top + bot) / 2);
    }
    return { geo, hull, zAt };
  }
  function slabBody(sid, o) {
    const K = R.KUIH[sid], paths = silPaths(K.sil).map(p => `<path d="${p.d}"${p.rule === 'evenodd' ? ' fill-rule="evenodd"' : ''}/>`).join('');
    const data = new T3.SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150">${paths}</svg>`);
    const flip = list => {   // to world units, dropping repeated points (a circle's start and end coincide) so the bevel can't spike
      const out = [];
      list.forEach(p => { const v = new T3.Vector2((p.x - 60) * S, (100 - p.y) * S), l = out[out.length - 1]; if (!l || v.distanceTo(l) > 0.004) out.push(v); });
      if (out.length > 2 && out[0].distanceTo(out[out.length - 1]) < 0.004) out.pop();
      return out;
    };
    const shapes = []; let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, holes = false;
    data.paths.forEach(path => T3.SVGLoader.createShapes(path).forEach(sh => {
      const ex = sh.extractPoints(18), outer = flip(ex.shape), shp = new T3.Shape(outer);
      ex.holes.forEach(h => { shp.holes.push(new T3.Path(flip(h))); holes = true; });
      outer.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
      shapes.push(shp);
    }));
    const m = Math.min(maxX - minX, maxY - minY), round = /^<(circle|ellipse)/.test(K.sil) || /^[^<]*<circle/.test(K.sil);
    let bev = holes ? m * 0.05 : (round ? m * 0.17 : Math.min(0.2, m * 0.1)), bevT = bev, dep = round ? m * 0.32 : 0.8;
    if (o && o.t === 'pillow') { bev = o.bev || m * 0.07; bevT = m * 0.22; dep = 0.1; }   // thick, with a small inset so sharp corners don't pinch
    const make = grow => {
      const g = new T3.ExtrudeGeometry(shapes, { depth: dep + 2 * grow, bevelEnabled: true, bevelThickness: bevT, bevelSize: bev, bevelOffset: -bev + grow, bevelSegments: 7, curveSegments: 16 });
      g.translate(0, 0, -(dep + 2 * grow) / 2);
      return g;
    };
    const geo = make(0);
    planarUV(geo, holes ? 0.97 : 0.93, (minX + maxX) / 2 / S + 60, 100 - (minY + maxY) / 2 / S);
    return { geo, hull: make(0.075) };
  }
  const SHAPES = {};
  function shape(sid) {
    if (SHAPES[sid]) return SHAPES[sid];
    const o = SOLID[sid], b = o && o.t !== 'pillow' ? solidBody(sid, o) : slabBody(sid, o);
    b.geo.computeBoundingBox();
    // the face sits on a patch that hugs the front of the body
    const K = R.KUIH[sid], cy = 2 - (K.faceDy || 0) * S, pg = new T3.PlaneGeometry(60 * S, 60 * S, 14, 14), pp = pg.attributes.position;
    // round bodies: follow the surface; slabs and pastries have a flat front
    const flatZ = b.geo.boundingBox.max.z;
    for (let i = 0; i < pp.count; i++) pp.setZ(i, (b.zAt ? Math.max(0, b.zAt(pp.getX(i), pp.getY(i) + cy)) : flatZ) + 0.012);
    pg.translate(0, cy, 0);
    return (SHAPES[sid] = { geo: b.geo, hull: b.hull, face: pg, front: b.geo.boundingBox.max.z });
  }

  /* ---------- pictures: the kuih's art as a texture, and its faces ---------- */
  function picture(svg) {
    return new Promise((ok, no) => { const img = new Image(); img.onload = () => ok(img); img.onerror = no; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  }
  const ARTS = {};
  function art(sid, outfit, golden) {
    const key = sid + '|' + (outfit || '') + '|' + (golden ? 1 : 0);
    if (!ARTS[key]) ARTS[key] = picture(R.artSVG(sid, outfit, golden, 512)).then(img => {
      const c = document.createElement('canvas'); c.width = c.height = 512; c.getContext('2d').drawImage(img, 0, 0);
      const t = new T3.CanvasTexture(c); t.encoding = T3.sRGBEncoding; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      return t;
    });
    return ARTS[key];
  }
  const FACES = {};
  function faceImg(kind, mouth) {
    const key = (kind || '') + '|' + (mouth || '');
    if (!FACES[key]) {
      FACES[key] = { img: null };
      picture(R.faceSVG(kind, mouth)).then(img => { FACES[key].img = img; ALL.forEach(v => { v.dirty = true; }); wake(); }, () => {});
    }
    return FACES[key].img;
  }

  /* ---------- a kuih character, one per kuih + outfit + golden look, shared by all its pictures ---------- */
  function limb(foot) {
    const g = new T3.Group(), segs = [], joints = [], end = new T3.Mesh(endGeo, inkMat);
    for (let j = 0; j < 2; j++) { const m = new T3.Mesh(cylGeo, inkMat); g.add(m); segs.push(m); }
    for (let j = 0; j < 3; j++) { const m = new T3.Mesh(jointGeo, inkMat); g.add(m); joints.push(m); }
    if (foot) end.scale.set(8 * S, 4.5 * S, 6 * S); else end.scale.setScalar(4.6 * S);
    g.add(end);
    return { g, segs, joints, end, foot };
  }
  // Artwork loads in the background straight away; the 3D shape is built later, one kuih per frame (see loop).
  const CHARS = {};
  function character(sid, outfit, golden) {
    const key = sid + '|' + (outfit || '') + '|' + (golden ? 1 : 0);
    if (!CHARS[key]) {
      const c = CHARS[key] = { key, sid, ready: false };
      art(sid, outfit, golden).then(tex => { c.tex = tex; wake(); }, () => { c.failed = true; });
    }
    return CHARS[key];
  }
  function build(c) {
    const sid = c.sid, tex = c.tex, sh = shape(sid);
    c.root = new T3.Group(); c.body = new T3.Group(); c.squash = new T3.Group();
    c.body.matrixAutoUpdate = false;
    c.root.add(c.body); c.body.add(c.squash);
    c.squash.add(new T3.Mesh(sh.geo, new T3.MeshToonMaterial({ map: tex, gradientMap: grad })));
    c.squash.add(new T3.Mesh(sh.hull, outlineMat));
    c.fc = document.createElement('canvas'); c.fc.width = c.fc.height = 256; c.fx = c.fc.getContext('2d');
    c.ftex = new T3.CanvasTexture(c.fc); c.ftex.encoding = T3.sRGBEncoding; c.shown = '';
    c.squash.add(new T3.Mesh(sh.face, new T3.MeshBasicMaterial({ map: c.ftex, transparent: true, depthWrite: false })));
    c.arms = [limb(false), limb(false)]; c.legs = [limb(true), limb(true)];
    c.arms.forEach(l => c.body.add(l.g)); c.legs.forEach(l => c.root.add(l.g));
    c.front = sh.front; c.d = (R.KUIH[sid].half || 28) - 28;
    c.root.visible = false; scene.add(c.root);
    c.ready = true;
  }

  /* ---------- poses ---------- */
  const N = 41;   // arms 2x3 points x (x, y, z), legs the same, then the body: translate x, y, rotation, scale x, y
  const three = a => (a.length >= 3 ? a.slice(0, 3) : [a[0], [(a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2], a[1]]);
  // an SVG transform list as a matrix [a, b, c, d, e, f]
  const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  function svgMatrix(str) {
    let M = [1, 0, 0, 1, 0, 0];
    String(str || '').replace(/(translate|rotate|scale)\s*\(([^)]*)\)/g, (_, f, args) => {
      const n = args.trim().split(/[\s,]+/).map(Number);
      if (f === 'translate') M = mul(M, [1, 0, 0, 1, n[0] || 0, n[1] || 0]);
      else if (f === 'scale') M = mul(M, [n[0], 0, 0, n.length > 1 ? n[1] : n[0], 0, 0]);
      else {
        const a = (n[0] || 0) * Math.PI / 180, co = Math.cos(a), si = Math.sin(a), cx = n[1] || 0, cy = n[2] || 0;
        M = mul(mul(mul(M, [1, 0, 0, 1, cx, cy]), [co, si, -si, co, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
      }
      return '';
    });
    return M;
  }
  const TO_W = [S, 0, 0, -S, -60 * S, 100 * S], FROM_W = [1 / S, 0, 0, -1 / S, 60, 100];
  function setTarget(v, p) {
    const T = v.T, d = v.d, fz = p.front ? (v.front + 0.14) / S : 0, arms = p.arms || R.IDLE_ARMS, legs = p.legs || R.IDLE_LEGS;
    let o = 0;
    for (let l = 0; l < 2; l++) {
      const a = three(arms[l]), dx = a[0][0] < 60 ? -d : d;
      for (let q = 0; q < 3; q++) { T[o++] = a[q][0] + dx; T[o++] = a[q][1]; T[o++] = q ? fz : 0; }
    }
    for (let l = 0; l < 2; l++) { const a = three(legs[l]); for (let q = 0; q < 3; q++) { T[o++] = a[q][0]; T[o++] = a[q][1]; T[o++] = 0; } }
    const M = mul(mul(TO_W, svgMatrix(p.body)), FROM_W), sx = Math.hypot(M[0], M[1]) || 1;
    T[36] = M[4]; T[37] = M[5]; T[38] = Math.atan2(M[1], M[0]); T[39] = sx; T[40] = (M[0] * M[3] - M[1] * M[2]) / sx;
    v.face = p.face || ''; v.mouth = p.mouth || v.K.mouth;
  }

  /* ---------- drawing one picture ---------- */
  const UP = new T3.Vector3(0, 1, 0), dv = new T3.Vector3(), P = [new T3.Vector3(), new T3.Vector3(), new T3.Vector3()];
  function place(l, X, off) {
    for (let q = 0; q < 3; q++) P[q].set((X[off + q * 3] - 60) * S, (100 - X[off + q * 3 + 1]) * S, X[off + q * 3 + 2] * S);
    for (let s = 0; s < 2; s++) {
      dv.subVectors(P[s + 1], P[s]); const len = dv.length() || 0.001, m = l.segs[s];
      m.position.copy(P[s]).add(P[s + 1]).multiplyScalar(0.5); m.scale.set(1, len, 1); m.quaternion.setFromUnitVectors(UP, dv.multiplyScalar(1 / len));
    }
    for (let j = 0; j < 3; j++) l.joints[j].position.copy(P[j]);
    l.end.position.copy(P[2]); if (l.foot) l.end.position.y -= 0.1;
  }
  function drawFace(c, kind, mouth) {
    const key = (kind || '') + '|' + (mouth || '');
    if (c.shown === key) return;
    const img = faceImg(kind, mouth);
    c.fx.clearRect(0, 0, 256, 256);
    if (img) { c.fx.drawImage(img, 0, 0, 256, 256); c.shown = key; } else c.shown = '';
    c.ftex.needsUpdate = true;
  }
  function draw(v, now) {
    const c = v.ch, r = v.svg.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1), k = Math.min(r.width / v.vb[2], r.height / v.vb[3]) * dpr, vb = padded(v.vb);
    let w = Math.max(8, Math.round(vb[2] * k)), h = Math.max(8, Math.round(vb[3] * k));
    if (w > MAXW || h > MAXH) { const f = Math.min(MAXW / w, MAXH / h); w = Math.round(w * f); h = Math.round(h * f); }
    if (v.canvas.width !== w || v.canvas.height !== h) { v.canvas.width = w; v.canvas.height = h; }
    // pose the shared character as this picture
    const X = v.X, t = (now - v.t0) / 1000, live = v.live && !reduce();
    const co = Math.cos(X[38]), si = Math.sin(X[38]);
    c.body.matrix.set(co * X[39], -si * X[40], 0, X[36], si * X[39], co * X[40], 0, X[37], 0, 0, 1, 0, 0, 0, 0, 1);
    c.body.matrixWorldNeedsUpdate = true;
    const breath = live ? Math.sin(t * 1.8) * 0.01 : 0, sy = 1 + v.sq * 0.05 + breath, sw = 1 / Math.sqrt(sy);
    c.squash.scale.set(sw, sy, sw);
    const bob = live ? 0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 2.6) : 0;   // the drawing's gentle bob, every 2.6 s
    c.root.position.set(0, bob * 3 * S, 0); c.root.rotation.set(0, v.sway && live ? Math.sin(t * 0.7) * 0.16 : 0, bob * -0.026);
    place(c.arms[0], X, 0); place(c.arms[1], X, 9); place(c.legs[0], X, 18); place(c.legs[1], X, 27);
    const blink = live && !v.face && v.blinking > now;
    drawFace(c, blink ? 'closed' : v.face, v.mouth);
    // a camera that frames the drawing's viewBox exactly, so the flat layers line up
    const D = 40, cx = (vb[0] + vb[2] / 2 - 60) * S, cy = (100 - vb[1] - vb[3] / 2) * S;
    camera.fov = 2 * Math.atan(vb[3] * S / 2 / D) * 180 / Math.PI; camera.aspect = vb[2] / vb[3];
    camera.position.set(cx, cy, D); camera.lookAt(cx, cy, 0); camera.updateProjectionMatrix();
    c.root.visible = true;
    renderer.setViewport(0, 0, w, h); renderer.setScissor(0, 0, w, h); renderer.clear();
    renderer.render(scene, camera);
    c.root.visible = false;
    v.ctx.clearRect(0, 0, w, h);
    v.ctx.drawImage(renderer.domElement, 0, MAXH - h, w, h, 0, 0, w, h);
    if (!v.shown) { v.shown = true; v.fo.appendChild(v.canvas); const two = v.svg.querySelector('.k2d'); if (two) two.remove(); v.svg.classList.add('k3on'); }
    return true;
  }

  /* ---------- pictures on the page ---------- */
  const SPECS = new Map();   // what each <svg> returned by lapis3d.svg() should show, until it is on the page
  const VIEWS = new WeakMap(); // the container an <svg> sits in -> its picture, so a new pose in the same place moves smoothly
  const ALL = new Set();
  let seq = 0, raf = 0, last = 0;
  const queue = [];
  const wake = () => { if (!raf) raf = requestAnimationFrame(loop); };
  const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(es => { es.forEach(e => { const v = e.target.__k3; if (v) v.dirty = true; }); wake(); }) : null;

  function newView(svg, spec) {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%';
    const v = { svg, canvas, ctx: canvas.getContext('2d'), X: new Float32Array(N), V: new Float32Array(N), T: new Float32Array(N), sq: 0, sqv: 0, t0: performance.now(),
      blinkAt: performance.now() + 1500 + Math.random() * 3000, blinking: 0, settle: 0, last: 0, dirty: true, shown: false };
    return Object.assign(v, spec);
  }
  function hydrate(svg) {
    const spec = SPECS.get(svg.dataset.k3id);
    SPECS.delete(svg.dataset.k3id);
    svg.dataset.k3id = '';
    if (!spec || !svg.isConnected) return;
    const fo = svg.querySelector('.k3fo'), cont = svg.parentElement, ckey = spec.sid + '|' + (spec.outfit || '') + '|' + (spec.golden ? 1 : 0);
    let v = cont && VIEWS.get(cont);
    const now = performance.now();
    if (v && v.ckey === ckey && v.shown && !v.svg.isConnected && glOK) {
      // the same kuih in the same place with a new pose: keep its picture and move it there
      Object.assign(v, { svg, fo, live: spec.live, sway: spec.sway, vb: spec.vb });
      fo.appendChild(v.canvas);
      const two = svg.querySelector('.k2d'); if (two) two.remove();
      svg.classList.add('k3on');
      setTarget(v, spec.p);
      if (reduce()) v.X.set(v.T); else { v.settle = now + 1600; v.sqv = -3; }
    } else {
      v = newView(svg, Object.assign({}, spec, { fo, ckey }));
      v.front = 0; setTarget(v, spec.p); v.X.set(v.T);
    }
    v.p = spec.p; v.dirty = true;
    svg.__k3 = v;
    if (cont) VIEWS.set(cont, v);
    ALL.add(v);
    if (resized) resized.observe(svg);
  }
  function step(v, dt) {
    const X = v.X, V = v.V, T = v.T, n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for (let s = 0; s < n; s++) {
      for (let i = 0; i < N; i++) { const a = 150 * (T[i] - X[i]) - 13 * V[i]; V[i] += a * h; X[i] += V[i] * h; }
      const aq = 220 * -v.sq - 11 * v.sqv; v.sqv += aq * h; v.sq += v.sqv * h;
    }
  }
  function loop(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    let again = false;
    // bring new pictures in, a few milliseconds' worth per frame so the window stays responsive
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < 8) hydrate(queue.shift());
    if (queue.length) again = true;
    let built = 0, buildMs = 0;
    ALL.forEach(v => {
      if (!v.svg.isConnected) { ALL.delete(v); if (resized) resized.unobserve(v.svg); return; }
      if (!v.ch) {
        const c = character(v.sid, v.outfit, v.golden);
        if (!c.ready) {
          if (!c.tex) return;                                  // artwork still loading; it wakes the loop when done
          if (built > 0 && buildMs > 8) { again = true; return; }   // build at least one new kuih per frame, more if they are quick
          const b0 = performance.now(); build(c); built++; buildMs += performance.now() - b0;
        }
        v.ch = c;
        if (!v.front) { v.front = c.front; setTarget(v, v.p); if (!v.shown) v.X.set(v.T); }
      }
      const moving = v.settle > now, live = v.live && !reduce();
      if (live && now > v.blinkAt) { v.blinking = now + 130; v.blinkAt = now + 2600 + Math.random() * 2600; }
      if (moving) step(v, dt);
      if (moving || live) again = true;
      if (!v.dirty && !moving && !(live && now - v.last >= 1000 / 24)) return;
      if (draw(v, now)) { v.dirty = false; v.last = now; }
    });
    if (again) wake();
  }
  // Watch the page for new kuih pictures.
  function scan(node) {
    if (node.nodeType !== 1) return;
    if (node.matches && node.matches('svg.k3d[data-k3id]:not([data-k3id=""])')) queue.push(node);
    else if (node.querySelectorAll) node.querySelectorAll('svg.k3d[data-k3id]:not([data-k3id=""])').forEach(s => queue.push(s));
  }
  let watching = false;
  function watch() {
    if (watching || !document.body) return;
    watching = true;
    new MutationObserver(ms => { ms.forEach(m => m.addedNodes.forEach(scan)); if (queue.length) wake(); }).observe(document.body, { childList: true, subtree: true });
    scan(document.body); if (queue.length) wake();
  }

  /* ---------- what app.js calls ---------- */
  api.svg = function (pose, label, bob, skin, outfit, golden) {
    const flat = window.lapisSVG(pose, label, bob, skin, outfit, golden);
    if (!gl()) return flat;
    watch();
    const L = R.layers(pose, skin, outfit, golden), id = String(++seq), vb = L.viewBox;
    SPECS.set(id, { sid: L.sid, K: L.K, p: L.p, outfit: L.outfit, golden: L.golden, live: !!bob, sway: !L.over, vb, d: (L.K.half || 28) - 28 });
    if (SPECS.size > 400) SPECS.delete(SPECS.keys().next().value);   // pictures made but never shown
    const inner = flat.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const label2 = (/aria-label="([^"]*)"/.exec(flat) || [])[1] || '';
    return `<svg class="lapis k3d${L.golden ? ' golden' : ''}" data-k3id="${id}" viewBox="${vb.join(' ')}" role="img" aria-label="${label2}">` +
      `<g class="k3under">${L.under}</g><g class="k2d">${inner}</g><foreignObject class="k3fo" x="${vb[0] - PAD}" y="${vb[1]}" width="${vb[2] + 2 * PAD}" height="${vb[3]}"></foreignObject>` +
      `<g class="k3over">${L.over}</g></svg>`;
  };
  // A stretch move on the reminder card: pose the picture already in `el` frame by frame. False if `el` has no 3D kuih.
  api.frame = function (el, pose) {
    const svg = el && el.querySelector('svg.k3d');
    if (!svg) return false;
    const v = svg.__k3;
    if (v && v.ch) {
      setTarget(v, R.resolve(pose, v.sid)); v.X.set(v.T); v.dirty = true; wake();
      // the flat layer (hat, arrows) moves with the body, as in the drawing
      const over = svg.querySelector('.k3over'), L = R.layers(pose, v.sid, v.outfit, v.golden);
      if (over && over.__html !== L.over) { over.innerHTML = L.over; over.__html = L.over; }
    }
    return true;
  };
})();
