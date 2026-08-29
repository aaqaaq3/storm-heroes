'use strict';
/* ============================================================
   أبطال العاصفة — منطق اللعبة الأساسي
   ============================================================ */

const GRAV = -26;
const EYE = 1.62;
const BODY_H = 1.85;
const RAD = 0.40;
const SPD_WALK = 5.6, SPD_SPRINT = 8.6, SPD_CROUCH = 2.7, SPD_AIM = 3.6;
const JUMP_V = 8.4;
const MAX_MAT = 500;

const STORM_PHASES = [
  { r: 300, wait: 34, shrink: 38, dps: 1 },
  { r: 195, wait: 28, shrink: 32, dps: 2 },
  { r: 128, wait: 24, shrink: 28, dps: 4 },
  { r: 80, wait: 21, shrink: 24, dps: 6 },
  { r: 46, wait: 18, shrink: 20, dps: 9 },
  { r: 20, wait: 15, shrink: 18, dps: 13 },
  { r: 0, wait: 12, shrink: 22, dps: 18 }
];

const G = {
  state: 'boot',
  gl: null, canvas: null,
  time: 0, dt: 0,
  ents: [], player: null, alive: 0, total: 16,
  particles: [], tracers: [], projectiles: [], dmgNums: [], feed: [],
  storm: null, busT: 0, bus: null,
  seed: 0, matchTime: 0,
  camPos: [0, 0, 0], camYaw: 0, camPitch: 0, camDist: 4.2, camShake: 0, camRoll: 0,
  fov: 76, targetFov: 76, scoped: false,
  hitMarker: 0, hitMarkerKill: 0,
  spectate: 0, placement: 0,
  worldReady: false,
  msg: null, msgT: 0,
  ping: [],

  /* ============ التهيئة ============ */
  init(canvas) {
    this.canvas = canvas;
    const gl = R.init(canvas);
    if (!gl) return false;
    this.gl = gl;
    Chars.init(gl);
    Weapons.init(gl);
    Build.init(gl);

    // شبكة الجسيمات
    this.partMesh = new Mesh(gl, Geo.quad(), 'particle');
    this.partMesh.instances(3000);

    // حافلة المعركة (منطاد)
    const md = new MeshData();
    // بالون بأشرطة رأسية ملوّنة (تقسيم مثلثات الكرة حسب الزاوية)
    const ballSeg = (keepMod) => Geo.filterTris(Geo.sphere(6.2, 24, 16, 1.25), (x, y, z) => {
      let a = Math.atan2(z, x); a = (a + TAU) % TAU;
      return Math.floor(a / (TAU / 10)) % 3 === keepMod;
    });
    md.add(ballSeg(0), { y: 9.5 }, [0.94, 0.26, 0.28]);
    md.add(ballSeg(1), { y: 9.5 }, [0.97, 0.95, 0.92]);
    md.add(ballSeg(2), { y: 9.5 }, [0.20, 0.52, 0.88]);
    md.add(Geo.cylinder(2.2, 3.0, 1.2, 16), { y: 16.9 }, [0.95, 0.85, 0.30]);
    md.add(Geo.sphere(1.1, 12, 9), { y: 17.9 }, [1.6, 1.4, 0.5]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.78;
      md.add(Geo.cylinder(0.08, 0.08, 4.4, 6), { x: Math.cos(a) * 2.6, y: 2.6, z: Math.sin(a) * 2.6 }, [0.30, 0.30, 0.34]);
    }
    md.add(Geo.box(9.5, 3.2, 4.6), { y: 0 }, [0.96, 0.86, 0.30]);
    md.add(Geo.box(9.9, 0.5, 5.0), { y: 1.7 }, [0.24, 0.26, 0.32]);
    md.add(Geo.box(9.9, 0.6, 5.0), { y: -1.7 }, [0.24, 0.26, 0.32]);
    for (let i = -1; i <= 1; i++) md.add(Geo.box(2.2, 1.5, 4.75), { x: i * 3.0, y: 0.3 }, [0.35, 0.68, 0.92]);
    md.add(Geo.box(1.2, 1.2, 0.3), { x: 0, y: 0.2, z: 2.4 }, [1.8, 1.6, 0.7]);
    this.busMesh = new Mesh(gl, md); this.busMesh.instances(1);
    this.busList = new InstList(this.busMesh);
    return true;
  },

  buildWorld(seed) {
    this.seed = seed;
    World.init(this.gl, seed);
    this.worldReady = true;
  },

  /* ============ بدء المباراة ============ */
  startMatch(heroId) {
    const rng = makeRng((Date.now() ^ 0x9e3779b9) >>> 0);
    Build.clear(); Loot.clear();
    this.particles.length = 0; this.tracers.length = 0;
    this.projectiles.length = 0; this.dmgNums.length = 0; this.feed.length = 0;
    this.ents = [];
    this.matchTime = 0;
    this.placement = 0;
    this.spectate = 0;

    for (const c of World.chests) c.open = false;
    for (const t of World.trees) { t.alive = true; t.hp = 160; }
    for (const r of World.rocks) { r.alive = true; r.hp = 200; }
    World.rebuildInstances();

    // مسار الحافلة
    const a0 = rng() * TAU;
    this.busFrom = [Math.cos(a0) * 460, 168, Math.sin(a0) * 460];
    this.busTo = [Math.cos(a0 + Math.PI) * 460, 168, Math.sin(a0 + Math.PI) * 460];
    const off = (rng() - 0.5) * 150;
    const px = -Math.sin(a0) * off, pz = Math.cos(a0) * off;
    this.busFrom[0] += px; this.busFrom[2] += pz;
    this.busTo[0] += px; this.busTo[2] += pz;
    this.busT = 0;
    this.busDur = 26;
    this.busGone = 0;
    this.busGrace = 0.9;
    this._rtHeld = true;
    this.busPos = [this.busFrom[0], this.busFrom[1], this.busFrom[2]];

    // اللاعب
    const hero = HEROES.find(h => h.id === heroId) || HEROES[0];
    const p = this.makeEnt(hero.name, hero, true);
    p.fem = hero.fem;
    this.player = p;
    this.ents.push(p);

    // إخوة العائلة كخصوم مميّزين
    for (const h of HEROES) {
      if (h.id === hero.id) continue;
      const e = this.makeEnt(h.name, h, false);
      e.fem = h.fem;
      e.family = true;
      e.ai = AI.create(clamp((0.58 + rng() * 0.22) * this.diffMul(), 0.06, 0.98));
      e.inv.mats = [180, 90, 40];
      this.ents.push(e);
    }

    // بوتات إضافية
    const names = BOT_NAMES.slice();
    for (let i = this.ents.length; i < this.total; i++) {
      const ni = Math.floor(rng() * names.length);
      const nm = names.splice(ni, 1)[0] || ('لاعب ' + i);
      const pal = BOT_PALETTES[Math.floor(rng() * BOT_PALETTES.length)];
      const look = {
        skin: SKINS[Math.floor(rng() * SKINS.length)],
        hair: HAIRS[Math.floor(rng() * HAIRS.length)],
        shirt: pal.shirt, pants: pal.pants, accent: pal.accent,
        hair2: Chars.hairs[Math.floor(rng() * Chars.hairs.length)],
        gear: Chars.gears[Math.floor(rng() * Chars.gears.length)]
      };
      const e = this.makeEnt(nm, null, false, look);
      e.fem = !!BOT_FEM[nm];
      e.ai = AI.create(clamp((0.20 + rng() * 0.55) * this.diffMul(), 0.05, 0.95));
      e.inv.mats = [140, 60, 0];
      this.ents.push(e);
    }

    // وضع الجميع في الحافلة
    for (const e of this.ents) {
      e.state = 'bus';
      V.set(e.pos, this.busFrom[0], this.busFrom[1], this.busFrom[2]);
      e.busJumpT = 3 + rng() * 20;
    }
    p.busJumpT = 1e9;

    // ميزة كل بطل
    if (hero.id === 'janan') p.shield = 40;
    if (hero.id === 'abdullah') p.harvestBonus = 1.6;
    if (hero.id === 'osama') p.speedBonus = 1.14;
    if (hero.id === 'aseel') p.aimBonus = 0.55;

    // العاصفة
    this.storm = {
      phase: -1, cx: 0, cz: 0, r: 420,
      nx: 0, nz: 0, nextR: STORM_PHASES[0].r,
      timer: 22, mode: 'wait', dps: 0, total: 22
    };
    this.nextPhase(true);

    this.alive = this.ents.length;
    this.state = 'bus';
    this.camYaw = Math.atan2(this.busTo[0] - this.busFrom[0], this.busTo[2] - this.busFrom[2]);
    this.camPitch = -0.25;
    this.showMsg(Input.gp.on ? 'اضغط ✕ للقفز فوق الجزيرة' : 'اضغط «مسافة» للقفز فوق الجزيرة', 6);
    SFX.stormLoop(true);
    UI.onMatchStart();
  },

  diffMul() {
    const d = (typeof UI !== 'undefined' && UI.diff) || 'normal';
    return d === 'easy' ? 0.55 : (d === 'hard' ? 1.35 : 1);
  },

  makeEnt(name, hero, isPlayer, lookOverride) {
    const look = lookOverride || (hero ? {
      skin: hero.skin, shirt: hero.shirt, pants: hero.pants,
      hair: hero.hair, accent: hero.accent, hair2: hero.hair2, gear: hero.gear
    } : {});
    return {
      name, hero: hero || null, isPlayer: !!isPlayer, look, fem: false, family: !!hero,
      pos: [0, 0, 0], vel: [0, 0, 0], yaw: 0, pitch: 0, bodyYaw: 0,
      hp: 100, shield: 0, state: 'bus', grounded: false, crouch: false,
      aiming: false, sprint: false, inWater: false, swimming: false,
      inv: {
        slots: [Weapons.make('pickaxe', 0), null, null, null, null],
        ammo: { light: 0, medium: 0, heavy: 0, shell: 0, rocket: 0 },
        mats: [50, 0, 0], shieldPots: 0, medkits: 0
      },
      slot: 0, mat: 0, swapT: 0, buildMode: false, buildType: 'wall',
      in: { mx: 0, mz: 0, jump: false, sprint: false, crouch: false, fire: false, aim: false, reload: false, build: null },
      ai: null, kills: 0, placement: 0, lastHitT: 99, lastAttacker: null,
      recoil: 0, recoilAnim: 0, swing: 0, hitFlash: 0, stormIn: false,
      healing: null, healT: 0, dt: 0.016, moveBack: false, marked: false,
      speedBonus: 1, harvestBonus: 1, aimBonus: 1, footT: 0, anim: null,
      handM: null, headPos: [0, 0, 0], busJumpT: 0, dmgDealt: 0
    };
  },

  /* ============ الحلقة ============ */
  update(dt) {
    this.dt = dt;
    this.time += dt;
    R.time = this.time;

    if (this.state === 'menu') { this.updateMenu(dt); return; }
    if (this.state === 'boot') return;

    this.matchTime += dt;
    this.updateStorm(dt);

    // الحافلة — تستمرّ في التحليق حتى ينزل كلّ اللاعبين
    if (this.busPos && this.ents.some(e => e.state === 'bus')) {
      this.busT += dt;
      const f = clamp(this.busT / this.busDur, 0, 1);
      const bp = this.busPos;
      bp[0] = lerp(this.busFrom[0], this.busTo[0], f);
      bp[1] = this.busFrom[1] + Math.sin(this.time * 0.7) * 1.2;
      bp[2] = lerp(this.busFrom[2], this.busTo[2], f);
      for (const e of this.ents) {
        if (e.state !== 'bus') continue;
        V.set(e.pos, bp[0], bp[1] - 3.2, bp[2]);
        if (e.isPlayer) {
          // اللاعب يقفز متى شاء — بضغطة جديدة، وبعد مهلة قصيرة
          // حتى لا تُحسب ضغطة زر «ابدأ المعركة» قفزًا فوريًّا
          const I = Input;
          this.busGrace = Math.max(0, (this.busGrace || 0) - dt);
          const fresh = I.pressed('Space') || I.clickPressed(0) ||
            (I.gp.on && (I.gpPressed(0) || (I.gp.rt > 0.45 && !this._rtHeld))) || I.touch.jump;
          this._rtHeld = I.gp.on && I.gp.rt > 0.45;
          if ((!UI.paused && this.busGrace <= 0 && fresh) || f > 0.965) this.jumpOut(e);
        } else {
          e.busJumpT -= dt;
          if (e.busJumpT <= 0 || f > 0.96) this.jumpOut(e);
        }
      }
      if (this.state === 'bus' && this.player.state !== 'bus') this.state = 'play';
    } else if (this.busPos) {
      this.busGone = (this.busGone || 0) + dt;
      if (this.busGone > 6) this.busPos = null;
      else {
        this.busT += dt * 1.6;
        const f = clamp(this.busT / this.busDur, 0, 1.4);
        this.busPos[0] = lerp(this.busFrom[0], this.busTo[0], f);
        this.busPos[2] = lerp(this.busFrom[2], this.busTo[2], f);
      }
    }

    // الكيانات
    for (const e of this.ents) {
      e.dt = dt;
      if (e.state === 'dead') { this.updateDead(e, dt); continue; }
      if (e.state === 'bus') continue;
      if (e.isPlayer) this.playerInput(e, dt);
      else AI.think(e, dt, this);
      this.updateEnt(e, dt);
    }

    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.updateTracers(dt);
    Loot.update(dt);
    this.updateCamera(dt);
    this.updateChests(dt);

    for (let i = this.dmgNums.length - 1; i >= 0; i--) {
      const d = this.dmgNums[i];
      d.t += dt; d.y += dt * 1.4;
      if (d.t > 1.05) this.dmgNums.splice(i, 1);
    }
    for (let i = this.feed.length - 1; i >= 0; i--) {
      this.feed[i].t += dt;
      if (this.feed[i].t > 6) this.feed.splice(i, 1);
    }
    if (this.msgT > 0) this.msgT -= dt;
    this.hitMarker = Math.max(0, this.hitMarker - dt * 3.2);
    this.camShake = Math.max(0, this.camShake - dt * 3.4);
    R.flash[0] = Math.max(0, R.flash[0] - dt * 2.6);
    R.flash[1] = Math.max(0, R.flash[1] - dt * 2.6);
    R.flash[2] = Math.max(0, R.flash[2] - dt * 2.6);

    // نهاية المباراة
    if (this.state === 'play' || this.state === 'spectate') {
      const liveEnts = this.ents.filter(e => e.state !== 'dead');
      this.alive = liveEnts.length;
      if (this.alive <= 1 && this.state !== 'over') {
        const w = liveEnts[0];
        if (w === this.player) this.endMatch(true);
        else if (this.player.state === 'dead') this.endMatch(false, w);
      }
    }
  },

  updateMenu(dt) {
    const focus = this.menuFocus || 0;
    for (let i = 0; i < this.ents.length; i++) {
      const e = this.ents[i];
      e.dt = dt;
      e.grounded = true;
      e.weapon = e.inv.slots[e.slot];
      e.carry = !!(e.weapon && e.weapon.def.kind !== 'melee');
      e.marked = (i === focus);
      e.aiming = false;
      // البطل المختار يلتفت نحو الكاميرا قليلًا ويقفز فرحًا كل حين
      if (i === focus) {
        e.menuT = (e.menuT || 0) + dt;
        if (e.menuT > 4.2) { e.menuT = 0; e.vel[1] = 4.2; }
        if (e.vel[1] !== 0) {
          e.vel[1] += GRAV * dt;
          e.pos[1] += e.vel[1] * dt;
          const gy = World.height(e.pos[0], e.pos[2]);
          if (e.pos[1] <= gy) { e.pos[1] = gy; e.vel[1] = 0; e.grounded = true; }
          else e.grounded = false;
        }
      } else { e.vel[1] = 0; }
      Chars.pose(e, this.time);
    }

    const a = this.menuAnchor || [0, 0, 0];
    const sel = this.ents[focus];
    const tx = sel ? lerp(a[0], sel.pos[0], 0.32) : a[0];
    const tz = sel ? lerp(a[2], sel.pos[2], 0.32) : a[2];
    const target = [tx, a[1] + 1.15, tz];
    const d = this.menuDir || [0, 0, 1];
    const base = Math.atan2(d[0], d[2]);
    const ang = base + Math.sin(this.time * 0.13) * 0.45;   // قوس أمامي هادئ
    const cam = [a[0] + Math.sin(ang) * 7.7, a[1] + 2.4, a[2] + Math.cos(ang) * 7.7];
    const camG = World.height(cam[0], cam[2]) + 1.6;
    if (cam[1] < camG) cam[1] = camG;
    V.lerp(this.camPos, this.camPos, cam, clamp(dt * 2.2, 0, 1));
    const dir = V.norm([0, 0, 0], V.sub([0, 0, 0], target, this.camPos));
    // إزاحة أفقية: لوحة الاختيار تشغل يمين الشاشة، فالأبطال إلى اليسار
    const shift = innerWidth > 820 ? -0.30 : 0;
    R.setSunTarget(a);
    R.setCamera(this.camPos, Math.atan2(dir[0], dir[2]) + shift, Math.asin(clamp(dir[1], -1, 1)), 56, 0);
  },

  /* ============ الحافلة والهبوط ============ */
  jumpOut(e) {
    e.state = 'skydive';
    e.vel[0] = 0; e.vel[1] = -2; e.vel[2] = 0;
    e.pos[1] = this.busPos[1] - 4;
    if (e.isPlayer) { SFX.glider(); this.state = 'play'; this.showMsg('اقفز! وجّه هبوطك', 1.6); }
  },

  /* ============ إدخال اللاعب ============ */
  playerInput(e, dt) {
    const i = e.in;
    const I = Input;
    i.mx = 0; i.mz = 0; i.build = null;
    if (UI.paused) {
      i.fire = false; i.aim = false; i.reload = false; i.jump = false; i.sprint = false;
      return;
    }

    const gp = I.gp;
    let mx = 0, mz = 0;
    if (I.isDown('KeyW')) mz += 1;
    if (I.isDown('KeyS')) mz -= 1;
    if (I.isDown('KeyA')) mx += 1;
    if (I.isDown('KeyD')) mx -= 1;
    mx += I.touch.moveX; mz += I.touch.moveY;
    if (gp.on) { mx += -gp.lx; mz += -gp.ly; }
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    i.mx = mx; i.mz = mz;
    e.moveBack = mz < -0.3;

    i.sprint = I.isDown('ShiftLeft') || I.isDown('ShiftRight') || I.touch.sprint || (gp.on && I.gpDown(10));
    i.jump = I.isDown('Space') || I.touch.jump || (gp.on && I.gpDown(0));
    i.crouch = I.isDown('ControlLeft') || (gp.on && I.gpDown(1));
    i.reload = I.pressed('KeyR') || (gp.on && I.gpPressed(4));
    i.fire = I.mouse[0] || I.touch.fire || (gp.on && gp.rt > 0.45);
    i.aim = (I.mouse[2] || (gp.on && gp.lt > 0.35)) && !e.buildMode;

    // النظر
    const [dx, dy] = I.takeMouse();
    const sens = 0.00235 * (this.scoped ? 0.38 : (e.aiming ? 0.62 : 1));
    e.yaw -= dx * sens;
    e.pitch -= dy * sens;
    if (I.isDown('ArrowLeft')) e.yaw += dt * 2.0;
    if (I.isDown('ArrowRight')) e.yaw -= dt * 2.0;
    if (I.isDown('ArrowUp')) e.pitch += dt * 1.6;
    if (I.isDown('ArrowDown')) e.pitch -= dt * 1.6;
    if (gp.on) {
      const zoom = this.scoped ? 0.40 : (e.aiming ? 0.68 : 1);
      const gl = I.gpLook(dt);
      e.yaw -= gl[0] * zoom;
      e.pitch -= gl[1] * zoom;
    }
    e.pitch = clamp(e.pitch, -1.45, 1.45);
    e.yaw = ((e.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;

    if (e.state === 'skydive' || e.state === 'glide' || e.state === 'dead') return;

    // اختيار الخانة
    for (let k = 0; k < 5; k++) {
      if (I.pressed('Digit' + (k + 1))) { this.selectSlot(e, k); e.buildMode = false; }
    }
    const wh = I.takeWheel();
    if (wh) {
      if (e.buildMode) {
        const t = Build.types;
        let idx = t.findIndex(x => x.id === e.buildType);
        idx = (idx + (wh > 0 ? 1 : -1) + t.length) % t.length;
        e.buildType = t[idx].id;
      } else {
        let s = e.slot;
        for (let k = 0; k < 5; k++) {
          s = (s + (wh > 0 ? 1 : -1) + 5) % 5;
          if (e.inv.slots[s]) break;
        }
        this.selectSlot(e, s);
      }
    }

    /* --- أزرار يد التحكّم --- */
    if (gp.on) {
      if (I.gpPressed(5)) {                       // R1: السلاح التالي
        let sl = e.slot;
        for (let k = 0; k < 5; k++) { sl = (sl + 1) % 5; if (e.inv.slots[sl]) break; }
        this.selectSlot(e, sl); e.buildMode = false;
      }
      if (I.gpPressed(2)) { e.buildMode = !e.buildMode; SFX.ui('click'); }   // مربّع: وضع البناء
      if (I.gpPressed(3)) this.tryInteract(e);                               // مثلّث: فتح/التقاط
      if (I.gpPressed(12)) this.useHeal(e);                                  // ↑ : درع/علاج
      if (I.gpPressed(13)) { e.mat = (e.mat + 1) % 3; SFX.ui('hover'); }     // ↓ : تغيير المادة
      if (I.gpPressed(14) || I.gpPressed(15)) {                              // ←/→ : نوع البناء
        const t = Build.types;
        let idx = t.findIndex(x => x.id === e.buildType);
        idx = (idx + (I.gpPressed(15) ? 1 : t.length - 1)) % t.length;
        e.buildType = t[idx].id; e.buildMode = true;
      }
      if (I.gpPressed(11)) { this.selectSlot(e, 0); e.buildMode = false; }   // R3: الفأس
      // Options (إيقاف) وShare (الخريطة) تُدار في UI.gamepadNav لأنها تعمل
      // حتى واللعبة متوقّفة أو الخريطة مفتوحة
    }

    // وضع البناء
    if (I.pressed('KeyG') || I.pressed('KeyB')) { e.buildMode = !e.buildMode; SFX.ui('click'); }
    if (I.pressed('KeyZ')) { e.buildMode = true; e.buildType = 'wall'; }
    if (I.pressed('KeyX')) { e.buildMode = true; e.buildType = 'floor'; }
    if (I.pressed('KeyC')) { e.buildMode = true; e.buildType = 'ramp'; }
    if (I.pressed('KeyV')) { e.buildMode = true; e.buildType = 'pyr'; }
    if (I.pressed('KeyF')) { e.mat = (e.mat + 1) % 3; SFX.ui('hover'); }
    if (I.pressed('KeyQ')) { e.mat = (e.mat + 1) % 3; SFX.ui('hover'); }
    if (I.pressed('KeyE')) this.tryInteract(e);
    if (I.pressed('KeyH') || I.pressed('KeyT')) this.useHeal(e);

    if (e.buildMode) { i.aim = false; if (i.fire) i.build = e.buildType; }

    // تصويب مساعد لطيف عند اللعب بيد التحكّم
    if (gp.on && Input.aimAssist && !e.buildMode && e.weapon && e.weapon.def.kind !== 'melee') {
      this.aimAssist(e, dt, e.aiming ? 5.0 : (i.fire ? 3.0 : 1.4));
    }
  },

  /* ينجذب التصويب برفق نحو أقرب خصم داخل مخروط ضيّق أمام اللاعب */
  aimAssist(e, dt, strength) {
    const cp = Math.cos(e.pitch), sp = Math.sin(e.pitch);
    const fwd = [Math.sin(e.yaw) * cp, sp, Math.cos(e.yaw) * cp];
    const range = e.weapon.def.range * 0.8;
    let best = null, bestDot = 0.9885;            // ≈ ٨٫٧ درجات
    const to = [0, 0, 0];
    for (const o of this.ents) {
      if (o === e || o.state === 'dead' || o.state === 'bus') continue;
      const dx = o.pos[0] - e.pos[0], dz = o.pos[2] - e.pos[2];
      const dy = (o.pos[1] + 1.15) - (e.pos[1] + EYE);
      const d = Math.hypot(dx, dy, dz);
      if (d > range || d < 1.5) continue;
      const nx = dx / d, ny = dy / d, nz = dz / d;
      const dot = nx * fwd[0] + ny * fwd[1] + nz * fwd[2];
      if (dot <= bestDot) continue;
      if (!this.hasLOS(e, o)) continue;
      bestDot = dot; best = o;
      to[0] = nx; to[1] = ny; to[2] = nz;
    }
    if (!best) return;
    const wantYaw = Math.atan2(to[0], to[2]);
    const wantPitch = Math.asin(clamp(to[1], -1, 1));
    const k = clamp(dt * strength, 0, 0.4);
    e.yaw = angleLerp(e.yaw, wantYaw, k);
    e.pitch += (wantPitch - e.pitch) * k;
  },

  selectSlot(e, k) {
    if (e.slot === k) return;
    if (!e.inv.slots[k]) return;
    e.slot = k; e.swapT = 0.25;
    e.weaponRef = null;
    if (e.isPlayer) { SFX.ui('hover'); this.scoped = false; }
  },

  /* ============ تحديث الكيان ============ */
  updateEnt(e, dt) {
    const i = e.in;
    e.lastHitT += dt;
    if (e.swapT > 0) e.swapT -= dt;
    if (e.buildCool > 0) e.buildCool -= dt;
    if (e.swing > 0) e.swing = Math.max(0, e.swing - dt * 3.4);
    e.weapon = e.inv.slots[e.slot];
    e.carry = !!(e.weapon && e.weapon.def.kind !== 'melee') && e.swapT <= 0;

    /* --- القفز بالمظلة --- */
    if (e.state === 'skydive' || e.state === 'glide') {
      const glide = e.state === 'glide';
      const fwd = [Math.sin(e.yaw), 0, Math.cos(e.yaw)];
      const rgt = [Math.cos(e.yaw), 0, -Math.sin(e.yaw)];
      const acc = glide ? 26 : 34;
      e.vel[0] += (fwd[0] * i.mz + rgt[0] * i.mx) * acc * dt;
      e.vel[2] += (fwd[2] * i.mz + rgt[2] * i.mx) * acc * dt;
      const maxH = glide ? 17 : 26;
      const hs = Math.hypot(e.vel[0], e.vel[2]);
      if (hs > maxH) { e.vel[0] *= maxH / hs; e.vel[2] *= maxH / hs; }
      e.vel[0] *= (1 - dt * 1.1); e.vel[2] *= (1 - dt * 1.1);
      const termV = glide ? -13 : -52;
      e.vel[1] += GRAV * dt * (glide ? 0.55 : 1.4);
      if (e.vel[1] < termV) e.vel[1] = termV;
      e.pos[0] += e.vel[0] * dt; e.pos[1] += e.vel[1] * dt; e.pos[2] += e.vel[2] * dt;

      const gy = this.groundHeight(e.pos, 0);
      const above = e.pos[1] - gy;
      if (!glide && (above < 42 || (e.isPlayer && Input.pressed('Space')))) {
        e.state = 'glide';
        if (e.isPlayer) SFX.glider();
      }
      if (above <= 0.05) {
        e.pos[1] = gy; e.vel[1] = 0; e.state = 'ground'; e.grounded = true;
        SFX.land(e.isPlayer ? 1 : 0.35);
        this.spawnDust(e.pos, 10, 1.2);
        if (e.isPlayer) { this.camShake = 0.35; this.showMsg('هبوط ناجح! ابحث عن الغنائم', 2.2); }
      }
      this.clampToWorld(e);
      Chars.pose(e, this.time);
      return;
    }

    /* --- في الأرض --- */
    const inStorm = Math.hypot(e.pos[0] - this.storm.cx, e.pos[2] - this.storm.cz) > this.storm.r;
    e.stormIn = inStorm;
    if (inStorm) {
      e.dmgAcc = (e.dmgAcc || 0) + this.storm.dps * dt;
      if (e.dmgAcc >= 1) {
        const d = Math.floor(e.dmgAcc); e.dmgAcc -= d;
        this.damage(e, d, null, e.pos, 'storm');
      }
    }

    // العلاج
    if (e.healing) {
      e.healT -= dt;
      const still = Math.hypot(e.vel[0], e.vel[2]) < 1.2;
      if (!still || e.lastHitT < 0.25) { e.healing = null; }
      else if (e.healT <= 0) {
        if (e.healing === 'shield') { e.shield = Math.min(100, e.shield + 50); e.inv.shieldPots--; }
        else { e.hp = Math.min(100, e.hp + 45); e.inv.medkits--; }
        SFX.pickup();
        e.healing = null;
      }
      i.mx = 0; i.mz = 0; i.fire = false;
    }

    // حركة
    e.crouch = !!i.crouch && e.grounded;
    e.aiming = !!i.aim && !e.buildMode && e.weapon && e.weapon.def.kind !== 'melee';
    const sprinting = i.sprint && i.mz > 0.3 && !e.aiming && !e.crouch;
    e.sprint = sprinting;

    let spd = e.crouch ? SPD_CROUCH : (e.aiming ? SPD_AIM : (sprinting ? SPD_SPRINT : SPD_WALK));
    spd *= (e.speedBonus || 1);
    if (e.swimming) spd *= 0.74;

    const fwd = [Math.sin(e.yaw), 0, Math.cos(e.yaw)];
    const rgt = [Math.cos(e.yaw), 0, -Math.sin(e.yaw)];
    let wx = fwd[0] * i.mz + rgt[0] * i.mx;
    let wz = fwd[2] * i.mz + rgt[2] * i.mx;
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-4) { wx /= wl; wz /= wl; }
    const want = wl > 0.05 ? spd : 0;
    const accel = e.grounded ? 42 : 12;
    e.vel[0] += (wx * want - e.vel[0]) * clamp(accel * dt / (e.grounded ? 1 : 3.4), 0, 1);
    e.vel[2] += (wz * want - e.vel[2]) * clamp(accel * dt / (e.grounded ? 1 : 3.4), 0, 1);

    // قفز
    if (i.jump && e.grounded && !e.healing) {
      e.vel[1] = JUMP_V; e.grounded = false;
      if (e.isPlayer) SFX.jump();
    }
    e.vel[1] += GRAV * dt * (e.swimming ? 0.25 : 1);
    if (e.vel[1] < -62) e.vel[1] = -62;

    // تكامل + اصطدام
    const prevY = e.pos[1];
    e.pos[0] += e.vel[0] * dt;
    e.pos[2] += e.vel[2] * dt;
    World.pushOut(e.pos, RAD, BODY_H);
    Build.pushOut(e.pos, RAD, BODY_H);
    e.pos[1] += e.vel[1] * dt;

    const tol = e.grounded ? 0.82 : 0.06;
    const gy = this.groundHeight(e.pos, tol);
    if (e.pos[1] <= gy + 0.001) {
      const fall = -e.vel[1];
      e.pos[1] = gy;
      if (!e.grounded && fall > 6) {
        SFX.land(clamp(fall / 26, 0.2, 1) * (e.isPlayer ? 1 : 0.3));
        this.spawnDust(e.pos, 5, 0.8);
        if (fall > 30) {
          const d = Math.floor((fall - 30) * 1.4);
          if (d > 0) this.damage(e, d, null, e.pos, 'fall');
        }
        if (e.isPlayer) this.camShake = clamp(fall / 40, 0, 0.5);
      }
      e.vel[1] = 0; e.grounded = true;
    } else {
      e.grounded = false;
    }

    // سقف
    const cy = Build.ceilingAt ? Build.ceilingAt(e.pos) : 1e9;
    if (e.vel[1] > 0 && e.pos[1] + BODY_H > cy) { e.pos[1] = cy - BODY_H; e.vel[1] = 0; }

    // الماء — سباحة على السطح مع تحكّم كامل
    const th = World.height(e.pos[0], e.pos[2]);
    e.inWater = th < WATER_Y - 0.4 && e.pos[1] < WATER_Y + 0.25;
    if (e.inWater) {
      e.swimming = true;
      const target = WATER_Y - 0.55;              // يطفو والرأس فوق الماء
      if (e.pos[1] < target) {
        e.vel[1] += (target - e.pos[1]) * 46 * dt;
        if (e.vel[1] > 7) e.vel[1] = 7;
      }
      e.vel[1] *= (1 - clamp(dt * 3.4, 0, 1));
      e.vel[0] *= (1 - clamp(dt * 0.8, 0, 1));
      e.vel[2] *= (1 - clamp(dt * 0.8, 0, 1));
      if (i.jump) e.vel[1] = Math.max(e.vel[1], 4.6);   // قفزة للخروج إلى الشاطئ
      e.grounded = true;                                 // تسارع أفقي طبيعي أثناء السباحة
      if (e.pos[1] < WATER_Y - 2.6) e.pos[1] = WATER_Y - 2.6;
    } else e.swimming = false;

    this.clampToWorld(e);

    // خطوات
    const hs = Math.hypot(e.vel[0], e.vel[2]);
    if (e.grounded && hs > 1.2) {
      e.footT -= dt * hs * 0.19;
      if (e.footT <= 0) {
        e.footT = 1;
        const dd = e.isPlayer ? 1 : clamp(1 - V.dist(e.pos, this.player.pos) / 30, 0, 0.8);
        if (dd > 0.05) SFX.step(dd);
      }
    }

    // اتجاه الجسم
    const targetBody = (hs > 0.6 && !e.aiming) ? Math.atan2(e.vel[0], e.vel[2]) : e.yaw;
    e.bodyYaw = angleLerp(e.bodyYaw, e.aiming ? e.yaw : targetBody, clamp(dt * 9, 0, 1));

    // الأسلحة والبناء
    this.weaponLogic(e, dt);
    if (i.build) this.tryBuild(e, i.build);

    Chars.pose(e, this.time);
  },

  updateDead(e, dt) {
    e.deadT = (e.deadT || 0) + dt;
    e.vel[1] += GRAV * dt;
    e.pos[1] += e.vel[1] * dt;
    const gy = this.groundHeight(e.pos, 0);
    if (e.pos[1] <= gy) { e.pos[1] = gy; e.vel[1] = 0; }
    Chars.pose(e, this.time);
  },

  clampToWorld(e) {
    const d = Math.hypot(e.pos[0], e.pos[2]);
    const lim = MAP_SIZE / 2 - 12;
    if (d > lim) {
      e.pos[0] *= lim / d; e.pos[2] *= lim / d;
      e.vel[0] *= 0.2; e.vel[2] *= 0.2;
    }
  },

  groundHeight(pos, tol) {
    let gy = World.height(pos[0], pos[2]);
    if (gy < WATER_Y - 6) gy = Math.max(gy, WATER_Y - 6);
    const st = World.solidTop(pos[0], pos[1] + tol, pos[2], RAD);
    if (st > gy && st <= pos[1] + tol + 0.4) gy = st;
    const bt = Build.groundAt(pos[0], pos[1] + tol, pos[2], RAD);
    if (bt > gy && bt <= pos[1] + tol + 0.4) gy = bt;
    return gy;
  },

  /* ============ الأسلحة ============ */
  weaponLogic(e, dt) {
    const w = e.weapon;
    if (!w) return;
    if (w.cool > 0) w.cool -= dt;
    if (e.recoil > 0) e.recoil = Math.max(0, e.recoil - dt * 6);

    if (w.reloading > 0) {
      w.reloading -= dt;
      if (w.reloading <= 0) {
        const need = w.def.mag - w.ammoIn;
        const have = e.inv.ammo[w.def.ammo] || 0;
        const take = Math.min(need, have);
        w.ammoIn += take; e.inv.ammo[w.def.ammo] -= take;
      }
      return;
    }

    if (e.in.reload && w.def.ammo && w.ammoIn < w.def.mag && (e.inv.ammo[w.def.ammo] || 0) > 0) {
      w.reloading = Weapons.reloadTime(w);
      if (e.isPlayer) SFX.reload();
      return;
    }

    if (!e.in.fire || e.swapT > 0 || e.healing) { e.firedOnce = false; return; }
    if (w.def.kind === 'melee') {
      if (w.cool > 0) return;
      w.cool = 1 / w.def.rate;
      e.swing = 1;
      this.melee(e);
      return;
    }
    if (!w.def.auto && e.firedOnce) return;
    if (w.cool > 0) return;
    if (w.ammoIn <= 0) {
      if ((e.inv.ammo[w.def.ammo] || 0) > 0) { w.reloading = Weapons.reloadTime(w); if (e.isPlayer) SFX.reload(); }
      else if (e.isPlayer && !e.firedOnce) SFX.ui('back');
      e.firedOnce = true;
      return;
    }
    e.firedOnce = true;
    this.fire(e, w);
  },

  fire(e, w) {
    const d = w.def;
    w.cool = Weapons.fireDelay(w);
    w.ammoIn--;
    const origin = [e.pos[0], e.pos[1] + EYE, e.pos[2]];
    const muzzle = e.handM ? [e.handM[12], e.handM[13], e.handM[14]] : origin;

    const spreadBase = e.aiming ? d.aimSpread : d.spread;
    let spread = spreadBase * (e.grounded ? 1 : 1.9) * (e.sprint ? 1.6 : 1) * (e.crouch ? 0.7 : 1);
    if (e.isPlayer && e.aimBonus && d.id === 'sniper') spread *= e.aimBonus;
    if (!e.isPlayer) spread *= (1.4 - (e.ai ? e.ai.skill : 0.5) * 0.8);

    const n = d.pellets || 1;
    if (d.kind === 'launcher') {
      const dir = this.aimDir(e, spread);
      this.projectiles.push({
        p: [muzzle[0], muzzle[1], muzzle[2]], v: V.sca([0, 0, 0], dir, d.speed),
        owner: e, def: d, rar: w.rarity, life: 6, t: 0
      });
    } else {
      for (let k = 0; k < n; k++) {
        const dir = this.aimDir(e, spread);
        this.hitscan(e, w, origin, dir, muzzle);
      }
    }

    // ارتداد
    const rec = d.recoil * (e.aiming ? 0.6 : 1) * (0.85 + Math.random() * 0.3);
    e.pitch += rec * 0.012;
    e.yaw += (Math.random() - 0.5) * rec * 0.006;
    e.recoil = Math.min(1.6, e.recoil + rec * 0.28);
    e.recoilAnim = Math.min(1, (e.recoilAnim || 0) + 0.55);

    // مؤثرات
    this.spawnMuzzle(muzzle, e);
    const dist = V.dist(this.camPos, e.pos);
    const vol = e.isPlayer ? 1 : clamp(1 - dist / 110, 0, 0.85);
    if (vol > 0.02) SFX.shoot(d.sound, vol);
    if (e.isPlayer) this.camShake = Math.min(0.6, this.camShake + rec * 0.06);
  },

  aimDir(e, spread) {
    const cp = Math.cos(e.pitch), sp = Math.sin(e.pitch);
    let dir = [Math.sin(e.yaw) * cp, sp, Math.cos(e.yaw) * cp];
    if (spread > 0) {
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * spread;
      const right = [Math.cos(e.yaw), 0, -Math.sin(e.yaw)];
      const up = V.cross([0, 0, 0], right, dir);
      dir = [
        dir[0] + right[0] * Math.cos(a) * r + up[0] * Math.sin(a) * r,
        dir[1] + right[1] * Math.cos(a) * r + up[1] * Math.sin(a) * r,
        dir[2] + right[2] * Math.cos(a) * r + up[2] * Math.sin(a) * r
      ];
      V.norm(dir, dir);
    }
    return dir;
  },

  hitscan(e, w, origin, dir, muzzle) {
    const d = w.def;
    const maxT = d.range;
    const hit = this.raycast(origin, dir, maxT, e);
    const end = hit ? hit.point : [origin[0] + dir[0] * maxT, origin[1] + dir[1] * maxT, origin[2] + dir[2] * maxT];
    this.tracers.push({ a: [muzzle[0], muzzle[1], muzzle[2]], b: end, t: 0, life: 0.09, col: d.tracer });

    if (!hit) return;
    if (hit.type === 'ent') {
      const dist = hit.t;
      let dmg = Weapons.dmgOf(w);
      if (d.id === 'shotgun') dmg *= clamp(1 - dist / (d.range * 1.15), 0.25, 1);
      if (hit.head) dmg *= 1.85;
      this.damage(hit.obj, Math.round(dmg), e, hit.point, hit.head ? 'head' : 'body');
      this.spawnHitFx(hit.point, hit.head ? [1, 0.85, 0.3] : [1, 0.5, 0.35], hit.head ? 14 : 8);
    } else if (hit.type === 'build') {
      Build.damage(hit.obj, Weapons.dmgOf(w) * 0.85);
      this.spawnHitFx(hit.point, MATS[hit.obj.mat].col, 6);
      if (e.isPlayer) { this.hitMarker = Math.max(this.hitMarker, 0.35); SFX.hitMarker(); }
    } else if (hit.type === 'tree') {
      hit.obj.hp -= Weapons.dmgOf(w) * 0.6;
      this.spawnHitFx(hit.point, [0.35, 0.6, 0.25], 6);
      if (hit.obj.hp <= 0) this.killTree(hit.obj);
    } else if (hit.type === 'rock') {
      hit.obj.hp -= Weapons.dmgOf(w) * 0.5;
      this.spawnHitFx(hit.point, [0.55, 0.54, 0.52], 6);
      if (hit.obj.hp <= 0) { hit.obj.alive = false; World.rebuildInstances(); }
    } else {
      this.spawnHitFx(hit.point, [0.65, 0.58, 0.42], 7);
    }
  },

  /* شعاع شامل ضد الكيانات والبناء والعالم */
  raycast(o, dir, maxT, ignore) {
    let best = maxT, hit = null;
    for (const e of this.ents) {
      if (e === ignore || e.state === 'dead' || e.state === 'bus') continue;
      const t = rayCylinder(o, dir, e.pos[0], e.pos[1], e.pos[2], 0.46, 1.55, best);
      const th = raySphere(o, dir, e.pos[0], e.pos[1] + 1.72, e.pos[2], 0.30, best);
      let tt = null, head = false;
      if (th !== null && (t === null || th < t)) { tt = th; head = true; }
      else if (t !== null) { tt = t; }
      if (tt !== null && tt < best) {
        best = tt; hit = { t: tt, type: 'ent', obj: e, head };
      }
    }
    const hb = Build.ray(o, dir, best);
    if (hb && hb.t < best) { best = hb.t; hit = hb; }
    const hw = World.ray(o, dir, best);
    if (hw && hw.t < best) { best = hw.t; hit = hw; }
    if (hit && !hit.point) hit.point = [o[0] + dir[0] * hit.t, o[1] + dir[1] * hit.t, o[2] + dir[2] * hit.t];
    return hit;
  },

  hasLOS(a, b) {
    const o = [a.pos[0], a.pos[1] + EYE, a.pos[2]];
    const t = [b.pos[0] - o[0], b.pos[1] + 1.2 - o[1], b.pos[2] - o[2]];
    const d = V.len(t);
    V.sca(t, t, 1 / d);
    const hb = Build.ray(o, t, d - 0.4);
    if (hb) return false;
    const hw = World.ray(o, t, d - 0.4);
    if (hw && hw.type !== 'tree') return false;
    return true;
  },

  melee(e) {
    const origin = [e.pos[0], e.pos[1] + EYE, e.pos[2]];
    const dir = this.aimDir(e, 0);
    SFX.swing();
    const hit = this.raycast(origin, dir, e.weapon.def.range, e);
    if (!hit) return;
    const bonus = e.harvestBonus || 1;
    if (hit.type === 'tree') {
      hit.obj.hp -= 60;
      this.gainMat(e, 0, Math.round(26 * bonus));
      this.spawnHitFx(hit.point, [0.45, 0.62, 0.28], 8);
      SFX.chop();
      if (hit.obj.hp <= 0) this.killTree(hit.obj);
    } else if (hit.type === 'rock') {
      hit.obj.hp -= 55;
      this.gainMat(e, 1, Math.round(22 * bonus));
      this.spawnHitFx(hit.point, [0.58, 0.57, 0.55], 8);
      SFX.chop();
      if (hit.obj.hp <= 0) { hit.obj.alive = false; World.rebuildInstances(); }
    } else if (hit.type === 'struct') {
      this.gainMat(e, Math.random() < 0.5 ? 1 : 2, Math.round(16 * bonus));
      this.spawnHitFx(hit.point, [0.7, 0.7, 0.72], 7);
      SFX.chop();
    } else if (hit.type === 'build') {
      Build.damage(hit.obj, 80);
      this.spawnHitFx(hit.point, MATS[hit.obj.mat].col, 7);
      SFX.chop();
    } else if (hit.type === 'ent') {
      this.damage(hit.obj, 22, e, hit.point, 'body');
      this.spawnHitFx(hit.point, [1, 0.5, 0.35], 8);
    } else {
      this.gainMat(e, 0, Math.round(10 * bonus));
      this.spawnHitFx(hit.point, [0.6, 0.55, 0.4], 5);
      SFX.chop();
    }
  },

  killTree(t) {
    t.alive = false;
    World.rebuildInstances();
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        p: [t.x + (Math.random() - 0.5) * 2, t.y + 2 + Math.random() * 4, t.z + (Math.random() - 0.5) * 2],
        v: [(Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4],
        c: [0.32, 0.58, 0.24, 1], size: 0.5 + Math.random() * 0.5, life: 0, max: 1.1, grav: -8
      });
    }
  },

  gainMat(e, type, n) {
    e.inv.mats[type] = Math.min(MAX_MAT, e.inv.mats[type] + n);
    if (e.isPlayer) UI.pulseMat(type);
  },

  /* ============ الضرر ============ */
  damage(target, amount, from, point, kind) {
    if (target.state === 'dead' || amount <= 0) return;
    let a = amount;
    if (target.shield > 0) {
      const s = Math.min(target.shield, a);
      target.shield -= s; a -= s;
    }
    target.hp -= a;
    target.hitFlash = 0.5;
    target.lastHitT = 0;
    if (from) { target.lastAttacker = from; from.dmgDealt += amount; }

    if (from && from.isPlayer) {
      this.hitMarker = 1;
      if (kind === 'head') SFX.headshot(); else SFX.hitMarker();
      this.dmgNums.push({ x: point[0], y: point[1], z: point[2], v: amount, t: 0, head: kind === 'head' });
    }
    if (target.isPlayer) {
      SFX.hurt();
      R.flash[0] = Math.min(0.55, R.flash[0] + amount * 0.008);
      this.camShake = Math.min(0.7, this.camShake + amount * 0.006);
      UI.damageDir(from ? from.pos : null);
    }
    if (target.hp <= 0) this.eliminate(target, from, kind);
  },

  eliminate(e, by, kind) {
    if (e.state === 'dead') return;
    e.state = 'dead'; e.hp = 0; e.deadT = 0;
    e.placement = this.ents.filter(x => x.state !== 'dead').length + 1;
    if (by && by !== e) by.kills++;

    // إسقاط الغنائم
    for (let s = 1; s < 5; s++) {
      const w = e.inv.slots[s];
      if (w) Loot.dropWeapon(e.pos[0] + (Math.random() - 0.5) * 1.6, e.pos[1] + 1, e.pos[2] + (Math.random() - 0.5) * 1.6, w);
    }
    for (const k in e.inv.ammo) {
      if (e.inv.ammo[k] > 0) Loot.dropAmmo(e.pos[0] + (Math.random() - 0.5) * 2, e.pos[1] + 1, e.pos[2] + (Math.random() - 0.5) * 2, k, e.inv.ammo[k]);
    }
    if (e.inv.shieldPots > 0) Loot.dropPotion(e.pos[0] + 1, e.pos[1] + 1, e.pos[2], 'shield');
    if (e.inv.medkits > 0) Loot.dropPotion(e.pos[0] - 1, e.pos[1] + 1, e.pos[2], 'heal');

    this.spawnBurst(e.pos, e.look.accent || [1, 1, 1], 40);
    SFX.elim();

    this.feed.push({ killer: by ? by.name : null, killerFem: by ? by.fem : false, victim: e.name, victimFem: e.fem, t: 0, kind: kind || 'body', player: (by && by.isPlayer) || e.isPlayer });

    if (by && by.isPlayer) {
      this.hitMarkerKill = 1;
      this.showMsg('أحسنت! إقصاء ' + e.name, 2.0);
    }
    if (e.isPlayer) {
      this.placement = e.placement;
      this.state = 'spectate';
      setTimeout(() => { if (this.state === 'spectate') this.endMatch(false, by); }, 2200);
    }
    this.alive = this.ents.filter(x => x.state !== 'dead').length;
  },

  endMatch(win, by) {
    if (this.state === 'over') return;
    this.state = 'over';
    Input.exitLock();
    SFX.stormLoop(false);
    if (win) { SFX.victory(); this.placement = 1; }
    else SFX.defeat();
    UI.showResult(win, this.player, by, this.placement || this.player.placement || this.alive);
  },

  /* ============ العاصفة ============ */
  nextPhase(first) {
    const s = this.storm;
    s.phase++;
    const ph = STORM_PHASES[Math.min(s.phase, STORM_PHASES.length - 1)];
    s.dpsNext = ph.dps;
    if (first) {
      s.cx = (Math.random() - 0.5) * 90; s.cz = (Math.random() - 0.5) * 90;
      s.r = 640; s.nextR = ph.r; s.nx = s.cx; s.nz = s.cz;
    } else {
      const maxOff = Math.max(0, s.r - ph.r) * 0.62;
      const a = Math.random() * TAU, rr = Math.random() * maxOff;
      s.nx = s.cx + Math.cos(a) * rr;
      s.nz = s.cz + Math.sin(a) * rr;
      s.nextR = ph.r;
    }
    s.mode = 'wait';
    s.timer = ph.wait; s.total = ph.wait;
    s.shrinkDur = ph.shrink;
    s.startR = s.r; s.startX = s.cx; s.startZ = s.cz;
    if (!first) this.showMsg('المرحلة ' + ar(s.phase + 1) + ' — استعدّ! العاصفة ستتقلّص', 3);
  },

  updateStorm(dt) {
    const s = this.storm;
    if (!s) return;
    s.timer -= dt;
    if (s.mode === 'wait') {
      if (s.timer <= 0) {
        s.mode = 'shrink'; s.timer = s.shrinkDur; s.total = s.shrinkDur;
        s.dps = s.dpsNext;
        this.showMsg('العاصفة تتحرّك الآن!', 2.5);
      }
    } else {
      const f = 1 - clamp(s.timer / s.shrinkDur, 0, 1);
      s.r = lerp(s.startR, s.nextR, f);
      s.cx = lerp(s.startX, s.nx, f);
      s.cz = lerp(s.startZ, s.nz, f);
      if (s.timer <= 0) {
        s.r = s.nextR; s.cx = s.nx; s.cz = s.nz;
        if (s.phase < STORM_PHASES.length - 1) this.nextPhase(false);
        else { s.mode = 'wait'; s.timer = 999; }
      }
    }
    const p = this.player;
    if (p && p.state !== 'bus' && p.state !== 'skydive' && p.state !== 'glide') {
      const d = Math.hypot(p.pos[0] - s.cx, p.pos[2] - s.cz);
      const out = d - s.r;
      R.stormFx = clamp(out / 8, 0, 1) * 0.85;
      SFX.stormLevel(clamp((out + 45) / 55, 0, 1));
    } else { R.stormFx = 0; SFX.stormLevel(0); }
  },

  /* ============ الصناديق والغنائم ============ */
  updateChests(dt) {
    for (const c of World.chests) { c.t += dt; }
    const p = this.player;
    if (!p || p.state === 'dead' || p.state === 'skydive' || p.state === 'glide') return;
    // التقاط تلقائي للذخيرة والمواد
    for (let i = Loot.items.length - 1; i >= 0; i--) {
      const it = Loot.items[i];
      for (const e of this.ents) {
        if (e.state === 'dead' || e.state === 'skydive' || e.state === 'glide' || e.state === 'bus') continue;
        const d = Math.hypot(e.pos[0] - it.x, e.pos[2] - it.z);
        if (d > 1.8 || Math.abs(e.pos[1] - it.y) > 2.6) continue;
        if (it.kind === 'weapon') {
          if (e.isPlayer) continue;  // اللاعب يلتقط يدويًا
          const slot = this.freeSlot(e);
          if (slot < 0) continue;
          e.inv.slots[slot] = it.data.w;
          e.inv.ammo[it.data.w.def.ammo] = (e.inv.ammo[it.data.w.def.ammo] || 0) + 25;
          Loot.items.splice(i, 1);
        } else if (it.kind === 'ammo') {
          e.inv.ammo[it.data.type] = Math.min(999, (e.inv.ammo[it.data.type] || 0) + it.data.n);
          if (e.isPlayer) { SFX.pickup(); UI.toast('+' + it.data.n + ' ذخيرة ' + AMMO[it.data.type].name); }
          Loot.items.splice(i, 1);
        } else if (it.kind === 'potion') {
          if (it.data.kind === 'shield') { if (e.inv.shieldPots >= 4) continue; e.inv.shieldPots++; }
          else { if (e.inv.medkits >= 4) continue; e.inv.medkits++; }
          if (e.isPlayer) { SFX.pickup(); UI.toast(it.data.kind === 'shield' ? '+ عبوة درع' : '+ حقيبة إسعاف'); }
          Loot.items.splice(i, 1);
        } else if (it.kind === 'mat') {
          this.gainMat(e, it.data.type, it.data.n);
          if (e.isPlayer) SFX.pickup();
          Loot.items.splice(i, 1);
        }
        break;
      }
    }
  },

  freeSlot(e) {
    for (let i = 1; i < 5; i++) if (!e.inv.slots[i]) return i;
    return -1;
  },

  tryInteract(e) {
    // فتح صندوق
    let best = null, bd = 3.4;
    for (const c of World.chests) {
      if (c.open) continue;
      const d = Math.hypot(c.x - e.pos[0], c.z - e.pos[2]) + Math.abs(c.y - e.pos[1]) * 0.6;
      if (d < bd) { bd = d; best = c; }
    }
    if (best) { this.openChest(best, e); return; }
    // التقاط غنيمة
    let bi = -1; bd = 2.6;
    for (let i = 0; i < Loot.items.length; i++) {
      const it = Loot.items[i];
      if (it.kind !== 'weapon') continue;
      const d = Math.hypot(it.x - e.pos[0], it.z - e.pos[2]) + Math.abs(it.y - e.pos[1]) * 0.6;
      if (d < bd) { bd = d; bi = i; }
    }
    if (bi >= 0) {
      const it = Loot.items[bi];
      let slot = this.freeSlot(e);
      if (slot < 0) {
        slot = Math.max(1, e.slot);
        Loot.dropWeapon(e.pos[0] + Math.sin(e.yaw) * 1.4, e.pos[1] + 1, e.pos[2] + Math.cos(e.yaw) * 1.4, e.inv.slots[slot]);
      }
      e.inv.slots[slot] = it.data.w;
      Loot.items.splice(bi, 1);
      this.selectSlot(e, slot);
      SFX.pickup();
      UI.toast(RARITY[it.data.w.rarity].name + ' — ' + it.data.w.def.name);
    }
  },

  useHeal(e) {
    if (e.healing) { e.healing = null; return; }
    if (e.shield < 100 && e.inv.shieldPots > 0) { e.healing = 'shield'; e.healT = 2.0; }
    else if (e.hp < 100 && e.inv.medkits > 0) { e.healing = 'heal'; e.healT = 3.0; }
    else if (e.isPlayer) UI.toast('لا يوجد ما يمكن استخدامه');
  },

  openChest(c, e) {
    if (c.open) return;
    c.open = true;
    c.openT = 0;
    const rng = Math.random;
    const bias = 0.06;
    const w = Weapons.roll(rng, bias);
    Loot.dropWeapon(c.x + (rng() - 0.5) * 1.2, c.y + 1.2, c.z + (rng() - 0.5) * 1.2, w);
    Loot.dropAmmo(c.x + 0.9, c.y + 1.2, c.z, w.def.ammo, w.def.id === 'rocket' ? 4 : (w.def.id === 'sniper' ? 12 : 40));
    if (rng() < 0.55) Loot.dropPotion(c.x - 0.9, c.y + 1.2, c.z + 0.4, rng() < 0.6 ? 'shield' : 'heal');
    if (rng() < 0.4) Loot.dropAmmo(c.x, c.y + 1.2, c.z + 0.9, ['light', 'medium', 'heavy', 'shell'][Math.floor(rng() * 4)], 30);
    this.spawnBurst([c.x, c.y + 0.8, c.z], [1, 0.85, 0.3], 26);
    const dist = V.dist(this.camPos, [c.x, c.y, c.z]);
    if (dist < 60) SFX.chest();
    if (e && e.isPlayer) UI.toast('صندوق مفتوح!');
  },

  /* ============ البناء ============ */
  tryBuild(e, type) {
    if (e.buildCool > 0) return;
    const t = Build.target(e, type);
    if (!Build.canPlace(t)) return;
    if (e.inv.mats[e.mat] < BUILD_COST) {
      if (e.isPlayer) { UI.toast('لا توجد مواد كافية'); SFX.ui('back'); }
      return;
    }
    e.inv.mats[e.mat] -= BUILD_COST;
    Build.place(t, e.mat, e);
    e.buildCool = MATS[e.mat].speed;
    SFX.build();
    if (e.isPlayer) UI.pulseMat(e.mat);
  },

  /* ============ المقذوفات ============ */
  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.t += dt;
      pr.v[1] += GRAV * 0.32 * dt;
      const step = V.sca([0, 0, 0], pr.v, dt);
      const dist = V.len(step);
      const dir = V.norm([0, 0, 0], step);
      const hit = this.raycast(pr.p, dir, dist + 0.3, pr.owner);
      if (hit) {
        this.explode(hit.point, pr);
        this.projectiles.splice(i, 1); continue;
      }
      V.add(pr.p, pr.p, step);
      if (pr.p[1] < World.height(pr.p[0], pr.p[2])) {
        this.explode(pr.p, pr); this.projectiles.splice(i, 1); continue;
      }
      pr.life -= dt;
      if (pr.life <= 0) { this.explode(pr.p, pr); this.projectiles.splice(i, 1); continue; }
      // أثر الدخان
      if (Math.random() < 0.9) {
        this.particles.push({
          p: [pr.p[0], pr.p[1], pr.p[2]], v: [(Math.random() - 0.5) * 0.6, Math.random() * 0.4, (Math.random() - 0.5) * 0.6],
          c: [0.9, 0.7, 0.5, 0.8], size: 0.5, life: 0, max: 0.55, grav: 1.5
        });
      }
    }
  },

  explode(p, pr) {
    const d = pr.def;
    const dmg = d.dmg * RARITY[pr.rar].mul;
    SFX.explosion(clamp(1 - V.dist(this.camPos, p) / 90, 0.1, 1));
    this.spawnExplosion(p);
    for (const e of this.ents) {
      if (e.state === 'dead' || e.state === 'bus') continue;
      const dist = V.dist(e.pos, [p[0], p[1] - 0.8, p[2]]);
      if (dist > d.splash) continue;
      const f = 1 - dist / d.splash;
      this.damage(e, Math.round(dmg * f * f), pr.owner, e.pos, 'splash');
      const push = V.norm([0, 0, 0], [e.pos[0] - p[0], e.pos[1] + 0.8 - p[1], e.pos[2] - p[2]]);
      e.vel[0] += push[0] * 16 * f; e.vel[1] += Math.abs(push[1]) * 10 * f + 5 * f; e.vel[2] += push[2] * 16 * f;
      e.grounded = false;
    }
    // تدمير البناء
    const kill = [];
    for (const bp of Build.pieces.values()) {
      const bx = bp.gx * CELL + CELL / 2, by = bp.gy * CELL + CELL / 2, bz = bp.gz * CELL + CELL / 2;
      const dist = Math.hypot(bx - p[0], by - p[1], bz - p[2]);
      if (dist < d.splash * 1.35) kill.push(bp);
    }
    for (const bp of kill) Build.damage(bp, dmg * 1.5);
    // الأشجار
    for (const t of World.trees) {
      if (!t.alive) continue;
      if (Math.hypot(t.x - p[0], t.z - p[2]) < d.splash * 1.1 && Math.abs(t.y - p[1]) < 8) this.killTree(t);
    }
    if (V.dist(this.camPos, p) < 30) this.camShake = Math.min(1, this.camShake + 0.7);
  },

  /* ============ الجسيمات ============ */
  spawnMuzzle(p, e) {
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        p: [p[0], p[1], p[2]],
        v: [(Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3 + 1, (Math.random() - 0.5) * 3],
        c: [1, 0.85, 0.4, 1], size: 0.22 + Math.random() * 0.2, life: 0, max: 0.10, grav: 0
      });
    }
  },

  spawnHitFx(p, col, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        p: [p[0], p[1], p[2]],
        v: [(Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6],
        c: [col[0], col[1], col[2], 1], size: 0.14 + Math.random() * 0.16, life: 0, max: 0.42, grav: -10
      });
    }
  },

  spawnDust(p, n, s) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      this.particles.push({
        p: [p[0] + Math.cos(a) * 0.4, p[1] + 0.1, p[2] + Math.sin(a) * 0.4],
        v: [Math.cos(a) * 2.5, Math.random() * 1.5, Math.sin(a) * 2.5],
        c: [0.85, 0.80, 0.68, 0.7], size: 0.3 * s + Math.random() * 0.3, life: 0, max: 0.6, grav: -2
      });
    }
  },

  spawnBurst(p, col, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, e = Math.random() * Math.PI;
      const sp = 4 + Math.random() * 9;
      this.particles.push({
        p: [p[0], p[1] + 1, p[2]],
        v: [Math.cos(a) * Math.sin(e) * sp, Math.cos(e) * sp + 3, Math.sin(a) * Math.sin(e) * sp],
        c: [col[0], col[1], col[2], 1], size: 0.22 + Math.random() * 0.3, life: 0, max: 0.9 + Math.random() * 0.5, grav: -12
      });
    }
  },

  spawnExplosion(p) {
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * TAU, e = Math.random() * Math.PI;
      const sp = 6 + Math.random() * 16;
      const warm = Math.random();
      this.particles.push({
        p: [p[0], p[1], p[2]],
        v: [Math.cos(a) * Math.sin(e) * sp, Math.abs(Math.cos(e)) * sp * 0.8 + 4, Math.sin(a) * Math.sin(e) * sp],
        c: [1, 0.55 + warm * 0.35, 0.18 + warm * 0.2, 1], size: 0.4 + Math.random() * 0.7, life: 0, max: 0.5 + Math.random() * 0.6, grav: -9
      });
    }
    for (let i = 0; i < 18; i++) {
      this.particles.push({
        p: [p[0], p[1], p[2]],
        v: [(Math.random() - 0.5) * 7, Math.random() * 5 + 1, (Math.random() - 0.5) * 7],
        c: [0.35, 0.34, 0.33, 0.8], size: 0.9 + Math.random() * 0.9, life: 0, max: 1.2, grav: 1.2
      });
    }
  },

  updateParticles(dt) {
    const P = this.particles;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life += dt;
      if (p.life >= p.max) { P.splice(i, 1); continue; }
      p.v[1] += p.grav * dt;
      p.p[0] += p.v[0] * dt; p.p[1] += p.v[1] * dt; p.p[2] += p.v[2] * dt;
      p.v[0] *= (1 - dt * 1.5); p.v[2] *= (1 - dt * 1.5);
    }
    if (P.length > 2800) P.splice(0, P.length - 2800);
  },

  updateTracers(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.t += dt;
      if (t.t > t.life) this.tracers.splice(i, 1);
    }
  },

  /* ============ الكاميرا ============ */
  updateCamera(dt) {
    let e = this.player;
    if (this.state === 'spectate' || (this.player && this.player.state === 'dead')) {
      const alive = this.ents.filter(x => x.state !== 'dead');
      if (alive.length) e = alive[this.spectate % alive.length];
    }
    if (!e) return;

    if (e === this.player && this.state !== 'over') {
      this.camYaw = e.yaw; this.camPitch = e.pitch;
    } else {
      this.camYaw = angleLerp(this.camYaw, e.yaw, clamp(dt * 4, 0, 1));
      this.camPitch += (e.pitch - this.camPitch) * clamp(dt * 4, 0, 1);
    }

    const aiming = e.aiming;
    const scoped = e.isPlayer && aiming && e.weapon && e.weapon.def.scope;
    this.scoped = !!scoped;
    this.targetFov = scoped ? e.weapon.def.scope : (aiming ? 62 : (e.sprint ? 84 : 78));
    this.fov += (this.targetFov - this.fov) * clamp(dt * 11, 0, 1);

    const head = [e.pos[0], e.pos[1] + EYE + (e.crouch ? -0.35 : 0), e.pos[2]];
    if (this.state === 'bus' && this.busPos) {
      const bp = this.busPos;
      const a = this.time * 0.25;
      const cp = [bp[0] + Math.cos(a) * 44, bp[1] + 13, bp[2] + Math.sin(a) * 44];
      V.lerp(this.camPos, this.camPos, cp, clamp(dt * 2.5, 0, 1));
      const dir = V.norm([0, 0, 0], V.sub([0, 0, 0], bp, this.camPos));
      const yaw = Math.atan2(dir[0], dir[2]);
      const pitch = Math.asin(clamp(dir[1], -1, 1));
      R.setSunTarget(bp);
      R.setCamera(this.camPos, yaw, pitch, 72, 0);
      return;
    }

    let dist = scoped ? 0 : (aiming ? 3.15 : 4.35);
    if (e.state === 'skydive' || e.state === 'glide') dist = 6.5;
    const side = scoped ? 0 : (aiming ? 0.95 : 0.60);

    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const back = [-Math.sin(this.camYaw) * cp, -sp, -Math.cos(this.camYaw) * cp];
    const right = [Math.cos(this.camYaw), 0, -Math.sin(this.camYaw)];
    const fwdN = [Math.sin(this.camYaw) * cp, sp, Math.cos(this.camYaw) * cp];
    const push = scoped ? 0.42 : 0;
    const anchor = [head[0] + right[0] * side + fwdN[0] * push,
                    head[1] + 0.18 + fwdN[1] * push,
                    head[2] + right[2] * side + fwdN[2] * push];

    // منع اختراق الكاميرا للجدران
    let d = dist;
    if (dist > 0.1) {
      // الكاميرا تصطدم بالعالم والبناء فقط، لا بالشخصيات
      const hb = Build.ray(anchor, back, dist + 0.5);
      const hw = World.ray(anchor, back, dist + 0.5);
      let t = null;
      if (hb) t = hb.t;
      if (hw && (t === null || hw.t < t)) t = hw.t;
      if (t !== null) d = clamp(t - 0.40, 1.25, dist);
    }
    const want = [anchor[0] + back[0] * d, anchor[1] + back[1] * d, anchor[2] + back[2] * d];
    V.lerp(this.camPos, this.camPos, want, clamp(dt * 26, 0, 1));

    // اهتزاز
    let sh = this.camShake;
    if (sh > 0.001) {
      const t = this.time * 42;
      this.camPos[0] += Math.sin(t * 1.7) * sh * 0.16;
      this.camPos[1] += Math.sin(t * 2.3) * sh * 0.13;
      this.camPos[2] += Math.cos(t * 1.9) * sh * 0.16;
    }
    // ميل عند الحركة الجانبية
    const targetRoll = -e.in.mx * 0.024 - (e.state === 'glide' ? e.in.mx * 0.10 : 0);
    this.camRoll += (targetRoll - this.camRoll) * clamp(dt * 6, 0, 1);

    R.setSunTarget(e.pos);
    R.setCamera(this.camPos, this.camYaw, this.camPitch, this.fov, this.camRoll);
  },

  showMsg(text, dur) { this.msg = text; this.msgT = dur || 2; },

  /* ============ العرض ============ */
  render() {
    const gl = this.gl;

    // تجميع نسخ الشخصيات
    Chars.resetLists();
    Weapons.reset();
    const spectating = this.state === 'spectate' || this.state === 'over';
    for (const e of this.ents) {
      if (e.state === 'bus') continue;
      // أثناء منظار القنص الكاميرا داخل رأس اللاعب، فنخفي جسده
      if (e === this.player && this.scoped) continue;
      if (V.dist(e.pos, this.camPos) > 320) continue;
      Chars.submit(e, this.time, null);
      if (e.state !== 'dead' && e.state !== 'skydive') Weapons.submitHeld(e);
    }
    Chars.flushLists();

    // الغنائم الأرضية
    for (const it of Loot.items) {
      const spin = this.time * 1.6 + it.t;
      const bob = Math.sin(this.time * 2.2 + it.t * 3) * 0.10;
      if (it.kind === 'weapon') {
        const l = Weapons.lists[it.data.w.id];
        if (l) {
          const t = Weapons.tint(it.data.w.rarity);
          l.push(it.x, it.y + 0.45 + bob, it.z, 0.25, spin, 0, 1, 1, 1, t[0], t[1], t[2], 0.06);
        }
      } else if (it.kind === 'ammo') {
        const c = it.data.type === 'light' ? [1, 0.83, 0.35] : it.data.type === 'medium' ? [0.62, 0.88, 0.42] :
          it.data.type === 'heavy' ? [1, 0.54, 0.36] : it.data.type === 'shell' ? [1, 0.42, 0.54] : [0.48, 0.88, 1];
        Weapons.ammoList.push(it.x, it.y + 0.35 + bob, it.z, 0, spin, 0, 1, 1, 1, c[0], c[1], c[2], 0.05);
      } else if (it.kind === 'potion') {
        const c = it.data.kind === 'shield' ? [0.36, 0.62, 1.0] : [1.0, 0.40, 0.42];
        Weapons.potList.push(it.x, it.y + 0.35 + bob, it.z, 0, spin, 0, 1, 1, 1, c[0], c[1], c[2], 0.10);
      }
    }
    Weapons.flush();

    // الصناديق
    World.chestList.reset();
    for (const c of World.chests) {
      if (V.dist([c.x, c.y, c.z], this.camPos) > 190) continue;
      const open = c.open;
      const g = open ? 0.55 : 1;
      World.chestList.push(c.x, c.y, c.z, 0, c.ry, 0, 1, 1, 1,
        g, g * (open ? 0.9 : 1), g * (open ? 0.85 : 1), open ? 0 : (0.10 + Math.sin(this.time * 2.4 + c.t) * 0.05));
    }
    World.chestList.flush();

    Build.submit(this.dt);

    // ---- تمريرة الظل ----
    R.beginShadow();
    World.terrainList.draw();
    World.structList.draw();
    for (const l of World.treeLists) l.draw();
    for (const l of World.rockLists) l.draw();
    for (const k in Build.lists) Build.lists[k].draw();
    for (const k in Chars.lists) if (k !== 'glider') Chars.lists[k].draw();
    if (this.busPos) { this.submitBus(); this.busList.draw(); }

    // ---- التمريرة الرئيسية ----
    R.beginMain();
    World.terrainList.draw();
    World.structList.draw();
    for (const l of World.treeLists) l.draw();
    for (const l of World.rockLists) l.draw();
    World.bushList.draw();
    World.chestList.draw();
    for (const k in Build.lists) Build.lists[k].draw();
    for (const k in Chars.lists) Chars.lists[k].draw();
    for (const k in Weapons.lists) Weapons.lists[k].draw();
    Weapons.ammoList.draw();
    Weapons.potList.draw();
    if (this.busPos) { this.submitBus(); this.busList.draw(); }

    R.drawWater(WATER_Y);

    // ---- المؤثرات المضيئة ----
    R.beginFx();
    this.submitFx();
    Weapons.tracerList.draw();
    Weapons.sphereList.draw();
    Weapons.lists.proj_rocket.draw();
    World.beamList.draw();

    // ---- معاينة البناء ----
    if (this.player && this.player.buildMode && this.player.state !== 'dead' && this.state === 'play') {
      const t = Build.target(this.player, this.player.buildType);
      const ok = Build.canPlace(t) && this.player.inv.mats[this.player.mat] >= BUILD_COST;
      const mesh = Build.meshFor(t);
      const l = Build.lists[mesh];
      l.reset();
      const m = Build.previewMatrix(t, M.create());
      const pulse = 0.55 + Math.sin(this.time * 6) * 0.14;
      if (ok) l.pushMat(m, 0.30 * pulse, 1.0 * pulse, 0.75 * pulse, 0.55);
      else l.pushMat(m, 1.0 * pulse, 0.25 * pulse, 0.25 * pulse, 0.55);
      l.flush(); l.draw();
    }

    // ---- العاصفة ----
    if (this.storm && this.storm.r < 560) R.drawStorm(this.storm.cx, this.storm.cz, this.storm.r);

    // ---- الجسيمات ----
    R.beginParticles();
    this.submitParticles();

    R.endWorld();
    R.post();
  },

  submitBus() {
    this.busList.reset();
    const yaw = Math.atan2(this.busTo[0] - this.busFrom[0], this.busTo[2] - this.busFrom[2]);
    this.busList.push(this.busPos[0], this.busPos[1], this.busPos[2], 0, yaw, Math.sin(this.time * 0.6) * 0.03, 1, 1, 1, 1, 1, 1, 0);
    this.busList.flush();
  },

  submitFx() {
    // خطوط الرصاص
    const L = Weapons.tracerList;
    L.reset();
    for (const t of this.tracers) {
      const f = 1 - t.t / t.life;
      const dx = t.b[0] - t.a[0], dy = t.b[1] - t.a[1], dz = t.b[2] - t.a[2];
      const len = Math.hypot(dx, dy, dz) || 1;
      const yaw = Math.atan2(dx, dz);
      const pitch = -Math.asin(clamp(dy / len, -1, 1));
      L.push(t.a[0], t.a[1], t.a[2], pitch, yaw, 0, 1, 1, len, t.col[0], t.col[1], t.col[2], f * 0.85);
    }
    L.flush();

    // كرات الطاقة (وميض الفوهة والمؤثرات)
    const S = Weapons.sphereList;
    S.reset();
    for (const pr of this.projectiles) {
      S.push(pr.p[0], pr.p[1], pr.p[2], 0, 0, 0, 1.1, 1.1, 1.1, 1.0, 0.55, 0.2, 0.9);
    }
    S.flush();

    // الصواريخ
    const RL = Weapons.lists.proj_rocket;
    RL.reset();
    for (const pr of this.projectiles) {
      const v = pr.v;
      const yaw = Math.atan2(v[0], v[2]);
      const pitch = -Math.asin(clamp(v[1] / (V.len(v) || 1), -1, 1));
      RL.push(pr.p[0], pr.p[1], pr.p[2], pitch, yaw, 0, 1, 1, 1, 1, 1, 1, 0.9);
    }
    RL.flush();

    // أعمدة ضوء الغنائم والصناديق
    const B = World.beamList;
    B.reset();
    for (const it of Loot.items) {
      let c = [1, 1, 1];
      if (it.kind === 'weapon') c = RARITY[it.data.w.rarity].col;
      else if (it.kind === 'potion') c = it.data.kind === 'shield' ? [0.35, 0.6, 1] : [1, 0.4, 0.42];
      else c = [1, 0.85, 0.4];
      B.push(it.x, it.y, it.z, 0, 0, 0, 0.55, 2.6, 0.55, c[0], c[1], c[2], 0.18);
    }
    for (const ch of World.chests) {
      if (ch.open) continue;
      if (V.dist([ch.x, ch.y, ch.z], this.camPos) > 120) continue;
      B.push(ch.x, ch.y, ch.z, 0, 0, 0, 0.9, 3.6, 0.9, 1.0, 0.82, 0.30, 0.14 + Math.sin(this.time * 2 + ch.t) * 0.05);
    }
    B.flush();
    B.draw();
  },

  submitParticles() {
    const m = this.partMesh;
    const d = m.data;
    let n = 0;
    for (const p of this.particles) {
      if (n >= m.maxInst) break;
      const f = 1 - p.life / p.max;
      const o = n * 8;
      d[o] = p.p[0]; d[o + 1] = p.p[1]; d[o + 2] = p.p[2]; d[o + 3] = p.size * (0.5 + f * 0.8);
      d[o + 4] = p.c[0]; d[o + 5] = p.c[1]; d[o + 6] = p.c[2]; d[o + 7] = p.c[3] * f;
      n++;
    }
    m.upload(n);
    m.draw(n);
  }
};

function raySphere(o, d, cx, cy, cz, r, maxT) {
  const ox = o[0] - cx, oy = o[1] - cy, oz = o[2] - cz;
  const b = 2 * (ox * d[0] + oy * d[1] + oz * d[2]);
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = (-b - sq) / 2;
  if (t < 0.001) t = (-b + sq) / 2;
  if (t < 0.001 || t > maxT) return null;
  return t;
}
