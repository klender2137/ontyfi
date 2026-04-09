/**
 * Excel Worker - Off-thread spreadsheet processing
 * Handles XLSX parsing without blocking UI
 */

self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');

let currentWorkbook = null;
let currentSheetName = null;

self.onmessage = async function(e) {
  const { action, arrayBuffer, sheetIndex = 0, rowStart = 0, rowCount = 50 } = e.data;

  try {
    switch (action) {
      case 'load':
        await loadWorkbook(arrayBuffer);
        break;

      case 'getSheetData':
        await getSheetData(sheetIndex, rowStart, rowCount);
        break;

      case 'getSheetNames':
        getSheetNames();
        break;

      case 'getCellValue':
        // For specific cell access
        break;

      default:
        self.postMessage({ type: 'error', error: 'Unknown action: ' + action });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message || 'Excel Worker processing failed',
      stack: error.stack,
    });
  }
};

async function loadWorkbook(arrayBuffer) {
  try {
    // Validate buffer
    if (!arrayBuffer || arrayBuffer.byteLength < 200) {
      throw new Error(`Invalid Excel file: Buffer too small (${arrayBuffer?.byteLength || 0} bytes)`);
    }

    // Check if it's a ZIP-based Office file (XLSX)
    // ZIP files start with PK (0x50 0x4B)
    const header = new Uint8Array(arrayBuffer.slice(0, 2));
    if (header[0] !== 0x50 || header[1] !== 0x4B) {
      // Check if it's an old XLS binary format
      const xlsHeader = new Uint8Array(arrayBuffer.slice(0, 8));
      const isXLS = xlsHeader[0] === 0xD0 && xlsHeader[1] === 0xCF &&
                    xlsHeader[2] === 0x11 && xlsHeader[3] === 0xE0;

      if (!isXLS) {
        const textDecoder = new TextDecoder('utf-8');
        const asText = textDecoder.decode(arrayBuffer.slice(0, 200));
        throw new Error(`Invalid Excel file format. Not a valid XLSX or XLS file. First 200 chars: "${asText}"`);
      }
    }

    // Parse the workbook
    const data = new Uint8Array(arrayBuffer);
    currentWorkbook = XLSX.read(data, {
      type: 'array',
      cellStyles: true,
      cellFormula: true,
      cellNF: true,
      cellDates: true,
    });

    const sheetNames = currentWorkbook.SheetNames;
    currentSheetName = sheetNames[0];

    // Get info about each sheet
    const sheetsInfo = sheetNames.map(name => {
      const worksheet = currentWorkbook.Sheets[name];
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      return {
        name,
        rowCount: range.e.r + 1,
        colCount: range.e.c + 1,
      };
    });

    self.postMessage({
      type: 'loaded',
      sheetNames,
      sheetsInfo,
      activeSheet: currentSheetName,
    });

  } catch (error) {
    throw new Error(`Excel Load Failed: ${error.message}`);
  }
}

async function getSheetData(sheetIndex, rowStart, rowCount) {
  if (!currentWorkbook) {
    throw new Error('No workbook loaded. Call load first.');
  }

  if (sheetIndex < 0 || sheetIndex >= currentWorkbook.SheetNames.length) {
    throw new Error(`Invalid sheet index: ${sheetIndex}`);
  }

  try {
    const sheetName = currentWorkbook.SheetNames[sheetIndex];
    const worksheet = currentWorkbook.Sheets[sheetName];
    currentSheetName = sheetName;

    // Get full range
    const fullRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const totalRows = fullRange.e.r + 1;
    const totalCols = fullRange.e.c + 1;

    // Calculate actual range to fetch
    const actualRowCount = Math.min(rowCount, totalRows - rowStart);

    if (actualRowCount <= 0) {
      self.postMessage({
        type: 'sheetData',
        sheetName,
        data: [],
        headers: [],
        totalRows,
        totalCols,
        rowStart,
        rowCount: 0,
      });
      return;
    }

    // Extract data range
    const range = {
      s: { c: 0, r: rowStart },
      e: { c: fullRange.e.c, r: rowStart + actualRowCount - 1 },
    };

    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      range: range,
      defval: '',
    });

    // Extract headers from first row if at start
    let headers = [];
    if (rowStart === 0 && jsonData.length > 0) {
      headers = jsonData[0];
    }

    // The actual data rows (excluding header if we got it)
    const dataRows = rowStart === 0 ? jsonData.slice(1) : jsonData;

    self.postMessage({
      type: 'sheetData',
      sheetName,
      data: dataRows,
      headers,
      totalRows,
      totalCols,
      rowStart,
      rowCount: actualRowCount,
    });

  } catch (error) {
    throw new Error(`Sheet Data Failed: ${error.message}`);
  }
}

function getSheetNames() {
  if (!currentWorkbook) {
    throw new Error('No workbook loaded');
  }

  self.postMessage({
    type: 'sheetNames',
    sheetNames: currentWorkbook.SheetNames,
  });
}
