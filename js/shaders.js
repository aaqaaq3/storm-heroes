'use strict';
/* ============================================================
   أبطال العاصفة — مصادر التظليل (GLSL ES 3.00)
   ============================================================ */

const SH = {};

/* ---------- دوال مشتركة ---------- */
SH.common = `
vec3 acesTone(vec3 x){
  const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0);
}
float hash13(vec3 p){
  p = fract(p*0.3183099+vec3(0.71,0.113,0.419));
  p *= 17.0;
  return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}
float vnoise3(vec3 x){
  vec3 i=floor(x), f=fract(x);
  f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash13(i+vec3(0,0,0)),hash13(i+vec3(1,0,0)),f.x),
                 mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x),
                 mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm3(vec3 p){
  float s=0.0,a=0.5;
  for(int i=0;i<5;i++){ s+=vnoise3(p)*a; p*=2.02; a*=0.5; }
  return s;
}`;

/* ============================================================
   1) التظليل الأساسي للأجسام (مع الاستنساخ instancing)
   ============================================================ */
SH.objVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec3 aCol;
layout(location=3) in vec4 iM0;
layout(location=4) in vec4 iM1;
layout(location=5) in vec4 iM2;
layout(location=6) in vec4 iM3;
layout(location=7) in vec4 iTint;   // rgb = صبغة، a = توهّج

uniform mat4 uVP;
uniform mat4 uLightVP;

out vec3 vNrm; out vec3 vCol; out vec3 vWorld; out vec4 vLP; out float vEmis;

void main(){
  mat4 m = mat4(iM0,iM1,iM2,iM3);
  vec4 wp = m * vec4(aPos,1.0);
  vWorld = wp.xyz;
  vec3 n = mat3(m) * aNrm;
  vNrm = normalize(n);
  vCol = aCol * iTint.rgb;
  vEmis = iTint.a;
  vLP = uLightVP * wp;
  gl_Position = uVP * wp;
}`;

SH.objFS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vNrm; in vec3 vCol; in vec3 vWorld; in vec4 vLP; in float vEmis;

uniform vec3 uLightDir;
uniform vec3 uLightCol;
uniform vec3 uAmbSky;
uniform vec3 uAmbGnd;
uniform vec3 uCamPos;
uniform vec3 uFogCol;
uniform float uFogDen;
uniform sampler2D uShadow;
uniform float uShadowTexel;
uniform float uShadowOn;

out vec4 outColor;
${SH.common}

float shadowAt(){
  if(uShadowOn < 0.5) return 1.0;
  vec3 p = vLP.xyz / vLP.w * 0.5 + 0.5;
  if(p.z>1.0 || p.x<0.0 || p.x>1.0 || p.y<0.0 || p.y>1.0) return 1.0;
  float bias = 0.0012;
  float s = 0.0;
  for(int y=-1;y<=1;y++){
    for(int x=-1;x<=1;x++){
      float d = texture(uShadow, p.xy + vec2(float(x),float(y))*uShadowTexel).r;
      s += (p.z - bias > d) ? 0.0 : 1.0;
    }
  }
  // تلاشٍ عند حواف خريطة الظل حتى لا يظهر خط فاصل
  float edge = min(min(p.x, 1.0-p.x), min(p.y, 1.0-p.y));
  float fade = smoothstep(0.0, 0.055, edge) * (1.0 - smoothstep(0.86, 1.0, p.z));
  return mix(1.0, s/9.0, fade);
}

void main(){
  vec3 N = normalize(vNrm);
  vec3 L = normalize(uLightDir);
  vec3 Vv = normalize(uCamPos - vWorld);
  float ndl = max(dot(N,L), 0.0);
  float sh = shadowAt();
  // ضوء محيط نصف كروي
  vec3 amb = mix(uAmbGnd, uAmbSky, N.y*0.5+0.5);
  // إضاءة مرتدة خفيفة من الاتجاه المعاكس
  float back = max(dot(N,-L),0.0)*0.12;
  vec3 H = normalize(L+Vv);
  float lum = dot(vCol, vec3(0.2126,0.7152,0.0722));
  float spec = pow(max(dot(N,H),0.0), 42.0) * (0.06 + lum*0.26) * sh * ndl;
  vec3 col = vCol * (amb + uLightCol*ndl*sh + uLightCol*back) + uLightCol*spec;
  // حافة ضوئية تعطي مظهر الكرتون ثلاثي الأبعاد
  float rim = pow(1.0 - max(dot(N,Vv),0.0), 3.5);
  col += vCol * rim * 0.17 * (0.3 + 0.7*sh);
  col = mix(col, vCol*2.2 + 0.25, clamp(vEmis,0.0,1.0));
  float d = length(uCamPos - vWorld);
  float f = 1.0 - exp(-pow(d*uFogDen, 2.2));
  col = mix(col, uFogCol, clamp(f,0.0,0.92));
  outColor = vec4(col,1.0);
}`;

