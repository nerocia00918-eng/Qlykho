import { SheetData } from '../types';

// Convert "A1" to {row: 0, col: 0}
export const parseCellRef = (ref: string): { row: number, col: number } | null => {
  const match = ref.match(/^([A-Z]+)([0-9]+)$/);
  if (!match) return null;

  const colStr = match[1];
  const rowStr = match[2];

  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  
  return {
    col: col - 1,
    row: parseInt(rowStr) - 1
  };
};

export const evaluateFormula = (formula: string, data: SheetData): string | number => {
  if (!formula.startsWith('=')) return formula;

  const expression = formula.substring(1).toUpperCase();

  try {
    // Regex to identify cell references like A1, Z99
    const parsedExpression = expression.replace(/[A-Z]+[0-9]+/g, (match) => {
      const coords = parseCellRef(match);
      if (!coords) return '0';
      
      const cell = data[coords.row]?.[coords.col];
      const val = cell?.computed ?? cell?.value ?? 0;
      
      // If empty string, treat as 0 for math
      if (val === '') return '0';
      // If it's a number, return it
      if (!isNaN(Number(val))) return String(val);
      // If string, wrap in quotes
      return `"${val}"`;
    });

    // Security warning: eval is used here for demonstration purposes to mimic spreadsheet behavior.
    // In a production app, use a proper parser library like `hot-formula-parser` or `mathjs`.
    // eslint-disable-next-line no-new-func
    const result = new Function(`return ${parsedExpression}`)();
    return result;
  } catch (e) {
    return "#ERROR";
  }
};
