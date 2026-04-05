import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TextLayoutEngine } from '../utils/TextLayoutEngine';

const CACHE_KEY = 'my_insights_files';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

const getFileTypeInfo = (file) => {
  const mimeType = file.mimeType || '';
  const name = file.name || '';
  const ext = name.split('.').pop().toLowerCase();

  if (mimeType.includes('pdf') || ext === 'pdf') 
    return { label: 'PDF', color: '#ef4444', icon: '📄', type: 'pdf' };
  
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || ['xlsx', 'xls', 'csv', 'ods'].includes(ext)) 
    return { label: 'Sheet', color: '#22c55e', icon: '📊', type: 'excel' };
  
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || ['pptx', 'ppt', 'odp'].includes(ext)) 
    return { label: 'Slides', color: '#eab308', icon: '🖼️', type: 'slides' };
  
  if (mimeType.includes('document') || mimeType.includes('word') || ['docx', 'doc', 'odt', 'rtf'].includes(ext)) 
    return { label: 'Doc', color: '#3b82f6', icon: '📝', type: 'doc' };
  
  if (mimeType.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) 
    return { label: 'Image', color: '#a855f7', icon: '🖼️', type: 'image' };
  
  if (mimeType.includes('text/plain') || ext === 'txt') 
    return { label: 'Text', color: '#94a3b8', icon: '📄', type: 'txt' };
  
  return { label: 'File', color: '#94a3b8', icon: '📎', type: 'other' };
};

