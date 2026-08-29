'use strict';
/* ============================================================
   أبطال العاصفة — الشخصيات: الهيكل، المظهر، الحركات
   ============================================================ */

/* أبطال العائلة */
const HEROES = [
  {
    id: 'aseel', name: 'أسيل', fem: true, title: 'قنّاصة الفجر',
    skin: [0.99, 0.82, 0.68], shirt: [0.10, 0.82, 0.76], pants: [0.09, 0.22, 0.40],
    hair: [0.15, 0.09, 0.06], accent: [1.00, 0.86, 0.26], hair2: 'long', gear: 'band',
    perk: 'دقّة أعلى مع أسلحة القنص', desc: 'هادئة، دقيقة، ولا تُخطئ الهدف من بعيد.'
  },
  {
    id: 'janan', name: 'جنان', fem: true, title: 'حارسة النجوم',
    skin: [1.00, 0.85, 0.72], shirt: [0.74, 0.24, 0.76], pants: [0.22, 0.13, 0.33],
    hair: [0.26, 0.13, 0.06], accent: [1.00, 0.56, 0.78], hair2: 'pony', gear: 'helm',
    perk: 'درع إضافي عند بداية الجولة', desc: 'شجاعة تحمي فريقها وتبني أسرع من الجميع.'
  },
  {
    id: 'abdullah', name: 'عبدالله', fem: false, title: 'قائد الميدان',
    skin: [0.94, 0.77, 0.61], shirt: [0.13, 0.42, 0.88], pants: [0.90, 0.92, 0.95],
    hair: [0.09, 0.07, 0.05], accent: [0.96, 0.96, 1.00], hair2: 'short', gear: 'cap',
    perk: 'مواد بناء أكثر عند الحصاد', desc: 'يخطّط قبل أن يتحرّك، ويصنع البرج في لمح البصر.'
  },
  {
    id: 'osama', name: 'أسامة', fem: false, title: 'صائد العواصف',
    skin: [0.90, 0.72, 0.55], shirt: [0.96, 0.49, 0.11], pants: [0.19, 0.33, 0.19],
    hair: [0.12, 0.08, 0.05], accent: [0.28, 0.86, 0.36], hair2: 'short', gear: 'goggles',
    perk: 'سرعة جري أعلى', desc: 'سريع، جريء، وأوّل من يهبط في قلب المعركة.'
  }
];

const BOT_NAMES = ['سالم', 'نورة', 'فيصل', 'ريما', 'خالد', 'لمى', 'بدر', 'هيا', 'ماجد', 'دانة',
  'طلال', 'شهد', 'راكان', 'جود', 'يزيد', 'رغد', 'نايف', 'ملاك', 'زياد', 'وعد'];
const BOT_FEM = { 'نورة': 1, 'ريما': 1, 'لمى': 1, 'هيا': 1, 'دانة': 1, 'شهد': 1, 'جود': 1, 'رغد': 1, 'ملاك': 1, 'وعد': 1 };

const BOT_PALETTES = [
  { shirt: [0.85, 0.22, 0.25], pants: [0.18, 0.20, 0.26], accent: [1.0, 0.8, 0.3] },
  { shirt: [0.20, 0.62, 0.35], pants: [0.24, 0.22, 0.18], accent: [0.9, 0.95, 0.5] },
  { shirt: [0.30, 0.34, 0.72], pants: [0.14, 0.16, 0.22], accent: [0.6, 0.8, 1.0] },
  { shirt: [0.86, 0.62, 0.16], pants: [0.30, 0.22, 0.14], accent: [1.0, 0.9, 0.6] },
  { shirt: [0.62, 0.24, 0.62], pants: [0.20, 0.14, 0.26], accent: [0.95, 0.6, 0.95] },
  { shirt: [0.18, 0.55, 0.62], pants: [0.16, 0.24, 0.28], accent: [0.6, 0.95, 1.0] },
  { shirt: [0.80, 0.80, 0.84], pants: [0.28, 0.30, 0.34], accent: [0.5, 0.55, 0.6] },
  { shirt: [0.45, 0.28, 0.18], pants: [0.22, 0.26, 0.20], accent: [0.9, 0.75, 0.45] }
];
const SKINS = [[0.99, 0.83, 0.69], [0.93, 0.75, 0.59], [0.85, 0.65, 0.48], [0.72, 0.52, 0.38], [0.58, 0.40, 0.28]];
const HAIRS = [[0.10, 0.08, 0.06], [0.20, 0.12, 0.07], [0.35, 0.22, 0.10], [0.55, 0.42, 0.20], [0.12, 0.12, 0.14]];

