'use strict';
/* ============================================================
   أبطال العاصفة — طبقة WebGL2 المساعدة
   ============================================================ */

const GLU = {
  compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      const lines = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
      console.error('خطأ في التظليل:\n' + log + '\n' + lines);
      throw new Error('Shader compile error: ' + log);
    }
    return s;
  },

  program(gl, vs, fs, name) {
    const p = gl.createProgram();
    gl.attachShader(p, GLU.compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, GLU.compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('Link error (' + name + '): ' + gl.getProgramInfoLog(p));
    }
    // جمع مواقع الـ uniforms تلقائيًا
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const nm = info.name.replace(/\[0\]$/, '');
      u[nm] = gl.getUniformLocation(p, nm);
    }
    p.u = u;
    p.name = name;
    return p;
  },

  fbo(gl, w, h, opts) {
    const o = opts || {};
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    let color = null, depth = null;
    if (o.color !== false) {
      color = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, color);
      gl.texImage2D(gl.TEXTURE_2D, 0, o.hdr ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA,
        o.hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
    } else {
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
    }
    if (o.depth) {
      depth = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, depth);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    } else if (o.depthBuffer) {
      const rb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    }
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) console.warn('FBO غير مكتمل:', st.toString(16));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, color, depth, w, h };
  }
};

/* ============================================================
   Mesh — شبكة مع دعم الاستنساخ
   ============================================================ */
const INST_FLOATS = 20;   // 16 مصفوفة + 4 صبغة
const PART_FLOATS = 8;    // 4 موقع+حجم + 4 لون

class Mesh {
  constructor(gl, data, mode) {
    this.gl = gl;
    this.mode = mode || 'model';
    this.count = data.idx.length;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    const buf = (loc, arr, size) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return b;
    };
    buf(0, data.pos, 3);
    if (data.nrm && data.nrm.length) buf(1, data.nrm, 3);
    if (data.col && data.col.length) buf(2, data.col, 3);

    const eb = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb);
    const big = (data.pos.length / 3) > 65000;
    this.itype = big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
      big ? new Uint32Array(data.idx) : new Uint16Array(data.idx), gl.STATIC_DRAW);

    gl.bindVertexArray(null);
    this.instBuf = null;
    this.maxInst = 0;
  }

  /* تهيئة مخزن الاستنساخ */
  instances(max) {
    const gl = this.gl;
    const stride = this.mode === 'particle' ? PART_FLOATS : INST_FLOATS;
    this.maxInst = max;
    this.data = new Float32Array(max * stride);
    gl.bindVertexArray(this.vao);
    this.instBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const F = 4;
    if (this.mode === 'particle') {
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride * F, 0);
      gl.vertexAttribDivisor(3, 1);
      gl.enableVertexAttribArray(7);
      gl.vertexAttribPointer(7, 4, gl.FLOAT, false, stride * F, 4 * F);
      gl.vertexAttribDivisor(7, 1);
    } else {
      for (let i = 0; i < 4; i++) {
        gl.enableVertexAttribArray(3 + i);
        gl.vertexAttribPointer(3 + i, 4, gl.FLOAT, false, stride * F, i * 4 * F);
        gl.vertexAttribDivisor(3 + i, 1);
      }
      gl.enableVertexAttribArray(7);
      gl.vertexAttribPointer(7, 4, gl.FLOAT, false, stride * F, 16 * F);
      gl.vertexAttribDivisor(7, 1);
    }
    gl.bindVertexArray(null);
    return this;
  }

  upload(n) {
    const gl = this.gl;
    const stride = this.mode === 'particle' ? PART_FLOATS : INST_FLOATS;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, Math.max(0, n * stride));
    this.n = n;
  }

  draw(n) {
    const gl = this.gl;
    const c = n === undefined ? this.n : n;
    if (!c) return;
    gl.bindVertexArray(this.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, this.count, this.itype, 0, c);
  }
}

/* ============================================================
   InstanceList — قائمة استنساخ سهلة الملء
   ============================================================ */
class InstList {
  constructor(mesh) { this.mesh = mesh; this.n = 0; }
  reset() { this.n = 0; }

  /* إضافة نسخة من مصفوفة جاهزة */
  pushMat(m, r, g, b, e) {
    if (this.n >= this.mesh.maxInst) return;
    const d = this.mesh.data, o = this.n * INST_FLOATS;
    for (let i = 0; i < 16; i++) d[o + i] = m[i];
    d[o + 16] = r; d[o + 17] = g; d[o + 18] = b; d[o + 19] = e || 0;
    this.n++;
  }

  /* إضافة نسخة بإزاحة/دوران/تحجيم */
  push(x, y, z, rx, ry, rz, sx, sy, sz, r, g, b, e) {
    if (this.n >= this.mesh.maxInst) return;
    const d = this.mesh.data, o = this.n * INST_FLOATS;
    const cx = Math.cos(rx), sxx = Math.sin(rx), cy = Math.cos(ry), syy = Math.sin(ry),
      cz = Math.cos(rz), szz = Math.sin(rz);
    const m00 = cy * cz + syy * sxx * szz, m01 = -cy * szz + syy * sxx * cz, m02 = syy * cx;
    const m10 = cx * szz, m11 = cx * cz, m12 = -sxx;
    const m20 = -syy * cz + cy * sxx * szz, m21 = syy * szz + cy * sxx * cz, m22 = cy * cx;
    d[o] = m00 * sx; d[o + 1] = m10 * sx; d[o + 2] = m20 * sx; d[o + 3] = 0;
    d[o + 4] = m01 * sy; d[o + 5] = m11 * sy; d[o + 6] = m21 * sy; d[o + 7] = 0;
    d[o + 8] = m02 * sz; d[o + 9] = m12 * sz; d[o + 10] = m22 * sz; d[o + 11] = 0;
    d[o + 12] = x; d[o + 13] = y; d[o + 14] = z; d[o + 15] = 1;
    d[o + 16] = r; d[o + 17] = g; d[o + 18] = b; d[o + 19] = e || 0;
    this.n++;
  }

  flush() { this.mesh.upload(this.n); }
  draw() { this.mesh.draw(this.n); }
}
