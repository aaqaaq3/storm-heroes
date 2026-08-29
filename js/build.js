'use strict';
/* ============================================================
   أبطال العاصفة — نظام البناء
   ============================================================ */

const CELL = 4;
const MATS = [
  { id: 0, name: 'خشب', hp: 95, hex: '#c78b3f', col: [0.66, 0.46, 0.24], speed: 0.20 },
  { id: 1, name: 'حجر', hp: 145, hex: '#a8a6a2', col: [0.60, 0.59, 0.58], speed: 0.30 },
  { id: 2, name: 'معدن', hp: 205, hex: '#8fa4b8', col: [0.53, 0.61, 0.70], speed: 0.42 }
];
const BUILD_COST = 10;

const Build = {
  pieces: new Map(),
  grid: new Map(),
  GRID: 12,
  meshes: {}, lists: {},
  previewList: null,

  init(gl) {
    const mk = (id, md, max) => {
      const m = new Mesh(gl, md); m.instances(max || 900);
      this.meshes[id] = m; this.lists[id] = new InstList(m);
    };
    const T = 0.30;

    // جدار
    let md = new MeshData();
    md.add(Geo.box(CELL, CELL, T), { y: CELL / 2 }, [1, 1, 1]);   // يمتد من 0 إلى CELL
    md.add(Geo.box(CELL, 0.34, T * 1.25), { y: 0.17 }, [0.80, 0.80, 0.82]);
    md.add(Geo.box(CELL, 0.34, T * 1.25), { y: CELL - 0.17 }, [0.80, 0.80, 0.82]);
    md.add(Geo.box(0.34, CELL, T * 1.25), { x: -CELL / 2 + 0.17, y: CELL / 2 }, [0.86, 0.86, 0.88]);
    md.add(Geo.box(0.34, CELL, T * 1.25), { x: CELL / 2 - 0.17, y: CELL / 2 }, [0.86, 0.86, 0.88]);
    md.add(Geo.box(CELL - 0.9, 0.22, T * 1.3), { y: CELL / 2 }, [0.72, 0.72, 0.74]);
    mk('wall', md);

    // أرضية
    md = new MeshData();
    md.add(Geo.box(CELL, T, CELL), {}, [1, 1, 1]);
    md.add(Geo.box(CELL, T * 1.3, 0.34), { z: -CELL / 2 + 0.17 }, [0.82, 0.82, 0.84]);
    md.add(Geo.box(CELL, T * 1.3, 0.34), { z: CELL / 2 - 0.17 }, [0.82, 0.82, 0.84]);
    md.add(Geo.box(0.34, T * 1.3, CELL), { x: -CELL / 2 + 0.17 }, [0.82, 0.82, 0.84]);
    md.add(Geo.box(0.34, T * 1.3, CELL), { x: CELL / 2 - 0.17 }, [0.82, 0.82, 0.84]);
    md.add(Geo.box(CELL - 0.9, T * 1.35, 0.22), {}, [0.72, 0.72, 0.74]);
    mk('floor', md);

    // منحدر (يرتفع نحو +Z)
    md = new MeshData();
    md.add(Geo.wedge(CELL, CELL, CELL), {}, [1, 1, 1]);
    for (let i = 0; i < 5; i++) {
      const f = (i + 0.5) / 5;
      md.add(Geo.box(CELL, 0.13, 0.30), { y: CELL * f + 0.06, z: -CELL / 2 + CELL * f, rx: -0.785 }, [0.80, 0.80, 0.82]);
    }
    md.add(Geo.box(0.28, 0.30, CELL * 1.42), { x: -CELL / 2 + 0.14, y: CELL / 2, rx: -0.785 }, [0.86, 0.86, 0.88]);
    md.add(Geo.box(0.28, 0.30, CELL * 1.42), { x: CELL / 2 - 0.14, y: CELL / 2, rx: -0.785 }, [0.86, 0.86, 0.88]);
    mk('ramp', md);

    // هرم
    md = new MeshData();
    md.add(Geo.pyramid(CELL, CELL, CELL), {}, [1, 1, 1]);
    md.add(Geo.box(CELL, 0.28, 0.28), { y: 0.14, z: -CELL / 2 + 0.14 }, [0.84, 0.84, 0.86]);
    md.add(Geo.box(CELL, 0.28, 0.28), { y: 0.14, z: CELL / 2 - 0.14 }, [0.84, 0.84, 0.86]);
    md.add(Geo.box(0.28, 0.28, CELL), { y: 0.14, x: -CELL / 2 + 0.14 }, [0.84, 0.84, 0.86]);
    md.add(Geo.box(0.28, 0.28, CELL), { y: 0.14, x: CELL / 2 - 0.14 }, [0.84, 0.84, 0.86]);
    mk('pyr', md);

    this.order = ['wall', 'floor', 'ramp', 'pyr'];
    this.types = [
      { id: 'wall', name: 'جدار', key: 'Z' },
      { id: 'ramp', name: 'منحدر', key: 'C' },
      { id: 'floor', name: 'أرضية', key: 'X' },
      { id: 'pyr', name: 'هرم', key: 'V' }
    ];
  },

  clear() { this.pieces.clear(); this.grid.clear(); },

  key(type, gx, gy, gz) { return type + ':' + gx + ':' + gy + ':' + gz; },

  gkey(gx, gz) { return gx * 100003 + gz; },

  addToGrid(p) {
    const k = this.gkey(Math.floor(p.gx * CELL / this.GRID), Math.floor(p.gz * CELL / this.GRID));
    let a = this.grid.get(k);
    if (!a) { a = []; this.grid.set(k, a); }
    a.push(p);
  },

  rebuildGrid() {
    this.grid.clear();
    for (const p of this.pieces.values()) this.addToGrid(p);
  },

  nearPieces(x, z, out) {
    out.length = 0;
    const gx = Math.floor(x / this.GRID), gz = Math.floor(z / this.GRID);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = this.grid.get(this.gkey(gx + i, gz + j));
      if (a) for (const p of a) if (p.alive) out.push(p);
    }
    return out;
  },

  /* ---------- هدف البناء ---------- */
  target(e, type) {
    const px = e.pos[0], pz = e.pos[2], py = e.pos[1];
    const gx = Math.floor(px / CELL), gz = Math.floor(pz / CELL);
    const gy = Math.floor((py + 0.25) / CELL);
    const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
    let dx = 0, dz = 0, dir = 0;
    if (Math.abs(fz) >= Math.abs(fx)) { dz = fz > 0 ? 1 : -1; dir = fz > 0 ? 0 : 2; }
    else { dx = fx > 0 ? 1 : -1; dir = fx > 0 ? 1 : 3; }

    if (type === 'wall') {
      if (dz === 1) return { type: 'wz', gx, gy, gz: gz + 1, dir };
      if (dz === -1) return { type: 'wz', gx, gy, gz, dir };
      if (dx === 1) return { type: 'wx', gx: gx + 1, gy, gz, dir };
      return { type: 'wx', gx, gy, gz, dir };
    }
    if (type === 'floor') return { type: 'floor', gx: gx + dx, gy, gz: gz + dz, dir };
    if (type === 'ramp') return { type: 'ramp', gx: gx + dx, gy, gz: gz + dz, dir };
    return { type: 'pyr', gx: gx + dx, gy, gz: gz + dz, dir };
  },

  canPlace(t) {
    if (!t) return false;
    if (this.pieces.has(this.pkey(t))) return false;
    if (t.gy < -2 || t.gy > 40) return false;
    const wx = t.gx * CELL, wz = t.gz * CELL;
    if (Math.hypot(wx, wz) > ISLAND_R + 60) return false;
    return true;
  },

  pkey(t) {
    if (t.type === 'ramp' || t.type === 'pyr') return t.type + ':' + t.gx + ':' + t.gy + ':' + t.gz + ':' + (t.type === 'ramp' ? t.dir : 0);
    return t.type + ':' + t.gx + ':' + t.gy + ':' + t.gz;
  },

  place(t, mat, owner) {
    if (!this.canPlace(t)) return null;
    const m = MATS[mat];
    const p = {
      type: t.type, gx: t.gx, gy: t.gy, gz: t.gz, dir: t.dir || 0,
      mat: mat, hp: m.hp, maxHp: m.hp, owner: owner, alive: true,
      grow: 0, t: 0
    };
    this.pieces.set(this.pkey(t), p);
    this.addToGrid(p);
    return p;
  },

  remove(p) {
    p.alive = false;
    const t = { type: p.type, gx: p.gx, gy: p.gy, gz: p.gz, dir: p.dir };
    this.pieces.delete(this.pkey(t));
  },

  damage(p, d) {
    p.hp -= d;
    p.flash = 0.2;
    if (p.hp <= 0) { this.remove(p); return true; }
    return false;
  },

  /* ---------- الاصطدام ---------- */
  aabb(p, o) {
    const x = p.gx * CELL, y = p.gy * CELL, z = p.gz * CELL;
    const T = 0.18;
    switch (p.type) {
      case 'wx': o[0] = x - T; o[1] = y; o[2] = z; o[3] = x + T; o[4] = y + CELL; o[5] = z + CELL; break;
      case 'wz': o[0] = x; o[1] = y; o[2] = z - T; o[3] = x + CELL; o[4] = y + CELL; o[5] = z + T; break;
      case 'floor': o[0] = x; o[1] = y - T; o[2] = z; o[3] = x + CELL; o[4] = y + T; o[5] = z + CELL; break;
      default: o[0] = x; o[1] = y; o[2] = z; o[3] = x + CELL; o[4] = y + CELL; o[5] = z + CELL; break;
    }
    return o;
  },

  /* ارتفاع السطح العلوي عند نقطة (منحدرات/أهرام/أرضيات) */
  surfaceY(p, x, z) {
    const bx = p.gx * CELL, by = p.gy * CELL, bz = p.gz * CELL;
    const u = (x - bx) / CELL, v = (z - bz) / CELL;
    if (u < -0.02 || u > 1.02 || v < -0.02 || v > 1.02) return null;
    if (p.type === 'floor') return by + 0.18;
    if (p.type === 'ramp') {
      let f;
      if (p.dir === 0) f = v; else if (p.dir === 2) f = 1 - v;
      else if (p.dir === 1) f = u; else f = 1 - u;
      return by + clamp(f, 0, 1) * CELL + 0.12;
    }
    if (p.type === 'pyr') {
      const m = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2;
      return by + (1 - clamp(m, 0, 1)) * CELL;
    }
    return null;
  },

  _tmp: [],

  /* أعلى سطح صالح للوقوف أسفل y */
  groundAt(x, y, z, r) {
    let top = -1e9;
    const near = this.nearPieces(x, z, this._tmp);
    for (const p of near) {
      const sy = this.surfaceY(p, x, z);
      if (sy !== null && sy <= y + 0.65 && sy > top) top = sy;
    }
    return top;
  },

  /* أقرب أرضية فوق الرأس (لمنع اختراق السقف) */
  ceilingAt(pos) {
    let low = 1e9;
    const near = this.nearPieces(pos[0], pos[2], this._tmp);
    const b = [0, 0, 0, 0, 0, 0];
    for (const p of near) {
      if (p.type !== 'floor') continue;
      this.aabb(p, b);
      if (pos[0] < b[0] || pos[0] > b[3] || pos[2] < b[2] || pos[2] > b[5]) continue;
      if (b[1] > pos[1] + 0.5 && b[1] < low) low = b[1];
    }
    return low;
  },

  pushOut(pos, r, hEye) {
    const near = this.nearPieces(pos[0], pos[2], this._tmp);
    const b = [0, 0, 0, 0, 0, 0];
    for (const p of near) {
      if (p.type === 'ramp' || p.type === 'pyr' || p.type === 'floor') continue;
      this.aabb(p, b);
      if (pos[1] + hEye < b[1] + 0.05 || pos[1] > b[4] - 0.12) continue;
      if (pos[0] + r < b[0] || pos[0] - r > b[3] || pos[2] + r < b[2] || pos[2] - r > b[5]) continue;
      const dxL = (pos[0] + r) - b[0], dxR = b[3] - (pos[0] - r);
      const dzL = (pos[2] + r) - b[2], dzR = b[5] - (pos[2] - r);
      const m = Math.min(dxL, dxR, dzL, dzR);
      if (m === dxL) pos[0] = b[0] - r; else if (m === dxR) pos[0] = b[3] + r;
      else if (m === dzL) pos[2] = b[2] - r; else pos[2] = b[5] + r;
    }
  },

  /* شعاع ضد قطع البناء */
  ray(o, d, maxT) {
    let best = maxT, hit = null;
    const b = [0, 0, 0, 0, 0, 0];
    const HALF = CELL * 0.72;
    for (const p of this.pieces.values()) {
      if (!p.alive) continue;
      // استبعاد مبكر: هل يمرّ الشعاع قرب القطعة أصلًا؟
      const cx = p.gx * CELL + CELL / 2, cz = p.gz * CELL + CELL / 2;
      if (!nearRay(o, d, cx, cz, HALF, best)) continue;
      this.aabb(p, b);
      const t = rayAABB(o, d, b[0], b[1], b[2], b[3], b[4], b[5], best);
      if (t === null || t >= best) continue;
      if (p.type === 'ramp' || p.type === 'pyr') {
        const hx = o[0] + d[0] * t, hy = o[1] + d[1] * t, hz = o[2] + d[2] * t;
        const sy = this.surfaceY(p, hx, hz);
        if (sy === null || hy > sy + 0.35) continue;
      }
      best = t; hit = { t, type: 'build', obj: p };
    }
    if (hit) hit.point = [o[0] + d[0] * hit.t, o[1] + d[1] * hit.t, o[2] + d[2] * hit.t];
    return hit;
  },

  /* ---------- العرض ---------- */
  submit(dt) {
    for (const k in this.lists) this.lists[k].reset();
    for (const p of this.pieces.values()) {
      if (!p.alive) continue;
      if (p.grow < 1) p.grow = Math.min(1, p.grow + dt * 5.5);
      if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 4);
      const m = MATS[p.mat];
      const dmg = p.hp / p.maxHp;
      const f = p.flash || 0;
      const r = m.col[0] * (0.45 + dmg * 0.55) + f, g = m.col[1] * (0.45 + dmg * 0.55) + f * 0.3,
        bb = m.col[2] * (0.45 + dmg * 0.55) + f * 0.3;
        const x = p.gx * CELL, y = p.gy * CELL, z = p.gz * CELL;
      const gy = 1 - (1 - p.grow) * (1 - p.grow);
      if (p.type === 'wx') this.lists.wall.push(x, y, z + CELL / 2, 0, Math.PI / 2, 0, 1, gy, 1, r, g, bb, f * 2);
      else if (p.type === 'wz') this.lists.wall.push(x + CELL / 2, y, z, 0, 0, 0, 1, gy, 1, r, g, bb, f * 2);
      else if (p.type === 'floor') this.lists.floor.push(x + CELL / 2, y, z + CELL / 2, 0, 0, 0, gy, 1, gy, r, g, bb, f * 2);
      else if (p.type === 'ramp') this.lists.ramp.push(x + CELL / 2, y, z + CELL / 2, 0, p.dir * Math.PI / 2, 0, 1, gy, 1, r, g, bb, f * 2);
      else this.lists.pyr.push(x + CELL / 2, y, z + CELL / 2, 0, 0, 0, 1, gy, 1, r, g, bb, f * 2);
    }
    for (const k in this.lists) this.lists[k].flush();
  },

  /* معاينة القطعة المراد بناؤها */
  previewMatrix(t, out) {
    const x = t.gx * CELL, y = t.gy * CELL, z = t.gz * CELL;
    if (t.type === 'wx') return M.trs(out, x, y, z + CELL / 2, 0, Math.PI / 2, 0, 1, 1, 1);
    if (t.type === 'wz') return M.trs(out, x + CELL / 2, y, z, 0, 0, 0, 1, 1, 1);
    if (t.type === 'floor') return M.trs(out, x + CELL / 2, y, z + CELL / 2, 0, 0, 0, 1, 1, 1);
    if (t.type === 'ramp') return M.trs(out, x + CELL / 2, y, z + CELL / 2, 0, t.dir * Math.PI / 2, 0, 1, 1, 1);
    return M.trs(out, x + CELL / 2, y, z + CELL / 2, 0, 0, 0, 1, 1, 1);
  },

  meshFor(t) {
    if (t.type === 'wx' || t.type === 'wz') return 'wall';
    return t.type;
  }
};