/* ============================================================
   2) تمريرة الظل (عمق فقط)
   ============================================================ */
SH.depthVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=3) in vec4 iM0;
layout(location=4) in vec4 iM1;
layout(location=5) in vec4 iM2;
layout(location=6) in vec4 iM3;
uniform mat4 uLightVP;
void main(){
  mat4 m = mat4(iM0,iM1,iM2,iM3);
  gl_Position = uLightVP * m * vec4(aPos,1.0);
}`;

SH.depthFS = `#version 300 es
precision highp float;
void main(){}`;

/* ============================================================
   3) السماء (مثلث بملء الشاشة)
   ============================================================ */
SH.skyVS = `#version 300 es
precision highp float;
out vec2 vNdc;
void main(){
  vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2);
  vNdc = p*2.0-1.0;
  gl_Position = vec4(vNdc,1.0,1.0);
}`;

SH.skyFS = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform mat4 uInvVP;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform float uTime;
uniform vec3 uSkyTop, uSkyMid, uSkyBot;
out vec4 outColor;
${SH.common}

void main(){
  vec4 far = uInvVP * vec4(vNdc, 1.0, 1.0);
  vec3 dir = normalize(far.xyz/far.w - uCamPos);
  float h = dir.y;
  vec3 col = mix(uSkyBot, uSkyMid, smoothstep(-0.12, 0.22, h));
  col = mix(col, uSkyTop, smoothstep(0.12, 0.75, h));

  // الشمس + هالتها
  float sd = max(dot(dir, normalize(uSunDir)), 0.0);
  col += vec3(1.0,0.92,0.72) * pow(sd, 900.0) * 3.0;
  col += vec3(1.0,0.78,0.48) * pow(sd, 14.0) * 0.32;

  // غيوم إجرائية
  if(h > 0.015){
    vec3 pp = dir/max(h,0.02);
    vec2 uv = pp.xz*0.055 + vec2(uTime*0.0045, uTime*0.0022);
    float c = fbm3(vec3(uv, uTime*0.012));
    c = smoothstep(0.46, 0.78, c);
    float fade = smoothstep(0.015, 0.30, h);
    float lit = 0.55 + 0.45*smoothstep(0.0,0.6,sd);
    col = mix(col, mix(vec3(0.86,0.89,0.96), vec3(1.0,0.98,0.93), lit), c*fade*0.82);
  }

  // نجوم خفيفة قرب الأفق العلوي للجمال
  outColor = vec4(col, 1.0);
}`;

/* ============================================================
   4) الماء
   ============================================================ */
