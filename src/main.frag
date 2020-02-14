#version 300 es
precision highp float;

uniform float time;
uniform float fovy;
uniform vec2 resolution;
uniform vec2 mouse;
uniform vec3 cameraPosition;
uniform mat4 viewMatrixInverse;

// uniform sampler2D moonTexture;

in vec2 fragCoord;
out vec4 fragColor;

const float PI = 3.1415926;

float smin(in float a, in float b, in float k) {
  float h = max(k - abs(a-b), 0.);
  return min(a, b) - h*h / (k*4.);
}
float smax(in float a, in float b, in float k) {
  float h = max(k - abs(a-b), 0.);
  return max(a, b) + h*h / (k*4.);
}


float sdSphere(in vec3 p, in float radius) {
  return length(p) - radius;
}
float sdElipsoid(in vec3 p, in vec3 radius) {
  float k0 = length(p/radius);
  float k1 = length(p/radius/radius);
  return k0*(k0-1.)/k1;
}
float sdStick(in vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 ba = b-a;
  vec3 pa = p-a;
  float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.);
  float r = mix(ra, rb, h);
  return length(pa - h*ba) - r;
}

vec2 sdMon(in vec3 p) {
  vec2 res = vec2(0.);
  // float t = fract(time / 1000.);
  // float y = 4. * t * (1. - t);
  // float dy = 4.*(1.-2.*t);

  float ry = 1.; // 0.5 + 0.5*y;
  float rz = 1. / ry;
  vec3 radius = vec3(0.25 * rz, 0.25 * ry, 0.25 * rz);

  vec3 center = vec3(0., 0.5, 0.);
  vec3 h = p - center;
  vec3 sh = vec3(abs(h.x), h.yz); // symmetry in x axis

  // body
  float d = sdElipsoid(h, radius);

  // head
  float d2 = sdElipsoid(h - vec3(0., 0.28, 0.), vec3(0.2));
  float d3 = sdElipsoid(h - vec3(0., 0.28, -0.1), vec3(0.2));
  d2 = smin(d2, d3, 0.03);
  d = smin(d, d2, 0.1);

  // eyebrow
  vec3 eb = sh - vec3(0.12, 0.34, 0.15);
  eb.xy = (mat2(3, 4, -4, 3)/5.)*eb.xy;
  d2 = sdElipsoid(eb, vec3(0.06, 0.035, 0.05));
  d = smin(d, d2, 0.04);

  // mouse
  d2 = sdElipsoid(h-vec3(0., 0.175, 0.15), vec3(0.08, 0.035, 0.05));
  d = smax(d, -d2, 0.03);

  // ears
  d2 = sdStick(sh, vec3(0.1, 0.4, 0.), vec3(0.2, 0.55, 0.1), 0.01, 0.03);
  d = smin(d, d2, 0.03);

  res = vec2(d, 2.);

  // eye

  float d4 = sdSphere(sh - vec3(0.08, 0.28, 0.16), 0.05);
  if (d4 < d) {
    d = d4;
    res = vec2(d, 3.);
  }
  float d5 = sdSphere(sh - vec3(0.085, 0.28, 0.18), 0.032);
  if (d5 < d) {
    d = d5;
    res = vec2(d, 4.);
  }

  return res;
}

vec2 opU(vec2 d1, vec2 d2) {
	return (d1.x<d2.x) ? d1 : d2;
}
vec2 map(in vec3 pos) {
  vec2 res = sdMon(pos);
  vec2 plane = vec2(dot(pos, vec3(0., 1., 0.)) + 0.25, 1.);
  res = opU(res, plane);
  return res;
}

vec3 calcNormal(in vec3 pos) {
  vec2 e = vec2(0.001, 0.);
  return normalize(vec3(
    map(pos+e.xyy).x-map(pos-e.xyy).x,
    map(pos+e.yxy).x-map(pos-e.yxy).x,
    map(pos+e.yyx).x-map(pos-e.yyx).x
  ));
  // vec3 n = vec3(0.0);
  // for(int i=0; i<4; i++) {
  //   vec3 e = 0.5773*(2.0*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.0);
  //   n += e*map(pos+0.0005*e).x;
  // }
  // return normalize(n);
}

vec2 castRay(in vec3 rayOrigin, in vec3 rayDirection) {
    vec2 res = vec2(-1.0,-1.0);

    float tmin = 0.001;
    float tmax = 20.0;

    float t = tmin;
    for(int i=0; i<256 && t<tmax; i++) {
      vec2 h = map(rayOrigin + rayDirection*t);
      if (h.x < 0.001) {
        res = vec2(t, h.y);
        break;
      }
      t += h.x;
    }

    return res;
}

void main() {
  vec2 uv = fragCoord / resolution;
  vec2 p = (-resolution + 2. * fragCoord) / resolution.y; // -1 <> 1 by height

  vec2 pixelRes = resolution / 1.;
  p = floor(p*pixelRes)/pixelRes;

  vec3 rayOrigin = cameraPosition;
  // per set
  // vec3 target = vec3(0.);
  // vec3 cameraFront = normalize(target - rayOrigin);
  float focalLength = 1./atan(fovy/2.);
  vec3 rayDirection = normalize((viewMatrixInverse * vec4(p, -focalLength, 0.)).xyz);

  vec3 col = max(vec3(0.), vec3(0.4, 0.75, 1.) - 0.7 * rayDirection.y);
  col = mix(col, vec3(0.7, 0.75, 0.8), min(exp(-10.*rayDirection.y), 1.));

  vec2 tm = castRay(rayOrigin, rayDirection);
  if (tm.y > 0.0) {
    float t = tm.x;
    vec3 pos = rayOrigin + rayDirection * t;
    vec3 nor = calcNormal(pos);

    vec3 mate = vec3(0.18);

    if (tm.y < 1.5) {
      mate = vec3(0.05, 0.1, 0.02); // ground
    } else if (tm.y < 2.5) {
      mate = vec3(0.2, 0.1, 0.02); // body
    } else if (tm.y < 3.5) {
      mate = vec3(0.4, 0.4, 0.4); // eye
    } else if (tm.y < 4.5) {
      mate = vec3(0.01); // apple
    }

    vec3 sunDirection = normalize(vec3(0.8,0.4,0.2));
    float sunDiffuse = clamp(dot(nor, sunDirection), 0., 1.);
    float sunShadow = step(castRay(pos + 0.001 * nor, sunDirection).y, 0.);
    float skyDiffuse = clamp(0.5 + 0.5 * dot(nor, vec3(0., 1., 0.)), 0., 1.);
    float bounceDiffuse = clamp(0.5 + 0.5 * dot(nor, vec3(0., -1., 0.)), 0., 1.);


    vec3 sun_col = vec3(7., 5., 3.) * sunDiffuse * sunShadow;
    vec3 sky_col = vec3(0.5, 0.8, 0.9) * skyDiffuse;
    vec3 bounce_col = vec3(0.7, 0.3, 0.2) * bounceDiffuse;
    col =  clamp(mate * sun_col + mate * sky_col + mate * bounce_col, 0., 1.);
    // col = vec3(sunShadow);
  }
  col = pow(col, vec3(0.4545));
  fragColor = vec4(col, 1.);
}
