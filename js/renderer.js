'use strict';
/* ============================================================
   أبطال العاصفة — العارض ثلاثي الأبعاد
   ============================================================ */

const R = {
  gl: null, canvas: null,
  W: 1, H: 1, dpr: 1,
  quality: 'high',           // low | medium | high
  shadowSize: 2048,
  bloomOn: true,
  time: 0,

  view: M.create(), proj: M.create(), vp: M.create(), invVP: M.create(),
  lightView: M.create(), lightProj: M.create(), lightVP: M.create(),
  camPos: [0, 0, 0], camFwd: [0, 0, -1], camRight: [1, 0, 0], camUp: [0, 1, 0],

  sunDir: V.norm([0, 0, 0], [0.42, 0.82, 0.38]),
  lightCol: [1.10, 1.02, 0.88],
  ambSky: [0.40, 0.49, 0.62],
  ambGnd: [0.26, 0.24, 0.20],
  skyTop: [0.13, 0.34, 0.76], skyMid: [0.44, 0.70, 0.95], skyBot: [0.78, 0.85, 0.90],
  fogCol: [0.74, 0.84, 0.93], fogDen: 0.00165,
  flash: [0, 0, 0], stormFx: 0,

  init(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      antialias: true, alpha: false, depth: true, stencil: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false
    });
    if (!gl) return null;
    this.gl = gl;
    this.hdr = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');

    this.pObj = GLU.program(gl, SH.objVS, SH.objFS, 'obj');
    this.pDepth = GLU.program(gl, SH.depthVS, SH.depthFS, 'depth');
    this.pSky = GLU.program(gl, SH.skyVS, SH.skyFS, 'sky');
    this.pWater = GLU.program(gl, SH.waterVS, SH.waterFS, 'water');
    this.pStorm = GLU.program(gl, SH.stormVS, SH.stormFS, 'storm');
    this.pFx = GLU.program(gl, SH.fxVS, SH.fxFS, 'fx');
    this.pPart = GLU.program(gl, SH.partVS, SH.partFS, 'part');
    this.pBright = GLU.program(gl, SH.fullVS, SH.brightFS, 'bright');
    this.pBlur = GLU.program(gl, SH.fullVS, SH.blurFS, 'blur');
    this.pComp = GLU.program(gl, SH.fullVS, SH.compFS, 'comp');

    this.emptyVao = gl.createVertexArray();

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.5, 0.7, 0.9, 1);

    this.makeShadow();
    this.resize();

    // شبكة الماء وجدار العاصفة
    const wp = Geo.plane(2600, 2600, 48, 48);
    this.waterMesh = { vao: gl.createVertexArray(), count: wp.idx.length };
    gl.bindVertexArray(this.waterMesh.vao);
    let b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(wp.pos), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    let e = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, e);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(wp.idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    const cyl = Geo.cylinder(1, 1, 190, 72, false, false);
    for (let i = 1; i < cyl.pos.length; i += 3) cyl.pos[i] += 95;
    this.stormMesh = { vao: gl.createVertexArray(), count: cyl.idx.length };
    gl.bindVertexArray(this.stormMesh.vao);
    b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cyl.pos), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    e = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, e);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cyl.idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    return gl;
  },

  setQuality(q) {
    this.quality = q;
    this.bloomOn = (q !== 'low');
    const s = q === 'low' ? 1024 : (q === 'medium' ? 1536 : 2048);
    if (s !== this.shadowSize) { this.shadowSize = s; this.makeShadow(); }
    this.resize();
  },

  makeShadow() {
    const gl = this.gl;
    if (this.shadow) { gl.deleteFramebuffer(this.shadow.fb); gl.deleteTexture(this.shadow.depth); }
    this.shadow = GLU.fbo(gl, this.shadowSize, this.shadowSize, { color: false, depth: true });
  },

  resize() {
    const gl = this.gl;
    const maxDpr = this.quality === 'low' ? 1 : (this.quality === 'medium' ? 1.35 : 2);
    this.dpr = Math.min(devicePixelRatio || 1, maxDpr);
    const w = Math.max(2, Math.floor(this.canvas.clientWidth * this.dpr));
    const h = Math.max(2, Math.floor(this.canvas.clientHeight * this.dpr));
    if (w === this.W && h === this.H && this.scene) return;
    this.W = w; this.H = h;
    this.canvas.width = w; this.canvas.height = h;
    const del = f => { if (f) { gl.deleteFramebuffer(f.fb); if (f.color) gl.deleteTexture(f.color); if (f.depth) gl.deleteTexture(f.depth); } };
    del(this.scene); del(this.bA); del(this.bB);
    this.scene = GLU.fbo(gl, w, h, { depthBuffer: true, hdr: this.hdr });
    const bw = Math.max(2, w >> 2), bh = Math.max(2, h >> 2);
    this.bA = GLU.fbo(gl, bw, bh, { hdr: this.hdr });
    this.bB = GLU.fbo(gl, bw, bh, { hdr: this.hdr });
  },

  /* ---------- الكاميرا ---------- */
  setCamera(pos, yaw, pitch, fovDeg, roll) {
    V.cp(this.camPos, pos);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    this.camFwd = [Math.sin(yaw) * cp, sp, Math.cos(yaw) * cp];
    const wup = [0, 1, 0];
    V.norm(this.camRight, V.cross([0, 0, 0], this.camFwd, wup));
    V.norm(this.camUp, V.cross([0, 0, 0], this.camRight, this.camFwd));
    if (roll) {
      const cr = Math.cos(roll), sr = Math.sin(roll);
      const r = V.clone(this.camRight), u = V.clone(this.camUp);
      this.camRight = [r[0] * cr + u[0] * sr, r[1] * cr + u[1] * sr, r[2] * cr + u[2] * sr];
      this.camUp = [u[0] * cr - r[0] * sr, u[1] * cr - r[1] * sr, u[2] * cr - r[2] * sr];
    }
    const tgt = V.add([0, 0, 0], pos, this.camFwd);
    M.lookAt(this.view, pos, tgt, this.camUp);
    M.perspective(this.proj, fovDeg * DEG, this.W / this.H, 0.12, 1800);
    M.mul(this.vp, this.proj, this.view);
    M.invert(this.invVP, this.vp);
  },

  /* شمس تتبع اللاعب مع محاذاة للتكسل لتجنّب اهتزاز الظل */
  setSunTarget(p) {
    const D = this.quality === 'low' ? 58 : (this.quality === 'medium' ? 64 : 72);
    const texel = (D * 2) / this.shadowSize;
    const tx = Math.round(p[0] / texel) * texel;
    const tz = Math.round(p[2] / texel) * texel;
    const ty = p[1];
    const eye = [tx + this.sunDir[0] * 220, ty + this.sunDir[1] * 220, tz + this.sunDir[2] * 220];
    M.lookAt(this.lightView, eye, [tx, ty, tz], [0, 1, 0]);
    M.ortho(this.lightProj, -D, D, -D, D, 1, 470);
    M.mul(this.lightVP, this.lightProj, this.lightView);
  },

  /* ---------- التمريرات ---------- */
  beginShadow() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadow.fb);
    gl.viewport(0, 0, this.shadowSize, this.shadowSize);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.cullFace(gl.FRONT);
    gl.useProgram(this.pDepth);
    gl.uniformMatrix4fv(this.pDepth.u.uLightVP, false, this.lightVP);
  },

  beginMain() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fb);
    gl.viewport(0, 0, this.W, this.H);
    gl.cullFace(gl.BACK);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    this.drawSky();
    const p = this.pObj;
    gl.useProgram(p);
    gl.uniformMatrix4fv(p.u.uVP, false, this.vp);
    gl.uniformMatrix4fv(p.u.uLightVP, false, this.lightVP);
    gl.uniform3fv(p.u.uLightDir, this.sunDir);
    gl.uniform3fv(p.u.uLightCol, this.lightCol);
    gl.uniform3fv(p.u.uAmbSky, this.ambSky);
    gl.uniform3fv(p.u.uAmbGnd, this.ambGnd);
    gl.uniform3fv(p.u.uCamPos, this.camPos);
    gl.uniform3fv(p.u.uFogCol, this.fogCol);
    gl.uniform1f(p.u.uFogDen, this.fogDen);
    gl.uniform1f(p.u.uShadowTexel, 1 / this.shadowSize);
    gl.uniform1f(p.u.uShadowOn, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadow.depth);
    gl.uniform1i(p.u.uShadow, 0);
  },

  drawSky() {
    const gl = this.gl, p = this.pSky;
    gl.useProgram(p);
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    gl.uniformMatrix4fv(p.u.uInvVP, false, this.invVP);
    gl.uniform3fv(p.u.uCamPos, this.camPos);
    gl.uniform3fv(p.u.uSunDir, this.sunDir);
    gl.uniform1f(p.u.uTime, this.time);
    gl.uniform3fv(p.u.uSkyTop, this.skyTop);
    gl.uniform3fv(p.u.uSkyMid, this.skyMid);
    gl.uniform3fv(p.u.uSkyBot, this.skyBot);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
  },

  drawWater(level) {
    const gl = this.gl, p = this.pWater;
    gl.useProgram(p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(true);
    gl.uniformMatrix4fv(p.u.uVP, false, this.vp);
    gl.uniform3fv(p.u.uCamPos, this.camPos);
    gl.uniform1f(p.u.uTime, this.time);
    gl.uniform3fv(p.u.uSunDir, this.sunDir);
    gl.uniform3fv(p.u.uFogCol, this.fogCol);
    gl.uniform1f(p.u.uFogDen, this.fogDen);
    gl.bindVertexArray(this.waterMesh.vao);
    gl.drawElements(gl.TRIANGLES, this.waterMesh.count, gl.UNSIGNED_INT, 0);
    gl.disable(gl.BLEND);
  },

  beginFx() {
    const gl = this.gl, p = this.pFx;
    gl.useProgram(p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.uniformMatrix4fv(p.u.uVP, false, this.vp);
    gl.uniform3fv(p.u.uCamPos, this.camPos);
  },

  beginParticles() {
    const gl = this.gl, p = this.pPart;
    gl.useProgram(p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.uniformMatrix4fv(p.u.uVP, false, this.vp);
    gl.uniform3fv(p.u.uRight, this.camRight);
    gl.uniform3fv(p.u.uUp, this.camUp);
  },

  drawStorm(cx, cz, radius) {
    const gl = this.gl, p = this.pStorm;
    gl.useProgram(p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.uniformMatrix4fv(p.u.uVP, false, this.vp);
    gl.uniform3f(p.u.uCenter, cx, 0, cz);
    gl.uniform1f(p.u.uRadius, radius);
    gl.uniform1f(p.u.uTime, this.time);
    gl.uniform3fv(p.u.uCamPos, this.camPos);
    gl.bindVertexArray(this.stormMesh.vao);
    gl.drawElements(gl.TRIANGLES, this.stormMesh.count, gl.UNSIGNED_SHORT, 0);
  },

  endWorld() {
    const gl = this.gl;
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  },

  /* ---------- المعالجة اللاحقة ---------- */
  post() {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.emptyVao);

    if (this.bloomOn) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bA.fb);
      gl.viewport(0, 0, this.bA.w, this.bA.h);
      gl.useProgram(this.pBright);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.scene.color);
      gl.uniform1i(this.pBright.u.uTex, 0);
      gl.uniform1f(this.pBright.u.uThresh, 0.78);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      for (let i = 0; i < 2; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.bB.fb);
        gl.useProgram(this.pBlur);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.bA.color);
        gl.uniform1i(this.pBlur.u.uTex, 0);
        gl.uniform2f(this.pBlur.u.uDir, 1 / this.bA.w, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.bA.fb);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.bB.color);
        gl.uniform2f(this.pBlur.u.uDir, 0, 1 / this.bA.h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    const p = this.pComp;
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.scene.color);
    gl.uniform1i(p.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.bloomOn ? this.bA.color : this.scene.color);
    gl.uniform1i(p.u.uBloom, 1);
    gl.uniform1f(p.u.uBloomAmt, this.bloomOn ? 0.46 : 0);
    gl.uniform1f(p.u.uVign, 0.62);
    gl.uniform1f(p.u.uSat, 1.14);
    gl.uniform3fv(p.u.uFlash, this.flash);
    gl.uniform1f(p.u.uTime, this.time);
    gl.uniform1f(p.u.uStormFx, this.stormFx);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
  },

  /* إسقاط نقطة عالمية إلى إحداثيات الشاشة (بالبكسل CSS) */
  project(out, wp) {
    const x = wp[0], y = wp[1], z = wp[2];
    const m = this.vp;
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 0.02) return false;
    const cx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / cw;
    const cy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw;
    out[0] = (cx * 0.5 + 0.5) * this.canvas.clientWidth;
    out[1] = (1 - (cy * 0.5 + 0.5)) * this.canvas.clientHeight;
    out[2] = cw;
    return true;
  }
};
