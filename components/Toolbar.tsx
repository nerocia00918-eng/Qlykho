import React, { useRef } from 'react';
import { Sparkles, Calculator } from 'lucide-react';
import { SheetData } from '../types';
import { parseExcelFile } from '../utils/excel';

interface ToolbarProps {
  onDataLoaded: (data: SheetData) => void;
  currentData: SheetData;
  onToggleAI: () => void;
  isAIOpen: boolean;
  onOpenInventory?: () => void; // New prop
}

export const Toolbar: React.FC<ToolbarProps> = ({ onDataLoaded, currentData, onToggleAI, isAIOpen, onOpenInventory }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await parseExcelFile(file);
        onDataLoaded(data);
      } catch (error) {
        console.error("Error parsing file:", error);
        alert("Failed to load Excel file.");
      }
    }
  };

  return (
    <div className="flex items-center space-x-2 py-2 px-4 bg-[#0f0f0f] border-b border-gray-800 overflow-x-auto text-gray-300">
       <input 
        type="file" 
        accept=".xlsx, .xls, .csv" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileUpload}
      />
      
      <div className="flex items-center space-x-1 pr-4 border-r border-gray-700">
         <button 
           onClick={onOpenInventory}
           className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-orange-900/20 hover:text-orange-400 rounded transition-colors"
         >
           <Calculator className="w-4 h-4" />
           <span>Quản Lý Kho & Trưng Bày</span>
         </button>
      </div>

      <div className="flex-1"></div>

      <button 
        onClick={onToggleAI}
        className={`flex items-center space-x-2 px-3 py-1.5 text-sm font-medium rounded transition-colors border ${
          isAIOpen 
            ? 'bg-blue-900/30 text-blue-400 border-blue-800' 
            : 'text-gray-400 hover:bg-[#1a1a1a] border-transparent hover:border-gray-700'
        }`}
      >
        <Sparkles className={`w-4 h-4 ${isAIOpen ? 'fill-blue-400 text-blue-500' : 'text-purple-500'}`} />
        <span>AI Analyst</span>
      </button>
    </div>
  );
};