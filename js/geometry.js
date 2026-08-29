'use strict';
/* ============================================================
   أبطال العاصفة — مولّد الأشكال الهندسية الإجرائية
   كل دالة تُعيد {pos:[], nrm:[], idx:[]}
   ============================================================ */

const Geo = {

  /* صندوق مركزه الأصل (أو بإزاحة) */
  box(w, h, d, ox = 0, oy = 0, oz = 0) {
    const x = w / 2, y = h / 2, z = d / 2;
    const pos = [], nrm = [], idx = [];
    const faces = [
      [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1]],
      [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1]],
      [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0]],
      [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0]],
      [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0]],
      [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0]]
    ];
    for (const f of faces) {
      const b = pos.length / 3;
      for (let i = 0; i < 4; i++) {
        pos.push(f[i][0] + ox, f[i][1] + oy, f[i][2] + oz);
        nrm.push(f[4][0], f[4][1], f[4][2]);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    return { pos, nrm, idx };
  },

  /* كرة UV ناعمة التظليل */
  sphere(r, seg = 16, ring = 12, sy = 1) {
    const pos = [], nrm = [], idx = [];
    for (let y = 0; y <= ring; y++) {
      const v = y / ring, phi = v * Math.PI;
      for (let x = 0; x <= seg; x++) {
        const u = x / seg, th = u * TAU;
        const nx = Math.sin(phi) * Math.cos(th), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(th);
        pos.push(nx * r, ny * r * sy, nz * r);
        nrm.push(nx, ny / (sy || 1), nz);
      }
    }
    for (let y = 0; y < ring; y++) {
      for (let x = 0; x < seg; x++) {
        const a = y * (seg + 1) + x, b = a + seg + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    return { pos, nrm, idx };
  },

  /* أسطوانة / مخروط ناقص */
  cylinder(rt, rb, h, seg = 14, capTop = true, capBot = true) {
    const pos = [], nrm = [], idx = [];
    const slope = Math.atan2(rb - rt, h);
    const cs = Math.cos(slope), sn = Math.sin(slope);
    for (let y = 0; y <= 1; y++) {
      const r = y ? rt : rb, py = y ? h / 2 : -h / 2;
      for (let x = 0; x <= seg; x++) {
        const th = (x / seg) * TAU, c = Math.cos(th), s = Math.sin(th);
        pos.push(c * r, py, s * r);
        nrm.push(c * cs, sn, s * cs);
      }
    }
    for (let x = 0; x < seg; x++) {
      const a = x, b = x + seg + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    if (capTop && rt > 0.0001) {
      const base = pos.length / 3;
      pos.push(0, h / 2, 0); nrm.push(0, 1, 0);
      for (let x = 0; x <= seg; x++) {
        const th = (x / seg) * TAU;
        pos.push(Math.cos(th) * rt, h / 2, Math.sin(th) * rt); nrm.push(0, 1, 0);
      }
      for (let x = 0; x < seg; x++) idx.push(base, base + 1 + x, base + 2 + x);
    }
    if (capBot && rb > 0.0001) {
      const base = pos.length / 3;
      pos.push(0, -h / 2, 0); nrm.push(0, -1, 0);
      for (let x = 0; x <= seg; x++) {
        const th = (x / seg) * TAU;
        pos.push(Math.cos(th) * rb, -h / 2, Math.sin(th) * rb); nrm.push(0, -1, 0);
      }
      for (let x = 0; x < seg; x++) idx.push(base, base + 2 + x, base + 1 + x);
    }
    return { pos, nrm, idx };
  },

  cone(r, h, seg = 14) { return Geo.cylinder(0.001, r, h, seg, false, true); },

  /* إسفين (منحدر) — يرتفع باتجاه ‎+Z */
  wedge(w, h, d) {
    const x = w / 2, z = d / 2;
    const V0 = [-x, 0, -z], V1 = [x, 0, -z], V2 = [x, 0, z], V3 = [-x, 0, z];
    const T2 = [x, h, z], T3 = [-x, h, z];
    const pos = [], nrm = [], idx = [];
    const tri = (a, b, c) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const b0 = pos.length / 3;
      pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      nrm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      idx.push(b0, b0 + 1, b0 + 2);
    };
    tri(V0, V2, V1); tri(V0, V3, V2);        // القاعدة
    tri(V0, V1, T2); tri(V0, T2, T3);        // السطح المائل
    tri(V3, T3, T2); tri(V3, T2, V2);        // الخلف
    tri(V1, V2, T2);                          // الجانب الأيمن
    tri(V0, T3, V3);                          // الجانب الأيسر
    return { pos, nrm, idx };
  },

  /* هرم رباعي */
  pyramid(w, h, d) {
    const x = w / 2, z = d / 2;
    const A = [-x, 0, -z], B = [x, 0, -z], C = [x, 0, z], D = [-x, 0, z], T = [0, h, 0];
    const pos = [], nrm = [], idx = [];
    const tri = (a, b, c) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const b0 = pos.length / 3;
      pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      nrm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      idx.push(b0, b0 + 1, b0 + 2);
    };
    tri(A, C, B); tri(A, D, C);
    tri(A, B, T); tri(B, C, T); tri(C, D, T); tri(D, A, T);
    return { pos, nrm, idx };
  },

  /* مستوٍ أفقي مقسّم، بدالة ارتفاع اختيارية */
  plane(w, d, nx, nz, hf) {
    const pos = [], nrm = [], idx = [];
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const x = (i / nx - 0.5) * w, z = (j / nz - 0.5) * d;
        pos.push(x, hf ? hf(x, z) : 0, z);
        nrm.push(0, 1, 0);
      }
    }
    if (hf) {
      const st = w / nx;
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
        const k = (j * (nx + 1) + i) * 3;
        const x = pos[k], z = pos[k + 2];
        const hl = hf(x - st, z), hr = hf(x + st, z), hd = hf(x, z - st), hu = hf(x, z + st);
        let ax = -(hr - hl), ay = 2 * st, az = -(hu - hd);
        const l = Math.hypot(ax, ay, az) || 1;
        nrm[k] = ax / l; nrm[k + 1] = ay / l; nrm[k + 2] = az / l;
      }
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + nx + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return { pos, nrm, idx };
  },

  /* مربّع وحدة في مستوى XY (للجسيمات والألواح) */
  quad() {
    return {
      pos: [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0],
      nrm: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
      idx: [0, 1, 2, 0, 2, 3]
    };
  },

  /* صخرة عشوائية (كرة مشوّشة بتظليل مسطّح) */
  rock(r, seed) {
    const s = Geo.sphere(r, 9, 7);
    const rng = makeRng(seed);
    const n = s.pos.length / 3;
    const off = [];
    for (let i = 0; i < n; i++) off.push(0.68 + rng() * 0.6);
    for (let i = 0; i < n; i++) {
      const k = i * 3, f = off[i];
      s.pos[k] *= f; s.pos[k + 1] *= f * 0.8; s.pos[k + 2] *= f;
    }
    return Geo.flatten(s);
  },

  /* حذف المثلثات التي لا يقبلها الشرط (لقصّ خطّ الشعر مثلًا) */
  filterTris(g, keep) {
    const idx = [];
    for (let i = 0; i < g.idx.length; i += 3) {
      const a = g.idx[i] * 3, b = g.idx[i + 1] * 3, c = g.idx[i + 2] * 3;
      const cx = (g.pos[a] + g.pos[b] + g.pos[c]) / 3;
      const cy = (g.pos[a + 1] + g.pos[b + 1] + g.pos[c + 1]) / 3;
      const cz = (g.pos[a + 2] + g.pos[b + 2] + g.pos[c + 2]) / 3;
      if (keep(cx, cy, cz)) idx.push(g.idx[i], g.idx[i + 1], g.idx[i + 2]);
    }
    return { pos: g.pos, nrm: g.nrm, idx };
  },

  /* تحويل شبكة إلى تظليل مسطّح (low-poly) */
  flatten(g) {
    const pos = [], nrm = [], idx = [];
    for (let i = 0; i < g.idx.length; i += 3) {
      const p = [];
      for (let k = 0; k < 3; k++) {
        const o = g.idx[i + k] * 3;
        p.push([g.pos[o], g.pos[o + 1], g.pos[o + 2]]);
      }
      const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2];
      const vx = p[2][0] - p[0][0], vy = p[2][1] - p[0][1], vz = p[2][2] - p[0][2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const b = pos.length / 3;
      for (let k = 0; k < 3; k++) { pos.push(p[k][0], p[k][1], p[k][2]); nrm.push(nx, ny, nz); }
      idx.push(b, b + 1, b + 2);
    }
    return { pos, nrm, idx };
  }
};