SH.waterVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat4 uVP; uniform float uTime; uniform vec3 uCamPos;
out vec3 vW;
void main(){
  vec3 p = aPos;
  p.x += uCamPos.x; p.z += uCamPos.z;
  p.y += sin(p.x*0.18 + uTime*1.3)*0.13 + cos(p.z*0.22 + uTime*1.05)*0.11;
  vW = p;
  gl_Position = uVP * vec4(p,1.0);
}`;

SH.waterFS = `#version 300 es
precision highp float;
in vec3 vW;
uniform vec3 uCamPos; uniform float uTime; uniform vec3 uSunDir;
uniform vec3 uFogCol; uniform float uFogDen;
out vec4 outColor;
${SH.common}
void main(){
  vec3 Vv = normalize(uCamPos - vW);
  float n1 = fbm3(vec3(vW.xz*0.28, uTime*0.35));
  float n2 = fbm3(vec3(vW.zx*0.62 + 13.0, uTime*0.55));
  vec3 N = normalize(vec3((n1-0.5)*0.55, 1.0, (n2-0.5)*0.55));
  float fres = pow(1.0 - max(dot(N,Vv),0.0), 3.0);
  vec3 deep = vec3(0.023,0.16,0.30);
  vec3 shallow = vec3(0.10,0.48,0.62);
  vec3 col = mix(deep, shallow, fres*0.35 + 0.25);
  vec3 H = normalize(normalize(uSunDir)+Vv);
  col += vec3(1.0,0.95,0.85)*pow(max(dot(N,H),0.0), 160.0)*1.5;
  col += vec3(0.35,0.75,0.95)*fres*0.5;
  float foam = smoothstep(0.72,0.95, fbm3(vec3(vW.xz*0.75, uTime*0.6)));
  col = mix(col, vec3(0.85,0.94,1.0), foam*0.12);
  float d = length(uCamPos - vW);
  float f = 1.0 - exp(-pow(d*uFogDen, 2.2));
  col = mix(col, uFogCol, clamp(f,0.0,0.92));
  outColor = vec4(col, 0.93);
}`;

/* ============================================================
   5) جدار العاصفة
   ============================================================ */
SH.stormVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat4 uVP; uniform vec3 uCenter; uniform float uRadius;
out vec3 vW; out vec2 vUV;
void main(){
  vec3 p = vec3(aPos.x*uRadius + uCenter.x, aPos.y, aPos.z*uRadius + uCenter.z);
  vW = p;
  vUV = vec2(atan(aPos.z, aPos.x), aPos.y);
  gl_Position = uVP * vec4(p,1.0);
}`;

SH.stormFS = `#version 300 es
precision highp float;
in vec3 vW; in vec2 vUV;
uniform float uTime; uniform vec3 uCamPos; uniform float uInside;
out vec4 outColor;
${SH.common}
void main(){
  float a = vUV.x*3.2;
  vec3 q = vec3(a*2.4, vW.y*0.045 - uTime*0.35, uTime*0.16);
  float n = fbm3(q);
  float n2 = fbm3(q*2.4 + 5.0);
  float band = smoothstep(0.30, 0.85, n*0.65 + n2*0.45);
  vec3 c1 = vec3(0.42,0.24,0.95);
  vec3 c2 = vec3(0.16,0.72,1.0);
  vec3 c3 = vec3(0.92,0.42,1.0);
  vec3 col = mix(c1, c2, n2);
  col = mix(col, c3, band*0.45);
  col += band*0.30;
  // خطوط طاقة رأسية متحركة
  float st = pow(abs(sin(a*9.0 + uTime*1.1)), 22.0);
  col += vec3(0.8,0.9,1.0)*st*0.55;
  float hFade = smoothstep(0.0, 22.0, vW.y) * (1.0 - smoothstep(85.0, 165.0, vW.y));
  float d = length(uCamPos.xz - vW.xz);
  float near = smoothstep(160.0, 12.0, d);
  float alpha = (0.20 + band*0.34) * hFade * (0.50 + near*0.62);
  outColor = vec4(col, clamp(alpha,0.0,0.92));
}`;

/* ============================================================
   6) مؤثرات مضيئة (مقذوفات، خطوط الرصاص، أعمدة الغنائم)
   ============================================================ */
