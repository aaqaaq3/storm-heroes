'use strict';
/* ============================================================
   أبطال العاصفة — واجهة المستخدم
   ============================================================ */

const AR_NUM = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const ar = n => String(n).replace(/\d/g, d => AR_NUM[+d]);
const $ = id => document.getElementById(id);

const WICON = {
  pickaxe: '<svg viewBox="0 0 46 20"><path d="M4 15 L30 6" stroke="#b98a4e" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M26 2 Q34 6 40 3 Q36 10 40 16 Q33 12 26 15 Z" fill="#cfd9f0"/></svg>',
  pistol: '<svg viewBox="0 0 46 20"><rect x="16" y="5" width="22" height="6" rx="1.6" fill="#cfd9f0"/><rect x="34" y="7" width="10" height="3" rx="1" fill="#8d99b5"/><path d="M18 10 L16 18 L22 18 L23 10 Z" fill="#8d99b5"/></svg>',
  smg: '<svg viewBox="0 0 46 20"><rect x="10" y="5" width="26" height="6" rx="1.6" fill="#cfd9f0"/><rect x="34" y="7" width="10" height="3" rx="1" fill="#8d99b5"/><rect x="16" y="11" width="5" height="8" rx="1.4" fill="#8d99b5"/><path d="M12 10 L10 17 L15 17 L16 10 Z" fill="#8d99b5"/><rect x="4" y="6" width="7" height="4" rx="1.4" fill="#7b86a4"/></svg>',
  ar: '<svg viewBox="0 0 46 20"><rect x="8" y="5" width="30" height="6" rx="1.6" fill="#cfd9f0"/><rect x="36" y="7" width="9" height="3" rx="1" fill="#8d99b5"/><rect x="18" y="11" width="6" height="9" rx="1.4" fill="#8d99b5"/><path d="M13 10 L11 18 L16 18 L17 10 Z" fill="#8d99b5"/><rect x="2" y="6" width="7" height="5" rx="1.6" fill="#7b86a4"/><rect x="24" y="2" width="10" height="3" rx="1" fill="#9aa6c2"/></svg>',
  shotgun: '<svg viewBox="0 0 46 20"><rect x="10" y="5" width="26" height="7" rx="2" fill="#cfd9f0"/><rect x="34" y="6" width="11" height="5" rx="2" fill="#8d99b5"/><path d="M12 11 L9 18 L15 18 L16 11 Z" fill="#8d99b5"/><rect x="2" y="6" width="9" height="5" rx="2" fill="#8a6a44"/></svg>',
  sniper: '<svg viewBox="0 0 46 20"><rect x="6" y="6" width="30" height="5" rx="1.4" fill="#cfd9f0"/><rect x="34" y="7" width="12" height="3" rx="1" fill="#8d99b5"/><rect x="16" y="2" width="13" height="4" rx="1.6" fill="#6f7a96"/><path d="M12 10 L10 18 L15 18 L16 10 Z" fill="#8d99b5"/><rect x="1" y="6" width="6" height="6" rx="2" fill="#8a6a44"/></svg>',
  rocket: '<svg viewBox="0 0 46 20"><rect x="6" y="5" width="34" height="8" rx="4" fill="#cfd9f0"/><circle cx="41" cy="9" r="4.6" fill="#ff8a4c"/><path d="M14 12 L11 19 L17 19 L18 12 Z" fill="#8d99b5"/><rect x="22" y="1" width="9" height="4" rx="1.4" fill="#8d99b5"/></svg>'
};