// Document Viewer Component
const DocumentViewer = ({ file, onClose }) => {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const typeInfo = getFileTypeInfo(file);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(null);
      setIframeLoaded(false);
      try {
        console.log(`[DocumentViewer] Loading file: ${file.name}, type: ${typeInfo.type}, mime: ${file.mimeType}`);
        
        switch (typeInfo.type) {
          case 'pdf':
            // Use Drive's native PDF embed for reliability
            setContent(`https://drive.google.com/file/d/${file.id}/preview`);
            break;

          case 'slides': {
            const isNative = file.mimeType === 'application/vnd.google-apps.presentation';
            setContent(isNative
              ? `https://docs.google.com/presentation/d/${file.id}/embed?start=false&loop=false&delayms=3000` 
              : `https://docs.google.com/viewerng/viewer?srcid=${file.id}&pid=explorer&efb=true&usb=true&a=v&chrome=false&embedded=true`
            );
            break;
          }

          case 'excel': {
            const isNative = file.mimeType === 'application/vnd.google-apps.spreadsheet';
            setContent(isNative
              ? `https://docs.google.com/spreadsheets/d/${file.id}/htmlview?embedded=true` 
              : `https://docs.google.com/viewerng/viewer?srcid=${file.id}&pid=explorer&efb=true&usb=true&a=v&chrome=false&embedded=true`
            );
            break;
          }

          case 'doc': {
            const isNative = file.mimeType === 'application/vnd.google-apps.document';
            setContent(isNative
              ? `https://docs.google.com/document/d/${file.id}/preview` 
              : `https://docs.google.com/viewerng/viewer?srcid=${file.id}&pid=explorer&efb=true&usb=true&a=v&chrome=false&embedded=true`
            );
            break;
          }

          case 'txt': {
            // Route through backend proxy to avoid CORS
            const response = await fetch(`/api/insights/file-content?id=${file.id}`);
            if (!response.ok) throw new Error('Failed to load text file content');
            const text = await response.text();
            setContent(text);
            break;
          }

          case 'image':
            // Use Drive's thumbnail API for reliable cross-origin serving
            setContent(`https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`);
            break;

          default:
            // Fallback to viewerng for any other complex formats
            setContent(`https://docs.google.com/viewerng/viewer?srcid=${file.id}&pid=explorer&efb=true&usb=true&a=v&chrome=false&embedded=true`);
        }
      } catch (err) {
        setError('Failed to load document content. Please try refreshing or check file permissions.');
        console.error('[DocumentViewer] Error loading content:', err);
      } finally {
        setLoading(false);
      }
    };
    loadContent();
  }, [file.id, typeInfo.type, file.mimeType]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 1000,
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#fff' }}>{file.name}</h2>
        <button 
          onClick={onClose}
          style={{ 
            background: 'rgba(255,255,255,0.1)', 
            border: 'none', 
            color: '#fff', 
            padding: '10px 20px', 
            borderRadius: '12px', 
            cursor: 'pointer' 
          }}
        >Close</button>
      </div>

      <div style={{ flex: 1, background: '#fff', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#1e293b' }}>
            Loading preview...
          </div>
        )}
        
        {error && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#ef4444', textAlign: 'center', padding: '20px' }}>
            <p>{error}</p>
            <button 
              onClick={() => window.open(file.webViewLink, '_blank')}
              style={{ 
                background: '#1e293b', 
                color: '#fff', 
                border: 'none', 
                padding: '12px 24px', 
                minHeight: '44px',
                borderRadius: '8px', 
                cursor: 'pointer', 
                marginTop: '10px',
                touchAction: 'manipulation',
                transition: 'transform 0.1s ease'
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = 'scale(0.96)'
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >Open in Google Drive</button>
          </div>
        )}

        {!loading && !error && (
          <>
            {typeInfo.type === 'txt' ? (
              <pre style={{ margin: 0, padding: '20px', whiteSpace: 'pre-wrap', color: '#1e293b', height: '100%', overflow: 'auto' }}>
                {content}
              </pre>
            ) : typeInfo.type === 'image' ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '20px' }}>
                <img 
                  src={content} 
                  alt={file.name} 
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                  onError={(e) => {
                    console.error('[DocumentViewer] Image load error');
                    setError('Failed to load image.');
                  }}
                />
              </div>
            ) : (
              <iframe
                src={content}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  border: 'none',
                  display: iframeLoaded ? 'block' : 'none'
                }}
                title={file.name}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                allow="fullscreen"
                onLoad={() => {
                  console.log('[DocumentViewer] Iframe loaded successfully');
                  setIframeLoaded(true);
                }}
                onError={() => {
                  console.error('[DocumentViewer] Iframe error');
                  setError('Preview unavailable — try opening directly in Drive.');
                }}
              />
            )}
            {!iframeLoaded && !loading && !error && typeInfo.type !== 'txt' && typeInfo.type !== 'image' && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#1e293b' }}>
                Preparing viewer...
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Error Boundary Component
class MyInsightsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error('[MyInsights Error]', error); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f7f9ff' }}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h2>Something went wrong</h2>
            <button onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const MyInsightsScreen = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [tickers, setTickers] = useState([]);
  const [shaderError, setShaderError] = useState(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  const fetchTickers = useCallback(async () => {
    try {
      const response = await fetch('/api/finance/tickers');
      const result = await response.json();
      if (result.ok) {
        console.log('[MyInsights] Tickers loaded successfully:', result.data.length, 'symbols');
        setTickers(result.data);
      } else {
        console.warn('[MyInsights] Ticker API returned error:', result.error);
        // Set empty array to prevent undefined errors
        setTickers([]);
      }
    } catch (err) {
      console.warn('[MyInsights] Ticker fetch failed:', err);
      // Set empty array to prevent undefined errors
      setTickers([]);
    }
  }, []);

  useEffect(() => {
    fetchTickers();
    const interval = setInterval(fetchTickers, 30000);
    return () => {
      clearInterval(interval);
      // Clean up animation frame on unmount
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [fetchTickers]);

  const fetchFiles = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      console.log(`[MyInsights] Fetching files, forceRefresh: ${forceRefresh}`);
      
      if (!forceRefresh) {
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;
            console.log(`[MyInsights] Cache found, age: ${Math.round(age / 1000)}s, expiry: ${CACHE_EXPIRY / 1000}s`);
            if (age < CACHE_EXPIRY) {
              setFiles(data);
              setLoading(false);
              console.log(`[MyInsights] Using cached data, ${data.length} files`);
              return;
            }
          }
        } catch (cacheError) {
          console.warn('[MyInsights] Cache read error:', cacheError);
        }
      }

      console.log('[MyInsights] Fetching from API...');
      const response = await fetch('/api/insights/finance-resources');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('[MyInsights] API response:', result);

      if (result.ok) {
        const filesData = result.files || [];
        console.log(`[MyInsights] Files loaded successfully: ${filesData.length}`);
        setFiles(filesData);
        
        // Cache the results
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: filesData,
            timestamp: Date.now()
          }));
          console.log('[MyInsights] Data cached successfully');
        } catch (cacheError) {
          console.warn('[MyInsights] Cache write error:', cacheError);
        }
      } else {
        throw new Error(result.error || 'Failed to fetch files');
      }
    } catch (err) {
      console.error('[MyInsights] Fetch error:', err);
      setError(err.message);
      
      // Try to use cached data as fallback
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data } = JSON.parse(cached);
          console.log('[MyInsights] Using cached fallback data');
          setFiles(data);
        }
      } catch (fallbackError) {
        console.error('[MyInsights] Fallback cache error:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const tickerItems = useMemo(() => {
    if (!tickers || tickers.length === 0) return [];
    return tickers.map((ticker, idx) => {
      const text = `${ticker.symbol}: $${ticker.price.toFixed(2)} (${ticker.change >= 0 ? '+' : ''}${ticker.change.toFixed(2)}%)`;
      return { ticker, idx, text };
    });
  }, [tickers]);

  const tickerNaturalWidths = useMemo(() => {
    if (tickerItems.length === 0) return {};
    const font = 'bold 14px monospace';
    const widths = {};
    for (const item of tickerItems) {
      widths[item.ticker.symbol] = TextLayoutEngine.measureNaturalWidth(item.text, font);
    }
    return widths;
  }, [tickerItems]);

  const fileCards = useMemo(() => {
    return files.map(file => {
      const info = getFileTypeInfo(file);
      return (
        <div 
          key={file.id} 
          onClick={() => setSelectedFile(file)} 
          style={{ 
            background: 'rgba(255,255,255,0.03)', 
            backdropFilter: 'blur(12px)', 
            padding: '24px', 
            borderRadius: '20px', 
            border: '1px solid rgba(255,255,255,0.1)', 
            cursor: 'pointer',
            transition: 'transform 0.1s ease, box-shadow 0.15s ease',
            touchAction: 'manipulation'
          }}
          onTouchStart={(e) => {
            e.currentTarget.style.transform = 'scale(0.98)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,255,255,0.1)'
          }}
          onTouchEnd={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{info.icon}</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem' }}>{file.name}</h3>
          <div style={{ color: info.color, fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{info.label}</div>
        </div>
      );
    });
  }, [files]);

  const initShader = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn('[MyInsights] Canvas ref not available');
      return;
    }
    try {
      console.log('[MyInsights] Initializing WebGL shader...');
      
      // Check WebGL support
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      
      if (!gl) {
        throw new Error('WebGL not supported in this browser');
      }
      
      console.log('[MyInsights] WebGL supported:', {
        version: gl.getParameter(gl.VERSION),
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER)
      });

      const actualCanvas = canvasRef.current;
      const actualGl = actualCanvas.getContext('webgl', { 
        alpha: false, 
        preserveDrawingBuffer: true,
        antialias: true
      });
      
      if (!actualGl) {
        throw new Error('Failed to get WebGL context from canvas');
      }

      const vsSource = `
        attribute vec4 aVertexPosition;
        void main() {
          gl_Position = aVertexPosition;
        }
      `;

      const fsSource = `
        precision highp float;
        uniform float uTime;
        uniform vec2 uResolution;
        
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
        }
        
        void main() {
          vec2 uv = gl_FragCoord.xy / uResolution.xy;
          vec2 p = uv * 2.0 - 1.0;
          p.x *= uResolution.x / uResolution.y;
          
          float t = uTime * 0.1;
          
          // Surreal monocolour crystalical web - enhanced visibility
          vec3 baseColor = vec3(0.02, 0.06, 0.18); // Deep blue base
          vec3 crystalColor = vec3(0.15, 0.6, 1.0); // Bright cyan
          
          vec2 g = floor(p * 6.0);
          vec2 f = fract(p * 6.0);
          
          float web = 0.0;
          for(int y=-1; y<=1; y++) {
            for(int x=-1; x<=1; x++) {
              vec2 neighbor = vec2(float(x), float(y));
              vec2 point = neighbor + hash(g + neighbor) - 0.5;
              point += 0.4 * sin(t + 6.28 * hash(g + neighbor));
              float dist = distance(f, point);
              web += 0.02 / (dist * dist + 0.002); // Increased brightness and visibility
            }
          }
          
          vec3 finalColor = mix(baseColor, crystalColor, web * 0.8);
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `;

      const createShader = (gl, type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const info = gl.getShaderInfoLog(shader);
          console.error('[MyInsights] Shader compilation failed:', info);
          throw new Error(`Shader compilation failed: ${info}`);
        }
        
        return shader;
      };

      const program = gl.createProgram();
      gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vsSource));
      gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fsSource));
      gl.linkProgram(program);
      
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        console.error('[MyInsights] Shader program linking failed:', info);
        throw new Error(`Shader program linking failed: ${info}`);
      }
      
      gl.useProgram(program);

      const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      const position = gl.getAttribLocation(program, 'aVertexPosition');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const uTime = gl.getUniformLocation(program, 'uTime');
      const uResolution = gl.getUniformLocation(program, 'uResolution');

      const render = (time) => {
        if (!canvasRef.current) {
          console.log('[MyInsights] Canvas ref lost, stopping shader');
          return;
        }
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl.viewport(0, 0, width, height);
          console.log(`[MyInsights] Canvas resized to ${width}x${height}`);
        }
        
        gl.uniform1f(uTime, time * 0.001);
        gl.uniform2f(uResolution, width, height);
        
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        animationFrameRef.current = requestAnimationFrame(render);
      };
      
      animationFrameRef.current = requestAnimationFrame(render);
      setShaderError(null);
      console.log('[MyInsights] Shader initialized successfully');

    } catch (shaderError) {
      console.error('[MyInsights] Shader initialization error:', shaderError);
      setShaderError(shaderError.message);
    }
  }, []);

  useEffect(() => { 
    if (!shaderError) {
      const timeoutId = setTimeout(() => {
        initShader();
      }, 100); // Small delay to ensure DOM is ready
      
      return () => {
        clearTimeout(timeoutId);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [initShader, shaderError]);

  return (
    <MyInsightsErrorBoundary>
      <div style={{ minHeight: '100vh', position: 'relative', color: '#f7f9ff', overflowX: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
        <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, background: '#0f172a' }} />
        
        {/* Commuting Tickers Overlay */}
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, pointerEvents: 'none', opacity: 0.4, overflow: 'hidden' }}>
          {tickerItems.length > 0 ? tickerItems.map(({ ticker, idx, text }) => {
            const measuredWidth = tickerNaturalWidths[ticker.symbol];
            const startLeft = typeof measuredWidth === 'number' ? `${-(measuredWidth + 24)}px` : '-200px';
            return (
              <div key={ticker.symbol} style={{ 
                position: 'absolute', 
                color: ticker.change >= 0 ? '#4ade80' : '#f87171', 
                fontFamily: 'monospace', 
                fontSize: '0.9rem', 
                whiteSpace: 'nowrap', 
                top: `${(idx * 10) % 100}%`, 
                left: startLeft, 
                fontWeight: 'bold',
                textShadow: '0 0 10px rgba(0,0,0,0.5)',
                animation: `commute ${20 + idx * 5}s linear infinite` 
              }}>
                {text}
              </div>
            );
          }) : null}
        </div>

        <div style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
            <div>
              <h1 style={{ margin: 0 }}>MyInsights</h1>
              <p style={{ color: '#94a3b8', margin: '8px 0 0 0' }}>S&P 500 Market Research & Analysis</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => fetchFiles(true)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer' }}>Refresh</button>
              <Link to="/home" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '10px 20px', borderRadius: '12px', textDecoration: 'none' }}>Back Home</Link>
            </div>
          </div>

          {error && <div style={{ padding: '20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', marginBottom: '20px', color: '#fecaca' }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            {fileCards}
          </div>
        </div>

        {selectedFile && <DocumentViewer file={selectedFile} onClose={() => setSelectedFile(null)} />}

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes commute { from { transform: translateX(-100%); } to { transform: translateX(calc(100vw + 400px)); } }
        ` }} />
      </div>
    </MyInsightsErrorBoundary>
  );
};

export default MyInsightsScreen;