SH.fxVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec3 aCol;
layout(location=3) in vec4 iM0;
layout(location=4) in vec4 iM1;
layout(location=5) in vec4 iM2;
layout(location=6) in vec4 iM3;
layout(location=7) in vec4 iTint;
uniform mat4 uVP;
out vec3 vCol; out float vA; out vec3 vN; out vec3 vW;
void main(){
  mat4 m = mat4(iM0,iM1,iM2,iM3);
  vec4 wp = m*vec4(aPos,1.0);
  vW = wp.xyz;
  vN = normalize(mat3(m)*aNrm);
  vCol = aCol*iTint.rgb; vA = iTint.a;
  gl_Position = uVP * wp;
}`;

SH.fxFS = `#version 300 es
precision highp float;
in vec3 vCol; in float vA; in vec3 vN; in vec3 vW;
uniform vec3 uCamPos;
out vec4 outColor;
void main(){
  vec3 Vv = normalize(uCamPos - vW);
  float rim = pow(1.0 - max(dot(normalize(vN),Vv),0.0), 1.6);
  vec3 c = vCol*(1.0 + rim*1.6);
  outColor = vec4(c*vA, vA);
}`;

/* ============================================================
   7) جسيمات (ألواح مواجهة للكاميرا)
   ============================================================ */
SH.partVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=3) in vec4 iPS;     // xyz موقع، w حجم
layout(location=7) in vec4 iCol;    // rgba
uniform mat4 uVP; uniform vec3 uRight; uniform vec3 uUp;
out vec4 vCol; out vec2 vUV;
void main(){
  vec3 wp = iPS.xyz + uRight*aPos.x*iPS.w + uUp*aPos.y*iPS.w;
  vCol = iCol; vUV = aPos.xy*2.0;
  gl_Position = uVP*vec4(wp,1.0);
}`;

SH.partFS = `#version 300 es
precision highp float;
in vec4 vCol; in vec2 vUV;
out vec4 outColor;
void main(){
  float d = length(vUV);
  float a = smoothstep(1.0, 0.05, d);
  a *= a;
  outColor = vec4(vCol.rgb*a*vCol.a, a*vCol.a);
}`;

/* ============================================================
   8) معالجة لاحقة: سطوع + ضبابية + تركيب
   ============================================================ */
SH.fullVS = `#version 300 es
precision highp float;
out vec2 vUV;
void main(){
  vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2);
  vUV = p;
  gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
}`;

SH.brightFS = `#version 300 es
precision highp float;
in vec2 vUV; uniform sampler2D uTex; uniform float uThresh;
out vec4 outColor;
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  float k = smoothstep(uThresh, uThresh+0.45, l);
  outColor = vec4(c*k, 1.0);
}`;

SH.blurFS = `#version 300 es
precision highp float;
in vec2 vUV; uniform sampler2D uTex; uniform vec2 uDir;
out vec4 outColor;
void main(){
  vec3 s = texture(uTex, vUV).rgb*0.227027;
  s += (texture(uTex, vUV+uDir*1.3846).rgb + texture(uTex, vUV-uDir*1.3846).rgb)*0.316216;
  s += (texture(uTex, vUV+uDir*3.2307).rgb + texture(uTex, vUV-uDir*3.2307).rgb)*0.070270;
  outColor = vec4(s,1.0);
}`;

SH.compFS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uScene; uniform sampler2D uBloom;
uniform float uBloomAmt; uniform float uVign; uniform float uSat;
uniform vec3 uFlash; uniform float uTime; uniform float uStormFx;
out vec4 outColor;
void main(){
  vec3 c = texture(uScene, vUV).rgb;
  c += texture(uBloom, vUV).rgb * uBloomAmt;
  // تشبّع
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  c = mix(vec3(l), c, uSat);
  // تدرّج لوني سينمائي خفيف
  c = pow(max(c,0.0), vec3(0.96,1.0,1.02));
  c *= vec3(1.02,1.0,0.99);
  // تشويش العاصفة
  if(uStormFx > 0.01){
    float n = fract(sin(dot(vUV*vec2(432.1,127.7)+uTime, vec2(12.98,78.23)))*43758.5453);
    c = mix(c, c*vec3(0.72,0.55,1.15) + n*0.06, uStormFx);
  }
  // ومضة الإصابة
  c = mix(c, uFlash, clamp(uFlash.r+uFlash.g+uFlash.b,0.0,1.0)*0.0 + length(uFlash)*0.55);
  // تظليل الحواف
  vec2 q = vUV-0.5;
  float v = 1.0 - dot(q,q)*uVign;
  c *= clamp(v,0.0,1.0);
  outColor = vec4(c,1.0);
}`;
