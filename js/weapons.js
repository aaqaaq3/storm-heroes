'use strict';
/* ============================================================
   أبطال العاصفة — الأسلحة والغنائم
   ============================================================ */

const RARITY = [
  { id: 0, name: 'عادي', col: [0.72, 0.74, 0.78], mul: 1.00, hex: '#b9bec7' },
  { id: 1, name: 'نادر', col: [0.28, 0.62, 0.98], mul: 1.10, hex: '#3d9dfb' },
  { id: 2, name: 'ملحمي', col: [0.70, 0.36, 0.98], mul: 1.22, hex: '#b45cfa' },
  { id: 3, name: 'أسطوري', col: [1.00, 0.68, 0.18], mul: 1.36, hex: '#ffae2e' }
];

const AMMO = {
  light: { name: 'خفيفة', col: '#ffd45e' },
  medium: { name: 'متوسطة', col: '#9ee06a' },
  heavy: { name: 'ثقيلة', col: '#ff8a5c' },
  shell: { name: 'خراطيش', col: '#ff6b8a' },
  rocket: { name: 'صواريخ', col: '#7be0ff' }
};

const WEAPONS = {
  pickaxe: {
    id: 'pickaxe', name: 'فأس الحصاد', short: 'فأس', kind: 'melee',
    dmg: 22, rate: 1.6, range: 3.4, ammo: null, mag: 0, icon: 'pickaxe'
  },
  pistol: {
    id: 'pistol', name: 'مسدس الطاقة', short: 'مسدس', kind: 'gun', sound: 'pistol',
    dmg: 27, rate: 5.4, mag: 14, reload: 1.3, spread: 0.020, aimSpread: 0.006,
    range: 140, auto: false, ammo: 'light', recoil: 0.9, tracer: [1.0, 0.85, 0.35]
  },
  smg: {
    id: 'smg', name: 'رشّاش سريع', short: 'رشّاش', kind: 'gun', sound: 'smg',
    dmg: 15, rate: 12.5, mag: 32, reload: 2.1, spread: 0.042, aimSpread: 0.020,
    range: 95, auto: true, ammo: 'light', recoil: 0.55, tracer: [1.0, 0.75, 0.30]
  },
  ar: {
    id: 'ar', name: 'بندقية هجومية', short: 'هجومية', kind: 'gun', sound: 'ar',
    dmg: 31, rate: 6.6, mag: 30, reload: 2.4, spread: 0.028, aimSpread: 0.008,
    range: 220, auto: true, ammo: 'medium', recoil: 1.05, tracer: [0.65, 1.0, 0.45]
  },
  shotgun: {
    id: 'shotgun', name: 'مدفع الفقاعات', short: 'مدفع', kind: 'gun', sound: 'shotgun',
    dmg: 11, pellets: 9, rate: 1.25, mag: 6, reload: 2.9, spread: 0.105, aimSpread: 0.078,
    range: 42, auto: false, ammo: 'shell', recoil: 2.6, tracer: [1.0, 0.45, 0.6]
  },
  sniper: {
    id: 'sniper', name: 'قنّاص النجوم', short: 'قنّاص', kind: 'gun', sound: 'sniper',
    dmg: 108, rate: 0.72, mag: 5, reload: 3.1, spread: 0.055, aimSpread: 0.0006,
    range: 500, auto: false, ammo: 'heavy', recoil: 3.4, scope: 32, tracer: [0.55, 0.90, 1.0]
  },
  rocket: {
    id: 'rocket', name: 'قاذف الصواريخ', short: 'قاذف', kind: 'launcher', sound: 'rocket',
    dmg: 92, splash: 6.5, rate: 0.62, mag: 2, reload: 3.4, spread: 0.010, aimSpread: 0.004,
    range: 400, auto: false, ammo: 'rocket', recoil: 3.0, speed: 52, tracer: [1.0, 0.55, 0.25]
  }
};

const LOOT_POOL = [
  { w: 'smg', p: 20 }, { w: 'ar', p: 20 }, { w: 'shotgun', p: 18 },
  { w: 'pistol', p: 16 }, { w: 'sniper', p: 11 }, { w: 'rocket', p: 5 }
];