/* ============================================================
   MeshData — تجميع عدّة أشكال في شبكة واحدة مع الألوان
   ============================================================ */
class MeshData {
  constructor() { this.pos = []; this.nrm = []; this.col = []; this.idx = []; }

  /* إضافة شكل مع تحويل (إزاحة/دوران/تحجيم) ولون */
  add(geo, tr, color) {
    const t = tr || {};
    const tx = t.x || 0, ty = t.y || 0, tz = t.z || 0;
    const rx = t.rx || 0, ry = t.ry || 0, rz = t.rz || 0;
    const sx = t.sx !== undefined ? t.sx : (t.s !== undefined ? t.s : 1);
    const sy = t.sy !== undefined ? t.sy : (t.s !== undefined ? t.s : 1);
    const sz = t.sz !== undefined ? t.sz : (t.s !== undefined ? t.s : 1);
    const m = M.trs(M.create(), tx, ty, tz, rx, ry, rz, sx, sy, sz);
    const base = this.pos.length / 3;
    const n = geo.pos.length / 3;
    const p = [0, 0, 0], d = [0, 0, 0];
    const c = color || [1, 1, 1];
    const jit = t.jitter || 0;
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      p[0] = geo.pos[k]; p[1] = geo.pos[k + 1]; p[2] = geo.pos[k + 2];
      M.point(p, m, p);
      this.pos.push(p[0], p[1], p[2]);
      d[0] = geo.nrm[k]; d[1] = geo.nrm[k + 1]; d[2] = geo.nrm[k + 2];
      M.dir(d, m, d);
      const l = Math.hypot(d[0], d[1], d[2]) || 1;
      this.nrm.push(d[0] / l, d[1] / l, d[2] / l);
      if (jit) {
        const f = 1 + (ihash(base + i, 7, 13) - 0.5) * jit;
        this.col.push(c[0] * f, c[1] * f, c[2] * f);
      } else this.col.push(c[0], c[1], c[2]);
    }
    for (let i = 0; i < geo.idx.length; i++) this.idx.push(geo.idx[i] + base);
    return this;
  }

  get triangles() { return this.idx.length / 3; }
}
