import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFinanceResources } from '../hooks/useFinanceResources'

function CrystalDiamondBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', { antialias: false, alpha: true })
    if (!gl) return

    const vertSrc = `
          attribute vec2 position;
          void main() {
            gl_Position = vec4(position, 0.0, 1.0);
          }
        `

    const fragSrc = `
          precision highp float;
          uniform vec2 u_res;
          uniform float u_time;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }

          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
          }

          vec3 palette(float t) {
            vec3 a = vec3(0.05, 0.08, 0.15);
            vec3 b = vec3(0.55, 0.65, 0.9);
            vec3 c = vec3(0.75, 0.45, 0.95);
            vec3 d = vec3(0.15, 0.2, 0.35);
            return a + b * cos(6.28318 * (c * t + d));
          }

          void main() {
            vec2 uv = gl_FragCoord.xy / u_res.xy;
            vec2 p = (gl_FragCoord.xy * 2.0 - u_res.xy) / min(u_res.x, u_res.y);

            float t = u_time * 0.12;

            float n1 = noise(p * 2.0 + t);
            float n2 = noise(p * 6.0 - t * 1.2);

            float facets = abs(sin((p.x + p.y) * 6.0 + n2 * 3.0)) + abs(sin((p.x - p.y) * 7.5 - n1 * 2.0));
            facets = pow(facets, 1.2);

            float glow = smoothstep(1.4, 0.1, length(p)) * 0.55;

            float shimmer = 0.35 + 0.65 * sin((p.x * 1.6 - p.y * 1.8) * 7.0 + u_time * 0.35 + n1 * 4.0);

            float colT = 0.25 + 0.4 * uv.y + 0.25 * facets + 0.1 * shimmer;
            vec3 col = palette(colT);

            col += vec3(0.55, 0.8, 1.0) * glow * (0.35 + 0.65 * facets);
            col *= 0.85 + 0.15 * sin(u_time * 0.25 + uv.x * 5.0);

            gl_FragColor = vec4(col, 1.0);
          }
        `

    const compile = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('[CrystalDiamondBackground] Shader compile error:', gl.getShaderInfoLog(s))
        gl.deleteShader(s)
        return null
      }
      return s
    }

    const vs = compile(gl.VERTEX_SHADER, vertSrc)
    const fs = compile(gl.FRAGMENT_SHADER, fragSrc)
    if (!vs || !fs) return

    const prog = gl.createProgram()
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[CrystalDiamondBackground] Program link error:', gl.getProgramInfoLog(prog))
      return
    }

    const posLoc = gl.getAttribLocation(prog, 'position')
    const resLoc = gl.getUniformLocation(prog, 'u_res')
    const timeLoc = gl.getUniformLocation(prog, 'u_time')

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    )

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.floor((canvas.clientWidth || window.innerWidth) * dpr)
      const h = Math.floor((canvas.clientHeight || window.innerHeight) * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
      gl.useProgram(prog)
      gl.uniform2f(resLoc, canvas.width, canvas.height)
    }

    let raf = 0
    let running = true
    const start = performance.now()

    const render = () => {
      if (!running) return
      resize()
      gl.useProgram(prog)

      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.enableVertexAttribArray(posLoc)
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

      gl.uniform1f(timeLoc, (performance.now() - start) / 1000)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      raf = requestAnimationFrame(render)
    }

    const onResize = () => resize()
    window.addEventListener('resize', onResize)
    render()

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      try {
        gl.deleteProgram(prog)
        gl.deleteShader(vs)
        gl.deleteShader(fs)
        gl.deleteBuffer(buf)
      } catch {
      }
    }
  }, [])

  return (
    <canvas
      id="crystal-bg"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        opacity: 1,
      }}
      ref={canvasRef}
    />
  )
}

function getFileIcon(mimeType) {
  const mt = (mimeType || '').toLowerCase()
  if (mt.includes('pdf')) return 'PDF'
  if (mt.includes('spreadsheet') || mt.includes('excel')) return 'XLS'
  if (mt.includes('presentation') || mt.includes('powerpoint')) return 'PPT'
  if (mt.includes('document') || mt.includes('word')) return 'DOC'
  if (mt.startsWith('image/')) return 'IMG'
  if (mt.startsWith('video/')) return 'VID'
  if (mt.startsWith('audio/')) return 'AUD'
  if (mt.includes('zip') || mt.includes('compressed')) return 'ZIP'
  return 'FILE'
}

function pickOpenUrl(file) {
  if (file?.webContentLink) return file.webContentLink
  if (file?.webViewLink) return file.webViewLink
  return null
}

