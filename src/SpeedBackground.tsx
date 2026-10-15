import { useEffect, useRef } from 'react'

export type BgConfig = {
  /** Brand palette, darkest → brightest. Output never leaves the ramp between these. */
  colors: [string, string, string, string, string]
  speed: number // flow speed (0 = frozen)
  direction: 1 | -1 // 1 = flows left → right
  scale: number // size of the cloud forms (higher = smaller forms)
  stretch: number // horizontal motion-blur stretch
  warp: number // how much forms morph as they travel
  contrast: number // depth of the dark tongues
  ragged: number // jagged, smeared edges
  streaks: number // fast thin speed-lines layer
  brightness: number // overall lift
  shade: number // how far the dark band at the bottom reaches
  grain: number // film grain / dithering
  seed: number
  resolution: number // render scale; the image is soft, so <1 is cheap and invisible
}

export const DEFAULT_CONFIG: BgConfig = {
  colors: ['#2f0100', '#6a0605', '#930f0f', '#b11515', '#e22020'],
  speed: 0.03,
  direction: 1,
  scale: 1.4,
  stretch: 5,
  warp: 1.6,
  contrast: 0.42,
  ragged: 0.12,
  streaks: 0.08,
  brightness: 0.12,
  shade: 0.5,
  grain: 0.04,
  seed: 3.7,
  resolution: 0.75,
}

const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`

const FRAG = `precision highp float;
uniform vec2 uRes;
uniform float uTime, uSeed, uScale, uStretch, uWarp, uContrast, uRagged, uStreaks, uBright, uShade, uGrain;
uniform vec3 uC[5];

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0., a = .5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= .5; }
  return v;
}
vec3 ramp(float t){
  t = clamp(t, 0., 1.) * 4.;
  vec3 c = mix(uC[0], uC[1], clamp(t, 0., 1.));
  c = mix(c, uC[2], clamp(t - 1., 0., 1.));
  c = mix(c, uC[3], clamp(t - 2., 0., 1.));
  return mix(c, uC[4], clamp(t - 3., 0., 1.));
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes; // y up
  vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y) * uScale;
  float t = uTime;

  // big, slow, stretched forms that morph as they travel
  vec2 q = vec2(p.x / uStretch - t, p.y);
  vec2 w = vec2(fbm(q * vec2(1., 2.) + vec2(uSeed, t * .35)),
                fbm(q * vec2(1., 2.) + vec2(uSeed + 5.2, -t * .25)));
  float big = fbm(q * vec2(1., .7) + uWarp * (w - .5) * vec2(1., .5) + uSeed);

  // fibres: long thin noise that only shows where it frays the edge of a form,
  // like the directional smear in the reference
  float fib = noise(vec2(q.x * 3., p.y * 34. + uSeed)) + .5 * noise(vec2(q.x * 7., p.y * 90.)) - .75;
  float edge = big - .5 + fib * uRagged;
  float tongue = smoothstep(.04, -.14, edge); // dark tongues
  float n = (big - .5) * .5 - tongue * uContrast;

  // fast parallax speed-lines: soft, long, ~3x quicker than the forms
  float s = noise(vec2(p.x / (uStretch * 3.) - t * 3., p.y * 10. + uSeed));
  n += smoothstep(.6, 1., s) * uStreaks;

  // composition: bright upper-right, sinking into near-black at the bottom
  float base = .55 + .3 * (uv.x - .5) + .25 * (uv.y - .5);
  float v = base + n + uBright;
  v *= mix(.12, 1., smoothstep(0., uShade, uv.y + n * .2));

  // grain in palette space, so it also dithers away banding
  v += (hash(gl_FragCoord.xy + fract(t * 13.) * 91.) - .5) * uGrain;

  gl_FragColor = vec4(ramp(v), 1.);
}`

const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)

export function SpeedBackground({ config, className }: { config: BgConfig; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cfg = useRef(config)
  cfg.current = config

  useEffect(() => {
    const canvas = canvasRef.current!
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false })
    if (!gl) return // CSS background-color on the canvas is the fallback

    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    gl.useProgram(prog)

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    const u = (n: string) => gl.getUniformLocation(prog, n)
    const loc = {
      res: u('uRes'), time: u('uTime'), seed: u('uSeed'), scale: u('uScale'), stretch: u('uStretch'),
      warp: u('uWarp'), contrast: u('uContrast'), ragged: u('uRagged'), streaks: u('uStreaks'),
      bright: u('uBright'), shade: u('uShade'), grain: u('uGrain'), colors: u('uC'),
    }

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')
    let time = 0
    let last = performance.now()
    let raf = 0

    const frame = (now: number) => {
      const c = cfg.current
      const dpr = Math.min(devicePixelRatio, 2) * c.resolution
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
      // integrate time so changing speed never jumps the image
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      if (!reduceMotion.matches) time += dt * c.speed * c.direction

      gl.uniform2f(loc.res, w, h)
      gl.uniform1f(loc.time, time)
      gl.uniform1f(loc.seed, c.seed)
      gl.uniform1f(loc.scale, c.scale)
      gl.uniform1f(loc.stretch, c.stretch)
      gl.uniform1f(loc.warp, c.warp)
      gl.uniform1f(loc.contrast, c.contrast)
      gl.uniform1f(loc.ragged, c.ragged)
      gl.uniform1f(loc.streaks, c.streaks)
      gl.uniform1f(loc.bright, c.brightness)
      gl.uniform1f(loc.shade, c.shade)
      gl.uniform1f(loc.grain, c.grain)
      gl.uniform3fv(loc.colors, c.colors.flatMap(hexToRgb))
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', background: config.colors[2] }}
    />
  )
}
