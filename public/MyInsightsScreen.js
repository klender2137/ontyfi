(function() {
  const { useState, useEffect, useRef, useCallback } = React;

  const CACHE_KEY = 'my_insights_files';
  const CACHE_EXPIRY = 24 * 60 * 60 * 1000;
  const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
  const MAX_FOLDER_DEPTH = 5;

  const isFolder = (item) => item?.mimeType === FOLDER_MIME_TYPE;

  const getFileTypeInfo = (file) => {
    if (isFolder(file)) {
      return { label: 'Folder', color: '#f59e0b', icon: '📁', type: 'folder' };
    }

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

  const DocumentViewer = ({ file, onClose }) => {
    if (isFolder(file)) {
      console.error('[DocumentViewer] Attempted to open a folder as a document:', file);
      return null;
    }

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
          switch (typeInfo.type) {
            case 'pdf':
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
              const response = await fetch(`/api/insights/file-content?id=${file.id}`);
              if (!response.ok) throw new Error('Failed to load text file');
              setContent(await response.text());
              break;
            }

            case 'image':
              setContent(`https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`);
              break;

            default:
              setContent(`https://docs.google.com/viewerng/viewer?srcid=${file.id}&pid=explorer&efb=true&usb=true&a=v&chrome=false&embedded=true`);
          }
        } catch (err) {
          setError('Failed to load preview. Check file permissions or try refreshing.');
        } finally {
          setLoading(false);
        }
      };
      loadContent();
    }, [file.id, typeInfo.type]);

    return React.createElement('div', {
      style: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1000, background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', color: '#f7f9ff' }
    },
      React.createElement('div', {
        style: { padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '1rem' } },
          React.createElement('span', { style: { fontSize: '1.5rem' } }, typeInfo.icon),
          React.createElement('h3', { style: { margin: 0 } }, file.name)
        ),
        React.createElement('button', {
          onClick: onClose,
          style: { background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }
        }, 'Close')
      ),
      React.createElement('div', { style: { flex: 1, position: 'relative', overflow: 'hidden', padding: '2rem' } },
        loading && React.createElement('div', { style: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' } }, '⏳ Loading Viewer...'),
        error && React.createElement('div', { style: { color: '#fca5a5', textAlign: 'center', marginTop: '4rem' } },
          React.createElement('p', null, error),
          React.createElement('button', {
            onClick: () => window.open(file.webViewLink, '_blank'),
            style: { background: '#1e293b', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', marginTop: '10px' }
          }, 'Open in Google Drive')
        ),
        !loading && !error && React.createElement('div', { style: { width: '100%', height: '100%', background: 'white', borderRadius: '12px', overflow: 'hidden', position: 'relative' } },
          typeInfo.type === 'txt' ? React.createElement('pre', { style: { padding: '2rem', color: '#1e293b', whiteSpace: 'pre-wrap', fontFamily: 'monospace', height: '100%', overflow: 'auto', margin: 0 } }, content) :
          typeInfo.type === 'image' ? React.createElement('div', { style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' } }, 
            React.createElement('img', { 
              src: content, 
              alt: file.name, 
              style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
              onError: (e) => {
                e.target.src = `https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`;
              }
            })
          ) :
          React.createElement('iframe', { 
            src: content, 
            style: { width: '100%', height: '100%', border: 'none', display: iframeLoaded ? 'block' : 'none' }, 
            title: file.name,
            sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
            allow: 'fullscreen',
            onLoad: () => setIframeLoaded(true),
            onError: () => setError('Preview unavailable — try opening directly in Drive.')
          }),
          !iframeLoaded && typeInfo.type !== 'txt' && typeInfo.type !== 'image' && React.createElement('div', { style: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#1e293b' } }, '⏳ Preparing viewer...')
        )
      )
    );
  };

  function MyInsightsScreen({ onGoHome }) {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [tickers, setTickers] = useState([]);
    const [shaderError, setShaderError] = useState(null);
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [folderStack, setFolderStack] = useState([]);
    const [currentFolderName, setCurrentFolderName] = useState('Finance Resources');
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);

    const fetchTickers = useCallback(async () => {
      try {
        const response = await fetch('/api/finance/tickers');
        const result = await response.json();
        if (result.ok) setTickers(result.data);
      } catch (err) { console.warn('Ticker fetch failed:', err); }
    }, []);

    useEffect(() => {
      fetchTickers();
      const interval = setInterval(fetchTickers, 30000);
      return () => clearInterval(interval);
    }, [fetchTickers]);

    const fetchFiles = useCallback(async (forceRefresh = false, folderId = null) => {
      setLoading(true);
      setError(null);
      try {
        const cacheKey = folderId ? `${CACHE_KEY}_${folderId}` : CACHE_KEY;
        
        if (!forceRefresh) {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_EXPIRY) {
              setFiles(data);
              setLoading(false);
              return;
            }
          }
        }
        
        const url = folderId 
          ? `/api/insights/finance-resources?folderId=${encodeURIComponent(folderId)}`
          : '/api/insights/finance-resources';
          
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.ok) {
          const items = result.files || [];
          setFiles(items);
          localStorage.setItem(cacheKey, JSON.stringify({ data: items, timestamp: Date.now() }));
        } else { 
          throw new Error(result.error || 'Failed to fetch files'); 
        }
      } catch (err) {
        setError(err.message);
        const cacheKey = folderId ? `${CACHE_KEY}_${folderId}` : CACHE_KEY;
        const cached = localStorage.getItem(cacheKey);
        if (cached) setFiles(JSON.parse(cached).data);
      } finally { 
        setLoading(false); 
      }
    }, [setFiles, setLoading, setError]);

    useEffect(() => { 
      fetchFiles(false, currentFolderId); 
    }, [fetchFiles, currentFolderId]);

    const initShader = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const gl = canvas.getContext('webgl', { alpha: false, preserveDrawingBuffer: true });
        if (!gl) throw new Error('WebGL not supported');
        const vsSource = `attribute vec4 aVertexPosition; void main() { gl_Position = aVertexPosition; }`;
        const fsSource = `
          precision highp float;
          uniform float uTime;
          uniform vec2 uResolution;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123); }
          void main() {
            vec2 uv = gl_FragCoord.xy / uResolution.xy;
            vec2 p = uv * 2.0 - 1.0;
            p.x *= uResolution.x / uResolution.y;
            float t = uTime * 0.1;
            vec3 baseColor = vec3(0.01, 0.05, 0.15);
            vec3 crystalColor = vec3(0.1, 0.4, 0.8);
            vec2 g = floor(p * 8.0);
            vec2 f = fract(p * 8.0);
            float web = 0.0;
            for(int y=-1; y<=1; y++) {
              for(int x=-1; x<=1; x++) {
                vec2 neighbor = vec2(float(x), float(y));
                vec2 point = neighbor + hash(g + neighbor) - 0.5;
                point += 0.3 * sin(t + 6.28 * hash(g + neighbor));
                float dist = distance(f, point);
                web += 0.015 / (dist * dist + 0.001);
              }
            }
            vec3 finalColor = mix(baseColor, crystalColor, web * 0.5);
            gl_FragColor = vec4(finalColor, 1.0);
          }
        `;
        const createShader = (gl, type, source) => {
          const shader = gl.createShader(type);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
          return shader;
        };
        const program = gl.createProgram();
        gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vsSource));
        gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fsSource));
        gl.linkProgram(program);
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
          if (!canvasRef.current) return;
          canvas.width = window.innerWidth; canvas.height = window.innerHeight;
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.uniform1f(uTime, time * 0.001);
          gl.uniform2f(uResolution, canvas.width, canvas.height);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          animationFrameRef.current = requestAnimationFrame(render);
        };
        animationFrameRef.current = requestAnimationFrame(render);
      } catch (e) { setShaderError(e.message); }
    }, []);

    useEffect(() => { if (!shaderError) initShader(); return () => cancelAnimationFrame(animationFrameRef.current); }, [initShader, shaderError]);

    const openFolder = useCallback((folder) => {
      if (!isFolder(folder)) {
        console.error('[openFolder] Attempted to open non-folder:', folder);
        return;
      }
      
      // Clear files immediately to prevent showing stale data from previous folder
      setFiles([]);
      setError(null);
      setSelectedFile(null);
      
      setFolderStack(prev => {
        if (prev.length >= MAX_FOLDER_DEPTH - 1) {
          setError(`Cannot navigate deeper than ${MAX_FOLDER_DEPTH} levels. Please use the back button.`);
          return prev;
        }
        return [...prev, { id: currentFolderId, name: currentFolderName }];
      });
      
      setCurrentFolderId(folder.id);
      setCurrentFolderName(folder.name);
    }, [currentFolderId, currentFolderName]);

    const goBack = useCallback(() => {
      setFolderStack(prevStack => {
        if (prevStack.length === 0) return prevStack;
        
        // Clear files immediately to prevent showing stale data
        setFiles([]);
        setError(null);
        setSelectedFile(null);
        
        const prev = prevStack[prevStack.length - 1];
        setCurrentFolderId(prev.id);
        setCurrentFolderName(prev.name);
        
        return prevStack.slice(0, -1);
      });
    }, []);

    const goToRoot = useCallback(() => {
      setFiles([]);
      setFolderStack([]);
      setCurrentFolderId(null);
      setCurrentFolderName('Finance Resources');
      setSelectedFile(null);
      setError(null);
    }, []);

    const handleItemClick = useCallback((item) => {
      if (isFolder(item)) {
        openFolder(item);
      } else {
        setSelectedFile(item);
      }
    }, [openFolder]);

    const folders = files.filter(isFolder);
    const regularFiles = files.filter(f => !isFolder(f));
    const isEmpty = files.length === 0;

    if (loading) {
      return React.createElement('div', { className: 'screen', style: { textAlign: 'center', padding: '2rem' } },
        React.createElement('h2', null, 'Loading MyInsights...'),
        React.createElement('div', { className: 'loading-bar' })
      );
    }

    return React.createElement('div', { style: { minHeight: '100vh', position: 'relative', color: '#f7f9ff', overflowX: 'hidden', fontFamily: 'system-ui, sans-serif' } },
      React.createElement('canvas', { ref: canvasRef, style: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, background: '#0f172a' } }),
      React.createElement('div', { style: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, pointerEvents: 'none', opacity: 0.4, overflow: 'hidden' } },
        tickers.map((ticker, idx) => React.createElement('div', {
          key: ticker.symbol,
          style: { position: 'absolute', color: ticker.change >= 0 ? '#4ade80' : '#f87171', fontFamily: 'monospace', fontSize: '0.9rem', whiteSpace: 'nowrap', top: `${(idx * 10) % 100}%`, left: '-200px', fontWeight: 'bold', textShadow: '0 0 10px rgba(0,0,0,0.5)', animation: `commute ${20 + idx * 5}s linear infinite` }
        }, `${ticker.symbol}: $${ticker.price.toFixed(2)} (${ticker.change >= 0 ? '+' : ''}${ticker.change.toFixed(2)}%)`))
      ),
      React.createElement('div', { style: { padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' } },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' } },
          React.createElement('div', null,
            React.createElement('h1', { style: { margin: 0 } }, 'MyInsights'),
            React.createElement('p', { style: { color: '#94a3b8', margin: '8px 0 0 0' } }, 'S&P 500 Market Research & Analysis')
          ),
          React.createElement('div', { style: { display: 'flex', gap: '12px' } },
            React.createElement('button', { onClick: () => fetchFiles(true, currentFolderId), style: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer' } }, 'Refresh'),
            React.createElement('button', { onClick: onGoHome, style: { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer' } }, 'Back Home')
          )
        ),
        
        React.createElement('div', { style: { marginBottom: '24px' } },
          folderStack.length > 0 && React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' } },
            React.createElement('button', {
              onClick: goToRoot,
              style: { background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.9rem', padding: '4px 8px' }
            }, 'Finance Resources'),
            folderStack.map((folder, idx) => 
              React.createElement('span', { key: idx, style: { color: '#94a3b8' } }, '/')
            ),
            React.createElement('span', { style: { color: '#f7f9ff', fontWeight: 500 } }, currentFolderName),
            folderStack.length > 0 && React.createElement('button', {
              onClick: goBack,
              style: { marginLeft: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }
            }, '← Back')
          ),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', color: '#94a3b8', fontSize: '0.9rem' } },
            React.createElement('span', null, `${folders.length} folder${folders.length !== 1 ? 's' : ''}`),
            React.createElement('span', null, '•'),
            React.createElement('span', null, `${regularFiles.length} file${regularFiles.length !== 1 ? 's' : ''}`)
          )
        ),
        
        error && React.createElement('div', { style: { padding: '20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', marginBottom: '20px', color: '#fecaca' } }, error),
        
        isEmpty && !loading && !error && React.createElement('div', { style: { padding: '60px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' } },
          React.createElement('div', { style: { fontSize: '4rem', marginBottom: '20px' } }, '📂'),
          React.createElement('h3', { style: { margin: '0 0 12px 0', color: '#f7f9ff' } }, 'This folder is empty'),
          React.createElement('p', { style: { color: '#94a3b8', margin: 0 } }, 'No files or folders found in this location.'),
          folderStack.length > 0 && React.createElement('button', {
            onClick: goBack,
            style: { marginTop: '20px', background: 'rgba(96,165,250,0.2)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', padding: '10px 24px', borderRadius: '12px', cursor: 'pointer' }
          }, 'Go Back')
        ),
        
        !isEmpty && React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' } },
          folders.map(folder => 
            React.createElement('div', {
              key: `folder-${folder.id}`,
              onClick: () => handleItemClick(folder),
              style: { 
                background: 'rgba(245, 158, 11, 0.08)', 
                backdropFilter: 'blur(12px)', 
                padding: '24px', 
                borderRadius: '20px', 
                border: '2px solid rgba(245, 158, 11, 0.3)', 
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              },
              onMouseEnter: (e) => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; },
              onMouseLeave: (e) => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }
            },
              React.createElement('div', { style: { fontSize: '2.5rem', marginBottom: '12px' } }, '📁'),
              React.createElement('h3', { style: { margin: '0 0 8px 0', fontSize: '1.1rem', color: '#f59e0b' } }, folder.name),
              React.createElement('div', { style: { color: '#f59e0b', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' } }, 
                'Open Folder →'
              )
            )
          ),
          regularFiles.map(file => {
            const info = getFileTypeInfo(file);
            return React.createElement('div', {
              key: `file-${file.id}`,
              onClick: () => handleItemClick(file),
              style: { background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 0.2s ease' },
              onMouseEnter: (e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(-2px)'; },
              onMouseLeave: (e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateY(0)'; }
            },
              React.createElement('div', { style: { fontSize: '2rem', marginBottom: '12px' } }, info.icon),
              React.createElement('h3', { style: { margin: '0 0 8px 0', fontSize: '1.1rem' } }, file.name),
              React.createElement('div', { style: { color: info.color, fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' } }, info.label)
            );
          })
        )
      ),
      selectedFile && !isFolder(selectedFile) && React.createElement(DocumentViewer, { file: selectedFile, onClose: () => setSelectedFile(null) }),
      React.createElement('style', null, `
        @keyframes commute { from { transform: translateX(-100%); } to { transform: translateX(calc(100vw + 400px)); } }
      `)
    );
  }

  window.MyInsightsScreen = MyInsightsScreen;
})();
