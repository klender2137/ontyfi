/**
 * DocumentViewerComponent - High-Performance Document Viewer with WebWorkers
 * Uses GoogleDriveService for client-side OAuth and WebWorkers for non-blocking UI
 */

(function() {
  const { useState, useEffect, useRef, useCallback, useMemo } = React;

  // Error Component for graceful failure display
  const ErrorDisplay = ({ title, message, onRetry, onOpenInDrive, file }) =>
    React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#fca5a5',
        padding: '40px',
        textAlign: 'center',
      },
    },
      React.createElement('div', { style: { fontSize: '3rem', marginBottom: '16px' } }, '⚠️'),
      React.createElement('h3', { style: { margin: '0 0 12px 0', color: '#f87171' } }, title || 'Error Loading Document'),
      React.createElement('p', { style: { margin: '0 0 24px 0', maxWidth: '500px', color: '#fca5a5' } }, message),
      React.createElement('div', { style: { display: 'flex', gap: '12px' } },
        onRetry && React.createElement('button', {
          onClick: onRetry,
          style: {
            background: 'rgba(59, 130, 246, 0.2)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#60a5fa',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
          },
        }, '🔄 Retry'),
        file?.webViewLink && React.createElement('button', {
          onClick: () => window.open(file.webViewLink, '_blank'),
          style: {
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
          },
        }, '🔗 Open in Google Drive')
      )
    );

  // PDF Viewer with WebWorker
  const PDFViewer = ({ binaryData, file, onError }) => {
    const canvasRef = useRef(null);
    const workerRef = useRef(null);
    const [pageNum, setPageNum] = useState(1);
    const [numPages, setNumPages] = useState(0);
    const [scale, setScale] = useState(1.5);
    const [loading, setLoading] = useState(true);
    const [rendering, setRendering] = useState(false);
    const [error, setError] = useState(null);
    const abortControllerRef = useRef(new AbortController());

    // Validate binary data on mount
    useEffect(() => {
      if (!binaryData || binaryData.byteLength < 100) {
        setError(`Invalid PDF data: ${binaryData?.byteLength || 0} bytes received (minimum 100 bytes required)`);
        setLoading(false);
        return;
      }

      let isMounted = true;

      const initWorker = async () => {
        try {
          // Create worker
          workerRef.current = new Worker('/workers/pdf-worker.js');

          // Set up message handler
          workerRef.current.onmessage = (e) => {
            if (!isMounted) return;

            const { type, error: workerError, ...data } = e.data;

            switch (type) {
              case 'loaded':
                setNumPages(data.numPages);
                setLoading(false);
                // Render first page
                requestPageRender(1);
                break;

              case 'pageRendered':
                // Draw the bitmap to canvas
                const canvas = canvasRef.current;
                if (canvas) {
                  canvas.width = data.viewport.width;
                  canvas.height = data.viewport.height;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(data.bitmap, 0, 0);
                  data.bitmap.close();
                }
                setRendering(false);
                setPageNum(data.pageNum);
                break;

              case 'error':
                console.error('[PDF Worker Error]', workerError);
                setError(workerError);
                setLoading(false);
                setRendering(false);
                break;
            }
          };

          workerRef.current.onerror = (err) => {
            console.error('[PDF Worker Critical Error]', err);
            if (isMounted) {
              setError(`Worker failed: ${err.message}`);
              setLoading(false);
            }
          };

          // Load PDF in worker
          workerRef.current.postMessage({
            action: 'load',
            arrayBuffer: binaryData,
          }, [binaryData]);

        } catch (err) {
          if (isMounted) {
            setError(`Failed to initialize PDF worker: ${err.message}`);
            setLoading(false);
          }
        }
      };

      initWorker();

      return () => {
        isMounted = false;
        abortControllerRef.current.abort();
        if (workerRef.current) {
          workerRef.current.terminate();
        }
      };
    }, [binaryData]);

    const requestPageRender = (page) => {
      if (!workerRef.current || rendering) return;

      setRendering(true);
      workerRef.current.postMessage({
        action: 'renderPage',
        pageNum: page,
        scale,
      });
    };

    const goToPrevPage = () => {
      if (pageNum > 1 && !rendering) {
        requestPageRender(pageNum - 1);
      }
    };

    const goToNextPage = () => {
      if (pageNum < numPages && !rendering) {
        requestPageRender(pageNum + 1);
      }
    };

    const zoomIn = () => {
      const newScale = Math.min(scale + 0.25, 3.0);
      setScale(newScale);
      setTimeout(() => requestPageRender(pageNum), 0);
    };

    const zoomOut = () => {
      const newScale = Math.max(scale - 0.25, 0.5);
      setScale(newScale);
      setTimeout(() => requestPageRender(pageNum), 0);
    };

    useEffect(() => {
      const handleKeyDown = (e) => {
        if (e.key === 'ArrowLeft') goToPrevPage();
        if (e.key === 'ArrowRight') goToNextPage();
        if (e.key === '+' || e.key === '=') zoomIn();
        if (e.key === '-') zoomOut();
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [pageNum, numPages, rendering, scale]);

    if (error) {
      return React.createElement(ErrorDisplay, {
        title: 'PDF Load Failed',
        message: error,
        onRetry: () => window.location.reload(),
        onOpenInDrive: true,
        file,
      });
    }

    if (loading) {
      return React.createElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#94a3b8',
        },
      },
        React.createElement('div', { style: { fontSize: '2rem', marginBottom: '16px' } }, '⏳'),
        React.createElement('p', null, 'Loading PDF...'),
        React.createElement('p', { style: { fontSize: '12px', color: '#64748b' } }, 'Processing in WebWorker')
      );
    }

    return React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#1e293b',
      },
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: '#0f172a',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        },
      },
        React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          React.createElement('button', {
            onClick: goToPrevPage,
            disabled: pageNum <= 1 || rendering,
            style: {
              padding: '6px 12px',
              background: pageNum <= 1 || rendering ? '#334155' : '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: pageNum <= 1 || rendering ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            },
          }, '← Prev'),
          React.createElement('span', {
            style: { color: '#94a3b8', fontSize: '14px', minWidth: '80px', textAlign: 'center' },
          }, `Page ${pageNum} / ${numPages}`),
          React.createElement('button', {
            onClick: goToNextPage,
            disabled: pageNum >= numPages || rendering,
            style: {
              padding: '6px 12px',
              background: pageNum >= numPages || rendering ? '#334155' : '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: pageNum >= numPages || rendering ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            },
          }, 'Next →')
        ),
        React.createElement('div', { style: { display: 'flex', gap: '8px' } },
          React.createElement('button', {
            onClick: zoomOut,
            disabled: rendering,
            style: {
              padding: '6px 12px',
              background: rendering ? '#334155' : '#475569',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: rendering ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            },
          }, '−'),
          React.createElement('span', {
            style: { color: '#94a3b8', fontSize: '14px', minWidth: '50px', textAlign: 'center' },
          }, `${Math.round(scale * 100)}%`),
          React.createElement('button', {
            onClick: zoomIn,
            disabled: rendering,
            style: {
              padding: '6px 12px',
              background: rendering ? '#334155' : '#475569',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: rendering ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            },
          }, '+')
        )
      ),
      React.createElement('div', {
        style: {
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '20px',
          background: '#0f172a',
        },
      },
        React.createElement('canvas', {
          ref: canvasRef,
          style: {
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            maxWidth: '100%',
            background: 'white',
          },
        }),
        rendering && React.createElement('div', {
          style: {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#94a3b8',
            background: 'rgba(15, 23, 42, 0.9)',
            padding: '12px 24px',
            borderRadius: '8px',
          },
        }, 'Rendering...')
      )
    );
  };

  // Excel Viewer with WebWorker
  const ExcelViewer = ({ binaryData, file, onError }) => {
    const [workbook, setWorkbook] = useState(null);
    const [activeSheet, setActiveSheet] = useState(0);
    const [sheetData, setSheetData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [totalRows, setTotalRows] = useState(0);
    const [currentRange, setCurrentRange] = useState({ start: 0, end: 50 });
    const [sheetNames, setSheetNames] = useState([]);
    const workerRef = useRef(null);
    const containerRef = useRef(null);

    // Validate binary data
    useEffect(() => {
      if (!binaryData || binaryData.byteLength < 200) {
        setError(`Invalid Excel data: ${binaryData?.byteLength || 0} bytes received (minimum 200 bytes required)`);
        setLoading(false);
        return;
      }

      let isMounted = true;

      const initWorker = async () => {
        try {
          workerRef.current = new Worker('/workers/excel-worker.js');

          workerRef.current.onmessage = (e) => {
            if (!isMounted) return;

            const { type, error: workerError, ...data } = e.data;

            switch (type) {
              case 'loaded':
                setSheetNames(data.sheetNames);
                setWorkbook({ sheetNames: data.sheetNames });
                // Load first sheet data
                workerRef.current.postMessage({
                  action: 'getSheetData',
                  sheetIndex: 0,
                  rowStart: 0,
                  rowCount: 50,
                });
                break;

              case 'sheetData':
                setHeaders(data.headers || []);
                setSheetData(data.data || []);
                setTotalRows(data.totalRows);
                setCurrentRange({ start: data.rowStart, end: data.rowStart + data.rowCount });
                setLoading(false);
                break;

              case 'error':
                console.error('[Excel Worker Error]', workerError);
                setError(workerError);
                setLoading(false);
                break;
            }
          };

          workerRef.current.onerror = (err) => {
            console.error('[Excel Worker Critical Error]', err);
            if (isMounted) {
              setError(`Worker failed: ${err.message}`);
              setLoading(false);
            }
          };

          // Load workbook in worker
          workerRef.current.postMessage({
            action: 'load',
            arrayBuffer: binaryData,
          }, [binaryData]);

        } catch (err) {
          if (isMounted) {
            setError(`Failed to initialize Excel worker: ${err.message}`);
            setLoading(false);
          }
        }
      };

      initWorker();

      return () => {
        isMounted = false;
        if (workerRef.current) {
          workerRef.current.terminate();
        }
      };
    }, [binaryData]);

    const handleSheetChange = (index) => {
      if (!workerRef.current || index === activeSheet) return;

      setActiveSheet(index);
      setLoading(true);
      workerRef.current.postMessage({
        action: 'getSheetData',
        sheetIndex: index,
        rowStart: 0,
        rowCount: 50,
      });
    };

    const loadMoreRows = () => {
      if (!workerRef.current || currentRange.end >= totalRows) return;

      const newStart = currentRange.end;
      workerRef.current.postMessage({
        action: 'getSheetData',
        sheetIndex: activeSheet,
        rowStart: newStart,
        rowCount: 50,
      });
    };

    // Virtual scroll handler
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        if (scrollTop + clientHeight >= scrollHeight - 100) {
          loadMoreRows();
        }
      };

      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }, [activeSheet, currentRange, totalRows]);

    if (error) {
      return React.createElement(ErrorDisplay, {
        title: 'Excel Load Failed',
        message: error,
        onRetry: () => window.location.reload(),
        onOpenInDrive: true,
        file,
      });
    }

    if (loading) {
      return React.createElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#94a3b8',
        },
      },
        React.createElement('div', { style: { fontSize: '2rem', marginBottom: '16px' } }, '⏳'),
        React.createElement('p', null, 'Loading Spreadsheet...'),
        React.createElement('p', { style: { fontSize: '12px', color: '#64748b' } }, 'Processing in WebWorker')
      );
    }

    return React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0f172a',
      },
    },
      // Sheet tabs
      sheetNames.length > 0 && React.createElement('div', {
        style: {
          display: 'flex',
          gap: '4px',
          padding: '8px 16px',
          background: '#1e293b',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          overflowX: 'auto',
        },
      },
        sheetNames.map((name, index) =>
          React.createElement('button', {
            key: name,
            onClick: () => handleSheetChange(index),
            style: {
              padding: '6px 16px',
              background: activeSheet === index ? '#3b82f6' : '#334155',
              border: 'none',
              borderRadius: '6px 6px 0 0',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
              whiteSpace: 'nowrap',
            },
          }, name)
        )
      ),
      // Table container
      React.createElement('div', {
        ref: containerRef,
        style: {
          flex: 1,
          overflow: 'auto',
          padding: '0',
        },
      },
        React.createElement('table', {
          style: {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
          },
        },
          React.createElement('thead', {
            style: {
              position: 'sticky',
              top: 0,
              background: '#1e293b',
              zIndex: 10,
            },
          },
            React.createElement('tr', null,
              headers.map((header, i) =>
                React.createElement('th', {
                  key: i,
                  style: {
                    padding: '10px 12px',
                    textAlign: 'left',
                    borderBottom: '2px solid #3b82f6',
                    color: '#94a3b8',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                  },
                }, header || `Col ${i + 1}`)
              )
            )
          ),
          React.createElement('tbody', null,
            sheetData.map((row, rowIndex) =>
              React.createElement('tr', {
                key: rowIndex,
                style: {
                  background: rowIndex % 2 === 0 ? '#0f172a' : '#1e293b',
                },
              },
                headers.map((_, colIndex) =>
                  React.createElement('td', {
                    key: colIndex,
                    style: {
                      padding: '8px 12px',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      color: '#e2e8f0',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '300px',
                    },
                  }, row[colIndex] !== undefined ? String(row[colIndex]) : '')
                )
              )
            )
          )
        ),
        currentRange.end < totalRows && React.createElement('div', {
          style: {
            padding: '16px',
            textAlign: 'center',
            color: '#64748b',
          },
        }, `Loading more rows... (${currentRange.end} / ${totalRows})`)
      ),
      // Status bar
      React.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: '#1e293b',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          color: '#64748b',
          fontSize: '12px',
        },
      },
        React.createElement('span', null, `Rows: ${totalRows.toLocaleString()}`),
        React.createElement('span', null, `Showing: ${currentRange.start + 1} - ${Math.min(currentRange.end, totalRows)}`)
      )
    );
  };

  // Word Document Viewer
  const DocxViewer = ({ binaryData, fileId, fileName, onError }) => {
    const [htmlContent, setHtmlContent] = useState('');
    const [loading, setLoading] = useState(true);
    const containerRef = useRef(null);

    useEffect(() => {
      let isMounted = true;
      
      const loadDocx = async () => {
        try {
          setLoading(true);
          
          // Dynamically load Mammoth
          if (!window.mammoth) {
            await new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
              script.onload = resolve;
              script.onerror = reject;
              document.head.appendChild(script);
            });
          }
          
          if (!isMounted) return;
          
          const result = await window.mammoth.convertToHtml({ arrayBuffer: binaryData }, {
            styleMap: [
              "p[style-name='Heading 1'] => h1",
              "p[style-name='Heading 2'] => h2",
              "p[style-name='Heading 3'] => h3",
              "p[style-name='Title'] => h1.title"
            ]
          });
          
          if (isMounted) {
            setHtmlContent(result.value);
            setLoading(false);
          }
          
        } catch (error) {
          console.error('[DocxViewer] Error loading document:', error);
          if (isMounted) onError?.(error.message);
        }
      };
      
      loadDocx();
      
      return () => { isMounted = false; };
    }, [binaryData, onError]);

    if (loading) {
      return React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#94a3b8'
        }
      }, '⏳ Loading Document...');
    }

    return React.createElement('div', {
      ref: containerRef,
      style: {
        height: '100%',
        overflow: 'auto',
        background: '#fff',
        padding: '40px 60px'
      }
    },
      React.createElement('div', {
        style: {
          maxWidth: '800px',
          margin: '0 auto',
          fontFamily: 'Georgia, serif',
          fontSize: '16px',
          lineHeight: '1.6',
          color: '#1e293b'
        },
        dangerouslySetInnerHTML: { __html: htmlContent }
      })
    );
  };

  // Image Viewer with ImageBitmap
  const ImageViewer = ({ binaryData, fileId, fileName, mimeType, onError }) => {
    const canvasRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [scale, setScale] = useState(1);
    const [bitmap, setBitmap] = useState(null);

    useEffect(() => {
      let isMounted = true;
      
      const loadImage = async () => {
        try {
          setLoading(true);
          
          const blob = new Blob([binaryData], { type: mimeType || 'image/png' });
          const imageBitmap = await createImageBitmap(blob);
          
          if (!isMounted) {
            imageBitmap.close();
            return;
          }
          
          setBitmap(imageBitmap);
          setLoading(false);
          
          // Draw on canvas
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width = imageBitmap.width;
            canvas.height = imageBitmap.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imageBitmap, 0, 0);
          }
          
        } catch (error) {
          console.error('[ImageViewer] Error loading image:', error);
          if (isMounted) onError?.(error.message);
        }
      };
      
      loadImage();
      
      return () => {
        isMounted = false;
        if (bitmap) bitmap.close();
      };
    }, [binaryData, mimeType, onError]);

    const zoomIn = () => setScale(s => Math.min(s * 1.25, 5));
    const zoomOut = () => setScale(s => Math.max(s / 1.25, 0.1));
    const resetZoom = () => setScale(1);

    if (loading) {
      return React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#94a3b8'
        }
      }, '⏳ Loading Image...');
    }

    return React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0f172a'
      }
    },
      // Toolbar
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '8px 16px',
          background: '#1e293b',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }
      },
        React.createElement('button', {
          onClick: zoomOut,
          style: {
            padding: '6px 16px',
            background: '#475569',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            cursor: 'pointer'
          }
        }, '−'),
        React.createElement('span', { style: { color: '#94a3b8', minWidth: '60px', textAlign: 'center' } },
          `${Math.round(scale * 100)}%`
        ),
        React.createElement('button', {
          onClick: zoomIn,
          style: {
            padding: '6px 16px',
            background: '#475569',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            cursor: 'pointer'
          }
        }, '+'),
        React.createElement('button', {
          onClick: resetZoom,
          style: {
            padding: '6px 16px',
            background: '#3b82f6',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            cursor: 'pointer'
          }
        }, 'Fit')
      ),
      // Canvas
      React.createElement('div', {
        style: {
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }
      },
        React.createElement('canvas', {
          ref: canvasRef,
          style: {
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            maxWidth: 'none'
          }
        })
      )
    );
  };

  // Text Viewer
  const TextViewer = ({ content, fileName }) => {
    return React.createElement('div', {
      style: {
        height: '100%',
        overflow: 'auto',
        background: '#0f172a',
        padding: '0'
      }
    },
      React.createElement('pre', {
        style: {
          margin: 0,
          padding: '24px 32px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
          fontSize: '14px',
          lineHeight: '1.6',
          color: '#e2e8f0',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }
      }, content)
    );
  };

  // Auth Prompt Component
  const AuthPrompt = ({ onAuthenticate }) =>
    React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#94a3b8',
        padding: '40px',
        textAlign: 'center',
      },
    },
      React.createElement('div', { style: { fontSize: '3rem', marginBottom: '20px' } }, '🔐'),
      React.createElement('h3', { style: { margin: '0 0 12px 0', color: '#f7f9ff' } }, 'Authentication Required'),
      React.createElement('p', { style: { margin: '0 0 24px 0', maxWidth: '400px' } },
        'To view documents directly from Google Drive, you need to authenticate with your Google account.'
      ),
      React.createElement('button', {
        onClick: onAuthenticate,
        style: {
          background: '#3b82f6',
          border: 'none',
          padding: '14px 32px',
          borderRadius: '8px',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        },
      },
        React.createElement('span', null, '🔑'),
        'Sign in with Google'
      )
    );

  // Main DocumentViewer Component
  const DocumentViewer = ({ file, onClose }) => {
    const [binaryData, setBinaryData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState({ loaded: 0, total: 0, percent: 0 });
    const [needsAuth, setNeedsAuth] = useState(false);
    const abortControllerRef = useRef(new AbortController());

    const driveService = useMemo(() => window.GoogleDriveService, []);

    const getFileTypeInfo = (file) => {
      const mimeType = file.mimeType || '';
      const name = file.name || '';
      const ext = name.split('.').pop().toLowerCase();

      if (mimeType.includes('pdf') || ext === 'pdf')
        return { label: 'PDF', color: '#ef4444', icon: '📄', type: 'pdf' };

      if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || ['xlsx', 'xls', 'csv', 'ods'].includes(ext))
        return { label: 'Spreadsheet', color: '#22c55e', icon: '📊', type: 'excel' };

      if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || ['pptx', 'ppt', 'odp'].includes(ext))
        return { label: 'Presentation', color: '#eab308', icon: '🖼️', type: 'slides' };

      if (mimeType.includes('document') || mimeType.includes('word') || ['docx', 'doc', 'odt', 'rtf'].includes(ext))
        return { label: 'Document', color: '#3b82f6', icon: '📝', type: 'docx' };

      if (mimeType.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext))
        return { label: 'Image', color: '#a855f7', icon: '🖼️', type: 'image', mimeType };

      if (mimeType.includes('text/plain') || ext === 'txt')
        return { label: 'Text', color: '#94a3b8', icon: '📄', type: 'txt' };

      return { label: 'File', color: '#94a3b8', icon: '📎', type: 'other' };
    };

    const typeInfo = useMemo(() => getFileTypeInfo(file), [file]);

    useEffect(() => {
      let isMounted = true;
      abortControllerRef.current = new AbortController();

      const loadDocument = async () => {
        try {
          setLoading(true);
          setError(null);
          setProgress({ loaded: 0, total: 0, percent: 0 });

          // Initialize Google Drive Service
          await driveService.initialize();

          // Check if we need authentication
          if (!driveService.isAuthenticated()) {
            setNeedsAuth(true);
            setLoading(false);
            return;
          }

          // Fetch binary data with gatekeeper validation
          const result = await driveService.fetchFileBinary(file.id, {
            onProgress: (p) => {
              if (isMounted) setProgress(p);
            },
            signal: abortControllerRef.current.signal,
          });

          if (!isMounted) return;

          // Additional validation
          if (result.data.byteLength < 100) {
            throw new Error(`File too small (${result.data.byteLength} bytes) - likely corrupted or access was denied.`);
          }

          setBinaryData(result.data);
          setLoading(false);

        } catch (err) {
          if (err.name === 'AbortError') return;

          console.error('[DocumentViewer] Load error:', err);

          if (isMounted) {
            // Check if this is an auth error
            if (err.message?.includes('Not authenticated') ||
                err.message?.includes('401') ||
                err.message?.includes('403')) {
              setNeedsAuth(true);
            } else {
              setError(err.message || 'Failed to load document');
            }
            setLoading(false);
          }
        }
      };

      loadDocument();

      return () => {
        isMounted = false;
        abortControllerRef.current.abort();
      };
    }, [file.id, typeInfo.type, driveService]);

    const handleAuthenticate = async () => {
      try {
        setLoading(true);
        await driveService.authenticate();
        setNeedsAuth(false);
        // Reload document
        window.location.reload();
      } catch (err) {
        setError(`Authentication failed: ${err.message}`);
        setLoading(false);
      }
    };

    const renderViewer = () => {
      if (needsAuth) {
        return React.createElement(AuthPrompt, { onAuthenticate: handleAuthenticate });
      }

      if (error) {
        return React.createElement(ErrorDisplay, {
          title: 'Failed to Load Document',
          message: error,
          onRetry: () => window.location.reload(),
          onOpenInDrive: true,
          file,
        });
      }

      switch (typeInfo.type) {
        case 'pdf':
          return React.createElement(PDFViewer, {
            binaryData,
            file,
            onError: setError,
          });

        case 'excel':
          return React.createElement(ExcelViewer, {
            binaryData,
            file,
            onError: setError,
          });

        case 'docx':
          return React.createElement(DocxViewer, {
            binaryData,
            file,
            onError: setError,
          });

        case 'image':
          return React.createElement(ImageViewer, {
            binaryData,
            file,
            mimeType: typeInfo.mimeType,
            onError: setError,
          });

        default:
          return React.createElement(ErrorDisplay, {
            title: 'Unsupported File Type',
            message: 'Preview is not available for this file type.',
            onOpenInDrive: true,
            file,
          });
      }
    };

    return React.createElement('div', {
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.98)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        color: '#f7f9ff'
      }
    },
      // Header
      React.createElement('div', {
        style: {
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(15, 23, 42, 0.8)'
        }
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '1rem' } },
          React.createElement('span', { style: { fontSize: '1.5rem' } }, typeInfo.icon),
          React.createElement('div', null,
            React.createElement('h3', { style: { margin: 0, fontSize: '1.1rem' } }, file.name),
            React.createElement('span', { style: { color: typeInfo.color, fontSize: '0.85rem', fontWeight: 'bold' } }, typeInfo.label)
          )
        ),
        React.createElement('div', { style: { display: 'flex', gap: '12px' } },
          file.webViewLink && React.createElement('button', {
            onClick: () => window.open(file.webViewLink, '_blank'),
            style: {
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#60a5fa',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px'
            }
          }, 'Open in Drive'),
          React.createElement('button', {
            onClick: onClose,
            style: {
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px'
            }
          }, '✕ Close')
        )
      ),
      
      // Content area
      React.createElement('div', { style: { flex: 1, position: 'relative', overflow: 'hidden' } },
        loading && React.createElement('div', {
          style: {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#94a3b8'
          }
        },
          React.createElement('div', { style: { fontSize: '2rem', marginBottom: '16px' } }, '⏳'),
          React.createElement('p', { style: { margin: '0 0 12px 0' } }, 'Loading document...'),
          progress.total > 0 && React.createElement('div', {
            style: {
              width: '200px',
              height: '4px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '2px',
              overflow: 'hidden',
              margin: '0 auto'
            }
          },
            React.createElement('div', {
              style: {
                width: `${progress.percent}%`,
                height: '100%',
                background: '#3b82f6',
                transition: 'width 0.2s ease'
              }
            })
          ),
          React.createElement('p', { style: { margin: '8px 0 0 0', fontSize: '12px', color: '#64748b' } },
            progress.total > 0 ? `${(progress.loaded / 1024 / 1024).toFixed(2)} MB / ${(progress.total / 1024 / 1024).toFixed(2)} MB` : ''
          )
        ),
        
        error && React.createElement('div', {
          style: {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#fca5a5',
            maxWidth: '400px'
          }
        },
          React.createElement('div', { style: { fontSize: '2rem', marginBottom: '16px' } }, '⚠️'),
          React.createElement('p', { style: { margin: '0 0 16px 0' } }, error),
          React.createElement('button', {
            onClick: () => window.open(file.webViewLink, '_blank'),
            style: {
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer'
            }
          }, 'Open in Google Drive')
        ),
        
        !loading && !error && renderViewer()
      )
    );
  };

  // Expose components
  window.DocumentViewer = DocumentViewer;
  window.PDFViewer = PDFViewer;
  window.ExcelViewer = ExcelViewer;
  window.DocxViewer = DocxViewer;
  window.ImageViewer = ImageViewer;
})();
