'use strict';
/* ============================================================
   أبطال العاصفة — العالم: التضاريس، النباتات، المباني، المواقع
   ============================================================ */

const ISLAND_R = 318;
const WATER_Y = 1.2;
const MAP_SIZE = 760;

const World = {
  seed: 1337,
  flats: [],
  pois: [],
  lobby: null,
  colliders: [],      // {x0,y0,z0,x1,y1,z1,mat}
  grid: new Map(),
  GRID: 26,
  trees: [], rocks: [], bushes: [],
  treeMeshes: [], rockMeshes: [], bushMesh: null,
  chests: [],
  minimapCanvas: null,

  /* ---------- ارتفاع التضاريس ---------- */
  base(x, z) {
    const s = this.seed;
    let h = fbm(x * 0.00385, z * 0.00385, 5, s) * 62 - 14;
    h += (fbm(x * 0.0165 + 40, z * 0.0165 - 22, 3, s + 91) - 0.45) * 15;
    h += (fbm(x * 0.062, z * 0.062, 2, s + 211) - 0.5) * 2.6;
    const d = Math.hypot(x, z);
    const fall = smoothstep(ISLAND_R + 46, ISLAND_R - 120, d);
    h = h * fall - (1 - fall) * 17;
    return h;
  },

  height(x, z) {
    let h = this.base(x, z);
    for (let i = 0; i < this.flats.length; i++) {
      const f = this.flats[i];
      const d = Math.hypot(x - f.x, z - f.z);
      const t = smoothstep(f.r * 1.75, f.r * 0.72, d);
      if (t > 0) h = h + (f.h - h) * t;
    }
    return h;
  },

  normalAt(x, z) {
    const e = 1.4;
    const hl = this.height(x - e, z), hr = this.height(x + e, z);
    const hd = this.height(x, z - e), hu = this.height(x, z + e);
    return V.norm([0, 0, 0], [-(hr - hl), 2 * e, -(hu - hd)]);
  },

  /* ---------- بناء العالم ---------- */
  init(gl, seed) {
    this.seed = seed >>> 0;
    const rng = makeRng(this.seed);
    this.flats = []; this.pois = []; this.colliders = []; this.grid.clear();
    this.trees = []; this.rocks = []; this.bushes = []; this.chests = [];

    /* --- مواقع الخريطة --- */
    const defs = [
      { n: 'قرية النخيل', x: -168, z: 118, r: 46, kind: 'village' },
      { n: 'برج الرمال', x: 176, z: -152, r: 38, kind: 'tower' },
      { n: 'بحيرة الفيروز', x: 66, z: 186, r: 52, kind: 'lake' },
      { n: 'مصنع الألوان', x: -186, z: -122, r: 44, kind: 'factory' },
      { n: 'تلّة القمر', x: 8, z: -26, r: 40, kind: 'ruins' },
      { n: 'سوق الواحة', x: 206, z: 96, r: 38, kind: 'market' },
      { n: 'مخيّم المغامرين', x: -52, z: -212, r: 34, kind: 'camp' },
      { n: 'ميناء اللؤلؤ', x: -230, z: 8, r: 34, kind: 'port' }
    ];
    for (const d of defs) {
      let h = this.base(d.x, d.z);
      if (d.kind === 'lake') h = -6;
      else if (d.kind === 'ruins') h = Math.max(h, 30);
      else if (d.kind === 'port') h = 3.2;
      else h = clamp(h, 4.5, 40);
      this.flats.push({ x: d.x, z: d.z, r: d.r, h: h });
      this.pois.push({ name: d.n, x: d.x, z: d.z, r: d.r, kind: d.kind, y: h });
    }

    /* منصّة الردهة: بقعة مستوية على حافة الجزيرة والبحر خلفها */
    {
      let bestA = 0, bestScore = -1e9, RR = 244;
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * TAU;
        const x = Math.cos(a) * RR, z = Math.sin(a) * RR;
        const h = this.base(x, z);
        let far = 1e9;
        for (const p of this.pois) far = Math.min(far, Math.hypot(x - p.x, z - p.z));
        const score = (h > 5 && h < 26 ? 14 : -40) + Math.min(far, 110) * 0.16 - Math.abs(h - 13) * 0.55;
        if (score > bestScore) { bestScore = score; bestA = a; }
      }
      const lx = Math.cos(bestA) * RR, lz = Math.sin(bestA) * RR;
      const lh = clamp(this.base(lx, lz), 7.5, 22);
      this.flats.push({ x: lx, z: lz, r: 25, h: lh });
      this.lobby = { x: lx, y: lh, z: lz, dir: [-Math.cos(bestA), 0, -Math.sin(bestA)] };
    }

    this.buildTerrain(gl);
    this.buildStructures(gl, rng);
    this.scatterNature(gl, rng);
    this.buildProps(gl);
    this.buildMinimap();
    this.rebuildInstances();
    return this;
  },

  /* --- شبكة التضاريس (شبكة ارتفاعات مخزّنة مسبقًا للسرعة) --- */
  buildTerrain(gl) {
    const N = 210, S = MAP_SIZE, step = S / N;
    const W = N + 3;                       // هامش خلية لحساب الأعراف
    const H = new Float32Array(W * W);
    for (let j = 0; j < W; j++) {
      const z = ((j - 1) / N - 0.5) * S;
      for (let i = 0; i < W; i++) {
        H[j * W + i] = this.height(((i - 1) / N - 0.5) * S, z);
      }
    }
    const pos = new Float32Array((N + 1) * (N + 1) * 3);
    const nrm = new Float32Array((N + 1) * (N + 1) * 3);
    const col = new Float32Array((N + 1) * (N + 1) * 3);
    const idx = new Uint32Array(N * N * 6);
    let v = 0;
    for (let j = 0; j <= N; j++) {
      const z = (j / N - 0.5) * S;
      for (let i = 0; i <= N; i++, v += 3) {
        const x = (i / N - 0.5) * S;
        const k = (j + 1) * W + (i + 1);
        const y = H[k];
        pos[v] = x; pos[v + 1] = y; pos[v + 2] = z;
        let nx = H[k - 1] - H[k + 1], ny = 2 * step, nz = H[k - W] - H[k + W];
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l; ny /= l; nz /= l;
        nrm[v] = nx; nrm[v + 1] = ny; nrm[v + 2] = nz;

        const slope = 1 - ny;
        const n1 = fbm(x * 0.04, z * 0.04, 2, this.seed + 7);
        let c0, c1, c2;
        if (y < WATER_Y + 1.4) { c0 = 0.88; c1 = 0.80; c2 = 0.57; }
        else if (slope > 0.44) { c0 = 0.47; c1 = 0.45; c2 = 0.44; }
        else if (y > 47) { c0 = 0.93; c1 = 0.95; c2 = 0.97; }
        else if (y > 37) { const t = smoothstep(37, 47, y); c0 = lerp(0.58, 0.90, t); c1 = lerp(0.63, 0.92, t); c2 = lerp(0.50, 0.95, t); }
        else { const t2 = fbm(x * 0.011, z * 0.011, 3, this.seed + 33);
          c0 = 0.30 + n1 * 0.14 + t2 * 0.10; c1 = 0.47 + n1 * 0.13 + t2 * 0.12; c2 = 0.23 + n1 * 0.07 + t2 * 0.05; }
        if (y >= WATER_Y + 1.4 && y < WATER_Y + 4.0 && slope < 0.42) {
          const t = smoothstep(WATER_Y + 1.4, WATER_Y + 4.0, y);
          c0 = lerp(0.88, c0, t); c1 = lerp(0.80, c1, t); c2 = lerp(0.57, c2, t);
        }
        const sh = 0.92 + n1 * 0.15;
        col[v] = c0 * sh; col[v + 1] = c1 * sh; col[v + 2] = c2 * sh;
      }
    }
    let q = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + N + 1;
      idx[q++] = a; idx[q++] = b; idx[q++] = a + 1;
      idx[q++] = a + 1; idx[q++] = b; idx[q++] = b + 1;
    }
    this.terrainMesh = new Mesh(gl, { pos, nrm, col, idx });
    this.terrainMesh.instances(1);
    const il = new InstList(this.terrainMesh);
    il.push(0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0);
    il.flush();
    this.terrainList = il;
  },

  /* --- إضافة صندوق ثابت (شبكة + مصادم) --- */
  addBox(md, x, y, z, w, h, d, ry, color, solid, jitter) {
    md.add(Geo.box(w, h, d), { x, y: y + h / 2, z, ry: ry || 0, jitter: jitter || 0 }, color);
    if (solid !== false) {
      const c = Math.abs(Math.cos(ry || 0)), s = Math.abs(Math.sin(ry || 0));
      const hx = (w * c + d * s) / 2, hz = (w * s + d * c) / 2;
      this.colliders.push({ x0: x - hx, y0: y, z0: z - hz, x1: x + hx, y1: y + h, z1: z + hz });
    }
  },

  /* --- المباني والمواقع --- */
  buildStructures(gl, rng) {
    const md = new MeshData();
    const WOOD = [0.52, 0.35, 0.21], WOOD2 = [0.62, 0.45, 0.28];
    const CREAM = [0.93, 0.88, 0.76], CLAY = [0.86, 0.68, 0.48];
    const RED = [0.76, 0.25, 0.21], BLUE = [0.22, 0.40, 0.72], TEAL = [0.16, 0.60, 0.60];
    const MET = [0.60, 0.64, 0.68], DARK = [0.30, 0.32, 0.36];
    const roofCols = [RED, BLUE, TEAL, [0.85, 0.55, 0.16], [0.45, 0.28, 0.60]];

    const house = (x, z, w, d, hgt, ry, wallC, roofC, kind) => {
      const y = this.height(x, z) - 0.4;
      const t = 0.42;
      md.add(Geo.box(w + 1.2, 0.5, d + 1.2), { x, y: y + 0.25, z, ry }, [0.70, 0.68, 0.64]);
      const cs = Math.cos(ry), sn = Math.sin(ry);
      const put = (lx, lz, lw, ld) => {
        const wx = x + lx * cs + lz * sn, wz = z - lx * sn + lz * cs;
        this.addBox(md, wx, y + 0.4, wz, lw, hgt, ld, ry, wallC, true, 0.06);
      };
      put(0, d / 2, w, t); put(0, -d / 2, w, t);
      put(w / 2, 0, t, d);
      // جدار به فتحة باب
      const dw = 2.2, side = (d - dw) / 2;
      put(-w / 2, (d - side) / 2, t, side);
      put(-w / 2, -(d - side) / 2, t, side);
      this.addBox(md, x + (-w / 2) * cs, y + 0.4 + hgt - 0.55, z - (-w / 2) * sn, t, 0.55, dw, ry, wallC, false);
      // نوافذ مضيئة
      for (let i = -1; i <= 1; i += 2) {
        const wx = x + (w / 2 + 0.06) * cs + (i * d * 0.25) * sn;
        const wz = z - (w / 2 + 0.06) * sn + (i * d * 0.25) * cs;
        md.add(Geo.box(0.14, 1.1, 1.3), { x: wx, y: y + 0.4 + hgt * 0.58, z: wz, ry }, [0.55, 0.72, 0.85]);
      }
      // السقف
      if (kind === 'flat') {
        this.addBox(md, x, y + 0.4 + hgt, z, w + 0.9, 0.4, d + 0.9, ry, roofC, true);
        for (let i = -1; i <= 1; i += 2) {
          md.add(Geo.box(w + 0.9, 0.6, 0.25), { x: x + 0, y: y + 0.4 + hgt + 0.6, z: z + i * (d / 2 + 0.3), ry }, roofC);
        }
      } else {
        // سقف جملوني: إسفينان متقابلان يرتفعان نحو منتصف البيت
        const hz = (d + 1.4) / 4;
        md.add(Geo.wedge(w + 1.4, hgt * 0.55, (d + 1.4) / 2),
          { x: x - sn * hz, y: y + 0.4 + hgt, z: z - cs * hz, ry }, roofC);
        md.add(Geo.wedge(w + 1.4, hgt * 0.55, (d + 1.4) / 2),
          { x: x + sn * hz, y: y + 0.4 + hgt, z: z + cs * hz, ry: ry + Math.PI }, roofC);
        this.colliders.push({
          x0: x - (w + 1.4) / 2, y0: y + 0.4 + hgt, z0: z - (d + 1.4) / 2,
          x1: x + (w + 1.4) / 2, y1: y + 0.4 + hgt + 0.35, z1: z + (d + 1.4) / 2
        });
      }
    };

    for (const poi of this.pois) {
      const { x, z, kind, r } = poi;
      const y0 = this.height(x, z);
      if (kind === 'village') {
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + rng() * 0.5;
          const rr = 14 + rng() * 24;
          const hx = x + Math.cos(a) * rr, hz = z + Math.sin(a) * rr;
          house(hx, hz, 8 + rng() * 4, 7 + rng() * 4, 4.2 + rng() * 2.2, a + Math.PI / 2,
            rng() < 0.5 ? CREAM : CLAY, roofCols[(i * 3) % roofCols.length], rng() < 0.35 ? 'flat' : 'gable');
        }
        // نافورة الساحة
        md.add(Geo.cylinder(5, 5.6, 1.1, 20), { x, y: y0 + 0.55, z }, [0.78, 0.76, 0.72]);
        md.add(Geo.cylinder(1.1, 1.4, 3.0, 12), { x, y: y0 + 2.2, z }, [0.86, 0.84, 0.80]);
        md.add(Geo.sphere(1.2, 12, 9), { x, y: y0 + 4.0, z }, [0.35, 0.75, 0.92]);
        this.colliders.push({ x0: x - 5.4, y0: y0, z0: z - 5.4, x1: x + 5.4, y1: y0 + 1.2, z1: z + 5.4 });
        for (let i = 0; i < 5; i++) {
          const a = rng() * TAU, rr = 8 + rng() * 30;
          this.chests.push(this.mkChest(x + Math.cos(a) * rr, z + Math.sin(a) * rr));
        }
      } else if (kind === 'tower') {
        const lvls = 6;
        for (let i = 0; i < lvls; i++) {
          const s = 13 - i * 1.35;
          this.addBox(md, x, y0 + i * 4.6, z, s, 0.5, s, 0, i % 2 ? CLAY : CREAM, true);
          for (let k = 0; k < 4; k++) {
            const a = k * Math.PI / 2;
            const px = x + Math.cos(a) * (s / 2 - 0.3), pz = z + Math.sin(a) * (s / 2 - 0.3);
            this.addBox(md, px, y0 + i * 4.6 + 0.5, pz, k % 2 ? 0.5 : s, 3.0, k % 2 ? s : 0.5, 0,
              i % 2 ? CREAM : CLAY, k !== 0, 0.05);
          }
        }
        md.add(Geo.pyramid(13, 6, 13), { x, y: y0 + lvls * 4.6, z }, RED);
        md.add(Geo.cylinder(0.12, 0.12, 6, 6), { x, y: y0 + lvls * 4.6 + 8.5, z }, DARK);
        md.add(Geo.box(2.6, 1.6, 0.1), { x: x + 1.3, y: y0 + lvls * 4.6 + 10.6, z }, [0.95, 0.35, 0.35]);
        for (let i = 0; i < 4; i++) this.chests.push(this.mkChest(x + (rng() - 0.5) * 16, z + (rng() - 0.5) * 16, y0 + Math.floor(rng() * 3) * 4.6 + 0.6));
      } else if (kind === 'lake') {
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * TAU + 0.4;
          const dx = x + Math.cos(a) * (r * 0.82), dz = z + Math.sin(a) * (r * 0.82);
          for (let k = 0; k < 7; k++) {
            const px = dx - Math.cos(a) * k * 2.4, pz = dz - Math.sin(a) * k * 2.4;
            md.add(Geo.box(3.2, 0.35, 2.6), { x: px, y: WATER_Y + 0.6, z: pz, ry: a }, WOOD2);
            md.add(Geo.cylinder(0.22, 0.22, 3.5, 6), { x: px, y: WATER_Y - 1.2, z: pz }, WOOD);
          }
          this.colliders.push({ x0: dx - 12, y0: WATER_Y + 0.4, z0: dz - 12, x1: dx + 12, y1: WATER_Y + 0.78, z1: dz + 12 });
          this.chests.push(this.mkChest(dx, dz, WATER_Y + 0.9));
        }
        for (let i = 0; i < 4; i++) {
          const a = rng() * TAU, rr = r * 1.05 + rng() * 14;
          house(x + Math.cos(a) * rr, z + Math.sin(a) * rr, 7, 7, 4, a, CREAM, TEAL, 'gable');
        }
      } else if (kind === 'factory') {
        this.addBox(md, x, y0, z, 34, 0.5, 26, 0, [0.55, 0.56, 0.58], true);
        const wh = 9;
        this.addBox(md, x, y0 + 0.5, z + 13, 34, wh, 0.6, 0, MET, true, 0.05);
        this.addBox(md, x, y0 + 0.5, z - 13, 34, wh, 0.6, 0, MET, true, 0.05);
        this.addBox(md, x + 17, y0 + 0.5, z, 0.6, wh, 26, 0, MET, true, 0.05);
        this.addBox(md, x - 17, y0 + 0.5, z + 8, 0.6, wh, 10, 0, MET, true, 0.05);
        this.addBox(md, x - 17, y0 + 0.5, z - 8, 0.6, wh, 10, 0, MET, true, 0.05);
        this.addBox(md, x, y0 + 0.5 + wh, z, 35, 0.6, 27, 0, [0.42, 0.44, 0.48], true);
        for (let i = -1; i <= 1; i++) {
          md.add(Geo.cylinder(2.0, 2.4, 12, 12), { x: x + i * 10, y: y0 + wh + 7, z: z - 6 }, [0.75, 0.75, 0.78]);
          md.add(Geo.cylinder(2.3, 2.3, 1.0, 12), { x: x + i * 10, y: y0 + wh + 13.2, z: z - 6 }, [0.90, 0.35, 0.30]);
        }
        // براميل ملونة
        for (let i = 0; i < 14; i++) {
          const px = x + (rng() - 0.5) * 30, pz = z + (rng() - 0.5) * 22;
          const c = [[0.9, 0.3, 0.3], [0.3, 0.6, 0.9], [0.95, 0.8, 0.25], [0.4, 0.8, 0.4]][Math.floor(rng() * 4)];
          md.add(Geo.cylinder(0.75, 0.75, 1.7, 10), { x: px, y: y0 + 1.35, z: pz }, c);
          this.colliders.push({ x0: px - 0.75, y0: y0 + 0.5, z0: pz - 0.75, x1: px + 0.75, y1: y0 + 2.2, z1: pz + 0.75 });
        }
        for (let i = 0; i < 5; i++) this.chests.push(this.mkChest(x + (rng() - 0.5) * 28, z + (rng() - 0.5) * 20, y0 + 0.6));
      } else if (kind === 'ruins') {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU;
          const px = x + Math.cos(a) * 17, pz = z + Math.sin(a) * 17;
          const hh = 5 + (i % 3) * 2.5;
          md.add(Geo.cylinder(1.0, 1.2, hh, 10), { x: px, y: y0 + hh / 2, z: pz }, CREAM);
          this.colliders.push({ x0: px - 1.2, y0: y0, z0: pz - 1.2, x1: px + 1.2, y1: y0 + hh, z1: pz + 1.2 });
        }
        this.addBox(md, x, y0, z, 22, 1.2, 22, 0, [0.86, 0.84, 0.78], true);
        this.addBox(md, x, y0 + 1.2, z, 12, 1.0, 12, 0, [0.90, 0.88, 0.82], true);
        md.add(Geo.sphere(2.6, 16, 12), { x, y: y0 + 5.2, z }, [0.55, 0.80, 0.95]);
        md.add(Geo.cylinder(0.9, 1.4, 2.6, 12), { x, y: y0 + 3.4, z }, [0.80, 0.78, 0.72]);
        for (let i = 0; i < 4; i++) this.chests.push(this.mkChest(x + (rng() - 0.5) * 30, z + (rng() - 0.5) * 30));
      } else if (kind === 'market') {
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU + 0.2, rr = 10 + (i % 3) * 8;
          const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
          const py = this.height(px, pz);
          for (let k = 0; k < 4; k++) {
            const cx = px + ((k & 1) ? 1.8 : -1.8), cz = pz + ((k & 2) ? 1.6 : -1.6);
            md.add(Geo.cylinder(0.13, 0.13, 2.6, 6), { x: cx, y: py + 1.3, z: cz }, WOOD);
          }
          const cc = roofCols[i % roofCols.length];
          md.add(Geo.box(4.6, 0.22, 4.0), { x: px, y: py + 2.7, z: pz }, cc);
          md.add(Geo.wedge(4.6, 0.8, 2.0), { x: px, y: py + 2.8, z: pz }, cc);
          md.add(Geo.wedge(4.6, 0.8, 2.0), { x: px, y: py + 2.8, z: pz, ry: Math.PI }, cc);
          md.add(Geo.box(4.0, 0.9, 1.4), { x: px, y: py + 0.9, z: pz }, WOOD2);
          this.colliders.push({ x0: px - 2, y0: py, z0: pz - 0.7, x1: px + 2, y1: py + 1.35, z1: pz + 0.7 });
        }
        for (let i = 0; i < 4; i++) this.chests.push(this.mkChest(x + (rng() - 0.5) * 34, z + (rng() - 0.5) * 34));
      } else if (kind === 'camp') {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU, rr = 11 + rng() * 6;
          const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr, py = this.height(px, pz);
          const cc = roofCols[i % roofCols.length];
          md.add(Geo.wedge(5, 3.4, 3), { x: px, y: py, z: pz, ry: a }, cc);
          md.add(Geo.wedge(5, 3.4, 3), { x: px, y: py, z: pz, ry: a + Math.PI }, cc);
          this.colliders.push({ x0: px - 2.4, y0: py, z0: pz - 2.4, x1: px + 2.4, y1: py + 1.6, z1: pz + 2.4 });
        }
        md.add(Geo.cylinder(2.2, 2.6, 0.5, 14), { x, y: y0 + 0.25, z }, [0.45, 0.44, 0.42]);
        for (let i = 0; i < 5; i++) {
          const a = i * 1.3;
          md.add(Geo.cylinder(0.16, 0.2, 2.2, 6), { x, y: y0 + 1.1, z, rx: 0.5, ry: a, rz: 0.35 }, WOOD);
        }
        for (let i = 0; i < 3; i++) this.chests.push(this.mkChest(x + (rng() - 0.5) * 26, z + (rng() - 0.5) * 26));
      } else if (kind === 'port') {
        for (let k = 0; k < 12; k++) {
          const px = x + 8 + k * 3.2, pz = z;
          md.add(Geo.box(4.0, 0.4, 9.0), { x: px, y: WATER_Y + 0.8, z: pz }, WOOD2);
          md.add(Geo.cylinder(0.25, 0.25, 4, 6), { x: px, y: WATER_Y - 1.2, z: pz + 4 }, WOOD);
          md.add(Geo.cylinder(0.25, 0.25, 4, 6), { x: px, y: WATER_Y - 1.2, z: pz - 4 }, WOOD);
        }
        this.colliders.push({ x0: x + 6, y0: WATER_Y + 0.6, z0: z - 4.6, x1: x + 48, y1: WATER_Y + 1.0, z1: z + 4.6 });
        for (let i = 0; i < 10; i++) {
          const px = x + (rng() - 0.5) * 26, pz = z + (rng() - 0.5) * 26, py = this.height(px, pz);
          if (py < WATER_Y) continue;
          const c = [[0.85, 0.35, 0.30], [0.30, 0.55, 0.85], [0.95, 0.78, 0.25]][Math.floor(rng() * 3)];
          this.addBox(md, px, py, pz, 2.6, 2.6, 2.6, rng() * 3, c, true, 0.08);
        }
        for (let i = 0; i < 4; i++) this.chests.push(this.mkChest(x + (rng() - 0.5) * 30, z + (rng() - 0.5) * 30));
      }
    }

    /* صناديق ومنصات متفرقة عبر الخريطة */
    for (let i = 0; i < 70; i++) {
      const a = rng() * TAU, rr = 30 + rng() * (ISLAND_R - 60);
      const px = Math.cos(a) * rr, pz = Math.sin(a) * rr;
      const py = this.height(px, pz);
      if (py < WATER_Y + 1) continue;
      const c = [[0.62, 0.44, 0.26], [0.55, 0.58, 0.62], [0.72, 0.52, 0.30]][Math.floor(rng() * 3)];
      const n = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        this.addBox(md, px + (rng() - 0.5) * 2.2, py + k * 1.7, pz + (rng() - 0.5) * 2.2,
          1.7, 1.7, 1.7, rng() * 3, c, true, 0.08);
      }
      if (rng() < 0.45) this.chests.push(this.mkChest(px + 3, pz + 2));
    }

    this.structMesh = new Mesh(gl, md);
    this.structMesh.instances(1);
    const il = new InstList(this.structMesh);
    il.push(0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0);
    il.flush();
    this.structList = il;
    this.buildGrid();
  },

  mkChest(x, z, y) {
    const yy = y !== undefined ? y : this.height(x, z);
    return { x, y: yy, z, open: false, t: Math.random() * 10, ry: Math.random() * TAU };
  },

  /* --- شبكة تسريع للمصادمات --- */
  buildGrid() {
    this.grid.clear();
    const G = this.GRID;
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      const x0 = Math.floor(c.x0 / G), x1 = Math.floor(c.x1 / G);
      const z0 = Math.floor(c.z0 / G), z1 = Math.floor(c.z1 / G);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const k = x * 100003 + z;
        let a = this.grid.get(k);
        if (!a) { a = []; this.grid.set(k, a); }
        a.push(i);
      }
    }
  },

  near(x, z, out) {
    out.length = 0;
    const G = this.GRID;
    const gx = Math.floor(x / G), gz = Math.floor(z / G);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = this.grid.get((gx + i) * 100003 + (gz + j));
      if (a) for (let k = 0; k < a.length; k++) if (out.indexOf(a[k]) < 0) out.push(a[k]);
    }
    return out;
  },

  /* --- الأشجار والصخور --- */
  scatterNature(gl, rng) {
    const treeGeos = [];
    // 0: صنوبر
    let md = new MeshData();
    md.add(Geo.cylinder(0.28, 0.46, 4.2, 8), { y: 2.1 }, [0.42, 0.29, 0.18]);
    for (let i = 0; i < 4; i++) {
      md.add(Geo.cone(2.6 - i * 0.5, 2.6, 9), { y: 3.4 + i * 1.55 }, [0.16 + i * 0.02, 0.44 + i * 0.03, 0.20]);
    }
    treeGeos.push(md);
    // 1: نخلة بسعف عريض متدلٍّ
    md = new MeshData();
    for (let i = 0; i < 7; i++) {
      md.add(Geo.cylinder(0.235, 0.30, 1.06, 8), { y: 0.53 + i * 0.98, x: Math.sin(i * 0.55) * 0.24 }, [0.50, 0.38, 0.24]);
      md.add(Geo.box(0.56, 0.09, 0.56), { y: 0.98 + i * 0.98, x: Math.sin((i + 0.5) * 0.55) * 0.24 }, [0.44, 0.33, 0.21]);
    }
    {
      const topY = 7.15, tx = Math.sin(7 * 0.55) * 0.24;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + 0.2;
        const ry = Math.PI / 2 - a;
        md.add(Geo.box(0.70, 0.10, 1.75), { x: tx + Math.cos(a) * 0.88, y: topY + 0.16, z: Math.sin(a) * 0.88, ry, rx: 0.20 }, [0.24, 0.58, 0.26]);
        md.add(Geo.box(0.50, 0.09, 1.65), { x: tx + Math.cos(a) * 2.30, y: topY - 0.40, z: Math.sin(a) * 2.30, ry, rx: 0.68 }, [0.19, 0.49, 0.23]);
        md.add(Geo.box(0.26, 0.08, 0.95), { x: tx + Math.cos(a) * 3.25, y: topY - 1.45, z: Math.sin(a) * 3.25, ry, rx: 1.05 }, [0.16, 0.42, 0.21]);
      }
      md.add(Geo.sphere(0.52, 10, 8), { x: tx, y: topY + 0.05 }, [0.30, 0.52, 0.25]);
      for (let i = 0; i < 5; i++) {
        const a = i * 1.28;
        md.add(Geo.sphere(0.24, 8, 6), { x: tx + Math.cos(a) * 0.55, y: topY - 0.42, z: Math.sin(a) * 0.55 }, [0.62, 0.44, 0.20]);
      }
    }
    treeGeos.push(md);
    // 2: شجرة مستديرة
    md = new MeshData();
    md.add(Geo.cylinder(0.32, 0.55, 3.4, 8), { y: 1.7 }, [0.45, 0.31, 0.19]);
    md.add(Geo.sphere(2.5, 12, 9), { y: 5.0 }, [0.24, 0.56, 0.26]);
    md.add(Geo.sphere(1.7, 10, 8), { x: 1.5, y: 4.2, z: 0.8 }, [0.28, 0.62, 0.28]);
    md.add(Geo.sphere(1.5, 10, 8), { x: -1.3, y: 4.6, z: -0.9 }, [0.21, 0.51, 0.24]);
    treeGeos.push(md);

    this.treeMeshes = treeGeos.map(g => { const m = new Mesh(gl, g); m.instances(700); return m; });
    this.treeLists = this.treeMeshes.map(m => new InstList(m));

    const rockGeos = [0, 1, 2].map(i => {
      const g = new MeshData();
      g.add(Geo.rock(1.6 + i * 0.5, 900 + i * 31), { y: 0.6 + i * 0.2 }, [0.50 + i * 0.03, 0.49, 0.47], 0);
      if (i === 2) g.add(Geo.rock(1.0, 77), { x: 1.6, y: 0.5, z: 0.8 }, [0.46, 0.45, 0.44]);
      return g;
    });
    this.rockMeshes = rockGeos.map(g => { const m = new Mesh(gl, g); m.instances(420); return m; });
    this.rockLists = this.rockMeshes.map(m => new InstList(m));

    const bmd = new MeshData();
    bmd.add(Geo.sphere(0.85, 8, 6, 0.75), { y: 0.55 }, [0.26, 0.52, 0.24]);
    bmd.add(Geo.sphere(0.6, 7, 5, 0.8), { x: 0.7, y: 0.4, z: 0.3 }, [0.32, 0.58, 0.26]);
    this.bushMesh = new Mesh(gl, bmd); this.bushMesh.instances(900);
    this.bushList = new InstList(this.bushMesh);

    // توزيع
    for (let i = 0; i < 1500; i++) {
      const a = rng() * TAU, rr = Math.sqrt(rng()) * (ISLAND_R - 12);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const y = this.height(x, z);
      if (y < WATER_Y + 1.6 || y > 47) continue;
      const n = this.normalAt(x, z);
      if (n[1] < 0.80) continue;
      if (this.lobby && Math.hypot(x - this.lobby.x, z - this.lobby.z) < 20) continue;
      let inPoi = false;
      for (const p of this.pois) if (Math.hypot(x - p.x, z - p.z) < p.r * 0.75) { inPoi = true; break; }
      if (inPoi && rng() < 0.8) continue;
      const dens = fbm(x * 0.011, z * 0.011, 3, this.seed + 400);
      if (rng() > dens * 1.25) continue;
      let type = y < 9 ? 1 : (y > 33 ? 0 : (rng() < 0.5 ? 0 : 2));
      if (rng() < 0.18) type = 1;
      const s = 0.8 + rng() * 0.55;
      this.trees.push({ x, y, z, type, s, ry: rng() * TAU, hp: 160, alive: true, fall: 0 });
    }
    for (let i = 0; i < 700; i++) {
      const a = rng() * TAU, rr = Math.sqrt(rng()) * (ISLAND_R - 6);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const y = this.height(x, z);
      if (y < WATER_Y + 0.4) continue;
      if (this.lobby && Math.hypot(x - this.lobby.x, z - this.lobby.z) < 20) continue;
      let inPoi = false;
      for (const p of this.pois) if (Math.hypot(x - p.x, z - p.z) < p.r * 0.6) { inPoi = true; break; }
      if (inPoi && rng() < 0.7) continue;
      this.rocks.push({ x, y, z, type: Math.floor(rng() * 3), s: 0.7 + rng() * 0.9, ry: rng() * TAU, hp: 200, alive: true });
    }
    for (let i = 0; i < 900; i++) {
      const a = rng() * TAU, rr = Math.sqrt(rng()) * (ISLAND_R - 8);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const y = this.height(x, z);
      if (y < WATER_Y + 1.2 || y > 44) continue;
      if (this.lobby && Math.hypot(x - this.lobby.x, z - this.lobby.z) < 15) continue;
      this.bushes.push({ x, y, z, s: 0.7 + rng() * 0.8, ry: rng() * TAU });
    }
  },

  /* --- صناديق الغنائم وأجسام أخرى --- */
  buildProps(gl) {
    const c = new MeshData();
    c.add(Geo.box(1.5, 0.85, 1.05), { y: 0.42 }, [0.48, 0.32, 0.18]);
    c.add(Geo.box(1.56, 0.16, 1.11), { y: 0.30 }, [0.80, 0.64, 0.24]);
    c.add(Geo.box(1.56, 0.16, 1.11), { y: 0.72 }, [0.80, 0.64, 0.24]);
    c.add(Geo.box(0.22, 0.30, 1.12), { y: 0.5 }, [0.86, 0.70, 0.28]);
    c.add(Geo.box(1.5, 0.42, 1.05), { y: 1.02 }, [0.55, 0.37, 0.20]);
    c.add(Geo.box(0.26, 0.26, 0.20), { y: 0.62, z: 0.56 }, [0.92, 0.78, 0.30]);
    this.chestMesh = new Mesh(gl, c); this.chestMesh.instances(220);
    this.chestList = new InstList(this.chestMesh);

    const beam = new MeshData();
    beam.add(Geo.cylinder(0.5, 0.5, 1, 12, false, false), { y: 0.5 }, [1, 1, 1]);
    this.beamMesh = new Mesh(gl, beam); this.beamMesh.instances(300);
    this.beamList = new InstList(this.beamMesh);
  },

  rebuildInstances() {
    for (const l of this.treeLists) l.reset();
    for (const t of this.trees) {
      if (!t.alive) continue;
      this.treeLists[t.type].push(t.x, t.y, t.z, 0, t.ry, 0, t.s, t.s, t.s, 1, 1, 1, 0);
    }
    for (const l of this.treeLists) l.flush();
    for (const l of this.rockLists) l.reset();
    for (const r of this.rocks) {
      if (!r.alive) continue;
      this.rockLists[r.type].push(r.x, r.y, r.z, 0, r.ry, 0, r.s, r.s, r.s, 1, 1, 1, 0);
    }
    for (const l of this.rockLists) l.flush();
    this.bushList.reset();
    for (const b of this.bushes) this.bushList.push(b.x, b.y, b.z, 0, b.ry, 0, b.s, b.s, b.s, 1, 1, 1, 0);
    this.bushList.flush();
  },

  /* ---------- استعلامات الاصطدام ---------- */
  _tmp: [],

  /* أعلى سطح صلب أسفل نقطة معيّنة */
  solidTop(x, y, z, r) {
    let top = -1e9;
    const list = this.near(x, z, this._tmp);
    for (const i of list) {
      const c = this.colliders[i];
      if (x + r < c.x0 || x - r > c.x1 || z + r < c.z0 || z - r > c.z1) continue;
      if (c.y1 <= y + 0.55 && c.y1 > top) top = c.y1;
    }
    return top;
  },

  /* دفع أفقي خارج المصادمات الرأسية */
  pushOut(p, r, hEye) {
    const list = this.near(p[0], p[2], this._tmp);
    for (const i of list) {
      const c = this.colliders[i];
      if (p[1] + hEye < c.y0 + 0.05 || p[1] > c.y1 - 0.12) continue;
      if (p[0] + r < c.x0 || p[0] - r > c.x1 || p[2] + r < c.z0 || p[2] - r > c.z1) continue;
      const dxL = (p[0] + r) - c.x0, dxR = c.x1 - (p[0] - r);
      const dzL = (p[2] + r) - c.z0, dzR = c.z1 - (p[2] - r);
      const m = Math.min(dxL, dxR, dzL, dzR);
      if (m === dxL) p[0] = c.x0 - r; else if (m === dxR) p[0] = c.x1 + r;
      else if (m === dzL) p[2] = c.z0 - r; else p[2] = c.z1 + r;
    }
    // الأشجار
    for (const t of this.trees) {
      if (!t.alive) continue;
      const dx = p[0] - t.x, dz = p[2] - t.z;
      const rr = 0.42 * t.s + r;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6 && p[1] < t.y + 5 * t.s && p[1] + hEye > t.y) {
        const d = Math.sqrt(d2);
        p[0] = t.x + dx / d * rr; p[2] = t.z + dz / d * rr;
      }
    }
  },

  /* تقاطع شعاع مع العالم الثابت → {t, type, obj, point} */
  ray(o, d, maxT) {
    let best = maxT, hit = null;
    // التضاريس بالمسير
    let step = 0.55, t = 0.3;
    let py = o[1] + d[1] * t;
    while (t < maxT) {
      const x = o[0] + d[0] * t, z = o[2] + d[2] * t;
      py = o[1] + d[1] * t;
      const h = this.height(x, z);
      if (py <= h) {
        let lo = Math.max(0, t - step), hi = t;
        for (let i = 0; i < 6; i++) {
          const mid = (lo + hi) / 2;
          const hh = this.height(o[0] + d[0] * mid, o[2] + d[2] * mid);
          if (o[1] + d[1] * mid <= hh) hi = mid; else lo = mid;
        }
        best = hi; hit = { t: hi, type: 'ground' };
        break;
      }
      step = t < 25 ? 0.55 : (t < 90 ? 1.6 : 3.4);
      t += step;
    }
    // المصادمات الثابتة (مع استبعاد مبكر بالمسافة)
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      const cx = (c.x0 + c.x1) * 0.5, cz = (c.z0 + c.z1) * 0.5;
      const rad = Math.max(c.x1 - c.x0, c.z1 - c.z0) * 0.75 + 1.5;
      if (!nearRay(o, d, cx, cz, rad, best)) continue;
      const tt = rayAABB(o, d, c.x0, c.y0, c.z0, c.x1, c.y1, c.z1, best);
      if (tt !== null && tt < best) { best = tt; hit = { t: tt, type: 'struct' }; }
    }
    // الأشجار والصخور (أسطوانات تقريبية) — مع استبعاد مبكر سريع
    // اتجاه أفقي موحّد للاستبعاد المبكر الصحيح
    const hl = Math.hypot(d[0], d[2]);
    const nx = hl > 1e-6 ? d[0] / hl : 0, nz = hl > 1e-6 ? d[2] / hl : 0;
    const near2 = (cx, cz, rad) => {
      const ex = cx - o[0], ez = cz - o[2];
      const lim = rad + 0.6;
      if (hl < 1e-6) return ex * ex + ez * ez <= lim * lim;
      const proj = ex * nx + ez * nz;
      if (proj < -lim || proj > best * hl + lim) return false;
      const px = ex - nx * proj, pz = ez - nz * proj;
      return px * px + pz * pz <= lim * lim;
    };
    for (const tr of this.trees) {
      if (!tr.alive) continue;
      const rad = 0.55 * tr.s;
      if (!near2(tr.x, tr.z, rad)) continue;
      const tt = rayCylinder(o, d, tr.x, tr.y, tr.z, rad, 6.5 * tr.s, best);
      if (tt !== null && tt < best) { best = tt; hit = { t: tt, type: 'tree', obj: tr }; }
    }
    for (const rk of this.rocks) {
      if (!rk.alive) continue;
      const rad = 1.5 * rk.s;
      if (!near2(rk.x, rk.z, rad)) continue;
      const tt = rayCylinder(o, d, rk.x, rk.y, rk.z, rad, 2.4 * rk.s, best);
      if (tt !== null && tt < best) { best = tt; hit = { t: tt, type: 'rock', obj: rk }; }
    }
    if (hit) hit.point = [o[0] + d[0] * hit.t, o[1] + d[1] * hit.t, o[2] + d[2] * hit.t];
    return hit;
  },

  /* --- خريطة مصغّرة مرسومة مسبقًا --- */
  buildMinimap() {
    const S = 288, D = MAP_SIZE;
    const W = S + 2;
    const H = new Float32Array(W * W);
    for (let j = 0; j < W; j++) {
      const z = ((j - 0.5) / S - 0.5) * D;
      for (let i = 0; i < W; i++) H[j * W + i] = this.height(((i - 0.5) / S - 0.5) * D, z);
    }
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    const img = g.createImageData(S, S);
    const step = D / S;
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const k = (j + 1) * W + (i + 1);
        const h = H[k];
        let nx = H[k - 1] - H[k + 1], ny = 2 * step, nz = H[k - W] - H[k + W];
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l; ny /= l; nz /= l;
        let r, gg, b;
        if (h < WATER_Y - 1) { r = 30; gg = 96; b = 150; }
        else if (h < WATER_Y + 2.2) { r = 224; gg = 205; b = 145; }
        else if (ny < 0.62) { r = 118; gg = 114; b = 110; }
        else if (h > 47) { r = 238; gg = 242; b = 248; }
        else {
          const t = clamp((h - 4) / 42, 0, 1);
          r = 74 + t * 52; gg = 142 - t * 22; b = 58 + t * 20;
        }
        const sh = clamp(0.62 + ny * 0.5 + nx * 0.35, 0.4, 1.25);
        const o = (j * S + i) * 4;
        img.data[o] = clamp(r * sh, 0, 255);
        img.data[o + 1] = clamp(gg * sh, 0, 255);
        img.data[o + 2] = clamp(b * sh, 0, 255);
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    this.minimapCanvas = cv;
  }
};