const UI = {
  paused: false, mapOpen: false,
  heroSel: 0, dmgPool: [], npPool: [],
  tips: [
    'استخدم الفأس على الأشجار لجمع الخشب — الجدار السريع ينقذ حياتك.',
    'الصناديق الذهبية تحوي أفضل الأسلحة. اسمع صوت طنينها!',
    'الأسلحة الذهبية «الأسطورية» أقوى بنسبة ٣٦٪ من العادية.',
    'اضغط G للدخول في وضع البناء، ثم Z لجدار سريع أمامك.',
    'البقاء في المرتفعات يعطيك أفضلية رؤية وإصابة.',
    'العاصفة تؤذي أكثر كل مرحلة — لا تتأخّر في الحركة.',
    'الإصابة في الرأس تضاعف الضرر تقريبًا. صوّب عاليًا!',
    'اضغط H لشرب عبوة الدرع قبل بدء الاشتباك.'
  ],

  init() {
    if (this._ready) return;
    this._ready = true;
    /* بطاقات الأبطال */
    const wrap = $('hero-cards');
    HEROES.forEach((h, i) => {
      const c = document.createElement('div');
      c.className = 'hero-card' + (i === 0 ? ' sel' : '');
      const sk = rgbcss(h.skin), sh = rgbcss(h.shirt), pa = rgbcss(h.pants),
        ha = rgbcss(h.hair), ac = rgbcss(h.accent);
      c.innerHTML =
        '<div class="hc-av" style="background:linear-gradient(180deg,' + mixcss(h.shirt, .28) + ',rgba(6,10,24,.9))"></div>' +
        '<div class="hc-glow" style="background:' + ac + '"></div>' +
        '<div class="hc-fig">' +
        '<div class="hc-hat" style="background:' + ha + '"></div>' +
        '<div class="hc-head" style="background:' + sk + '"></div>' +
        '<div class="hc-body" style="background:linear-gradient(160deg,' + sh + ',' + mixcss(h.shirt, .55) + ')"></div>' +
        '<div class="hc-legs" style="background:' + pa + '"></div>' +
        '</div>' +
        '<span class="hc-tag">' + (h.fem ? 'بطلة' : 'بطل') + '</span>' +
        '<span class="hc-nm">' + h.name + '</span>';
      c.onclick = () => { this.selectHero(i); SFX.init(); SFX.ui('click'); };
      c.onmouseenter = () => SFX.ui('hover');
      wrap.appendChild(c);
    });
    this.selectHero(0);

    /* التبويبات */
    document.querySelectorAll('.tab').forEach(t => {
      t.onclick = () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.tabview').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        $('tab-' + t.dataset.tab).classList.add('active');
        SFX.ui('click');
      };
    });

    /* الأزرار */
    $('btn-play').onclick = () => this.startGame();
    $('btn-resume').onclick = () => this.setPause(false);
    $('btn-pause-help').onclick = () => { this.setPause(false); this.quitToMenu(); document.querySelector('.tab[data-tab=help]').click(); };
    $('btn-quit').onclick = () => { this.setPause(false); this.quitToMenu(); };
    $('btn-again').onclick = () => { hide('screen-result'); this.startGame(); };
    $('btn-menu').onclick = () => { hide('screen-result'); this.quitToMenu(); };

    /* الإعدادات */
    const s = this.loadSettings();
    const sens = $('set-sens'), vol = $('set-vol'), mus = $('set-mus'), sfx = $('set-sfx'),
      gps = $('set-gpsens');
    sens.value = s.sens; vol.value = s.vol; mus.value = s.mus; sfx.value = s.sfx;
    gps.value = s.gpsens;
    const applyS = () => {
      Input.sensitivity = +sens.value;
      Input.gpSens = +gps.value;
      $('val-gpsens').textContent = (+gps.value).toFixed(2);
      $('val-sens').textContent = (+sens.value).toFixed(2);
      $('val-vol').textContent = Math.round(vol.value * 100) + '%';
      $('val-mus').textContent = Math.round(mus.value * 100) + '%';
      $('val-sfx').textContent = Math.round(sfx.value * 100) + '%';
      SFX.setVolumes(+vol.value, +mus.value, +sfx.value);
      this.saveSettings();
    };
    [sens, vol, mus, sfx, gps].forEach(el => { el.oninput = applyS; });
    applyS();

    segmented('set-quality', 'q', v => { R.setQuality(v); this.saveSettings(); }, s.quality);
    segmented('set-assist', 'a', v => { Input.aimAssist = v === '1'; this.saveSettings(); }, s.assist);
    segmented('set-invert', 'v', v => { Input.invertY = v === '1'; this.saveSettings(); }, s.invert);
    segmented('set-count', 'n', v => { G.total = +v; this.syncPlayCount(); this.saveSettings(); }, String(s.count));
    segmented('set-diff', 'd', v => { this.diff = v; this.saveSettings(); }, s.diff);
    this.diff = s.diff;
    G.total = s.count;
    Input.gpSens = s.gpsens;
    Input.aimAssist = s.assist !== '0';
    Input.invertY = s.invert === '1';
    this.syncPlayCount();

    /* خريطة كاملة */
    const mo = document.createElement('div');
    mo.id = 'mapoverlay';
    mo.style.cssText = 'position:absolute;inset:0;z-index:30;display:none;align-items:center;justify-content:center;' +
      'background:rgba(4,7,20,.86);backdrop-filter:blur(10px)';
    mo.innerHTML = '<div style="text-align:center"><canvas id="bigmap" width="560" height="560" ' +
      'style="width:min(72vh,86vw);height:min(72vh,86vw);border-radius:22px;border:2px solid rgba(150,185,255,.35);' +
      'box-shadow:0 30px 80px rgba(0,0,0,.7)"></canvas>' +
      '<div style="margin-top:14px;font-size:13px;color:#93a2c9;font-weight:700">اضغط <kbd>M</kbd> للإغلاق</div></div>';
    document.body.appendChild(mo);

    /* أزرار اللمس */
    Input.bindTouchButton('t-fire', 'fire');
    Input.bindTouchButton('t-jump', 'jump');
    Input.bindTouchButton('t-sprint', 'sprint');
    const tb = $('t-build'), tu = $('t-use');
    if (tb) tb.onclick = () => { const p = G.player; if (p) p.buildMode = !p.buildMode; };
    if (tu) tu.onclick = () => { const p = G.player; if (p) G.tryInteract(p); };

    /* خانات المخزون */
    const inv = $('inventory');
    for (let i = 0; i < 5; i++) {
      const d = document.createElement('div');
      d.className = 'slot empty';
      d.innerHTML = '<span class="sn">' + ar(i + 1) + '</span><div class="swp"></div><span class="snm"></span>' +
        '<span class="sammo"></span><div class="rbar"></div>';
      d.style.pointerEvents = 'auto';
      d.onclick = () => { if (G.player) G.selectSlot(G.player, i); };
      inv.appendChild(d);
    }
    this.slots = Array.from(inv.children);

    document.querySelectorAll('.bslot').forEach(b => {
      b.style.pointerEvents = 'auto';
      b.onclick = () => { const p = G.player; if (p) { p.buildMode = true; p.buildType = b.dataset.b; } };
    });
    document.querySelectorAll('.mat').forEach(m => {
      m.style.pointerEvents = 'auto';
      m.onclick = () => { const p = G.player; if (p) p.mat = +m.dataset.m; };
    });

    /* مفاتيح عامة */
    addEventListener('keydown', e => {
      if (e.code === 'Escape') {
        if (this.mapOpen) { this.toggleMap(false); return; }
        if (G.state === 'play' || G.state === 'spectate') this.setPause(!this.paused);
      }
      if ((e.code === 'KeyM' || e.code === 'Tab') && (G.state === 'play' || G.state === 'spectate')) {
        e.preventDefault();
        if (!this.paused) this.toggleMap(!this.mapOpen);
      }
    });
    $('scene').addEventListener('click', () => {
      if ((G.state === 'play' || G.state === 'spectate') && !this.paused && !this.mapOpen && !Input.locked) Input.requestLock();
    });

    this.nextTip();
    this._tipTimer = setInterval(() => {
      const b = $('screen-boot');
      if (b && b.classList.contains('active')) this.nextTip();
      else { clearInterval(this._tipTimer); this._tipTimer = null; }
    }, 4200);
  },

  onGamepad(on, kind) {
    document.body.classList.toggle('has-gamepad', on);
    const h = $('padhint');
    if (h) h.textContent = on
      ? '🎮 يد التحكّم متّصلة — ✕ للبدء، ← → لاختيار البطل'
      : '';
    if (on) {
      SFX.ui('click');
      const name = kind === 'ps' ? 'PlayStation' : (kind === 'xbox' ? 'Xbox' : 'يد التحكّم');
      if (G.state === 'play' || G.state === 'spectate') this.toast('🎮 تم توصيل يد ' + name);
    }
  },

  /* التنقّل في القوائم بيد التحكّم (للّعب على التلفزيون) */
  gamepadNav(dt) {
    const g = Input.gp;
    if (!g.on) return;
    this._navT = Math.max(0, (this._navT || 0) - dt);
    const ax = g.lx + (Input.gpDown(15) ? 1 : 0) - (Input.gpDown(14) ? 1 : 0);

    const resultOn = $('screen-result').classList.contains('active');
    const pauseOn = $('screen-pause').classList.contains('active');

    if (resultOn) {
      if (Input.gpPressed(0)) { hide('screen-result'); this.startGame(); }
      else if (Input.gpPressed(1)) { hide('screen-result'); this.quitToMenu(); }
      return;
    }
    if (pauseOn) {
      if (Input.gpPressed(0) || Input.gpPressed(9)) this.setPause(false);
      else if (Input.gpPressed(3)) { this.setPause(false); this.quitToMenu(); }
      return;
    }
    if (G.state === 'play' || G.state === 'spectate') {
      if (Input.gpPressed(8)) this.toggleMap(!this.mapOpen);
      else if (this.mapOpen && (Input.gpPressed(1) || Input.gpPressed(0))) this.toggleMap(false);
      else if (!this.mapOpen && Input.gpPressed(9)) this.setPause(true);
      return;
    }
    if (G.state !== 'menu') return;

    if (Math.abs(ax) > 0.55 && this._navT <= 0) {
      this._navT = 0.22;
      const n = HEROES.length;
      this.selectHero((this.heroSel + (ax > 0 ? 1 : n - 1)) % n);
      SFX.ui('hover');
    }
    if (Input.gpPressed(0)) { SFX.ui('click'); this.startGame(); }
    if (Input.gpPressed(3)) {
      const tabs = Array.from(document.querySelectorAll('.tab'));
      const cur = tabs.findIndex(t => t.classList.contains('active'));
      tabs[(cur + 1) % tabs.length].click();
    }
    if (Input.gpPressed(1)) document.querySelector('.tab[data-tab=play]').click();
  },

  syncPlayCount() {
    const el = document.querySelector('#btn-play .btn-sub');
    if (el) el.textContent = ar(G.total) + ' لاعبًا — الفائز واحد';
  },

  nextTip() { $('boottip').textContent = '💡 ' + this.tips[Math.floor(Math.random() * this.tips.length)]; },

  loadSettings() {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const smallScr = Math.min(innerWidth, innerHeight) <= 560;
    const lowCore = (navigator.hardwareConcurrency || 4) <= 4;
    // جودة افتراضية مناسبة للجهاز: جوال → منخفضة، لوحي/ضعيف → متوسطة
    const autoQ = (coarse && smallScr) ? 'low' : ((coarse || lowCore) ? 'medium' : 'high');
    let s = { sens: 1, vol: .75, mus: .4, sfx: .9, quality: autoQ, invert: '0', count: coarse ? 12 : 16, diff: 'normal', gpsens: 1, assist: '1' };
    try { const j = JSON.parse(localStorage.getItem('storm_heroes_cfg') || '{}'); Object.assign(s, j); } catch (e) { }
    return s;
  },
  saveSettings() {
    try {
      localStorage.setItem('storm_heroes_cfg', JSON.stringify({
        sens: +$('set-sens').value, vol: +$('set-vol').value, mus: +$('set-mus').value, sfx: +$('set-sfx').value,
        quality: R.quality, invert: Input.invertY ? '1' : '0', count: G.total, diff: this.diff,
        gpsens: Input.gpSens, assist: Input.aimAssist ? '1' : '0'
      }));
    } catch (e) { }
  },

  selectHero(i) {
    this.heroSel = i;
    const h = HEROES[i];
    document.querySelectorAll('.hero-card').forEach((c, k) => c.classList.toggle('sel', k === i));
    $('hd-name').textContent = h.name;
    $('hd-title').textContent = h.title;
    $('hd-desc').textContent = h.desc;
    $('hd-perk').textContent = h.perk;
    if (G.state === 'menu') G.menuFocus = i;
  },

  /* ============ تدفّق اللعبة ============ */
  startGame() {
    SFX.init(); SFX.resume(); SFX.music(false);
    hide('screen-menu'); hide('screen-result');
    $('hud').classList.add('on');
    document.body.classList.add('in-match');
    this.paused = false; this.mapOpen = false;
    $('mapoverlay').style.display = 'none';
    $('killfeed').innerHTML = '';
    G.startMatch(HEROES[this.heroSel].id);
    // قفل المؤشّر للفأرة فقط — لا معنى له على اللمس أو يد التحكّم
    const touchDev = document.body.classList.contains('touch-device');
    if (!touchDev) {
      Input.requestLock();
      setTimeout(() => { if (!Input.locked) Input.requestLock(); }, 250);
      setTimeout(() => {
        if (!Input.locked && !Input.gp.on && !document.body.classList.contains('touch-device'))
          this.toast('انقر على الشاشة لتفعيل التحكّم بالفأرة');
      }, 900);
    }
  },

  quitToMenu() {
    G.state = 'menu';
    $('hud').classList.remove('on');
    document.body.classList.remove('in-match');
    hide('screen-result'); hide('screen-pause');
    show('screen-menu');
    Input.exitLock();
    SFX.stormLoop(false);
    SFX.music(true);
    this.buildMenuScene();
  },

  setPause(v) {
    if (G.state !== 'play' && G.state !== 'spectate') v = false;
    this.paused = v;
    if (v) { show('screen-pause'); Input.exitLock(); }
    else { hide('screen-pause'); setTimeout(() => Input.requestLock(), 60); }
  },

  toggleMap(v) {
    this.mapOpen = v;
    $('mapoverlay').style.display = v ? 'flex' : 'none';
    if (v) { Input.exitLock(); this.drawBigMap(); }
    else setTimeout(() => Input.requestLock(), 60);
  },

  onLockChange(locked) {
    if (locked) { this._wasLocked = true; return; }
    // نوقف اللعبة فقط إن كان المؤشّر مقفلًا فعلًا ثم تحرّر (ضغط Esc)،
    // لا إن كان المتصفّح لا يسمح بالقفل أصلًا.
    if (this._wasLocked && (G.state === 'play' || G.state === 'spectate') && !this.mapOpen && !this.paused) {
      this._wasLocked = false;
      this.setPause(true);
    }
  },

  onMatchStart() {
    $('stat-kills').textContent = ar(0);
    this.lastFeed = 0;
  },

  /* مشهد الردهة: الأبطال الأربعة يقفون معًا */
  buildMenuScene() {
    G.ents = [];
    // نقف على تلّة القمر: منظر واسع وخلفية جميلة
    const lob = World.lobby || { x: 0, y: 0, z: 0, dir: [0, 0, 1] };
    const cx = lob.x, cz = lob.z;
    const dir = lob.dir;                       // من الأبطال نحو الكاميرا
    const side = [dir[2], 0, -dir[0]];         // متعامد للصفّ
    const faceYaw = Math.atan2(dir[0], dir[2]);
    HEROES.forEach((h, i) => {
      const e = G.makeEnt(h.name, h, false);
      const a = (i - 1.5) * 1.05;
      e.pos = [cx + side[0] * a * 1.6 - dir[0] * Math.abs(a) * 0.3, 0, cz + side[2] * a * 1.6 - dir[2] * Math.abs(a) * 0.3];
      e.pos[1] = World.height(e.pos[0], e.pos[2]);
      e.bodyYaw = e.yaw = faceYaw + a * 0.14;
      e.state = 'ground'; e.grounded = true;
      e.inv.slots[1] = Weapons.make(['sniper', 'ar', 'smg', 'shotgun'][i], 3);
      e.slot = 1;
      e.weapon = e.inv.slots[1];
      e.anim = null;
      G.ents.push(e);
    });
    G.player = null;
    G.menuFocus = this.heroSel;
    G.menuAnchor = [cx, World.height(cx, cz), cz];
    G.menuDir = dir;
    V.set(G.camPos, cx + dir[0] * 7.6, World.height(cx, cz) + 2.5, cz + dir[2] * 7.6);
  },

  /* ============ تحديث الواجهة ============ */
  update(dt) {
    if (G.state === 'menu' || G.state === 'boot') return;
    const p = G.player;
    if (!p) return;

    /* الإحصاءات */
    $('stat-alive').textContent = ar(G.alive);
    $('stat-kills').textContent = ar(p.kills);
    const st = G.storm;
    if (st) {
      const t = Math.max(0, st.timer);
      $('stat-storm').textContent = ar(Math.floor(t / 60)) + ':' + ar(String(Math.floor(t % 60)).padStart(2, '0'));
      $('storm-lbl').textContent = st.mode === 'wait' ? 'تتقلّص بعد' : 'تتحرّك الآن';
      $('storm-box').classList.toggle('warn', st.mode === 'shrink' || t < 11);
    }

    /* الصحة والدرع */
    const hp = clamp(p.hp, 0, 100), sh = clamp(p.shield, 0, 100);
    $('bar-health').style.width = hp + '%';
    $('bar-shield').style.width = sh + '%';
    $('txt-health').textContent = ar(Math.ceil(hp));
    $('txt-shield').textContent = ar(Math.ceil(sh));
    document.querySelector('.bar.health').classList.toggle('low', hp < 30);

    /* المواد */
    for (let i = 0; i < 3; i++) $('mat-' + i).textContent = ar(p.inv.mats[i]);
    $('cs-shield').textContent = ar(p.inv.shieldPots);
    $('cs-heal').textContent = ar(p.inv.medkits);
    document.querySelectorAll('.mat').forEach((m, i) => m.style.opacity = (i === p.mat ? 1 : .55));

    /* المخزون */
    for (let i = 0; i < 5; i++) {
      const w = p.inv.slots[i], el = this.slots[i];
      el.classList.toggle('on', i === p.slot);
      el.classList.toggle('empty', !w);
      const svg = el.querySelector('.swp'), nm = el.querySelector('.snm'),
        am = el.querySelector('.sammo'), rb = el.querySelector('.rbar');
      if (!w) { svg.innerHTML = ''; nm.textContent = ''; am.textContent = ''; rb.style.background = 'transparent'; continue; }
      if (el._wid !== w.id + w.rarity) {
        el._wid = w.id + w.rarity;
        svg.innerHTML = WICON[w.id] || '';
        nm.textContent = w.def.short || w.def.name;
        rb.style.background = RARITY[w.rarity].hex;
        el.style.borderColor = i === p.slot ? '' : RARITY[w.rarity].hex + '66';
      }
      if (w.def.ammo) am.innerHTML = '<b>' + ar(w.ammoIn) + '</b> <i>/ ' + ar(p.inv.ammo[w.def.ammo] || 0) + '</i>';
      else am.textContent = '∞';
    }

    /* البناء */
    const bb = $('buildbar');
    bb.classList.toggle('on', p.buildMode);
    if (p.buildMode) {
      document.querySelectorAll('.bslot').forEach(b => b.classList.toggle('on', b.dataset.b === p.buildType));
      $('bmat').innerHTML = MATS[p.mat].name + ' <i>F</i>';
      $('bmat').style.borderColor = MATS[p.mat].hex;
      $('bmat').style.color = MATS[p.mat].hex;
    }

    /* المركز */
    const ch = $('crosshair');
    const w = p.weapon;
    let spread = 8;
    if (w && w.def.kind === 'gun') {
      const base = p.aiming ? w.def.aimSpread : w.def.spread;
      spread = 5 + base * 320 + p.recoil * 26 + (p.sprint ? 10 : 0) + (p.grounded ? 0 : 8);
    }
    spread = clamp(spread, 3, 30);
    ch.querySelector('.ch-t').style.top = (21 - spread) + 'px';
    ch.querySelector('.ch-b').style.bottom = (21 - spread) + 'px';
    ch.querySelector('.ch-l').style.left = (21 - spread) + 'px';
    ch.querySelector('.ch-r').style.right = (21 - spread) + 'px';
    ch.classList.toggle('hidden', G.scoped || p.state === 'dead' || p.state === 'skydive');
    $('scope').classList.toggle('on', G.scoped);

    /* علامة الإصابة */
    if (G.hitMarker > 0.95) {
      const hm = $('hitmarker');
      hm.classList.remove('on'); void hm.offsetWidth;
      hm.classList.toggle('kill', G.hitMarkerKill > 0);
      hm.classList.add('on');
      G.hitMarker = 0.9; G.hitMarkerKill = 0;
    }

    /* شريط إعادة التعبئة */
    const rr = $('reloadring');
    if (w && w.reloading > 0) {
      rr.classList.add('on');
      const f = 1 - w.reloading / Weapons.reloadTime(w);
      $('rl-arc').style.strokeDashoffset = (100.5 * (1 - f)).toFixed(1);
    } else rr.classList.remove('on');

    /* العلاج */
    const hb = $('healbar');
    if (p.healing) {
      hb.classList.add('on');
      const total = p.healing === 'shield' ? 2 : 3;
      $('hb-fill').style.width = ((1 - p.healT / total) * 100) + '%';
      $('hb-txt').textContent = p.healing === 'shield' ? 'شرب الدرع…' : 'إسعاف…';
    } else hb.classList.remove('on');

    /* تحذير العاصفة */
    $('stormwarn').classList.toggle('on', !!p.stormIn && p.state !== 'dead');

    /* رسالة المركز */
    const cm = $('centermsg');
    if (G.msgT > 0) { cm.textContent = G.msg; cm.classList.add('on'); }
    else cm.classList.remove('on');

    /* تلميح التفاعل */
    this.updatePrompt(p);
    /* الأرقام واللوحات */
    this.updateDmgNums();
    this.updateNameplates();
    this.updateFeed();
    this.updateCompass(p);
    this.drawMinimap(p);
    if (this.mapOpen) this.drawBigMap();
  },

  updatePrompt(p) {
    const el = $('prompt');
    if (p.state === 'dead' || p.state === 'skydive' || p.state === 'glide') { el.classList.remove('on'); return; }
    let txt = null;
    let bd = 3.4;
    for (const c of World.chests) {
      if (c.open) continue;
      const d = Math.hypot(c.x - p.pos[0], c.z - p.pos[2]) + Math.abs(c.y - p.pos[1]) * 0.6;
      if (d < bd) { bd = d; txt = 'فتح الصندوق'; }
    }
    if (!txt) {
      bd = 2.6;
      for (const it of Loot.items) {
        if (it.kind !== 'weapon') continue;
        const d = Math.hypot(it.x - p.pos[0], it.z - p.pos[2]) + Math.abs(it.y - p.pos[1]) * 0.6;
        if (d < bd) { bd = d; txt = 'التقاط ' + RARITY[it.data.w.rarity].name + ' — ' + it.data.w.def.name; }
      }
    }
    if (txt) { $('prompt-txt').textContent = txt; el.classList.add('on'); }
    else el.classList.remove('on');
  },

  updateDmgNums() {
    const host = $('dmgnums');
    const list = G.dmgNums;
    while (this.dmgPool.length < list.length) {
      const d = document.createElement('div'); d.className = 'dnum'; host.appendChild(d); this.dmgPool.push(d);
    }
    const sp = [0, 0, 0];
    for (let i = 0; i < this.dmgPool.length; i++) {
      const el = this.dmgPool[i], d = list[i];
      if (!d) { el.style.display = 'none'; continue; }
      if (!R.project(sp, [d.x, d.y + d.t * 1.1, d.z])) { el.style.display = 'none'; continue; }
      el.style.display = 'block';
      el.className = 'dnum' + (d.head ? ' head' : '');
      el.textContent = ar(d.v);
      el.style.left = sp[0] + 'px';
      el.style.top = sp[1] + 'px';
      el.style.opacity = clamp(1 - d.t / 1.05, 0, 1);
      el.style.transform = 'translate(-50%,-50%) scale(' + (1 + (1 - clamp(d.t * 4, 0, 1)) * 0.5) + ')';
    }
  },

  updateNameplates() {
    const host = $('nameplates');
    const p = G.player;
    const vis = [];
    for (const e of G.ents) {
      if (e === p || e.state === 'dead' || e.state === 'bus') continue;
      const d = V.dist(e.pos, R.camPos);
      if (d > 95) continue;
      const dir = V.norm([0, 0, 0], V.sub([0, 0, 0], e.pos, R.camPos));
      if (V.dot(dir, R.camFwd) < 0.55) continue;
      // فحص خطّ الرؤية مكلف — نخزّن نتيجته لجزء من الثانية
      if (e._losT === undefined || G.time - e._losT > 0.18) {
        e._losT = G.time;
        e._los = G.hasLOS(p, e);
      }
      if (!e._los) continue;
      vis.push(e);
    }
    while (this.npPool.length < vis.length) {
      const d = document.createElement('div'); d.className = 'nplate';
      d.innerHTML = '<span class="np-nm"></span><div class="np-bar"><i></i></div>';
      host.appendChild(d); this.npPool.push(d);
    }
    const sp = [0, 0, 0];
    for (let i = 0; i < this.npPool.length; i++) {
      const el = this.npPool[i], e = vis[i];
      if (!e) { el.style.display = 'none'; continue; }
      if (!R.project(sp, [e.pos[0], e.pos[1] + 2.25, e.pos[2]])) { el.style.display = 'none'; continue; }
      el.style.display = 'block';
      el.classList.toggle('fam', !!e.family);
      el.querySelector('.np-nm').textContent = e.name;
      el.querySelector('.np-bar i').style.width = clamp((e.hp + e.shield) / 2, 0, 100) + '%';
      el.style.left = sp[0] + 'px';
      el.style.top = sp[1] + 'px';
      el.style.opacity = clamp(1 - (sp[2] - 60) / 40, 0.35, 1);
    }
  },

  updateFeed() {
    const host = $('killfeed');
    if (G.feed.length !== this.lastFeed) {
      if (G.feed.length > this.lastFeed) {
        for (let i = this.lastFeed; i < G.feed.length; i++) {
          const f = G.feed[i];
          const d = document.createElement('div');
          d.className = 'kf' + (f.player ? ' me' : '');
          d.innerHTML = f.killer
            ? '<span class="kf-k">' + f.killer + '</span><span class="kf-x">✕</span><span class="kf-v">' + f.victim + '</span>'
            : '<span class="kf-v">' + f.victim + ' ' + (f.victimFem ? 'خرجت' : 'خرج') + ' من اللعبة</span>';
          host.appendChild(d);
          while (host.children.length > 5) host.removeChild(host.firstChild);
          setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 6000);
        }
      }
      this.lastFeed = G.feed.length;
    }
  },

  updateCompass(p) {
    const strip = $('compass-strip');
    if (!strip.dataset.built) {
      let h = '';
      for (let a = -360; a <= 720; a += 15) {
        const n = ((a % 360) + 360) % 360;
        const lbl = n === 0 ? 'ش' : n === 90 ? 'ق' : n === 180 ? 'ج' : n === 270 ? 'غ' : '·';
        h += '<i class="' + (lbl !== '·' ? 'card' : '') + '">' + lbl + '</i>';
      }
      strip.innerHTML = h;
      strip.dataset.built = '1';
      strip.style.width = (72 * 15 + 34) + 'px';
    }
    const deg = ((-p.yaw * 180 / Math.PI) % 360 + 360) % 360;
    const w = $('compass').clientWidth;
    const px = (deg / 15) * 34;
    strip.style.transform = 'translateX(' + (-(px + 24 * 34) + w / 2 - 17) + 'px)';
  },

  drawMinimap(p) {
    const cv = $('minimap'), g = cv.getContext('2d');
    const S = cv.width;
    const view = 230;   // وحدات العالم الظاهرة
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.roundRect ? g.roundRect(0, 0, S, S, 18) : g.rect(0, 0, S, S); g.clip();
    const src = World.minimapCanvas;
    const sc = src.width / MAP_SIZE;
    const sx = (p.pos[0] + MAP_SIZE / 2 - view / 2) * sc;
    const sy = (p.pos[2] + MAP_SIZE / 2 - view / 2) * sc;
    g.imageSmoothingEnabled = true;
    g.drawImage(src, sx, sy, view * sc, view * sc, 0, 0, S, S);

    const w2s = (x, z) => [((x - p.pos[0]) / view + 0.5) * S, ((z - p.pos[2]) / view + 0.5) * S];

    // العاصفة
    const st = G.storm;
    if (st) {
      const [cx, cy] = w2s(st.cx, st.cz);
      const r = st.r / view * S;
      g.save();
      g.beginPath(); g.rect(0, 0, S, S);
      g.arc(cx, cy, Math.max(1, r), 0, TAU, true);
      g.fillStyle = 'rgba(140,60,230,.34)'; g.fill('evenodd');
      g.restore();
      g.beginPath(); g.arc(cx, cy, Math.max(1, r), 0, TAU);
      g.strokeStyle = '#c07bff'; g.lineWidth = 2.6; g.stroke();
      if (st.mode === 'wait') {
        const [nx, ny] = w2s(st.nx, st.nz);
        g.beginPath(); g.arc(nx, ny, Math.max(1, st.nextR / view * S), 0, TAU);
        g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.setLineDash([7, 6]); g.stroke(); g.setLineDash([]);
      }
    }

    // المواقع
    g.font = '700 11px Cairo, sans-serif';
    g.textAlign = 'center';
    for (const poi of World.pois) {
      const [x, y] = w2s(poi.x, poi.z);
      if (x < -40 || x > S + 40 || y < -20 || y > S + 20) continue;
      g.fillStyle = 'rgba(0,0,0,.55)';
      g.fillText(poi.name, x + 1, y + 1);
      g.fillStyle = 'rgba(255,255,255,.92)';
      g.fillText(poi.name, x, y);
    }

    // الصناديق القريبة
    g.fillStyle = 'rgba(255,200,60,.85)';
    for (const c of World.chests) {
      if (c.open) continue;
      const d = Math.hypot(c.x - p.pos[0], c.z - p.pos[2]);
      if (d > view * 0.5) continue;
      const [x, y] = w2s(c.x, c.z);
      g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill();
    }

    // اللاعب
    const a = p.yaw;
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(-a + Math.PI);
    g.beginPath();
    g.moveTo(0, -11); g.lineTo(7.5, 8); g.lineTo(0, 4); g.lineTo(-7.5, 8); g.closePath();
    g.fillStyle = '#22e6d0'; g.strokeStyle = '#04121f'; g.lineWidth = 1.6;
    g.fill(); g.stroke();
    g.restore();
    g.restore();
  },

  drawBigMap() {
    const cv = $('bigmap'); if (!cv) return;
    const g = cv.getContext('2d'), S = cv.width;
    const p = G.player;
    g.clearRect(0, 0, S, S);
    g.drawImage(World.minimapCanvas, 0, 0, S, S);
    const w2s = (x, z) => [(x / MAP_SIZE + 0.5) * S, (z / MAP_SIZE + 0.5) * S];
    const st = G.storm;
    if (st) {
      const [cx, cy] = w2s(st.cx, st.cz);
      const r = st.r / MAP_SIZE * S;
      g.save();
      g.beginPath(); g.rect(0, 0, S, S); g.arc(cx, cy, Math.max(1, r), 0, TAU, true);
      g.fillStyle = 'rgba(140,60,230,.38)'; g.fill('evenodd'); g.restore();
      g.beginPath(); g.arc(cx, cy, Math.max(1, r), 0, TAU);
      g.strokeStyle = '#c07bff'; g.lineWidth = 3; g.stroke();
      if (st.mode === 'wait') {
        const [nx, ny] = w2s(st.nx, st.nz);
        g.beginPath(); g.arc(nx, ny, Math.max(1, st.nextR / MAP_SIZE * S), 0, TAU);
        g.strokeStyle = '#fff'; g.lineWidth = 2.4; g.setLineDash([9, 8]); g.stroke(); g.setLineDash([]);
      }
    }
    g.font = '800 15px Cairo, sans-serif'; g.textAlign = 'center';
    for (const poi of World.pois) {
      const [x, y] = w2s(poi.x, poi.z);
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(poi.name, x + 1.5, y + 1.5);
      g.fillStyle = '#fff'; g.fillText(poi.name, x, y);
    }
    if (p) {
      const [x, y] = w2s(p.pos[0], p.pos[2]);
      g.save(); g.translate(x, y); g.rotate(-p.yaw + Math.PI);
      g.beginPath(); g.moveTo(0, -13); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath();
      g.fillStyle = '#22e6d0'; g.strokeStyle = '#04121f'; g.lineWidth = 2; g.fill(); g.stroke();
      g.restore();
    }
  },

  /* ============ إشعارات ============ */
  toast(txt) {
    const host = $('toast');
    const d = document.createElement('div');
    d.className = 'tst'; d.textContent = txt;
    host.appendChild(d);
    while (host.children.length > 3) host.removeChild(host.firstChild);
    setTimeout(() => { if (d.parentNode) { d.style.opacity = '0'; d.style.transition = 'opacity .3s'; setTimeout(() => d.remove(), 320); } }, 1900);
  },

  damageDir(fromPos) {
    if (!fromPos || !G.player) return;
    const p = G.player;
    const a = Math.atan2(fromPos[0] - p.pos[0], fromPos[2] - p.pos[2]) - p.yaw;
    const d = document.createElement('div');
    d.className = 'ddir';
    d.style.transform = 'rotate(' + (-a * 180 / Math.PI) + 'deg)';
    $('dmgdirs').appendChild(d);
    setTimeout(() => d.remove(), 1150);
  },

  pulseMat(i) {
    const el = document.querySelectorAll('.mat')[i];
    if (!el) return;
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 180);
  },

  showResult(win, p, by, place) {
    $('hud').classList.remove('on');
    document.body.classList.remove('in-match');
    $('res-crown').textContent = win ? '👑' : '🛡️';
    const t = $('res-title');
    t.textContent = win ? 'فـوز ملكـي!' : 'انتهت الجولة';
    t.classList.toggle('lose', !win);
    const f = p.fem;
    $('res-sub').innerHTML = win
      ? (f ? 'أحسنتِ يا <b>' + p.name + '</b>! كنتِ آخر من بقي على الجزيرة.'
           : 'أحسنت يا <b>' + p.name + '</b>! كنتَ آخر من بقي على الجزيرة.')
      : (by ? ('أقصاكِ <b>' + by.name + '</b>').replace('أقصاكِ', f ? 'أقصاكِ' : 'أقصاك') + '. حاول مرّة أخرى!'
        : (f ? 'لم تنجي هذه المرّة. حاولي مرّة أخرى!' : 'لم تنجُ هذه المرّة. حاول مرّة أخرى!'));
    $('res-place').textContent = '#' + ar(place || 1);
    $('res-kills').textContent = ar(p.kills);
    $('res-dmg').textContent = ar(Math.round(p.dmgDealt));
    const s = Math.floor(G.matchTime);
    $('res-time').textContent = ar(Math.floor(s / 60)) + ':' + ar(String(s % 60).padStart(2, '0'));
    show('screen-result');
    if (win) this.confetti();
  },

  confetti() {
    const host = $('confetti');
    host.innerHTML = '';
    const cols = ['#22e6d0', '#7b5cff', '#ff4d8d', '#ffc23d', '#3ddc84', '#ffffff'];
    for (let i = 0; i < 130; i++) {
      const d = document.createElement('div');
      d.className = 'cft';
      d.style.left = Math.random() * 100 + '%';
      d.style.background = cols[Math.floor(Math.random() * cols.length)];
      d.style.animationDuration = (2.4 + Math.random() * 2.6) + 's';
      d.style.animationDelay = (Math.random() * 1.6) + 's';
      d.style.opacity = (0.6 + Math.random() * 0.4).toFixed(2);
      host.appendChild(d);
    }
    setTimeout(() => { host.innerHTML = ''; }, 7000);
  }
};

