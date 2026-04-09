/**
 * PDF Worker - Off-thread PDF processing
 * Handles binary parsing and page rendering without blocking UI
 */

self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let currentPdf = null;

self.onmessage = async function(e) {
  const { action, fileId, arrayBuffer, pageNum = 1, scale = 1.5 } = e.data;

  try {
    switch (action) {
      case 'load':
        await loadPDF(arrayBuffer);
        break;

      case 'renderPage':
        await renderPage(pageNum, scale);
        break;

      case 'getPageCount':
        getPageCount();
        break;

      case 'getTextContent':
        await getTextContent(pageNum);
        break;

      default:
        self.postMessage({ type: 'error', error: 'Unknown action: ' + action });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message || 'Worker processing failed',
      stack: error.stack,
    });
  }
};

async function loadPDF(arrayBuffer) {
  try {
    // Validate buffer
    if (!arrayBuffer || arrayBuffer.byteLength < 100) {
      throw new Error(`Invalid PDF: Buffer too small (${arrayBuffer?.byteLength || 0} bytes)`);
    }

    // Check PDF magic bytes
    const header = new Uint8Array(arrayBuffer.slice(0, 8));
    const headerStr = String.fromCharCode(...header);
    if (!headerStr.startsWith('%PDF')) {
      // Try to decode as text to see what we got
      const textDecoder = new TextDecoder('utf-8');
      const asText = textDecoder.decode(arrayBuffer.slice(0, 200));
      throw new Error(`Invalid PDF structure. Header: "${headerStr}". First 200 chars as text: "${asText}"`);
    }

    // Load the PDF
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    currentPdf = await loadingTask.promise;

    self.postMessage({
      type: 'loaded',
      numPages: currentPdf.numPages,
      fingerprint: currentPdf.fingerprint,
    });

  } catch (error) {
    throw new Error(`PDF Load Failed: ${error.message}`);
  }
}

async function renderPage(pageNum, scale) {
  if (!currentPdf) {
    throw new Error('No PDF loaded. Call load first.');
  }

  if (pageNum < 1 || pageNum > currentPdf.numPages) {
    throw new Error(`Invalid page number: ${pageNum}. Document has ${currentPdf.numPages} pages.`);
  }

  try {
    const page = await currentPdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    // Create offscreen canvas
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    // Fill white background
    context.fillStyle = 'white';
    context.fillRect(0, 0, viewport.width, viewport.height);

    // Render PDF page
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    // Convert to bitmap for transfer
    const bitmap = canvas.transferToImageBitmap();

    // Cleanup
    page.cleanup();

    self.postMessage({
      type: 'pageRendered',
      pageNum,
      bitmap,
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
    }, [bitmap]);

  } catch (error) {
    throw new Error(`Render Failed: ${error.message}`);
  }
}

function getPageCount() {
  if (!currentPdf) {
    throw new Error('No PDF loaded');
  }

  self.postMessage({
    type: 'pageCount',
    numPages: currentPdf.numPages,
  });
}

async function getTextContent(pageNum) {
  if (!currentPdf) {
    throw new Error('No PDF loaded');
  }

  const page = await currentPdf.getPage(pageNum);
  const textContent = await page.getTextContent();

  self.postMessage({
    type: 'textContent',
    pageNum,
    text: textContent.items.map(item => item.str).join(' '),
  });

  page.cleanup();
}
