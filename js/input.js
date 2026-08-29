'use strict';
/* ============================================================
   أبطال العاصفة — الإدخال (لوحة مفاتيح + فأرة + لمس)
   ============================================================ */

const Input = {
  keys: Object.create(null),
  down: Object.create(null),     // ضغطة واحدة (حافة)
  up: Object.create(null),
  mdx: 0, mdy: 0, wheel: 0,
  mouse: [false, false, false],
  mouseDown: [false, false, false],
  locked: false,
  sensitivity: 1.0,
  invertY: false,
  canvas: null,
  touch: { active: false, moveX: 0, moveY: 0, lookX: 0, lookY: 0, fire: false, jump: false, sprint: false },
  dragLook: false,
  lastX: 0, lastY: 0,

  init(canvas) {
    this.canvas = canvas;
    const self = this;

    addEventListener('keydown', e => {
      if (e.repeat) { return; }
      const c = e.code;
      if (!self.keys[c]) self.down[c] = true;
      self.keys[c] = true;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyG', 'Slash'].indexOf(c) >= 0) e.preventDefault();
    });
    addEventListener('keyup', e => { self.keys[e.code] = false; self.up[e.code] = true; });
    addEventListener('blur', () => { self.keys = Object.create(null); self.mouse = [false, false, false]; });

    canvas.addEventListener('mousedown', e => {
      if (e.button < 3) { if (!self.mouse[e.button]) self.mouseDown[e.button] = true; self.mouse[e.button] = true; }
      if (!self.locked && !self.dragLook) { self.lastX = e.clientX; self.lastY = e.clientY; self.dragLook = true; }
      e.preventDefault();
    });
    addEventListener('mouseup', e => { if (e.button < 3) self.mouse[e.button] = false; self.dragLook = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    addEventListener('mousemove', e => {
      if (self.locked) {
        self.mdx += e.movementX || 0;
        self.mdy += e.movementY || 0;
      } else if (self.dragLook) {
        self.mdx += e.clientX - self.lastX;
        self.mdy += e.clientY - self.lastY;
        self.lastX = e.clientX; self.lastY = e.clientY;
      }
    });

    canvas.addEventListener('wheel', e => { self.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });

    document.addEventListener('pointerlockchange', () => {
      self.locked = (document.pointerLockElement === canvas);
      if (typeof UI !== 'undefined' && UI.onLockChange) UI.onLockChange(self.locked);
    });

    addEventListener('gamepadconnected', () => self.pollGamepad());
    addEventListener('gamepaddisconnected', () => self.pollGamepad());

    this.initTouch(canvas);
  },

  requestLock() {
    if (!this.canvas || !this.canvas.requestPointerLock) return;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => {
        try {
          const q = this.canvas.requestPointerLock();
          if (q && q.catch) q.catch(() => { });
        } catch (e) { }
      });
    } catch (e) { }
  },
  exitLock() { if (document.exitPointerLock) document.exitPointerLock(); },

  /* --- لمس: عصا يسار للحركة، السحب يمينًا للنظر --- */
  initTouch(canvas) {
    const self = this;
    const stick = { id: -1, ox: 0, oy: 0 };
    const look = { id: -1, x: 0, y: 0 };
    const isTouch = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches && ('ontouchstart' in window);
    if (isTouch) document.body.classList.add('touch-device');

    const onStart = e => {
      self.touch.active = true;
      for (const t of e.changedTouches) {
        if (t.clientX > innerWidth * 0.5 && stick.id < 0) {
          stick.id = t.identifier; stick.ox = t.clientX; stick.oy = t.clientY;
          const el = document.getElementById('stick');
          if (el) { el.style.display = 'block'; el.style.left = (t.clientX - 60) + 'px'; el.style.top = (t.clientY - 60) + 'px'; }
        } else if (look.id < 0) {
          look.id = t.identifier; look.x = t.clientX; look.y = t.clientY;
        }
      }
    };
    const onMove = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === stick.id) {
          const dx = clamp((t.clientX - stick.ox) / 55, -1, 1);
          const dy = clamp((t.clientY - stick.oy) / 55, -1, 1);
          self.touch.moveX = -dx; self.touch.moveY = -dy;
          const kn = document.getElementById('stick-knob');
          if (kn) kn.style.transform = 'translate(' + (dx * 40) + 'px,' + (dy * 40) + 'px)';
        } else if (t.identifier === look.id) {
          self.mdx += (t.clientX - look.x) * 1.7;
          self.mdy += (t.clientY - look.y) * 1.7;
          look.x = t.clientX; look.y = t.clientY;
        }
      }
      e.preventDefault();
    };
    const onEnd = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === stick.id) {
          stick.id = -1; self.touch.moveX = 0; self.touch.moveY = 0;
          const el = document.getElementById('stick'); if (el) el.style.display = 'none';
          const kn = document.getElementById('stick-knob'); if (kn) kn.style.transform = '';
        }
        if (t.identifier === look.id) look.id = -1;
      }
    };
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd);
    canvas.addEventListener('touchcancel', onEnd);
  },

  bindTouchButton(id, prop) {
    const el = document.getElementById(id);
    if (!el) return;
    const self = this;
    el.addEventListener('touchstart', e => { self.touch[prop] = true; e.preventDefault(); e.stopPropagation(); }, { passive: false });
    el.addEventListener('touchend', e => { self.touch[prop] = false; e.preventDefault(); e.stopPropagation(); });
    el.addEventListener('mousedown', e => { self.touch[prop] = true; e.stopPropagation(); });
    el.addEventListener('mouseup', e => { self.touch[prop] = false; e.stopPropagation(); });
  },

  /* ============================================================
     يد التحكّم (DualSense / Xbox / أي يد بمخطّط standard)
     ============================================================ */
  gp: {
    on: false, id: '', kind: 'generic',
    lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0,
    btn: [], prev: [], index: -1
  },
  gpSens: 1.0,
  aimAssist: true,

  /* منطقة ميتة + منحنى استجابة */
  _dz(v, d) {
    const a = Math.abs(v);
    if (a < d) return 0;
    return (v < 0 ? -1 : 1) * ((a - d) / (1 - d));
  },

  pollGamepad() {
    const g = this.gp;
    g.prev = g.btn;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (p && p.connected && p.axes && p.axes.length >= 2) { pad = p; break; }
    }
    if (!pad) {
      if (g.on) {
        g.on = false;
        if (typeof UI !== 'undefined' && UI.onGamepad) UI.onGamepad(false, '');
      }
      g.btn = []; g.lx = g.ly = g.rx = g.ry = 0; g.lt = g.rt = 0;
      return;
    }
    if (!g.on) {
      g.on = true; g.id = pad.id || '';
      const low = g.id.toLowerCase();
      g.kind = /dualsense|dualshock|playstation|054c|wireless controller/.test(low) ? 'ps'
        : (/xbox|xinput|045e/.test(low) ? 'xbox' : 'generic');
      if (typeof UI !== 'undefined' && UI.onGamepad) UI.onGamepad(true, g.kind);
    }
    g.index = pad.index;
    g.lx = this._dz(pad.axes[0] || 0, 0.16);
    g.ly = this._dz(pad.axes[1] || 0, 0.16);
    g.rx = this._dz(pad.axes[2] || 0, 0.14);
    g.ry = this._dz(pad.axes[3] || 0, 0.14);
    const b = pad.buttons || [];
    const arr = new Array(b.length);
    for (let i = 0; i < b.length; i++) arr[i] = !!(b[i] && (b[i].pressed || b[i].value > 0.5));
    g.btn = arr;
    g.lt = b[6] ? (b[6].value !== undefined ? b[6].value : (b[6].pressed ? 1 : 0)) : 0;
    g.rt = b[7] ? (b[7].value !== undefined ? b[7].value : (b[7].pressed ? 1 : 0)) : 0;
  },

  gpDown(i) { return !!this.gp.btn[i]; },
  gpPressed(i) { return !!this.gp.btn[i] && !this.gp.prev[i]; },

  /* دفعة النظر من العصا اليمنى (راديان/ثانية) */
  gpLook(dt) {
    const g = this.gp;
    if (!g.on) return [0, 0];
    // منحنى تربيعي: تحكّم دقيق قرب المركز وسرعة عند الأطراف
    const cx = g.rx * Math.abs(g.rx);
    const cy = g.ry * Math.abs(g.ry);
    const sp = 3.1 * this.gpSens;
    return [cx * sp * dt, cy * sp * dt * (this.invertY ? -1 : 1)];
  },

  /* استهلاك حركة الفأرة */
  takeMouse() {
    const r = [this.mdx * this.sensitivity, this.mdy * this.sensitivity * (this.invertY ? -1 : 1)];
    this.mdx = 0; this.mdy = 0;
    return r;
  },
  takeWheel() { const w = this.wheel; this.wheel = 0; return w; },

  isDown(c) { return !!this.keys[c]; },
  pressed(c) { return !!this.down[c]; },
  released(c) { return !!this.up[c]; },
  clickPressed(b) { return !!this.mouseDown[b]; },

  endFrame() {
    this.down = Object.create(null);
    this.up = Object.create(null);
    this.mouseDown = [false, false, false];
  }
};