/* ---------- أدوات DOM ---------- */
function show(id) { const e = $(id); e.style.display = ''; e.classList.add('active'); }
function hide(id) { const e = $(id); e.classList.remove('active'); setTimeout(() => { if (!e.classList.contains('active')) e.style.display = 'none'; }, 360); }
function mixcss(c, k) { return 'rgb(' + Math.round(clamp(c[0] * k, 0, 1) * 255) + ',' + Math.round(clamp(c[1] * k, 0, 1) * 255) + ',' + Math.round(clamp(c[2] * k, 0, 1) * 255) + ')'; }
function rgbcss(c) { return 'rgb(' + Math.round(clamp(c[0], 0, 1) * 255) + ',' + Math.round(clamp(c[1], 0, 1) * 255) + ',' + Math.round(clamp(c[2], 0, 1) * 255) + ')'; }
function segmented(id, attr, cb, initial) {
  const host = $(id); if (!host) return;
  const btns = Array.from(host.children);
  btns.forEach(b => {
    b.onclick = () => {
      btns.forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      cb(b.dataset[attr]);
      SFX.ui('click');
    };
    if (b.dataset[attr] === String(initial)) { btns.forEach(x => x.classList.remove('on')); b.classList.add('on'); }
  });
  const on = btns.find(b => b.classList.contains('on'));
  if (on) cb(on.dataset[attr]);
}
