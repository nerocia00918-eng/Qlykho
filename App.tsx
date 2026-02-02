import React, { useState, useCallback } from 'react';
import { SheetData } from './types';
import { Toolbar } from './components/Toolbar';
import { Spreadsheet } from './components/Spreadsheet';
import { AIPanel } from './components/AIPanel';
import { InventoryPanel } from './components/InventoryPanel';
import { generateEmptySheet } from './utils/excel';

const DEFAULT_ROWS = 50;
const DEFAULT_COLS = 26;

const App: React.FC = () => {
  const [data, setData] = useState<SheetData>(generateEmptySheet(DEFAULT_ROWS, DEFAULT_COLS));
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(true); // Default to TRUE as requested

  // Update a specific cell
  const handleCellChange = useCallback((row: number, col: number, value: string) => {
    setData((prevData) => {
      const newData = { ...prevData };
      if (!newData[row]) newData[row] = {};
      newData[row][col] = {
        value,
        computed: value, // Computing will happen in the Spreadsheet component or a dedicated hook
      };
      return newData;
    });
  }, []);

  const handleDataLoaded = useCallback((newData: SheetData) => {
    setData(newData);
  }, []);

  const toggleAI = useCallback(() => {
    setIsAIPanelOpen(prev => !prev);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-black overflow-hidden relative text-gray-200">
      {/* Header / Toolbar */}
      <div className="flex-none z-10 bg-[#0f0f0f] border-b border-gray-800 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-700 rounded flex items-center justify-center text-white font-bold text-lg shadow-[0_0_10px_rgba(21,128,61,0.5)]">
              S
            </div>
            <h1 className="text-xl font-semibold text-gray-100 tracking-tight">SmartSheets AI</h1>
          </div>
          <div className="text-sm text-gray-500 font-mono">
            {selectedCell 
              ? `Cell: ${String.fromCharCode(65 + selectedCell.col)}${selectedCell.row + 1}` 
              : 'Ready'}
          </div>
        </div>
        <Toolbar 
          onDataLoaded={handleDataLoaded} 
          currentData={data} 
          onToggleAI={toggleAI}
          isAIOpen={isAIPanelOpen}
          onOpenInventory={() => setIsInventoryOpen(true)}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 flex flex-col overflow-hidden relative">
           <Spreadsheet 
             data={data} 
             onCellChange={handleCellChange}
             selectedCell={selectedCell}
             onSelectCell={setSelectedCell}
           />
        </div>

        {/* AI Side Panel */}
        {isAIPanelOpen && (
          <div className="w-96 border-l border-gray-800 bg-[#121212] shadow-xl z-20 flex flex-col transition-all duration-300">
            <AIPanel data={data} onClose={() => setIsAIPanelOpen(false)} />
          </div>
        )}
      </div>

      {/* Full Screen Inventory Modal */}
      {isInventoryOpen && (
        <InventoryPanel onClose={() => setIsInventoryOpen(false)} />
      )}
    </div>
  );
};

export default App;