const Weapons = {
  meshes: {}, lists: {},

  init(gl) {
    const G = [0.62, 0.64, 0.70], D = [0.22, 0.23, 0.27], A = [1.0, 1.0, 1.0], E = [1.9, 1.7, 0.7];

    const mk = (id, md, max) => {
      const m = new Mesh(gl, md); m.instances(max || 30);
      this.meshes[id] = m; this.lists[id] = new InstList(m);
    };

    // فأس
    let md = new MeshData();
    md.add(Geo.cylinder(0.045, 0.05, 0.95, 8), { rx: Math.PI / 2, z: 0.30 }, [0.45, 0.32, 0.20]);
    md.add(Geo.box(0.09, 0.30, 0.16), { z: 0.72, y: 0.06 }, G);
    md.add(Geo.wedge(0.09, 0.28, 0.26), { z: 0.80, y: -0.08, rx: -Math.PI / 2, ry: 0 }, [0.80, 0.82, 0.88]);
    md.add(Geo.box(0.07, 0.07, 0.10), { z: 0.60 }, E);
    mk('pickaxe', md);

    // مسدس
    md = new MeshData();
    md.add(Geo.box(0.09, 0.15, 0.34), { z: 0.10, y: 0.03 }, G);
    md.add(Geo.cylinder(0.032, 0.032, 0.26, 8), { rx: Math.PI / 2, z: 0.36, y: 0.05 }, D);
    md.add(Geo.box(0.075, 0.20, 0.11), { y: -0.14, z: -0.02, rx: 0.28 }, D);
    md.add(Geo.box(0.05, 0.05, 0.09), { z: 0.24, y: 0.13 }, E);
    mk('pistol', md);

    // رشّاش
    md = new MeshData();
    md.add(Geo.box(0.10, 0.16, 0.52), { z: 0.20, y: 0.03 }, G);
    md.add(Geo.cylinder(0.030, 0.030, 0.30, 8), { rx: Math.PI / 2, z: 0.58, y: 0.05 }, D);
    md.add(Geo.box(0.075, 0.24, 0.10), { y: -0.16, z: 0.00, rx: 0.20 }, D);
    md.add(Geo.box(0.06, 0.22, 0.09), { y: -0.14, z: 0.22 }, D);
    md.add(Geo.box(0.05, 0.06, 0.30), { y: 0.13, z: 0.24 }, D);
    md.add(Geo.box(0.05, 0.05, 0.07), { z: 0.44, y: 0.14 }, E);
    mk('smg', md);

    // بندقية هجومية
    md = new MeshData();
    md.add(Geo.box(0.10, 0.17, 0.72), { z: 0.28, y: 0.03 }, G);
    md.add(Geo.cylinder(0.030, 0.030, 0.42, 8), { rx: Math.PI / 2, z: 0.84, y: 0.05 }, D);
    md.add(Geo.box(0.078, 0.25, 0.11), { y: -0.16, z: 0.02, rx: 0.20 }, D);
    md.add(Geo.box(0.07, 0.26, 0.12), { y: -0.16, z: 0.30 }, [0.30, 0.32, 0.36]);
    md.add(Geo.box(0.075, 0.16, 0.28), { y: -0.02, z: -0.18 }, D);
    md.add(Geo.box(0.05, 0.07, 0.42), { y: 0.14, z: 0.34 }, D);
    md.add(Geo.box(0.05, 0.05, 0.08), { z: 0.60, y: 0.16 }, E);
    mk('ar', md);

    // مدفع الفقاعات
    md = new MeshData();
    md.add(Geo.box(0.14, 0.19, 0.62), { z: 0.24, y: 0.03 }, G);
    md.add(Geo.cylinder(0.075, 0.085, 0.46, 10), { rx: Math.PI / 2, z: 0.78, y: 0.05 }, D);
    md.add(Geo.cylinder(0.095, 0.095, 0.08, 10), { rx: Math.PI / 2, z: 1.00, y: 0.05 }, [1.4, 0.9, 1.2]);
    md.add(Geo.box(0.085, 0.26, 0.12), { y: -0.17, z: 0.02, rx: 0.22 }, D);
    md.add(Geo.box(0.09, 0.17, 0.30), { y: -0.02, z: -0.20 }, [0.46, 0.32, 0.20]);
    mk('shotgun', md);

    // قنّاص
    md = new MeshData();
    md.add(Geo.box(0.09, 0.16, 0.86), { z: 0.34, y: 0.03 }, G);
    md.add(Geo.cylinder(0.028, 0.032, 0.72, 8), { rx: Math.PI / 2, z: 1.10, y: 0.05 }, D);
    md.add(Geo.cylinder(0.05, 0.05, 0.30, 10), { rx: Math.PI / 2, z: 0.42, y: 0.18 }, [0.18, 0.19, 0.24]);
    md.add(Geo.cylinder(0.058, 0.058, 0.05, 10), { rx: Math.PI / 2, z: 0.58, y: 0.18 }, [0.4, 1.6, 1.9]);
    md.add(Geo.box(0.04, 0.09, 0.12), { y: 0.11, z: 0.34 }, D);
    md.add(Geo.box(0.078, 0.26, 0.11), { y: -0.17, z: 0.06, rx: 0.20 }, D);
    md.add(Geo.box(0.08, 0.19, 0.36), { y: -0.03, z: -0.22 }, [0.42, 0.30, 0.20]);
    md.add(Geo.box(0.05, 0.05, 0.08), { z: 0.84, y: 0.15 }, E);
    mk('sniper', md);

    // قاذف صواريخ
    md = new MeshData();
    md.add(Geo.cylinder(0.115, 0.115, 1.15, 12), { rx: Math.PI / 2, z: 0.48, y: 0.05 }, G);
    md.add(Geo.cylinder(0.14, 0.14, 0.10, 12), { rx: Math.PI / 2, z: 1.02, y: 0.05 }, [1.5, 0.7, 0.35]);
    md.add(Geo.cylinder(0.135, 0.10, 0.16, 12), { rx: Math.PI / 2, z: -0.12, y: 0.05 }, D);
    md.add(Geo.box(0.08, 0.25, 0.12), { y: -0.17, z: 0.10, rx: 0.18 }, D);
    md.add(Geo.box(0.05, 0.16, 0.24), { y: 0.20, z: 0.28 }, D);
    md.add(Geo.box(0.05, 0.05, 0.08), { z: 0.62, y: 0.24 }, E);
    mk('rocket', md);

    // مقذوف الصاروخ
    md = new MeshData();
    md.add(Geo.cylinder(0.09, 0.09, 0.5, 10), { rx: Math.PI / 2 }, [0.85, 0.86, 0.9]);
    md.add(Geo.cone(0.10, 0.22, 10), { rx: Math.PI / 2, z: 0.34 }, [1.4, 0.4, 0.3]);
    for (let i = 0; i < 4; i++) {
      md.add(Geo.box(0.02, 0.16, 0.16), { z: -0.20, ry: 0, rz: i * Math.PI / 2, x: 0, y: 0 }, [0.9, 0.3, 0.25]);
    }
    mk('proj_rocket', md, 24);

    // كرة طاقة عامة (للمؤثرات)
    md = new MeshData();
    md.add(Geo.sphere(0.5, 10, 8), {}, [1, 1, 1]);
    this.sphereMesh = new Mesh(gl, md); this.sphereMesh.instances(200);
    this.sphereList = new InstList(this.sphereMesh);

    // خط الرصاص
    md = new MeshData();
    md.add(Geo.box(0.06, 0.06, 1), { z: 0.5 }, [1, 1, 1]);
    this.tracerMesh = new Mesh(gl, md); this.tracerMesh.instances(220);
    this.tracerList = new InstList(this.tracerMesh);

    // أيقونات الغنائم الأرضية
    md = new MeshData();
    md.add(Geo.box(0.36, 0.42, 0.20), {}, [1, 1, 1]);
    md.add(Geo.box(0.40, 0.10, 0.24), { y: 0.14 }, [0.7, 0.7, 0.75]);
    md.add(Geo.box(0.12, 0.12, 0.24), { y: -0.02 }, [1.6, 1.6, 1.7]);
    this.ammoMesh = new Mesh(gl, md); this.ammoMesh.instances(90);
    this.ammoList = new InstList(this.ammoMesh);

    md = new MeshData();
    md.add(Geo.cylinder(0.13, 0.16, 0.42, 12), {}, [1, 1, 1]);
    md.add(Geo.cylinder(0.07, 0.07, 0.10, 10), { y: 0.25 }, [0.75, 0.75, 0.80]);
    md.add(Geo.box(0.16, 0.18, 0.02), { z: 0.15 }, [2.0, 2.0, 2.2]);
    this.potMesh = new Mesh(gl, md); this.potMesh.instances(90);
    this.potList = new InstList(this.potMesh);

    this.order = ['pickaxe', 'pistol', 'smg', 'ar', 'shotgun', 'sniper', 'rocket', 'proj_rocket'];
  },

  reset() {
    for (const k in this.lists) this.lists[k].reset();
    this.sphereList.reset(); this.tracerList.reset();
    this.ammoList.reset(); this.potList.reset();
  },
  flush() {
    for (const k in this.lists) this.lists[k].flush();
    this.sphereList.flush(); this.tracerList.flush();
    this.ammoList.flush(); this.potList.flush();
  },

  /* لون السلاح حسب الندرة */
  tint(rar) {
    const r = RARITY[rar || 0];
    return [lerp(0.72, r.col[0], 0.62), lerp(0.74, r.col[1], 0.62), lerp(0.78, r.col[2], 0.62)];
  },

  /* رسم السلاح في يد الشخصية */
  submitHeld(e) {
    const w = e.weapon;
    if (!w) return;
    const list = this.lists[w.id];
    if (!list || !e.handM) return;
    const t = this.tint(w.rarity);

    // الفأس يتبع الذراع (يُلوَّح به)، أمّا الأسلحة النارية فتتبع اتجاه التصويب
    if (w.def.kind === 'melee') {
      const off = M.trs(TMP_C, 0, -0.04, 0.02, Math.PI / 2, 0, 0, 1, 1, 1);
      const m = M.mul(WM_T, e.handM, off);
      list.pushMat(m, t[0], t[1], t[2], 0.02);
      return;
    }

    const hx = e.handM[12], hy = e.handM[13], hz = e.handM[14];
    const aiming = e.aiming || e.recoilAnim > 0.05;
    const yaw = aiming ? e.yaw : e.bodyYaw;
    const rx = aiming ? -clamp(e.pitch, -1.3, 1.3) : (e.carry ? 0.26 : 0.80);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const off = aiming ? 0.02 : 0.07;
    list.push(hx + fx * off, hy - (aiming ? 0 : 0.02), hz + fz * off, rx, yaw, 0, 1, 1, 1, t[0], t[1], t[2], 0.02);
  },

  /* اختيار سلاح عشوائي من المجمّع */
  roll(rng, bias) {
    let tot = 0;
    for (const l of LOOT_POOL) tot += l.p;
    let r = rng() * tot, pick = LOOT_POOL[0].w;
    for (const l of LOOT_POOL) { r -= l.p; if (r <= 0) { pick = l.w; break; } }
    const roll = rng() + (bias || 0);
    let rar = 0;
    if (roll > 0.965) rar = 3; else if (roll > 0.85) rar = 2; else if (roll > 0.55) rar = 1;
    return this.make(pick, rar);
  },

  make(id, rarity) {
    const d = WEAPONS[id];
    return {
      id: id, def: d, rarity: rarity || 0,
      ammoIn: d.mag || 0, cool: 0, reloading: 0
    };
  },

  dmgOf(w) { return w.def.dmg * RARITY[w.rarity].mul; },
  fireDelay(w) { return 1 / (w.def.rate * (1 + w.rarity * 0.035)); },
  reloadTime(w) { return w.def.reload * (1 - w.rarity * 0.05); }
};

const WM_T = M.create();

/* ============================================================
   الغنائم الأرضية
   ============================================================ */
const Loot = {
  items: [],

  clear() { this.items = []; },

  spawn(kind, x, y, z, data) {
    this.items.push({
      kind, x, y: y, z, t: Math.random() * 6, data: data || {},
      vy: 0, settled: false, id: Math.random()
    });
  },

  dropWeapon(x, y, z, w) { this.spawn('weapon', x, y, z, { w }); },
  dropAmmo(x, y, z, type, n) { this.spawn('ammo', x, y, z, { type, n }); },
  dropPotion(x, y, z, kind) { this.spawn('potion', x, y, z, { kind }); },

  update(dt) {
    for (const it of this.items) {
      it.t += dt;
      if (!it.settled) {
        it.vy -= 22 * dt;
        it.y += it.vy * dt;
        const g = World.height(it.x, it.z) + 0.35;
        const s = World.solidTop(it.x, it.y, it.z, 0.3);
        const gy = Math.max(g, s > -1e8 ? s + 0.35 : g);
        if (it.y <= gy) { it.y = gy; it.vy = 0; it.settled = true; }
      }
    }
  }
};
