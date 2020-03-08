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

// https://en.wikipedia.org/wiki/Rodrigues%27_rotation_formula
vec3 rotate(in vec3 vv, in vec3 center, in vec3 axis, in float angle) {
  vec3 v = vv - center;
  float cosa = cos(angle);
  float sina = sin(angle);
  vec3 res = v * cosa + cross(axis, v) * sina + axis * dot(axis, v) * (1. - cosa);
  return res + center;
}

float sdSphere(in vec3 p, in float radius) {
  return length(p) - radius;
}
float sdElipsoid(in vec3 p, in vec3 radius) {
  float k0 = length(p/radius);
  float k1 = length(p/radius/radius);
  return k0*(k0-1.)/k1;
}
float sdSegment( in vec3 p, in vec3 a, in vec3 b )
{
  vec3 pa = p-a, ba = b-a;
  float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
  return length( pa - ba*h );
}
float sdRoundCone( vec3 p, float r1, float r2, float h )
{
  vec2 q = vec2( length(p.xz), p.y );
  float b = (r1-r2)/h;
  float a = sqrt(1.0-b*b);
  float k = dot(q,vec2(-b,a));
  if( k < 0.0 ) return length(q) - r1;
  if( k > a*h ) return length(q-vec2(0.0,h)) - r2;
  return dot(q, vec2(a,b) ) - r1;
}

vec2 sdLalafell(in vec3 p) {
  vec2 res = vec2(100., 2.);

  vec3 center = vec3(0., 0., 0.);
  vec3 h = p - center;
  vec3 sh = vec3(abs(h.x), h.yz);

  // neck
  float neck = sdSegment(h, vec3(0., 0.86, 0.), vec3(0., .9, 0.))-0.04;
  // body
  // vec3 rt =rotate(h-vec3(0., 0.62, 0.03), vec3(0.), vec3(1., 0., 0.), PI/18.);
  float body = sdRoundCone(
    h-vec3(0., 0.5, 0.),
    0.15, 0.08, 0.29); // h=0.36
  body = smax(body, sdSphere(h-vec3(0., 0.7, 0.), 0.26), 0.03);
  body = smax(body, sdSegment(h - vec3(0., 0., 0.3), vec3(0., 1., 0.), vec3(0., 0., -0.02)) - .36, 0.07);

  float head = sdSphere(h-vec3(0., 1., 0.), 0.1);
  res.x = smin(neck, min(head, body), 0.02);

  // leg0
  float leg0 = sdSphere(sh-vec3(1., 0.455, 0.01), 0.1);
  // leg1
  {
    vec3 leg1pos = vec3(0.084, 0.28, 0.03);
    vec3 rot = rotate(sh-leg1pos, leg1pos, vec3(1., 0., 0.), -PI/32.);
    float leg1 = sdRoundCone(
      sh-leg1pos,
      0.058, 0.072, 0.22);
    res.x = smin(leg0, min(res.x, leg1), 0.02);
  }

  // leg2


  return res;
}

vec2 opU(vec2 d1, vec2 d2) {
	return (d1.x<d2.x) ? d1 : d2;
}
// return x for distance, y for material
vec2 map(in vec3 pos) {
  vec2 res = sdLalafell(pos);
  vec2 plane = vec2(dot(pos, vec3(0., 1., 0.)), 1.);
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

vec4 castRay(in vec3 rayOrigin, in vec3 rayDirection) {
  vec2 res = vec2(-1.0,-1.0);

  float tmin = 0.001;
  float tmax = 20.0;
  float t = tmin;

  vec2 lastH = vec2(1e10, 0.);
  vec2 edge = vec2(0.); // boolean and material
  float edgeWidth = 0.008;
  for(int i=0; i<256 && t<tmax; i++) {
    vec2 h = map(rayOrigin + rayDirection*t);
    if (lastH.x < edgeWidth && h.x > lastH.x) {
      edge = vec2(1., lastH.y); // is edge
    }
    if (h.x < tmin) {
      res = vec2(t, h.y);
      break;
    }
    t += h.x;
    if (h.x < lastH.x) {
      lastH = h;
    }
  }

  return vec4(res, edge);
}

vec3 palette(float f) {
  vec3 m = vec3(0.18);
  if (f < 1.5) {
    m = vec3(0.05, 0.1, 0.02); // ground
  } else if (f < 2.5) {
    m = vec3(0.2, 0.1, 0.02); // body
  } else if (f < 3.5) {
    m = vec3(0.4, 0.4, 0.4); // eye
  } else if (f < 4.5) {
    m = vec3(0.01); // apple
  }
  return m;
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

  vec4 tm = castRay(rayOrigin, rayDirection);
  if (tm.y > 0.0) {
    float t = tm.x;
    vec3 pos = rayOrigin + rayDirection * t;
    vec3 nor = calcNormal(pos);

    vec3 mate = palette(tm.y);

    vec3 sunDirection = normalize(vec3(0.8*sin(time/5000.),0.4,0.8*cos(time/5000.)));
    float sunDiffuse = clamp(dot(nor, sunDirection), 0., 1.);
    float sunShadow = step(castRay(pos + 0.001 * nor, sunDirection).y, 0.);
    float skyDiffuse = clamp(0.5 + 0.5 * dot(nor, vec3(0., 1., 0.)), 0., 1.);
    float bounceDiffuse = clamp(0.5 + 0.5 * dot(nor, vec3(0., -1., 0.)), 0., 1.);

    vec3 sun_col = vec3(7., 5., 3.) * sunDiffuse * sunShadow;
    vec3 sky_col = vec3(0.5, 0.8, 0.9) * skyDiffuse;
    vec3 bounce_col = vec3(0.7, 0.3, 0.2) * bounceDiffuse;
    col = clamp(mate * sun_col + mate * sky_col + mate * bounce_col, 0., 1.);
  }
  // col = vec3(1.);
  if (tm.z > 0.5) {
    vec3 edgeMate = palette(tm.w);
    col = mix(vec3(0.), edgeMate, .3);
  }
  col = pow(col, vec3(0.4545));
  fragColor = vec4(col, 1.);
}
