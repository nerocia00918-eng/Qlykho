import * as XLSX from 'xlsx';
import { SheetData, CellData } from '../types';

export const generateEmptySheet = (rows: number, cols: number): SheetData => {
  const data: SheetData = {};
  for (let r = 0; r < rows; r++) {
    data[r] = {};
    for (let c = 0; c < cols; c++) {
      data[r][c] = { value: '' };
    }
  }
  return data;
};

export const parseExcelFile = async (file: File): Promise<SheetData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON array of arrays
        const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: '' });
        
        const sheetData: SheetData = {};
        jsonData.forEach((row, rowIndex) => {
          sheetData[rowIndex] = {};
          row.forEach((cellValue: any, colIndex) => {
            const val = cellValue !== undefined && cellValue !== null ? String(cellValue) : '';
            sheetData[rowIndex][colIndex] = {
              value: val,
              computed: val
            };
          });
        });
        
        resolve(sheetData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

export const exportToExcel = (data: SheetData, filename: string = 'spreadsheet.xlsx') => {
  // Determine max rows and cols
  let maxRow = 0;
  let maxCol = 0;
  Object.keys(data).forEach(r => {
    const rowIdx = parseInt(r);
    if (rowIdx > maxRow) maxRow = rowIdx;
    Object.keys(data[rowIdx]).forEach(c => {
      const colIdx = parseInt(c);
      if (colIdx > maxCol) maxCol = colIdx;
    });
  });

  // Create 2D array
  const wsData: any[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    const row: any[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const cell = data[r]?.[c];
      row.push(cell ? cell.computed ?? cell.value : '');
    }
    wsData.push(row);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
};

export const convertSheetToCSV = (data: SheetData): string => {
  let csv = "";
  // Simple limiter to avoid sending massive tokens to Gemini for this demo
  // In production, we'd use a smarter windowing or summarization strategy
  const MAX_ROWS = 50; 
  const MAX_COLS = 15;

  let maxRow = 0;
  let maxCol = 0;
  
  // Find bounds
  Object.keys(data).forEach(key => {
    const r = parseInt(key);
    if (r > maxRow) maxRow = r;
    if (data[r]) {
        Object.keys(data[r]).forEach(k => {
            const c = parseInt(k);
            if (c > maxCol) maxCol = c;
        });
    }
  });

  maxRow = Math.min(maxRow, MAX_ROWS);
  maxCol = Math.min(maxCol, MAX_COLS);

  for (let r = 0; r <= maxRow; r++) {
    const rowValues = [];
    for (let c = 0; c <= maxCol; c++) {
       const cell = data[r]?.[c];
       let val = cell?.computed ?? cell?.value ?? "";
       // Escape quotes for CSV
       val = String(val).replace(/"/g, '""'); 
       rowValues.push(`"${val}"`);
    }
    csv += rowValues.join(",") + "\n";
  }
  return csv;
};
