'use strict';
/* ============================================================
   أبطال العاصفة — نقطة البداية
   ============================================================ */
(function () {
  const canvas = document.getElementById('scene');
  let started = false;

  function fatal(msg, detail) {
    const el = document.getElementById('fatal');
    el.innerHTML = '<div><div style="font-size:26px;font-weight:900;margin-bottom:14px">تعذّر تشغيل اللعبة</div>' +
      '<div>' + msg + '</div>' +
      (detail ? '<div style="margin-top:14px;font-size:12px;color:#7d8db5;direction:ltr">' + detail + '</div>' : '') +
      '</div>';
    el.classList.add('on');
    console.error(msg, detail || '');
  }

  addEventListener('error', e => {
    if (!started) fatal('حدث خطأ أثناء التحميل.', e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno);
  });

  const setProgress = (p, t) => {
    document.getElementById('loadfill').style.width = (p * 100).toFixed(0) + '%';
    if (t) document.getElementById('loadtext').textContent = t;
  };

  const steps = [
    ['تشغيل محرّك الرسوميات…', () => {
      if (!G.init(canvas)) throw new Error('WEBGL2_UNAVAILABLE');
      Input.init(canvas);
    }],
    ['نحت التضاريس وتلوين الجزيرة…', () => {
      G.buildWorld((Math.random() * 0xffffffff) >>> 0);
    }],
    ['توزيع الغنائم والصناديق…', () => {
      UI.init();
    }],
    ['تجهيز الأبطال…', () => {
      UI.buildMenuScene();
      G.state = 'menu';
    }]
  ];

  let si = 0;
  function nextStep() {
    if (si >= steps.length) return finish();
    const [label, fn] = steps[si];
    setProgress(si / steps.length, label);
    // setTimeout بدل requestAnimationFrame: يعمل حتى لو فُتحت اللعبة
    // في تبويب خلفي أو أثناء تبديل التطبيقات على الجوال
    setTimeout(() => {
      try { fn(); }
      catch (err) {
        if (String(err.message).indexOf('WEBGL2') >= 0) {
          fatal('متصفّحك لا يدعم WebGL 2 المطلوب لتشغيل اللعبة.<br>جرّب Chrome أو Safari بأحدث إصدار، وتأكّد من تفعيل تسريع الرسوميات.');
        } else {
          fatal('حدث خطأ أثناء التجهيز.', err.message);
        }
        console.error(err);
        return;
      }
      si++;
      setTimeout(nextStep, 30);
    }, 16);
  }

  function finish() {
    setProgress(1, 'جاهز!');
    setTimeout(() => {
      const b = document.getElementById('screen-boot');
      b.classList.remove('active');
      setTimeout(() => { b.style.display = 'none'; }, 400);
      const m = document.getElementById('screen-menu');
      m.style.display = ''; m.classList.add('active');
      started = true;
      loop(performance.now());
    }, 420);
  }

  /* عند العودة إلى التبويب: صفّر الزمن حتى لا تقفز اللعبة */
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') last = performance.now();
  });

  /* الحلقة الرئيسية */
  let last = performance.now(), acc = 0, frames = 0, fpsT = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.06) dt = 0.06;
    if (dt <= 0) dt = 0.0001;

    Input.pollGamepad();
    if (Input.gp.on) UI.gamepadNav(dt);

    try {
      if (!UI.paused && !UI.mapOpen) G.update(dt);
      else { R.time += dt * 0.15; G.updateCamera(dt); }
      G.render();
      UI.update(dt);
    } catch (err) {
      console.error(err);
      fatal('حدث خطأ أثناء اللعب.', err.message);
      throw err;
    }
    Input.endFrame();

    frames++; fpsT += dt;
    if (fpsT > 1) { G.fps = frames; frames = 0; fpsT = 0; }
  }

  /* تغيير الحجم */
  let rzT = null;
  addEventListener('resize', () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => { R.resize(); }, 90);
  });

  /* أول تفاعل يشغّل الصوت */
  const wake = () => {
    SFX.init(); SFX.resume();
    if (G.state === 'menu') SFX.music(true);
    removeEventListener('pointerdown', wake);
    removeEventListener('keydown', wake);
  };
  addEventListener('pointerdown', wake);
  addEventListener('keydown', wake);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (G.state === 'play' || G.state === 'spectate')) UI.setPause(true);
  });

  nextStep();
})();