/* ============================================================
   Chars — بناء الأجزاء وتحريكها
   ============================================================ */
const Chars = {
  parts: {}, lists: {},
  hairs: ['short', 'long', 'pony'],
  gears: [null, 'cap', 'helm', 'band', 'goggles', 'visor'],

  init(gl) {
    const P = this.parts;
    const mk = (name, md, max) => {
      const m = new Mesh(gl, md); m.instances(max || 40);
      P[name] = m; this.lists[name] = new InstList(m);
    };

    // الحوض
    let md = new MeshData();
    md.add(Geo.box(0.44, 0.26, 0.28), {}, [1, 1, 1]);
    md.add(Geo.box(0.46, 0.09, 0.30), { y: 0.10 }, [0.55, 0.55, 0.60]);
    mk('hips', md);

    // الجذع (مع خطوط تمييز مخبوزة)
    md = new MeshData();
    md.add(Geo.box(0.50, 0.60, 0.30), { y: 0.30 }, [1, 1, 1]);
    md.add(Geo.box(0.52, 0.10, 0.32), { y: 0.12 }, [0.42, 0.42, 0.46]);
    md.add(Geo.box(0.13, 0.34, 0.02), { y: 0.32, z: 0.16 }, [0.78, 0.78, 0.82]);
    md.add(Geo.box(0.545, 0.185, 0.345), { y: 0.505 }, [0.82, 0.82, 0.86]);
    md.add(Geo.box(0.062, 0.062, 0.028), { y: 0.44, z: 0.168, x: 0.145 }, [1.7, 1.6, 0.9]);
    mk('torso', md);

    // الرأس — الوجه مخبوز كأقنعة لونية تضرب في لون البشرة
    md = new MeshData();
    md.add(Geo.sphere(0.185, 18, 14, 1.06), {}, [1, 1, 1]);
    md.add(Geo.sphere(0.040, 8, 6, 1.30), { x: 0.176, y: -0.005 }, [0.96, 0.96, 0.96]);
    md.add(Geo.sphere(0.040, 8, 6, 1.30), { x: -0.176, y: -0.005 }, [0.96, 0.96, 0.96]);
    md.add(Geo.sphere(0.046, 10, 8, 0.96), { x: 0.073, y: 0.028, z: 0.152 }, [0.10, 0.10, 0.14]);
    md.add(Geo.sphere(0.046, 10, 8, 0.96), { x: -0.073, y: 0.028, z: 0.152 }, [0.10, 0.10, 0.14]);
    md.add(Geo.sphere(0.017, 7, 5), { x: 0.086, y: 0.046, z: 0.180 }, [3.0, 3.0, 3.0]);
    md.add(Geo.sphere(0.017, 7, 5), { x: -0.060, y: 0.046, z: 0.180 }, [3.0, 3.0, 3.0]);
    md.add(Geo.box(0.072, 0.019, 0.022), { x: 0.079, y: 0.088, z: 0.155, rz: -0.24 }, [0.34, 0.25, 0.21]);
    md.add(Geo.box(0.072, 0.019, 0.022), { x: -0.079, y: 0.088, z: 0.155, rz: 0.24 }, [0.34, 0.25, 0.21]);
    md.add(Geo.sphere(0.026, 8, 6), { y: -0.012, z: 0.172 }, [0.95, 0.93, 0.92]);
    md.add(Geo.box(0.062, 0.017, 0.022), { y: -0.068, z: 0.166 }, [0.52, 0.26, 0.25]);
    md.add(Geo.box(0.020, 0.017, 0.022), { x: 0.039, y: -0.057, z: 0.163, rz: 0.62 }, [0.52, 0.26, 0.25]);
    md.add(Geo.box(0.020, 0.017, 0.022), { x: -0.039, y: -0.057, z: 0.163, rz: -0.62 }, [0.52, 0.26, 0.25]);
    md.add(Geo.box(0.125, 0.12, 0.105), { y: -0.165 }, [0.94, 0.94, 0.94]);
    mk('head', md);

    // العضد (محوره عند الكتف)
    md = new MeshData();
    md.add(Geo.box(0.145, 0.34, 0.155), { y: -0.17 }, [1, 1, 1]);
    md.add(Geo.sphere(0.095, 10, 8), { y: 0.01 }, [1, 1, 1]);
    mk('armU', md, 60);

    // الساعد + اليد
    md = new MeshData();
    md.add(Geo.box(0.128, 0.30, 0.135), { y: -0.15 }, [1, 1, 1]);
    md.add(Geo.box(0.145, 0.09, 0.155), { y: -0.02 }, [0.45, 0.45, 0.50]);
    md.add(Geo.sphere(0.085, 10, 8), { y: -0.33 }, [1, 1, 1]);
    mk('armL', md, 60);

    // الفخذ
    md = new MeshData();
    md.add(Geo.box(0.175, 0.40, 0.185), { y: -0.20 }, [1, 1, 1]);
    md.add(Geo.sphere(0.105, 10, 8), { y: -0.02 }, [1, 1, 1]);
    mk('legU', md, 60);

    // الساق + الحذاء
    md = new MeshData();
    md.add(Geo.box(0.155, 0.36, 0.165), { y: -0.18 }, [1, 1, 1]);
    md.add(Geo.box(0.175, 0.13, 0.30), { y: -0.40, z: 0.055 }, [0.28, 0.27, 0.30]);
    md.add(Geo.box(0.185, 0.06, 0.32), { y: -0.455, z: 0.055 }, [0.90, 0.90, 0.95]);
    mk('legL', md, 60);

    // حقيبة الظهر
    md = new MeshData();
    md.add(Geo.box(0.30, 0.36, 0.17), {}, [0.82, 0.82, 0.85]);
    md.add(Geo.box(0.32, 0.085, 0.19), { y: 0.09 }, [0.50, 0.50, 0.54]);
    md.add(Geo.box(0.11, 0.11, 0.045), { y: -0.05, z: 0.10 }, [1.7, 1.5, 0.7]);
    mk('pack', md);

    /* ---- الشعر (يُصبغ بلون الشعر) ---- */
    const hairDome = (r, sy, cy) => Geo.filterTris(
      Geo.sphere(r, 16, 12, sy),
      (x, y, z) => z < 0.055 + (y + cy) * 1.15);   // خطّ شعر طبيعي يكشف الوجه

    md = new MeshData();                       // شعر قصير
    md.add(hairDome(0.197, 0.98, 0.05), { y: 0.05 }, [1, 1, 1]);
    md.add(Geo.box(0.055, 0.10, 0.09), { x: 0.163, y: -0.03, z: 0.055 }, [0.94, 0.94, 0.94]);
    md.add(Geo.box(0.055, 0.10, 0.09), { x: -0.163, y: -0.03, z: 0.055 }, [0.94, 0.94, 0.94]);
    mk('hair_short', md, 40);

    md = new MeshData();                       // شعر طويل
    md.add(hairDome(0.199, 1.0, 0.05), { y: 0.05 }, [1, 1, 1]);
    md.add(Geo.sphere(0.185, 12, 9, 1.05), { y: -0.02, z: -0.055 }, [0.96, 0.96, 0.96]);
    md.add(Geo.box(0.30, 0.40, 0.15), { y: -0.24, z: -0.075 }, [0.92, 0.92, 0.92]);
    md.add(Geo.box(0.24, 0.12, 0.13), { y: -0.44, z: -0.075 }, [0.88, 0.88, 0.88]);
    md.add(Geo.box(0.070, 0.24, 0.11), { x: 0.150, y: -0.125, z: -0.035 }, [0.95, 0.95, 0.95]);
    md.add(Geo.box(0.070, 0.24, 0.11), { x: -0.150, y: -0.125, z: -0.035 }, [0.95, 0.95, 0.95]);
    mk('hair_long', md, 40);

    md = new MeshData();                       // ذيل حصان
    md.add(hairDome(0.198, 0.98, 0.05), { y: 0.05 }, [1, 1, 1]);
    md.add(Geo.sphere(0.10, 10, 8), { y: 0.04, z: -0.20 }, [0.90, 0.90, 0.90]);
    for (let i = 0; i < 5; i++) {
      md.add(Geo.sphere(0.085 - i * 0.010, 9, 7), { y: -0.02 - i * 0.085, z: -0.24 - i * 0.028 }, [0.95 - i * 0.03, 0.95 - i * 0.03, 0.95 - i * 0.03]);
    }
    md.add(Geo.box(0.052, 0.19, 0.10), { x: 0.156, y: -0.105, z: -0.02 }, [0.95, 0.95, 0.95]);
    md.add(Geo.box(0.052, 0.19, 0.10), { x: -0.156, y: -0.105, z: -0.02 }, [0.95, 0.95, 0.95]);
    mk('hair_pony', md, 40);

    /* ---- العتاد فوق الرأس (صدفة متّحدة المركز مع الرأس، تُصبغ بلون التمييز) ---- */
    const shell = (r, sy, yMin, yMax) => Geo.filterTris(
      Geo.sphere(r, 18, 14, sy),
      (x, y, z) => y > yMin && (yMax === undefined || y < yMax));

    md = new MeshData();                       // قبّعة
    md.add(shell(0.201, 1.05, 0.086), {}, [1, 1, 1]);
    md.add(Geo.box(0.30, 0.038, 0.21), { y: 0.096, z: 0.190, rx: -0.14 }, [0.82, 0.82, 0.86]);
    md.add(Geo.sphere(0.040, 8, 6), { y: 0.208 }, [0.66, 0.66, 0.70]);
    md.add(Geo.box(0.085, 0.050, 0.028), { y: 0.145, z: 0.163 }, [1.9, 1.8, 1.2]);
    mk('gear_cap', md, 24);

    md = new MeshData();                       // خوذة بنجمة
    md.add(shell(0.212, 1.02, 0.070), {}, [1, 1, 1]);
    md.add(Geo.box(0.40, 0.046, 0.06), { y: 0.086, z: 0.168, rx: -0.12 }, [0.80, 0.80, 0.84]);
    md.add(Geo.box(0.070, 0.150, 0.130), { x: 0.196, y: 0.010 }, [0.90, 0.90, 0.94]);
    md.add(Geo.box(0.070, 0.150, 0.130), { x: -0.196, y: 0.010 }, [0.90, 0.90, 0.94]);
    md.add(Geo.cylinder(0.034, 0.034, 0.10, 8), { y: 0.245 }, [0.72, 0.72, 0.76]);
    md.add(Geo.sphere(0.068, 9, 7), { y: 0.315 }, [2.2, 2.0, 0.9]);
    mk('gear_helm', md, 24);

    md = new MeshData();                       // عصابة رأس
    md.add(shell(0.200, 1.05, 0.092, 0.152), {}, [1, 1, 1]);
    md.add(Geo.box(0.068, 0.048, 0.032), { y: 0.120, z: 0.174 }, [1.9, 1.8, 1.1]);
    md.add(Geo.box(0.085, 0.062, 0.135), { y: 0.108, z: -0.180, rz: 0.28 }, [0.86, 0.86, 0.90]);
    mk('gear_band', md, 24);

    md = new MeshData();                       // نظّارات على الجبين
    md.add(shell(0.199, 1.05, 0.104, 0.156), {}, [1, 1, 1]);
    md.add(Geo.box(0.33, 0.085, 0.070), { y: 0.150, z: 0.128 }, [0.55, 0.55, 0.62]);
    md.add(Geo.sphere(0.062, 10, 8, 0.82), { x: 0.092, y: 0.152, z: 0.160 }, [0.35, 1.5, 2.0]);
    md.add(Geo.sphere(0.062, 10, 8, 0.82), { x: -0.092, y: 0.152, z: 0.160 }, [0.35, 1.5, 2.0]);
    mk('gear_goggles', md, 24);

    md = new MeshData();                       // واقٍ رياضي
    md.add(shell(0.199, 1.05, 0.088, 0.150), {}, [1, 1, 1]);
    md.add(Geo.box(0.32, 0.052, 0.20), { y: 0.112, z: 0.150, rx: -0.18 }, [0.88, 0.88, 0.92]);
    md.add(Geo.box(0.080, 0.070, 0.032), { y: 0.118, z: 0.212 }, [2.0, 1.9, 1.2]);
    md.add(Geo.wedge(0.065, 0.12, 0.20), { y: 0.150, z: -0.085 }, [0.80, 0.80, 0.85]);
    mk('gear_visor', md, 24);

    // الشراع
    md = new MeshData();
    md.add(Geo.box(3.6, 0.10, 1.5), { y: 0 }, [1, 1, 1]);
    md.add(Geo.wedge(3.6, 0.55, 1.5), { y: 0.05 }, [1, 1, 1]);
    md.add(Geo.wedge(3.6, 0.55, 1.5), { y: 0.05, ry: Math.PI }, [0.88, 0.88, 0.92]);
    md.add(Geo.box(0.10, 1.0, 0.10), { x: 0.55, y: -0.5 }, [0.35, 0.35, 0.40]);
    md.add(Geo.box(0.10, 1.0, 0.10), { x: -0.55, y: -0.5 }, [0.35, 0.35, 0.40]);
    md.add(Geo.box(1.3, 0.10, 0.10), { y: -1.0 }, [0.40, 0.40, 0.45]);
    mk('glider', md, 20);

    // ظل بسيط تحت الشخصية
    md = new MeshData();
    md.add(Geo.cylinder(0.5, 0.5, 0.02, 16), {}, [1, 1, 1]);
    mk('blob', md, 40);

    this.order = ['hips', 'torso', 'head', 'armU', 'armL', 'legU', 'legL', 'pack',
      'hair_short', 'hair_long', 'hair_pony',
      'gear_cap', 'gear_helm', 'gear_band', 'gear_goggles', 'gear_visor', 'glider'];
  },

  resetLists() { for (const k in this.lists) this.lists[k].reset(); },
  flushLists() { for (const k in this.lists) this.lists[k].flush(); },

  /* ---------- حساب الوضعية ---------- */
  pose(e, t) {
    const a = e.anim || (e.anim = {
      legL: 0, legR: 0, shinL: 0, shinR: 0, armL: 0, armR: 0, foreL: 0, foreR: 0,
      armLZ: 0, armRZ: 0, torsoX: 0, torsoY: 0, headX: 0, headY: 0,
      bob: 0, lean: 0, phase: 0, breathe: 0, land: 0, rootX: 0
    });

    const speed = Math.hypot(e.vel[0], e.vel[2]);
    const moving = speed > 0.35 && e.grounded;
    const runF = clamp(speed / 7.5, 0, 1.4);
    const dtp = Math.min(0.05, e.dt || 0.016);

    if (e.state === 'skydive') {
      a.phase = 0;
      const w = Math.sin(t * 3.2) * 0.12;
      lerpTo(a, 'armL', -2.35 + w, 8, dtp); lerpTo(a, 'armR', -2.35 - w, 8, dtp);
      lerpTo(a, 'armLZ', -0.85, 8, dtp); lerpTo(a, 'armRZ', 0.85, 8, dtp);
      lerpTo(a, 'foreL', -0.5, 8, dtp); lerpTo(a, 'foreR', -0.5, 8, dtp);
      lerpTo(a, 'legL', -0.55 + w, 8, dtp); lerpTo(a, 'legR', -0.55 - w, 8, dtp);
      lerpTo(a, 'shinL', 0.85, 8, dtp); lerpTo(a, 'shinR', 0.85, 8, dtp);
      lerpTo(a, 'rootX', -1.12, 6, dtp);
      lerpTo(a, 'torsoX', -0.28, 6, dtp); lerpTo(a, 'headX', 0.85, 6, dtp);
      lerpTo(a, 'bob', 0, 6, dtp);
    } else if (e.state === 'glide') {
      const w = Math.sin(t * 2.0) * 0.07;
      lerpTo(a, 'armL', -2.9 + w, 8, dtp); lerpTo(a, 'armR', -2.9 - w, 8, dtp);
      lerpTo(a, 'armLZ', -0.25, 8, dtp); lerpTo(a, 'armRZ', 0.25, 8, dtp);
      lerpTo(a, 'foreL', -0.15, 8, dtp); lerpTo(a, 'foreR', -0.15, 8, dtp);
      lerpTo(a, 'legL', 0.28 + w, 8, dtp); lerpTo(a, 'legR', 0.28 - w, 8, dtp);
      lerpTo(a, 'shinL', 0.35, 8, dtp); lerpTo(a, 'shinR', 0.35, 8, dtp);
      lerpTo(a, 'rootX', -0.30, 6, dtp);
      lerpTo(a, 'torsoX', -0.10, 6, dtp); lerpTo(a, 'headX', 0.30, 6, dtp);
    } else if (e.swimming) {
      a.phase += dtp * 5.2;
      const s2 = Math.sin(a.phase), c2 = Math.cos(a.phase);
      lerpTo(a, 'rootX', -1.02, 6, dtp);                 // الجسد أفقيّ على الماء
      a.armR = -1.55 + s2 * 1.15; a.armL = -1.55 - s2 * 1.15;
      lerpTo(a, 'armRZ', 0.55, 8, dtp); lerpTo(a, 'armLZ', -0.55, 8, dtp);
      lerpTo(a, 'foreR', -0.45, 8, dtp); lerpTo(a, 'foreL', -0.45, 8, dtp);
      a.legR = c2 * 0.42; a.legL = -c2 * 0.42;
      lerpTo(a, 'shinR', 0.30, 8, dtp); lerpTo(a, 'shinL', 0.30, 8, dtp);
      lerpTo(a, 'torsoX', 0.18, 6, dtp); lerpTo(a, 'headX', 0.75, 6, dtp);
      lerpTo(a, 'bob', 0, 6, dtp);
    } else if (!e.grounded) {
      lerpTo(a, 'rootX', 0, 7, dtp);
      const up = e.vel[1] > 0.5;
      lerpTo(a, 'legL', up ? -0.75 : -0.28, 10, dtp);
      lerpTo(a, 'legR', up ? -0.30 : 0.35, 10, dtp);
      lerpTo(a, 'shinL', up ? 1.15 : 0.35, 10, dtp);
      lerpTo(a, 'shinR', up ? 0.45 : 0.15, 10, dtp);
      lerpTo(a, 'armL', up ? -1.7 : -1.1, 9, dtp);
      lerpTo(a, 'armR', up ? -1.7 : -1.1, 9, dtp);
      lerpTo(a, 'armLZ', -0.45, 9, dtp); lerpTo(a, 'armRZ', 0.45, 9, dtp);
      lerpTo(a, 'foreL', -0.55, 9, dtp); lerpTo(a, 'foreR', -0.55, 9, dtp);
      lerpTo(a, 'torsoX', up ? -0.14 : 0.10, 7, dtp);
      lerpTo(a, 'bob', 0, 8, dtp);
    } else if (moving) {
      lerpTo(a, 'rootX', 0, 9, dtp);
      const freq = 4.2 + runF * 4.4;
      a.phase += dtp * freq;
      const s = Math.sin(a.phase), c = Math.cos(a.phase);
      const amp = 0.42 + runF * 0.46;
      const back = e.moveBack ? -1 : 1;
      a.legL = s * amp * back; a.legR = -s * amp * back;
      a.shinL = Math.max(0, -Math.sin(a.phase - 0.7)) * (0.55 + runF * 0.55);
      a.shinR = Math.max(0, -Math.sin(a.phase + Math.PI - 0.7)) * (0.55 + runF * 0.55);
      lerpTo(a, 'bob', 0, 1, dtp);
      a.bob = Math.abs(c) * 0.055 * (0.4 + runF) - 0.03;
      a.lean = clamp(runF * 0.10, 0, 0.14);
      lerpTo(a, 'torsoX', -a.lean + (e.crouch ? 0.32 : 0), 9, dtp);
      lerpTo(a, 'torsoY', s * 0.11 * back, 9, dtp);
      if (!e.aiming) {
        if (e.carry) {
          lerpTo(a, 'armR', -0.66 + s * 0.09, 10, dtp); lerpTo(a, 'armRZ', 0.22, 10, dtp);
          lerpTo(a, 'foreR', -0.62, 10, dtp);
          lerpTo(a, 'armL', -0.80 - s * 0.09, 10, dtp); lerpTo(a, 'armLZ', -0.50, 10, dtp);
          lerpTo(a, 'foreL', -0.86, 10, dtp);
        } else {
          a.armL = -s * amp * 0.85 * back; a.armR = s * amp * 0.85 * back;
          lerpTo(a, 'armLZ', -0.12, 9, dtp); lerpTo(a, 'armRZ', 0.12, 9, dtp);
          lerpTo(a, 'foreL', -0.45 - Math.max(0, s) * 0.3, 9, dtp);
          lerpTo(a, 'foreR', -0.45 - Math.max(0, -s) * 0.3, 9, dtp);
        }
      }
    } else {
      lerpTo(a, 'rootX', 0, 9, dtp);
      a.breathe += dtp;
      const b = Math.sin(a.breathe * 1.9) * 0.5 + 0.5;
      lerpTo(a, 'legL', 0, 8, dtp); lerpTo(a, 'legR', 0, 8, dtp);
      lerpTo(a, 'shinL', 0.03, 8, dtp); lerpTo(a, 'shinR', 0.03, 8, dtp);
      a.bob = b * 0.018 - 0.009;
      lerpTo(a, 'torsoX', (e.crouch ? 0.36 : 0) + b * 0.02, 8, dtp);
      lerpTo(a, 'torsoY', 0, 8, dtp);
      if (!e.aiming) {
        if (e.carry) {
          lerpTo(a, 'armR', -0.62 - b * 0.03, 8, dtp); lerpTo(a, 'armRZ', 0.21, 8, dtp);
          lerpTo(a, 'foreR', -0.60, 8, dtp);
          lerpTo(a, 'armL', -0.76 - b * 0.03, 8, dtp); lerpTo(a, 'armLZ', -0.48, 8, dtp);
          lerpTo(a, 'foreL', -0.84, 8, dtp);
        } else {
          lerpTo(a, 'armL', -0.06 - b * 0.03, 8, dtp); lerpTo(a, 'armR', -0.06 - b * 0.03, 8, dtp);
          lerpTo(a, 'armLZ', -0.14, 8, dtp); lerpTo(a, 'armRZ', 0.14, 8, dtp);
          lerpTo(a, 'foreL', -0.34, 8, dtp); lerpTo(a, 'foreR', -0.34, 8, dtp);
        }
      }
    }

    /* التصويب: الذراع اليمنى تتّجه نحو الهدف */
    if (e.aiming && e.state !== 'skydive' && e.state !== 'glide') {
      const pit = clamp(e.pitch, -1.2, 1.2);
      lerpTo(a, 'armR', -1.62 - pit, 16, dtp);
      lerpTo(a, 'armRZ', 0.30, 16, dtp);
      lerpTo(a, 'foreR', -0.10, 16, dtp);
      lerpTo(a, 'armL', -1.42 - pit * 0.85, 14, dtp);
      lerpTo(a, 'armLZ', -0.60, 14, dtp);
      lerpTo(a, 'foreL', -0.75, 14, dtp);
      lerpTo(a, 'torsoX', -pit * 0.30 + (e.crouch ? 0.30 : 0), 12, dtp);
      lerpTo(a, 'torsoY', -0.30, 12, dtp);
    }

    /* ارتداد إطلاق النار */
    if (e.recoilAnim > 0) {
      const k = e.recoilAnim;
      a.armR += k * 0.55; a.armL += k * 0.42; a.torsoX += k * 0.18;
      e.recoilAnim = Math.max(0, e.recoilAnim - dtp * 6.5);
    }
    /* ضربة الفأس */
    if (e.swing > 0) {
      const s = 1 - e.swing;
      const k = Math.sin(clamp(s, 0, 1) * Math.PI);
      a.armR = -2.6 + s * 4.0; a.armRZ = 0.25; a.foreR = -0.5 - k * 0.4;
      a.armL = -1.6 + s * 1.6; a.armLZ = -0.5; a.foreL = -0.9;
      a.torsoY = -0.5 + s * 0.9; a.torsoX = -0.1 + k * 0.25;
    }

    lerpTo(a, 'headX', clamp(e.pitch * 0.55, -0.6, 0.6) + (e.state === 'skydive' ? 0.5 : 0), 12, dtp);
    lerpTo(a, 'headY', 0, 10, dtp);
    if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dtp * 3.2);
    return a;
  },

  /* ---------- بناء مصفوفات العظام ورفعها للعرض ---------- */
  submit(e, t, opts) {
    const a = e.anim;
    const L = this.lists;
    const look = e.aiming ? e.yaw : e.bodyYaw;
    const crouch = e.crouch ? -0.24 : 0;
    const dead = e.state === 'dead';
    const hipY = (e.state === 'skydive' || e.state === 'glide') ? 0.95 : (0.95 + a.bob + crouch);

    const root = M.trs(TMP_A, e.pos[0], e.pos[1], e.pos[2], dead ? 1.35 : 0, look, 0, 1, 1, 1);
    const pelvis = M.mul(TMP_B, root, M.trs(TMP_C, 0, hipY, 0, a.rootX, 0, 0, 1, 1, 1));
    const torso = M.mul(M_T1, pelvis, M.trs(TMP_C, 0, 0.26, 0, a.torsoX, a.torsoY, 0, 1, 1, 1));
    const head = M.mul(M_T2, torso, M.trs(TMP_C, 0, 0.705, 0, a.headX, a.headY, 0, 1.17, 1.17, 1.17));

    const col = e.look;
    const dim = e.stormIn ? 0.72 : 1;
    const fl = e.hitFlash || 0;
    const mixC = (c) => [
      clamp(c[0] * dim + fl * 1.6, 0, 3), clamp(c[1] * dim + fl * 0.2, 0, 3), clamp(c[2] * dim + fl * 0.2, 0, 3)
    ];
    const skin = mixC(col.skin), shirt = mixC(col.shirt), pants = mixC(col.pants),
      hair = mixC(col.hair), acc = mixC(col.accent);
    const em = e.marked ? 0.22 : 0;

    L.hips.pushMat(pelvis, pants[0], pants[1], pants[2], em);
    L.torso.pushMat(torso, shirt[0], shirt[1], shirt[2], em);
    L.head.pushMat(head, skin[0], skin[1], skin[2], em);
    const hm = M.mul(M_T3, head, M.trs(TMP_C, 0, 0.0, 0, 0, 0, 0, 1, 1, 1));
    const hairMesh = L['hair_' + (col.hair2 || 'short')];
    if (hairMesh) hairMesh.pushMat(hm, hair[0], hair[1], hair[2], em);
    if (col.gear) {
      const gm = L['gear_' + col.gear];
      if (gm) gm.pushMat(hm, acc[0], acc[1], acc[2], em);
    }

    const packM = M.mul(M_T3, torso, M.trs(TMP_C, 0, 0.33, -0.235, 0.06, 0, 0, 1, 1, 1));
    L.pack.pushMat(packM, acc[0], acc[1], acc[2], em);

    // الأذرع
    const shoulderY = 0.52;
    const armRM = M.mul(M_T4, torso, M.trs(TMP_C, -0.335, shoulderY, 0, a.armR, 0, a.armRZ, 1, 1, 1));
    const armLM = M.mul(M_T5, torso, M.trs(TMP_C, 0.335, shoulderY, 0, a.armL, 0, a.armLZ, 1, 1, 1));
    L.armU.pushMat(armRM, shirt[0], shirt[1], shirt[2], em);
    L.armU.pushMat(armLM, shirt[0], shirt[1], shirt[2], em);
    const foreRM = M.mul(M_T6, armRM, M.trs(TMP_C, 0, -0.34, 0, a.foreR, 0, 0, 1, 1, 1));
    const foreLM = M.mul(M_T7, armLM, M.trs(TMP_C, 0, -0.34, 0, a.foreL, 0, 0, 1, 1, 1));
    L.armL.pushMat(foreRM, skin[0], skin[1], skin[2], em);
    L.armL.pushMat(foreLM, skin[0], skin[1], skin[2], em);

    // الأرجل
    const legRM = M.mul(M_T8, pelvis, M.trs(TMP_C, -0.125, -0.10, 0, a.legR, 0, 0, 1, 1, 1));
    const legLM = M.mul(M_T9, pelvis, M.trs(TMP_C, 0.125, -0.10, 0, a.legL, 0, 0, 1, 1, 1));
    L.legU.pushMat(legRM, pants[0], pants[1], pants[2], em);
    L.legU.pushMat(legLM, pants[0], pants[1], pants[2], em);
    L.legL.pushMat(M.mul(M_TA, legRM, M.trs(TMP_C, 0, -0.40, 0, a.shinR, 0, 0, 1, 1, 1)), pants[0], pants[1], pants[2], em);
    L.legL.pushMat(M.mul(M_TA, legLM, M.trs(TMP_C, 0, -0.40, 0, a.shinL, 0, 0, 1, 1, 1)), pants[0], pants[1], pants[2], em);

    // موضع اليد اليمنى (لتعليق السلاح)
    e.handM = M.mul(e.handM || M.create(), foreRM, M.trs(TMP_C, 0, -0.34, 0.02, 0, 0, 0, 1, 1, 1));
    e.headPos = [head[12], head[13], head[14]];

    // الشراع
    if (e.state === 'glide') {
      const gm = M.mul(M_T3, root, M.trs(TMP_C, 0, 3.05, 0.1, 0.12, 0, Math.sin(t * 1.4) * 0.06, 1, 1, 1));
      L.glider.pushMat(gm, acc[0] * 1.1, acc[1] * 1.1, acc[2] * 1.1, 0.1);
    }
  }
};

function lerpTo(o, k, target, rate, dt) {
  o[k] += (target - o[k]) * clamp(rate * dt, 0, 1);
}

/* مصفوفات مؤقتة مشتركة */
const TMP_A = M.create(), TMP_B = M.create(), TMP_C = M.create();
const M_T1 = M.create(), M_T2 = M.create(), M_T3 = M.create(), M_T4 = M.create(),
  M_T5 = M.create(), M_T6 = M.create(), M_T7 = M.create(), M_T8 = M.create(),
  M_T9 = M.create(), M_TA = M.create();
