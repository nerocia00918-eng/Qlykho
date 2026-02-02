import React, { useMemo } from 'react';
import { SheetData } from '../types';
import { evaluateFormula } from '../utils/formulas';

interface SpreadsheetProps {
  data: SheetData;
  onCellChange: (row: number, col: number, value: string) => void;
  selectedCell: { row: number; col: number } | null;
  onSelectCell: (cell: { row: number; col: number } | null) => void;
}

const ROWS = 50; // Visible rows for demo
const COLS = 26; // Visible cols for demo

// Helper to generate Column Headers (A, B, C...)
const getColLabel = (index: number) => {
  let label = '';
  let i = index;
  while (i >= 0) {
    label = String.fromCharCode((i % 26) + 65) + label;
    i = Math.floor(i / 26) - 1;
  }
  return label;
};

export const Spreadsheet: React.FC<SpreadsheetProps> = ({ 
  data, 
  onCellChange, 
  selectedCell, 
  onSelectCell 
}) => {

  // Memoize evaluated data so we don't re-run expensive eval on every render unless data changes
  const computedData = useMemo(() => {
    const computed: { [key: string]: string | number } = {};
    
    // Simple dependency-less pass (real sheets use topological sort)
    // We just iterate linearly for this prototype.
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = data[r]?.[c];
        if (cell) {
          const val = evaluateFormula(cell.value, data);
          computed[`${r},${c}`] = val;
        }
      }
    }
    return computed;
  }, [data]);

  return (
    <div className="overflow-auto w-full h-full bg-[#121212] select-none scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-[#0f0f0f]">
      <div 
        className="grid relative"
        style={{
          gridTemplateColumns: `50px repeat(${COLS}, 100px)`,
        }}
      >
        {/* Header Row */}
        <div className="sticky top-0 z-20 bg-[#1a1a1a] border-r border-b border-gray-700 h-8"></div>
        {Array.from({ length: COLS }).map((_, c) => (
          <div 
            key={`header-${c}`}
            className="sticky top-0 z-10 bg-[#1a1a1a] border-r border-b border-gray-700 h-8 flex items-center justify-center text-xs font-semibold text-gray-400 hover:bg-[#252525]"
          >
            {getColLabel(c)}
          </div>
        ))}

        {/* Rows */}
        {Array.from({ length: ROWS }).map((_, r) => (
          <React.Fragment key={`row-${r}`}>
            {/* Row Header */}
            <div className="sticky left-0 z-10 bg-[#1a1a1a] border-r border-b border-gray-700 w-[50px] flex items-center justify-center text-xs font-semibold text-gray-400 hover:bg-[#252525]">
              {r + 1}
            </div>

            {/* Cells */}
            {Array.from({ length: COLS }).map((_, c) => {
              const cellKey = `${r},${c}`;
              const rawValue = data[r]?.[c]?.value ?? '';
              const displayValue = computedData[cellKey] ?? rawValue;
              const isSelected = selectedCell?.row === r && selectedCell?.col === c;

              return (
                <div 
                  key={cellKey}
                  className={`relative border-r border-b border-gray-800 h-8 text-sm outline-none ${
                    isSelected ? 'border-2 border-green-500 z-10' : ''
                  }`}
                  onClick={() => onSelectCell({ row: r, col: c })}
                >
                  {isSelected ? (
                    <input
                      autoFocus
                      className="w-full h-full px-1 outline-none border-none bg-[#2a2a2a] text-white"
                      value={rawValue}
                      onChange={(e) => onCellChange(r, c, e.target.value)}
                      onBlur={() => { /* Optional: commit change logic */ }}
                    />
                  ) : (
                    <div className="w-full h-full px-1 flex items-center overflow-hidden whitespace-nowrap text-gray-300 hover:bg-[#1f1f1f] cursor-cell">
                      {displayValue}
                    </div>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};