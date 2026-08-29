'use strict';
/* ============================================================
   أبطال العاصفة — ذكاء الخصوم
   ============================================================ */

const AI = {
  think(e, dt, G) {
    const b = e.ai;
    const inp = e.in;
    inp.mx = 0; inp.mz = 0; inp.sprint = false; inp.jump = false;
    inp.fire = false; inp.aim = false; inp.reload = false; inp.build = null;

    b.t += dt;
    b.decide -= dt;
    b.stuckT += dt;

    /* --- الهبوط بالمظلة يديره المحرك --- */
    if (e.state === 'skydive' || e.state === 'glide') { this.dropLogic(e, dt, G); return; }
    if (e.state === 'dead') return;

    /* --- اختيار الهدف --- */
    b.scanT -= dt;
    if (b.scanT <= 0) {
      b.scanT = 0.20 + Math.random() * 0.12;
      b.target = this.findTarget(e, G);
    }

    const zone = G.storm;
    const dzone = Math.hypot(e.pos[0] - zone.cx, e.pos[2] - zone.cz);
    const outside = dzone > zone.r - 4;
    const mustRotate = dzone > zone.nextR * 0.92 || outside;

    /* --- علاج --- */
    if (!b.target && e.hp < 62 && (e.inv.shieldPots > 0 || e.inv.medkits > 0) && !e.healing && !outside) {
      e.healing = e.inv.shieldPots > 0 && e.shield < 90 ? 'shield' : (e.inv.medkits > 0 && e.hp < 90 ? 'heal' : null);
      if (e.healing) e.healT = e.healing === 'shield' ? 2.0 : 3.0;
    }
    if (e.healing) { inp.mx = 0; inp.mz = 0; return; }

    /* --- قتال --- */
    if (b.target && !outside) {
      this.combat(e, b.target, dt, G);
      return;
    }

    /* --- تجهيز/نهب --- */
    if (!mustRotate && b.t < 999) {
      if (!b.goal || b.goalT <= 0 || (b.goal.kind === 'chest' && b.goal.obj.open)) {
        b.goal = this.pickGoal(e, G);
        b.goalT = 12 + Math.random() * 8;
      }
      b.goalT -= dt;
    }
    if (mustRotate) {
      const ang = Math.atan2(zone.cz - e.pos[2], zone.cx - e.pos[0]);
      const rr = Math.max(0, zone.nextR * 0.62);
      b.goal = {
        kind: 'zone',
        x: zone.cx - Math.cos(ang) * rr * (Math.random() * 0.5),
        z: zone.cz - Math.sin(ang) * rr * (Math.random() * 0.5)
      };
      if (Math.hypot(b.goal.x - zone.cx, b.goal.z - zone.cz) > zone.nextR * 0.7) {
        b.goal.x = zone.cx; b.goal.z = zone.cz;
      }
    }

    const g = b.goal;
    if (g) {
      const tx = g.kind === 'chest' ? g.obj.x : (g.kind === 'loot' ? g.obj.x : g.x);
      const tz = g.kind === 'chest' ? g.obj.z : (g.kind === 'loot' ? g.obj.z : g.z);
      this.moveTo(e, tx, tz, dt, outside || mustRotate);
      const d = Math.hypot(e.pos[0] - tx, e.pos[2] - tz);
      if (d < 3.2) {
        if (g.kind === 'chest' && !g.obj.open) G.openChest(g.obj, e);
        b.goal = null;
      }
      // حصاد الموارد أثناء التنقّل
      b.harvesting = false;
      if (!outside && e.inv.mats[0] + e.inv.mats[1] + e.inv.mats[2] < 280 && b.harvestT <= 0) {
        const tr = this.nearTree(e);
        if (tr) {
          b.harvesting = true;
          this.moveTo(e, tr.x, tr.z, dt, false);
          if (Math.hypot(e.pos[0] - tr.x, e.pos[2] - tr.z) < 2.8) {
            e.slot = 0; e.swapT = 0; inp.fire = true; inp.mz = 0;
          }
        }
        if (Math.random() < 0.003) b.harvestT = 8;
      } else b.harvestT -= dt;
    } else {
      if (b.decide <= 0) {
        b.decide = 2 + Math.random() * 3;
        b.wanderA = Math.random() * TAU;
      }
      this.moveTo(e, e.pos[0] + Math.cos(b.wanderA) * 20, e.pos[2] + Math.sin(b.wanderA) * 20, dt, false);
    }

    // اختيار أفضل سلاح (إلّا أثناء الحصاد بالفأس)
    if (!b.harvesting) this.pickWeapon(e, 60);
  },

  dropLogic(e, dt, G) {
    const b = e.ai;
    if (!b.dropTarget) {
      const p = World.pois[Math.floor(Math.random() * World.pois.length)];
      b.dropTarget = [p.x + (Math.random() - 0.5) * 40, p.z + (Math.random() - 0.5) * 40];
    }
    const dx = b.dropTarget[0] - e.pos[0], dz = b.dropTarget[1] - e.pos[2];
    const d = Math.hypot(dx, dz);
    e.yaw = angleLerp(e.yaw, Math.atan2(dx, dz), clamp(dt * 3, 0, 1));
    e.in.mz = d > 6 ? 1 : 0;
    e.in.mx = 0;
  },

  findTarget(e, G) {
    let best = null, bestD = 1e9;
    const range = e.weapon && e.weapon.def.id === 'sniper' ? 145 : 82;
    for (const o of G.ents) {
      if (o === e || o.state === 'dead' || o.state === 'skydive' || o.state === 'glide') continue;
      const d = V.dist(e.pos, o.pos);
      if (d > range) continue;
      // مخروط رؤية واسع + كشف قريب
      const dir = [o.pos[0] - e.pos[0], 0, o.pos[2] - e.pos[2]];
      V.norm(dir, dir);
      const fw = [Math.sin(e.yaw), 0, Math.cos(e.yaw)];
      const dp = V.dot(dir, fw);
      if (d > 16 && dp < 0.15) continue;
      if (!G.hasLOS(e, o)) continue;
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  },

  combat(e, tgt, dt, G) {
    const b = e.ai, inp = e.in;
    const d = V.dist(e.pos, tgt.pos);
    const skill = b.skill;

    this.pickWeapon(e, d);
    const w = e.weapon;
    if (!w || w.def.kind === 'melee') {
      this.moveTo(e, tgt.pos[0], tgt.pos[2], dt, true);
      inp.fire = d < 3.0;
      return;
    }

    // التصويب مع خطأ يتناقص مع الوقت
    b.aimT += dt;
    const react = 0.42 - skill * 0.30;
    const err = Math.max(0.006, (0.16 - skill * 0.11) * Math.exp(-b.aimT * (1.6 + skill * 2.4)) + (0.030 - skill * 0.024));
    const tx = tgt.pos[0] - e.pos[0];
    const tz = tgt.pos[2] - e.pos[2];
    const ty = (tgt.pos[1] + 1.45) - (e.pos[1] + 1.55);
    const distXZ = Math.hypot(tx, tz);
    // تقدير حركة الخصم
    const lead = w.def.kind === 'launcher' ? distXZ / (w.def.speed || 50) : distXZ / 320;
    const wantYaw = Math.atan2(tx + tgt.vel[0] * lead, tz + tgt.vel[2] * lead);
    const wantPitch = Math.atan2(ty + (w.def.kind === 'launcher' ? distXZ * 0.055 : 0), distXZ);

    if (b.noiseT === undefined) b.noiseT = 0;
    b.noiseT += dt;
    const nx = Math.sin(b.noiseT * 2.7 + b.seed) * err;
    const ny = Math.cos(b.noiseT * 3.3 + b.seed * 2) * err * 0.7;
    e.yaw = angleLerp(e.yaw, wantYaw + nx, clamp(dt * (6 + skill * 9), 0, 1));
    e.pitch += ((wantPitch + ny) - e.pitch) * clamp(dt * (6 + skill * 9), 0, 1);
    e.pitch = clamp(e.pitch, -1.3, 1.3);

    inp.aim = d > 12 || w.def.id === 'sniper';

    // إطلاق النار
    const aimOff = Math.abs(((wantYaw - e.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI);
    const inRange = d < w.def.range * 0.9;
    if (b.aimT > react && aimOff < (0.07 + err * 1.6) && inRange && w.ammoIn > 0) {
      inp.fire = true;
    }
    if (w.ammoIn <= 0) inp.reload = true;

    // الحركة القتالية
    if (b.strafeT === undefined || b.strafeT <= 0) { b.strafeT = 0.5 + Math.random() * 1.1; b.strafeD = Math.random() < 0.5 ? -1 : 1; }
    b.strafeT -= dt;
    const ideal = w.def.id === 'shotgun' ? 8 : (w.def.id === 'sniper' ? 55 : 22);
    let fwd = 0;
    if (d > ideal * 1.35) fwd = 1;
    else if (d < ideal * 0.6) fwd = -1;
    inp.mz = fwd;
    inp.mx = b.strafeD * (skill * 0.85 + 0.15);
    inp.sprint = fwd > 0 && d > 34;
    if (Math.random() < skill * 0.010) inp.jump = true;

    // بناء دفاعي عند التعرّض للإصابة
    if (e.lastHitT < 1.8 && Math.random() < 0.012 + skill * 0.045 && e.inv.mats[e.mat] >= BUILD_COST) {
      inp.build = 'wall';
    }
    // منحدر للصعود إن كان الخصم أعلى
    if (tgt.pos[1] - e.pos[1] > 4 && d < 34 && Math.random() < 0.006 + skill * 0.022 && e.inv.mats[e.mat] >= BUILD_COST) {
      inp.build = 'ramp';
    }
  },

  pickWeapon(e, dist) {
    let best = -1, bestScore = -1;
    for (let i = 0; i < e.inv.slots.length; i++) {
      const w = e.inv.slots[i];
      if (!w) continue;
      let sc;
      if (w.def.kind === 'melee') sc = 0.05;
      else if (!this.hasAmmo(e, w)) sc = 0.02;
      else {
        const d = w.def;
        const dps = (d.dmg * (d.pellets || 1)) * d.rate * RARITY[w.rarity].mul;
        let fit = 1;
        if (d.id === 'shotgun') fit = dist < 16 ? 2.6 : (dist < 26 ? 0.8 : 0.15);
        else if (d.id === 'sniper') fit = dist > 45 ? 2.4 : (dist > 22 ? 0.9 : 0.25);
        else if (d.id === 'rocket') fit = dist > 14 && dist < 70 ? 1.5 : 0.3;
        else if (d.id === 'smg') fit = dist < 30 ? 1.5 : 0.5;
        else if (d.id === 'ar') fit = dist < 90 ? 1.6 : 0.7;
        else fit = dist < 40 ? 0.9 : 0.3;
        sc = dps * fit * 0.01;
      }
      if (sc > bestScore) { bestScore = sc; best = i; }
    }
    if (best >= 0 && best !== e.slot) { e.slot = best; e.swapT = 0.22; }
  },

  hasAmmo(e, w) {
    if (!w.def.ammo) return true;
    return w.ammoIn > 0 || e.inv.ammo[w.def.ammo] > 0;
  },

  nearTree(e) {
    let best = null, bd = 22 * 22;
    for (const t of World.trees) {
      if (!t.alive) continue;
      const d = (t.x - e.pos[0]) * (t.x - e.pos[0]) + (t.z - e.pos[2]) * (t.z - e.pos[2]);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  },

  pickGoal(e, G) {
    let best = null, bd = 1e9;
    for (const c of World.chests) {
      if (c.open) continue;
      const d = Math.hypot(c.x - e.pos[0], c.z - e.pos[2]);
      if (d > 130) continue;
      const dz = Math.hypot(c.x - G.storm.cx, c.z - G.storm.cz);
      if (dz > G.storm.r - 12) continue;
      if (d < bd) { bd = d; best = { kind: 'chest', obj: c }; }
    }
    if (!best) {
      for (const it of Loot.items) {
        if (it.kind !== 'weapon') continue;
        const d = Math.hypot(it.x - e.pos[0], it.z - e.pos[2]);
        if (d < bd && d < 60) { bd = d; best = { kind: 'loot', obj: it }; }
      }
    }
    if (!best) {
      const p = World.pois[Math.floor(Math.random() * World.pois.length)];
      best = { kind: 'poi', x: p.x + (Math.random() - 0.5) * 30, z: p.z + (Math.random() - 0.5) * 30 };
    }
    return best;
  },

  moveTo(e, tx, tz, dt, urgent) {
    const b = e.ai, inp = e.in;
    let dx = tx - e.pos[0], dz = tz - e.pos[2];
    const d = Math.hypot(dx, dz) || 1;

    // تجنّب العوائق: إن لم يتحرّك كفاية، انحرف
    const moved = Math.hypot(e.pos[0] - b.lastX, e.pos[2] - b.lastZ);
    if (b.stuckT > 0.45) {
      if (moved < 0.35 && e.grounded) {
        b.avoid = (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.9);
        b.avoidT = 0.8 + Math.random() * 0.8;
        b.stuckCount = (b.stuckCount || 0) + 1;
        if (b.stuckCount > 3 && e.inv.mats[e.mat] >= BUILD_COST) { inp.build = 'ramp'; b.stuckCount = 0; }
        else if (b.stuckCount > 1) inp.jump = true;
      } else b.stuckCount = 0;
      b.lastX = e.pos[0]; b.lastZ = e.pos[2]; b.stuckT = 0;
    }
    let ang = Math.atan2(dx, dz);
    if (b.avoidT > 0) { b.avoidT -= dt; ang += b.avoid; }

    e.yaw = angleLerp(e.yaw, ang, clamp(dt * 5.5, 0, 1));
    e.pitch += (0 - e.pitch) * clamp(dt * 3, 0, 1);
    inp.mz = 1;
    inp.sprint = urgent || d > 14;

    // قفزة عند وجود حاجز منخفض
    if (e.grounded) {
      const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
      const ahead = World.height(e.pos[0] + fx * 1.5, e.pos[2] + fz * 1.5);
      if (ahead - e.pos[1] > 0.85 && ahead - e.pos[1] < 2.2) inp.jump = true;
    }
  },

  create(skill) {
    return {
      t: 0, decide: 0, scanT: Math.random(), target: null, goal: null, goalT: 0,
      skill: skill, seed: Math.random() * 100, aimT: 0, stuckT: 0,
      lastX: 0, lastZ: 0, avoid: 0, avoidT: 0, harvestT: 0,
      strafeT: 0, strafeD: 1, dropTarget: null, stuckCount: 0, harvesting: false
    };
  }
};