/* ---------- دوال تقاطع ---------- */
/* استبعاد مبكر: هل يمرّ الشعاع قرب دائرة أفقية نصف قطرها rad؟ */
function nearRay(o, d, cx, cz, rad, maxT) {
  const ex = cx - o[0], ez = cz - o[2];
  const hl = Math.hypot(d[0], d[2]);
  if (hl < 1e-6) return ex * ex + ez * ez <= rad * rad;
  const nx = d[0] / hl, nz = d[2] / hl;
  const proj = ex * nx + ez * nz;
  if (proj < -rad || proj > maxT * hl + rad) return false;
  const px = ex - nx * proj, pz = ez - nz * proj;
  return px * px + pz * pz <= rad * rad;
}

function rayAABB(o, d, x0, y0, z0, x1, y1, z1, maxT) {
  let tmin = 0, tmax = maxT;
  for (let a = 0; a < 3; a++) {
    const lo = a === 0 ? x0 : (a === 1 ? y0 : z0);
    const hi = a === 0 ? x1 : (a === 1 ? y1 : z1);
    const inv = 1 / (d[a] || 1e-9);
    let t1 = (lo - o[a]) * inv, t2 = (hi - o[a]) * inv;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  return tmin > 0.0001 ? tmin : null;
}

function rayCylinder(o, d, cx, cy, cz, r, h, maxT) {
  const ox = o[0] - cx, oz = o[2] - cz;
  const a = d[0] * d[0] + d[2] * d[2];
  if (a < 1e-9) return null;
  const b = 2 * (ox * d[0] + oz * d[2]);
  const c = ox * ox + oz * oz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = (-b - sq) / (2 * a);
  if (t < 0.0001) t = (-b + sq) / (2 * a);
  if (t < 0.0001 || t > maxT) return null;
  const y = o[1] + d[1] * t;
  if (y < cy || y > cy + h) return null;
  return t;
}