export default function MyInsightsScreen() {
  const navigate = useNavigate()
  const { files, loading, error, doc } = useFinanceResources()

  const sorted = useMemo(() => {
    return Array.isArray(files)
      ? [...files].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
      : []
  }, [files])

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      <CrystalDiamondBackground />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '2rem',
          minHeight: '100vh',
          color: '#f7f9ff',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '2.2rem', fontWeight: 950, letterSpacing: '-0.02em' }}>MyInsights</div>
              <div style={{ color: 'rgba(226,232,240,0.8)', marginTop: '0.25rem' }}>
                Shader portal into your Drive folder
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => navigate('/')}
                style={{
                  padding: '0.7rem 0.9rem',
                  borderRadius: 12,
                  border: '1px solid rgba(148, 163, 184, 0.35)',
                  background: 'rgba(2, 6, 23, 0.45)',
                  backdropFilter: 'blur(10px)',
                  color: '#e2e8f0',
                  fontWeight: 850,
                  cursor: 'pointer',
                }}
              >
                Back
              </button>

              <a
                href="https://drive.google.com/drive/folders/1jBZ94VMVZ_9mNyeHnSkbhAY8odDgjWMO"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.7rem 0.9rem',
                  borderRadius: 12,
                  border: '1px solid rgba(167, 139, 250, 0.35)',
                  background: 'rgba(124, 58, 237, 0.18)',
                  backdropFilter: 'blur(10px)',
                  color: '#f5f3ff',
                  fontWeight: 900,
                  textDecoration: 'none',
                }}
              >
                Open Folder
              </a>
            </div>
          </div>

          <div
            style={{
              border: '1px solid rgba(148, 163, 184, 0.22)',
              background: 'rgba(2, 6, 23, 0.28)',
              backdropFilter: 'blur(14px)',
              borderRadius: 18,
              padding: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ color: 'rgba(226,232,240,0.85)', fontWeight: 800 }}>
                {loading ? 'Scanning Drive…' : `Files: ${sorted.length}`}
              </div>
              <div style={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.9rem' }}>
                Cache: 24h on-device{doc?.cachedAtMs ? ` • cached at ${new Date(doc.cachedAtMs).toLocaleString()}` : ''}
              </div>
            </div>

            {error ? (
              <div
                style={{
                  marginTop: '0.9rem',
                  borderRadius: 14,
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  background: 'rgba(239, 68, 68, 0.12)',
                  padding: '0.9rem',
                  color: '#fecaca',
                  fontWeight: 750,
                }}
              >
                {error}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1rem',
            }}
          >
            {sorted.map((file) => {
              const url = pickOpenUrl(file)
              const label = getFileIcon(file?.mimeType)

              return (
                <div
                  key={file.id || file.name}
                  style={{
                    borderRadius: 18,
                    padding: '1rem',
                    border: '1px solid rgba(226, 232, 240, 0.18)',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))',
                    backdropFilter: 'blur(14px)',
                    boxShadow: '0 18px 50px rgba(2, 6, 23, 0.35)',
                    cursor: url ? 'pointer' : 'default',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  role={url ? 'button' : undefined}
                  tabIndex={url ? 0 : undefined}
                  onClick={() => {
                    if (!url) return
                    window.open(url, '_blank', 'noreferrer')
                  }}
                  onKeyDown={(e) => {
                    if (!url) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      window.open(url, '_blank', 'noreferrer')
                    }
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: -2,
                      background:
                        'radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.18), transparent 55%), radial-gradient(circle at 80% 10%, rgba(167, 139, 250, 0.16), transparent 55%), radial-gradient(circle at 50% 90%, rgba(34, 211, 238, 0.12), transparent 60%)',
                      pointerEvents: 'none',
                    }}
                  />

                  <div style={{ position: 'relative', display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(2, 6, 23, 0.35)',
                        border: '1px solid rgba(148, 163, 184, 0.25)',
                        fontWeight: 1000,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {label}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 950, lineHeight: 1.15, wordBreak: 'break-word' }}>{file?.name || 'Untitled'}</div>
                      <div style={{ marginTop: '0.4rem', color: 'rgba(226,232,240,0.75)', fontSize: '0.88rem' }}>
                        {file?.mimeType || 'unknown'}
                      </div>
                      <div style={{ marginTop: '0.65rem', color: 'rgba(148,163,184,0.85)', fontSize: '0.86rem' }}>
                        {url ? 'Open' : 'No link available'}
                      </div>
                    </div>

                    {file?.iconLink ? (
                      <img
                        alt=""
                        src={file.iconLink}
                        style={{ width: 20, height: 20, opacity: 0.75, marginTop: 2 }}
                      />
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: '1.5rem', color: 'rgba(148,163,184,0.85)', fontSize: '0.88rem' }}>
            Powered by a backend Drive proxy using a service account. No Firestore.
          </div>
        </div>
      </div>
    </div>
  )
}
