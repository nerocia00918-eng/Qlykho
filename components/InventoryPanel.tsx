import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, UploadCloud, FileSpreadsheet, Calculator, 
  Download, RefreshCw, Filter, Search, 
  AlertTriangle, CheckCircle2, TrendingUp, PackageX,
  ArrowRight, Database, ShoppingCart, Monitor, Copy, History, Edit, Save, CalendarPlus,
  Settings, ArrowDownToLine, ArrowUpFromLine, Truck, ArrowUpDown, ChevronUp, ChevronDown, Clock,
  Hourglass, SearchCode, Eye, CopyCheck, ListPlus, CircleHelp, FileText, CalendarCheck, Trash2,
  BarChart4, ShieldCheck, MapPin, FileDown
} from 'lucide-react';
import { calculateRestockPlan } from '../utils/inventory';
import { RestockRecommendation, DisplayInfo, ABCClass } from '../types';
import * as XLSX from 'xlsx';
import { saveStateToDB, loadStateFromDB, clearStateInDB } from '../utils/indexedDB';

interface InventoryPanelProps {
  onClose: () => void;
}

// Helper types for sorting and filtering
type SortDirection = 'asc' | 'desc';
interface SortConfig {
  key: keyof RestockRecommendation | 'displayDays' | 'sourceStatus' | 'displayStatus' | 'sourcingQty' | 'otherStockQty';
  direction: SortDirection;
}

type QuickFilterType = 'ALL' | 'CRITICAL' | 'NORMAL_RESTOCK' | 'NEW' | 'DISCONTINUED' | 'DISPLAY_CHECK' | 'SLOW_MOVING' | 'PROMO_CHECK' | 'ABC_A' | 'PULL_LOGIC';

const STORAGE_KEY = 'SMARTSHEETS_DISPLAY_HISTORY';
const DB_STATE_KEY = 'LATEST_CALCULATION';

interface DateConflictItem {
    code: string;
    existingDate: string;
    newDate: string;
}

const StatCard = ({ title, value, subtext, icon: Icon, colorClass, onClick, active }: any) => (
  <div 
    onClick={onClick}
    className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm relative overflow-hidden group
      ${active 
        ? 'bg-[#1b1b1b] border-orange-500 ring-1 ring-orange-500' 
        : 'bg-[#1b1b1b] border-gray-800 hover:border-orange-500/50 hover:bg-[#252525]'}
    `}
  >
    <div className={`absolute top-0 right-0 w-16 h-16 transform translate-x-4 -translate-y-4 rounded-full opacity-10 ${colorClass}`}></div>
    <div className="flex items-start justify-between relative z-10">
      <div>
        <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider group-hover:text-orange-400 transition-colors">{title}</p>
        <h3 className="text-2xl font-bold text-white mt-1">{value}</h3>
        {subtext && <p className="text-[11px] text-gray-500 mt-1 font-medium">{subtext}</p>}
      </div>
      <div className={`p-2.5 rounded-lg bg-gray-900 border border-gray-700`}>
        <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
    </div>
  </div>
);

const FileUploadBox = ({ label, description, file, onChange, multiple = false }: any) => (
  <div className="mb-4">
    <label className="block text-sm font-semibold text-gray-300 mb-1">{label}</label>
    <p className="text-xs text-gray-500 mb-2">{description}</p>
    <div className="relative group">
      <div className={`
        border-2 border-dashed rounded-lg p-3 flex items-center justify-between transition-colors
        ${file || (multiple && file.length > 0) 
          ? 'border-orange-500 bg-orange-900/10' 
          : 'border-gray-700 hover:border-orange-500 bg-[#121212] hover:bg-[#1a1a1a]'}
      `}>
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className={`p-2 rounded-md ${file || (multiple && file.length > 0) ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
            {multiple ? <Database className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
          </div>
          <div className="flex flex-col truncate">
            <span className={`text-sm font-medium truncate ${file || (multiple && file.length > 0) ? 'text-orange-400' : 'text-gray-400'}`}>
              {multiple 
                ? (file.length > 0 ? `${file.length} files đã chọn` : 'Chọn các file kho...') 
                : (file ? file.name : 'Chọn file...')}
            </span>
            <span className="text-xs text-gray-600">
              {multiple ? 'Kho 64, 7BC, Q9...' : (file ? `${(file.size / 1024).toFixed(0)} KB` : 'Chưa có file')}
            </span>
          </div>
        </div>
        <input 
          type="file" 
          multiple={multiple} 
          accept=".xlsx, .xls, .csv"
          onChange={onChange} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
        />
      </div>
    </div>
  </div>
);

// --- Help Modal ---
const HelpModal = ({ onClose }: { onClose: () => void }) => (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-[#1b1b1b] border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-800 bg-[#121212] flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <CircleHelp className="w-5 h-5 text-orange-500" />
                    <h3 className="font-bold text-white text-lg">Hướng Dẫn Sử Dụng</h3>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-8 text-gray-300">
                <section>
                    <h4 className="text-orange-400 font-bold text-base mb-3 border-b border-gray-700 pb-2">Tính Năng Enterprise Mới</h4>
                    <ul className="list-disc list-inside text-sm space-y-2">
                        <li><strong>Lưu Phiên Làm Việc:</strong> Dữ liệu tính toán được lưu tự động. Bạn có thể F5 hoặc tắt trình duyệt mà không mất kết quả.</li>
                        <li><strong>Phân Tích ABC:</strong>
                            <ul className="pl-6 pt-1 space-y-1 text-xs text-gray-400">
                                <li><span className="text-green-400 font-bold">Hạng A:</span> Sản phẩm chủ lực (Top 80% doanh thu). Hệ thống sẽ tự động tăng mức dự trữ an toàn.</li>
                                <li><span className="text-yellow-400 font-bold">Hạng B:</span> Sản phẩm trung bình.</li>
                                <li><span className="text-red-400 font-bold">Hạng C:</span> Sản phẩm bán chậm (Top 5% doanh thu cuối).</li>
                            </ul>
                        </li>
                        <li><strong>Backup Dữ Liệu Trưng Bày:</strong> Sử dụng nút "Backup Trưng Bày" để tải về file Excel chứa thông tin ngày tháng và tình trạng hàng trưng bày mà bạn đã nhập.</li>
                    </ul>
                </section>
            </div>
            <div className="p-4 bg-[#121212] border-t border-gray-800 text-center">
                <button onClick={onClose} className="px-6 py-2 bg-orange-500 text-black font-bold rounded-lg hover:bg-orange-600 transition-colors">Đã Hiểu</button>
            </div>
        </div>
    </div>
);

// --- Modals (Reused) ---
const ZeroStockConfirmModal = ({ items, onConfirm, onCancel }: { items: string[], onConfirm: (saveHistory: boolean) => void, onCancel: () => void }) => (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in zoom-in duration-200">
        <div className="bg-[#1b1b1b] border border-orange-500 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-800 bg-black flex justify-between items-center shrink-0">
                 <h3 className="font-bold text-white flex items-center"><AlertTriangle className="w-5 h-5 text-orange-500 mr-2"/> Xác nhận hàng không tồn</h3>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
                <p className="text-gray-300 text-sm mb-3">Phát hiện <span className="text-orange-500 font-bold">{items.length}</span> sản phẩm không có tồn kho (TBA = 0).</p>
                <div className="bg-[#121212] border border-gray-800 rounded-lg p-3 max-h-60 overflow-y-auto">
                    <ul className="space-y-1.5">
                        {items.map(code => (
                            <li key={code} className="text-xs text-gray-400 flex items-center space-x-2 border-b border-gray-800/50 pb-1 last:border-0 last:pb-0">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                <span className="font-mono text-gray-200 font-semibold">{code}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <div className="px-6 py-4 bg-black border-t border-gray-800 flex justify-end space-x-3 shrink-0">
                <button onClick={() => onConfirm(false)} className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors">Bỏ qua</button>
                <button onClick={() => onConfirm(true)} className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-orange-900/20">Ghi nhận</button>
            </div>
        </div>
    </div>
);

const DateConflictModal = ({ items, onOverwrite, onKeepOld }: { items: DateConflictItem[], onOverwrite: () => void, onKeepOld: () => void }) => (
     <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in zoom-in duration-200">
        <div className="bg-[#1b1b1b] border border-red-500 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-800 bg-black flex justify-between items-center shrink-0">
                <h3 className="font-bold text-white text-red-500 flex items-center"><AlertTriangle className="w-5 h-5 mr-2" /> Xung đột ngày cập nhật</h3>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
                <p className="text-gray-300 mb-4 text-sm">Hệ thống phát hiện dữ liệu ngày mới hơn cho các sản phẩm sau. Bạn có muốn ghi đè?</p>
                <div className="bg-[#121212] border border-gray-800 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-gray-800 text-gray-400 font-bold">
                            <tr>
                                <th className="px-4 py-2">Mã Sản Phẩm</th>
                                <th className="px-4 py-2 text-gray-500">Ngày Cũ (Hiện Tại)</th>
                                <th className="px-4 py-2 text-green-500">Ngày Mới (Cập Nhật)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-800/50">
                                    <td className="px-4 py-2 font-bold text-orange-400 font-mono">{item.code}</td>
                                    <td className="px-4 py-2 text-gray-500">{item.existingDate}</td>
                                    <td className="px-4 py-2 text-green-400 font-bold">{item.newDate}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="px-6 py-4 bg-black border-t border-gray-800 flex justify-end space-x-3 shrink-0">
                <button onClick={onKeepOld} className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors">Giữ ngày cũ</button>
                <button onClick={onOverwrite} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-red-900/20">Ghi đè tất cả</button>
            </div>
        </div>
    </div>
);

const EditDisplayModal = ({ item, onClose, onSave }: { item: RestockRecommendation, onClose: () => void, onSave: (date: string, condition: string) => void }) => {
    const [startDate, setStartDate] = useState(item.displayInfo?.startDate || new Date().toISOString().split('T')[0]);
    const [condition, setCondition] = useState<string>(item.displayInfo?.condition || 'New');
    const [isCustom, setIsCustom] = useState(false);
    const options = [{ val: 'New', label: 'Mới (New)' }, { val: 'Scratched', label: 'Trầy xước' }, { val: 'Used', label: 'Đã dùng / Cũ' }];
    const isPredefined = options.some(o => o.val === condition);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in zoom-in duration-200">
            <div className="bg-[#1b1b1b] border border-orange-500 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 bg-black flex justify-between items-center">
                    <h3 className="font-bold text-white">Cập nhật Trưng Bày</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Sản phẩm</label>
                        <div className="text-sm font-semibold text-orange-500">{item.code}</div>
                        <div className="text-sm text-gray-400 truncate">{item.name}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Ngày Xuống Trưng</label>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-gray-700 bg-black text-white rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tình trạng</label>
                            <div className="relative">
                                {isCustom || !isPredefined ? (
                                    <div className="flex space-x-1">
                                         <input type="text" value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="Nhập..." className="w-full border border-gray-700 bg-black text-white rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none" autoFocus />
                                        <button onClick={() => { setIsCustom(false); setCondition('New'); }} className="px-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700"><ListPlus className="w-4 h-4" /></button>
                                    </div>
                                ) : (
                                    <select value={condition} onChange={(e) => { if (e.target.value === 'CUSTOM') setIsCustom(true); else setCondition(e.target.value); }} className="w-full border border-gray-700 bg-black text-white rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none appearance-none">
                                        {options.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                                        <option value="CUSTOM">+ Khác (Nhập tay)</option>
                                    </select>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 bg-black border-t border-gray-800 flex justify-end space-x-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 rounded-lg transition-colors">Hủy</button>
                    <button onClick={() => onSave(startDate, condition)} className="px-4 py-2 text-sm bg-orange-500 text-black font-bold rounded-lg hover:bg-orange-600 transition-colors shadow-sm">Lưu Cập Nhật</button>
                </div>
            </div>
        </div>
    );
};

export const InventoryPanel: React.FC<InventoryPanelProps> = ({ onClose }) => {
  const [btFile, setBtFile] = useState<File | null>(null);
  const [tkFile, setTkFile] = useState<File | null>(null);
  const [displayFile, setDisplayFile] = useState<File | null>(null);
  const [slowFile, setSlowFile] = useState<File | null>(null);
  const [whFiles, setWhFiles] = useState<File[]>([]);
  const [rawResults, setRawResults] = useState<RestockRecommendation[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isDataRestored, setIsDataRestored] = useState(false);
  
  const [promoInput, setPromoInput] = useState('');
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);
  const [zeroStockItems, setZeroStockItems] = useState<string[]>([]);
  const [conflictItems, setConflictItems] = useState<DateConflictItem[]>([]);
  const [pendingBulkUpdates, setPendingBulkUpdates] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<RestockRecommendation | null>(null);

  const [searchText, setSearchText] = useState('');
  const [searchMode, setSearchMode] = useState<'CONTAINS' | 'STARTS_WITH'>('CONTAINS');
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [filterBT, setFilterBT] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL'); 
  
  // FILTERS
  const [filterTBA, setFilterTBA] = useState<string>('ALL');
  const [filterABC, setFilterABC] = useState<string>('ALL');
  const [filterCondition, setFilterCondition] = useState<string>('ALL');
  const [filterOtherStock, setFilterOtherStock] = useState<string>('ALL'); // NEW: For "Tồn Kho Khác" / "Tồn Chi Nhánh"

  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // --- PERSISTENCE LOGIC ---
  useEffect(() => {
    // Restore data on mount
    const restore = async () => {
        const data = await loadStateFromDB(DB_STATE_KEY);
        if (data && Array.isArray(data) && data.length > 0) {
            // Apply localStorage display info overrides on top of DB data
            const merged = loadSavedDisplayData(data);
            setRawResults(merged);
            setIsDataRestored(true);
            setQuickFilter('ALL'); 
        }
    };
    restore();
  }, []);

  const clearCache = async () => {
      await clearStateInDB(DB_STATE_KEY);
      setRawResults([]);
      setIsDataRestored(false);
      alert("Đã xóa dữ liệu đã lưu.");
  };

  const saveDisplayData = (data: RestockRecommendation[]) => {
      try {
          const displayMap: Record<string, {startDate: string, condition: string}> = {};
          const existingStr = localStorage.getItem(STORAGE_KEY);
          if (existingStr) {
              Object.assign(displayMap, JSON.parse(existingStr));
          }
          data.forEach(r => { if (r.displayInfo) displayMap[r.code] = r.displayInfo; });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(displayMap));
          
          // Also update the main DB state
          saveStateToDB(DB_STATE_KEY, data);
      } catch (e) { console.error("Failed to auto-save", e); }
  };

  const loadSavedDisplayData = (freshData: RestockRecommendation[]): RestockRecommendation[] => {
      try {
          const savedStr = localStorage.getItem(STORAGE_KEY);
          if (!savedStr) return freshData;
          const savedMap = JSON.parse(savedStr);
          return freshData.map(r => savedMap[r.code] ? { ...r, displayInfo: savedMap[r.code] } : r);
      } catch (e) { return freshData; }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'BT' | 'TK' | 'WH' | 'DISP' | 'SLOW') => {
    if (!e.target.files?.length) return;
    if (type === 'BT') setBtFile(e.target.files[0]);
    else if (type === 'TK') setTkFile(e.target.files[0]);
    else if (type === 'WH') setWhFiles(Array.from(e.target.files));
    else if (type === 'DISP') setDisplayFile(e.target.files[0]);
    else if (type === 'SLOW') setSlowFile(e.target.files[0]);
  };

  const handleCalculate = async () => {
    if (!btFile || !tkFile) { alert("Vui lòng tải lên đủ File Tồn Kho và File Bán Hàng."); return; }
    setIsCalculating(true);
    setTimeout(async () => {
        try {
            const data = await calculateRestockPlan(btFile, tkFile, whFiles, displayFile || undefined, slowFile || undefined);
            const mergedData = loadSavedDisplayData(data);
            setRawResults(mergedData);
            setQuickFilter('CRITICAL'); 
            
            // Save to IndexedDB
            await saveStateToDB(DB_STATE_KEY, mergedData);
            setIsDataRestored(true);

        } catch (error) { console.error(error); alert("Lỗi xử lý file."); } finally { setIsCalculating(false); }
    }, 100);
  };

  const handleUpdateDisplay = (startDate: string, condition: string) => {
      if (!editingItem) return;
      if (editingItem.displayInfo?.startDate) {
          if (new Date(editingItem.displayInfo.startDate) > new Date(startDate)) {
              if (!window.confirm(`CẢNH BÁO: Ngày cũ hơn hiện tại. Ghi đè?`)) return;
          }
      }
      const newData = rawResults.map(item => item.code === editingItem.code ? { ...item, displayInfo: { startDate, condition } } : item);
      setRawResults(newData);
      saveDisplayData(newData);
      setEditingItem(null);
  };

  const handleBulkUpdateClick = () => {
      const codes = promoInput.split(/[\n\t,;]+/).map(s => s.trim().toLowerCase()).filter(s => s);
      if (codes.length === 0) return;
      const foundItems = rawResults.filter(r => codes.some(c => r.code.toLowerCase().includes(c)));
      
      const conflicts: DateConflictItem[] = [];
      const newDateObj = new Date(bulkDate);
      foundItems.forEach(item => {
          if (item.displayInfo?.startDate && new Date(item.displayInfo.startDate) > newDateObj) {
              conflicts.push({ code: item.code, existingDate: item.displayInfo.startDate, newDate: bulkDate });
          }
      });

      if (conflicts.length > 0) {
          setConflictItems(conflicts);
          setPendingBulkUpdates(foundItems.map(r => r.code));
          return;
      }
      const zeroStock = foundItems.filter(r => r.currentStockTBA === 0).map(r => r.code);
      const hasStockCodes = foundItems.filter(r => r.currentStockTBA > 0).map(r => r.code);
      processZeroStockLogic(zeroStock, hasStockCodes);
  };

  const processZeroStockLogic = (zeroStock: string[], hasStockCodes: string[]) => {
      if (zeroStock.length > 0) {
          setZeroStockItems(zeroStock);
          finalizeBulkUpdate(hasStockCodes); 
      } else {
          finalizeBulkUpdate(hasStockCodes);
          alert(`Đã cập nhật ${hasStockCodes.length} sản phẩm thành công.`);
      }
  };

  const handleConflictResolution = (overwrite: boolean) => {
      let codesToProcess = [...pendingBulkUpdates];
      if (!overwrite) {
          const conflictCodes = conflictItems.map(c => c.code);
          codesToProcess = codesToProcess.filter(c => !conflictCodes.includes(c));
      }
      const relevantItems = rawResults.filter(r => codesToProcess.includes(r.code));
      const zeroStock = relevantItems.filter(r => r.currentStockTBA === 0).map(r => r.code);
      const hasStock = relevantItems.filter(r => r.currentStockTBA > 0).map(r => r.code);
      setConflictItems([]); 
      setPendingBulkUpdates([]);
      processZeroStockLogic(zeroStock, hasStock);
  };

  const finalizeBulkUpdate = (codesToUpdate: string[]) => {
      if (codesToUpdate.length === 0) return;
      const newData = rawResults.map(item => codesToUpdate.includes(item.code) ? { ...item, displayInfo: { startDate: bulkDate, condition: 'New' } } : item);
      setRawResults(newData);
      saveDisplayData(newData);
  };

  const handleZeroStockConfirm = (saveHistory: boolean) => {
      if (saveHistory) { finalizeBulkUpdate(zeroStockItems); alert(`Đã ghi nhận lịch sử.`); }
      setZeroStockItems([]);
  };

  const handleSort = (key: SortConfig['key']) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleExport = () => {
    if (filteredResults.length === 0) return;
    const exportData = filteredResults.map(r => ({
        'Mã SP': r.code,
        'Tên SP': r.name,
        'Phân Loại ABC': r.abcClass,
        'Tồn BT': r.currentStockBT,
        'Tồn TBA': r.currentStockTBA,
        'Bán 30N': r.sold30Days,
        'Dự Báo Cần Nhập': r.needsRestock,
        'Điều Chỉnh An Toàn': r.safetyStockAdjustment,
        'Nguồn': r.sourcing.map(s => `${s.sourceWarehouse} (${s.quantity})`).join(', ')
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "Export");
    XLSX.writeFile(wb, "Inventory_Plan_ABC.xlsx");
  };
  
  const handleExportDisplayData = () => {
      const displayItems = rawResults.filter(r => r.displayInfo).map(r => ({
          'Mã SP': r.code, 'Ngày': r.displayInfo?.startDate, 'TT': r.displayInfo?.condition
      }));
      if (displayItems.length === 0) {
          alert("Chưa có dữ liệu trưng bày nào để xuất.");
          return;
      }
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(displayItems);
      XLSX.utils.book_append_sheet(wb, ws, "Display");
      XLSX.writeFile(wb, "Display_Data_Backup.xlsx");
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      // Removed alert to be less intrusive
  };
  
  const handleCopyPromoDisplayed = () => {
      const inputCodes = promoInput.split(/[\n\t,;]+/).map(s => s.trim().toLowerCase()).filter(s => s);
      if (inputCodes.length === 0) { alert("Chưa nhập danh sách mã."); return; }
      
      // CREATE MAP FOR EXACT LOOKUP
      const codeMap = new Map<string, RestockRecommendation>();
      rawResults.forEach(r => codeMap.set(r.code.toLowerCase(), r));

      const foundItems: RestockRecommendation[] = [];
      const missingCodes: string[] = [];

      inputCodes.forEach(c => {
          const item = codeMap.get(c);
          if (item) foundItems.push(item);
          else missingCodes.push(c);
      });
      
      // Criteria: Has stock in display warehouse (TBA > 0)
      const hits = foundItems.filter(r => r.currentStockTBA > 0);
      
      if (hits.length === 0) { 
          alert(`Đã tìm thấy ${foundItems.length} mã trong hệ thống, nhưng KHÔNG CÓ mã nào có tồn trưng bày (TBA > 0).`); 
          return; 
      }
      
      copyToClipboard(hits.map(r => r.code).join('\n'));
      
      let msg = `Đã copy ${hits.length} mã ĐANG TRƯNG BÀY (TBA > 0).\n`;
      msg += `- Tổng nhập: ${inputCodes.length}\n`;
      msg += `- Tìm thấy trong file: ${foundItems.length}\n`;
      msg += `- Đạt điều kiện: ${hits.length}`;
      if (missingCodes.length > 0) {
          msg += `\n- Không tìm thấy (có thể do sai mã): ${missingCodes.length}`;
      }
      alert(msg);
  };

  const handleCopyPromoOpportunity = () => {
      const inputCodes = promoInput.split(/[\n\t,;]+/).map(s => s.trim().toLowerCase()).filter(s => s);
      if (inputCodes.length === 0) { alert("Chưa nhập danh sách mã."); return; }
      
      // CREATE MAP FOR EXACT LOOKUP
      const codeMap = new Map<string, RestockRecommendation>();
      rawResults.forEach(r => codeMap.set(r.code.toLowerCase(), r));

      const foundItems: RestockRecommendation[] = [];
      const missingCodes: string[] = [];

      inputCodes.forEach(c => {
          const item = codeMap.get(c);
          if (item) foundItems.push(item);
          else missingCodes.push(c);
      });

      // Criteria: Zero stock in display warehouse
      const hits = foundItems.filter(r => r.currentStockTBA === 0);
      
      if (hits.length === 0) { 
          alert(`Tìm thấy ${foundItems.length} mã, nhưng tất cả đều ĐÃ CÓ hàng trưng bày (TBA > 0).`); 
          return; 
      }
      
      copyToClipboard(hits.map(r => r.code).join('\n'));
      let msg = `Đã copy ${hits.length} mã CHƯA TRƯNG BÀY (TBA = 0).\n`;
      msg += `- Tổng nhập: ${inputCodes.length}\n`;
      msg += `- Tìm thấy trong file: ${foundItems.length}\n`;
      msg += `- Đạt điều kiện: ${hits.length}`;
      if (missingCodes.length > 0) {
          msg += `\n- Không tìm thấy (có thể do sai mã): ${missingCodes.length}`;
      }
      alert(msg);
  };

  const availableWarehouses = useMemo(() => {
    const whSet = new Set<string>();
    rawResults.forEach(r => r.sourcing.forEach(s => whSet.add(s.sourceWarehouse)));
    rawResults.forEach(r => r.allWarehousesStock.forEach(s => whSet.add(s.name))); // Gather from all stocks too
    return Array.from(whSet).sort();
  }, [rawResults]);

  const getDaysDisplayed = (startDateStr?: string) => {
      if (!startDateStr) return 0;
      return Math.ceil(Math.abs(new Date().getTime() - new Date(startDateStr).getTime()) / (86400000)); 
  };

  const stats = useMemo(() => {
    return {
      critical: rawResults.filter(r => !r.isDiscontinued && !r.isNewArrival && r.urgency === 'Critical').length,
      normalRestock: rawResults.filter(r => !r.isDiscontinued && !r.isNewArrival && r.urgency === 'Normal').length,
      newArrivals: rawResults.filter(r => r.isNewArrival).length,
      discontinued: rawResults.filter(r => r.isDiscontinued).length,
      displayIssues: rawResults.filter(r => (r.shouldDisplay || r.isTbaSolo || (r.displayInfo?.condition === 'New' && getDaysDisplayed(r.displayInfo.startDate) > 20))).length,
      abcA: rawResults.filter(r => r.abcClass === 'A').length,
      pullLogic: rawResults.filter(r => r.pullReason && r.pullReason !== '').length,
      total: rawResults.length
    };
  }, [rawResults]);

  const filteredResults = useMemo(() => {
      let result = [...rawResults];
      
      // 1. Text Search
      const text = searchText.toLowerCase().trim();
      if (text) {
          if (searchMode === 'STARTS_WITH') result = result.filter(r => r.code.toLowerCase().startsWith(text));
          else result = result.filter(r => r.code.toLowerCase().includes(text) || r.name.toLowerCase().includes(text));
      }

      // 2. Promo Input Check (Special Case)
      if (quickFilter === 'PROMO_CHECK') {
        const codes = promoInput.split(/[\n,;]+/).map(s => s.trim().toLowerCase()).filter(s => s);
        if (codes.length > 0) result = result.filter(r => codes.some(c => r.code.toLowerCase().includes(c)));
      }

      // 3. Header Filters (Applied Globally)
      if (filterBT !== 'ALL') {
             if (filterBT === '0') result = result.filter(r => r.currentStockBT === 0);
             else if (filterBT === '>0') result = result.filter(r => r.currentStockBT > 0);
             else if (filterBT === '<5') result = result.filter(r => r.currentStockBT > 0 && r.currentStockBT < 5);
      }
      // NEW: Filter TBA
      if (filterTBA !== 'ALL') {
          if (filterTBA === '0') result = result.filter(r => r.currentStockTBA === 0);
          else if (filterTBA === '>0') result = result.filter(r => r.currentStockTBA > 0);
      }
      
      // NEW: Filter Other Stock / Branch Stock
      if (filterOtherStock !== 'ALL') {
          result = result.filter(r => {
             const totalOther = r.allWarehousesStock.reduce((sum, w) => sum + w.stock, 0);
             if (filterOtherStock === '0') return totalOther === 0;
             if (filterOtherStock === '>0') return totalOther > 0;
             return true;
          });
      }

      if (selectedSource !== 'ALL') {
          // Filter if ANY source warehouse matches selection OR if using allWarehousesStock for display logic
          result = result.filter(r => 
              r.sourcing.some(s => s.sourceWarehouse === selectedSource) || 
              (quickFilter === 'DISPLAY_CHECK' && r.allWarehousesStock.some(s => s.name === selectedSource)) ||
               // Ensure filtering works for PROMO_CHECK logic if sourcing matches
              (quickFilter === 'PROMO_CHECK' && r.sourcing.some(s => s.sourceWarehouse === selectedSource))
          );
      }
      if (filterStatus !== 'ALL') {
          // Reuse status for header filter
          if (filterStatus === 'Critical') result = result.filter(r => r.urgency === 'Critical');
          else if (filterStatus === 'Normal') result = result.filter(r => r.urgency === 'Normal');
          else if (filterStatus === 'Review') result = result.filter(r => r.status === 'Review');
      }
      if (filterABC !== 'ALL') {
          if (filterABC === 'A') result = result.filter(r => r.abcClass === 'A');
          else if (filterABC === 'B') result = result.filter(r => r.abcClass === 'B');
          else if (filterABC === 'C') result = result.filter(r => r.abcClass === 'C');
      }
      if (filterCondition !== 'ALL') {
          result = result.filter(r => {
             if (!r.displayInfo) return false;
             if (filterCondition === 'New') return r.displayInfo.condition === 'New';
             if (filterCondition === 'Used') return r.displayInfo.condition === 'Used' || r.displayInfo.condition.toLowerCase().includes('cũ');
             if (filterCondition === 'Scratched') return r.displayInfo.condition === 'Scratched' || r.displayInfo.condition.toLowerCase().includes('trầy');
             return true;
          });
      }

      // 4. Quick Filters (Tabs)
      switch (quickFilter) {
            case 'CRITICAL': result = result.filter(r => !r.isDiscontinued && !r.isNewArrival && r.urgency === 'Critical'); break;
            case 'NORMAL_RESTOCK': result = result.filter(r => !r.isDiscontinued && !r.isNewArrival && r.urgency === 'Normal'); break;
            case 'NEW': result = result.filter(r => r.isNewArrival); break;
            case 'DISCONTINUED': result = result.filter(r => r.isDiscontinued); break;
            case 'SLOW_MOVING': result = result.filter(r => !!r.slowStockInfo); break;
            case 'ABC_A': result = result.filter(r => r.abcClass === 'A'); break;
            case 'PULL_LOGIC': result = result.filter(r => r.pullReason && r.pullReason !== ''); break;
            case 'DISPLAY_CHECK':
                // Display check specific logic handled in filter loop? 
                // Just keeping relevant items
                result = result.filter(r => {
                     const daysDisp = getDaysDisplayed(r.displayInfo?.startDate);
                     const isReturnNeeded = r.currentStockTBA > 0 && daysDisp > 20 && r.displayInfo?.condition === 'New';
                     // Show item if it has TBA stock OR needs display OR has display info
                     return r.currentStockTBA > 0 || r.shouldDisplay || r.isTbaSolo || r.tbaMaxStock > 0 || !!r.displayInfo;
                });
                break;
      }

      // 5. Sorting
      if (sortConfig) {
          result.sort((a, b) => {
              // Handle Derived Sort Keys first
              if (sortConfig.key === 'displayDays') {
                  const dayA = getDaysDisplayed(a.displayInfo?.startDate);
                  const dayB = getDaysDisplayed(b.displayInfo?.startDate);
                  return sortConfig.direction === 'asc' ? dayA - dayB : dayB - dayA;
              }
              if (sortConfig.key === 'sourcingQty') {
                  const sA = a.sourcing.reduce((acc, s) => acc + s.quantity, 0);
                  const sB = b.sourcing.reduce((acc, s) => acc + s.quantity, 0);
                  return sortConfig.direction === 'asc' ? sA - sB : sB - sA;
              }
              if (sortConfig.key === 'otherStockQty') {
                  const sA = a.allWarehousesStock.reduce((acc, s) => acc + s.stock, 0);
                  const sB = b.allWarehousesStock.reduce((acc, s) => acc + s.stock, 0);
                  return sortConfig.direction === 'asc' ? sA - sB : sB - sA;
              }

              // Normal Keys
              let aValue: any = a[sortConfig.key as keyof RestockRecommendation];
              let bValue: any = b[sortConfig.key as keyof RestockRecommendation];

              if (sortConfig.key === 'code') return sortConfig.direction === 'asc' ? a.code.localeCompare(b.code) : b.code.localeCompare(a.code);
              
              if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
              if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
              return 0;
          });
      }
      return result;
  }, [rawResults, searchText, searchMode, quickFilter, selectedSource, filterBT, filterStatus, sortConfig, promoInput, filterABC, filterCondition, filterTBA, filterOtherStock]);

  return (
    <div className="absolute inset-0 bg-black text-gray-200 z-50 flex flex-col font-sans">
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {editingItem && <EditDisplayModal item={editingItem} onClose={() => setEditingItem(null)} onSave={handleUpdateDisplay}/>}
      {zeroStockItems.length > 0 && <ZeroStockConfirmModal items={zeroStockItems} onConfirm={handleZeroStockConfirm} onCancel={() => setZeroStockItems([])} />}
      {conflictItems.length > 0 && <DateConflictModal items={conflictItems} onOverwrite={() => handleConflictResolution(true)} onKeepOld={() => handleConflictResolution(false)} />}

      <div className="bg-black border-b border-orange-500 px-6 py-4 flex items-center justify-between shadow-lg z-20">
         <div className="flex items-center space-x-3">
            <div className="flex items-center tracking-tighter text-2xl font-bold select-none">
              <span className="text-white mr-1">Inventory&Display</span>
              <span className="bg-orange-500 text-black px-2 rounded-md pb-1 pt-0.5">hub</span>
            </div>
            <button onClick={() => setShowHelp(true)} className="ml-4 text-xs flex items-center space-x-1 text-gray-500 hover:text-orange-400 transition-colors border border-gray-800 hover:border-orange-500 rounded-full px-2 py-1">
                <CircleHelp className="w-4 h-4" /> <span>Hướng dẫn</span>
            </button>
            {isDataRestored && (
                <div className="ml-4 flex items-center space-x-2 text-xs text-green-500 bg-green-900/20 px-2 py-1 rounded border border-green-900">
                    <History className="w-3 h-3" />
                    <span>Đã khôi phục phiên làm việc</span>
                </div>
            )}
        </div>
        <div className="flex items-center space-x-2">
             {isDataRestored && (
                <button onClick={clearCache} className="text-xs text-red-500 hover:text-red-400 mr-2 flex items-center"><Trash2 className="w-3 h-3 mr-1" /> Xóa Cache</button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <div className="w-80 bg-[#1b1b1b] border-r border-orange-500/30 flex flex-col z-10 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
            <div className="p-6 flex-1 overflow-y-auto">
                <h3 className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-6">1. Nhập Dữ Liệu Nguồn</h3>
                <FileUploadBox label="File Kho Chính" description="File tồn kho chi nhánh (Cột B=Mã, E=Tồn)." file={btFile} onChange={(e: any) => handleFileChange(e, 'BT')} />
                <FileUploadBox label="File Thống Kê Bán" description="Excel bán hàng 30 ngày." file={tkFile} onChange={(e: any) => handleFileChange(e, 'TK')} />
                <FileUploadBox label="File Tồn Lâu (Tùy chọn)" description="Excel: A(Mã), C(Tồn), G(Tháng)." file={slowFile} onChange={(e: any) => handleFileChange(e, 'SLOW')} />
                <FileUploadBox label="Theo Dõi Trưng Bày" description="Excel: A(Mã), B(Ngày), C(TT)." file={displayFile} onChange={(e: any) => handleFileChange(e, 'DISP')} />
                <div className="border-t border-gray-700 my-4"></div>
                <FileUploadBox label="Kho Khác / Chi Nhánh" description="Chọn nhiều file (TBA, 64, 7BC...)." file={whFiles} multiple={true} onChange={(e: any) => handleFileChange(e, 'WH')} />

                <div className="mt-6 bg-[#2a2a2a] p-4 rounded-xl border border-gray-700 relative">
                    <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <div className="flex items-center"><SearchCode className="w-4 h-4 mr-1.5 text-orange-500" /> 2. Tra Cứu List</div>
                        {promoInput.length > 0 && <button onClick={() => setPromoInput('')} className="text-gray-500 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </h3>
                    <textarea className="w-full border border-gray-600 rounded-lg p-3 text-xs h-24 bg-[#121212] text-white placeholder-gray-600" placeholder="Paste mã..." value={promoInput} onChange={(e) => setPromoInput(e.target.value)}></textarea>
                    
                    <div className="mt-2 pt-2 border-t border-gray-700">
                        <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Cập nhật ngày trưng:</label>
                        <div className="flex space-x-2">
                             <input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} className="flex-1 border border-gray-600 rounded-lg px-2 py-1.5 text-xs bg-[#121212] text-white" />
                            <button onClick={handleBulkUpdateClick} disabled={!promoInput.trim()} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center disabled:opacity-50">
                                <CalendarCheck className="w-3.5 h-3.5 mr-1" /> Áp dụng
                            </button>
                        </div>
                    </div>
                    <button onClick={() => setQuickFilter('PROMO_CHECK')} disabled={!promoInput.trim()} className="mt-3 w-full bg-orange-500 text-black py-2 rounded-lg text-xs font-bold hover:bg-orange-600 flex items-center justify-center shadow-sm">
                        <Eye className="w-3 h-3 mr-1.5" /> Kiểm Tra Ngay
                    </button>
                </div>
            </div>
            <div className="p-6 border-t border-gray-700 bg-[#121212]">
                <button onClick={handleCalculate} disabled={isCalculating || !btFile || !tkFile} className="w-full bg-orange-500 text-black py-3.5 rounded-xl font-bold hover:bg-orange-600 shadow-lg shadow-orange-900/20 disabled:opacity-50 flex items-center justify-center space-x-2">
                    {isCalculating ? <RefreshCw className="w-5 h-5 animate-spin"/> : <Calculator className="w-5 h-5" />} <span>{isCalculating ? 'Đang Phân Tích...' : 'Tính Toán Ngay'}</span>
                </button>
            </div>
        </div>

        {/* MAIN DASHBOARD */}
        <div className="flex-1 flex flex-col bg-black overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0a0a0a] to-[#121212] pointer-events-none"></div>
            <div className="relative z-10 flex flex-col h-full">
            {rawResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <div className="w-24 h-24 bg-[#1b1b1b] border border-gray-800 rounded-full flex items-center justify-center shadow-sm mb-6"><UploadCloud className="w-10 h-10 text-orange-500" /></div>
                    <h3 className="text-lg font-semibold text-gray-300">Chưa có dữ liệu</h3>
                    <p className="max-w-md text-center mt-2 text-sm text-gray-600">Vui lòng nhập các file Excel ở cột bên trái và nhấn "Tính Toán Ngay".</p>
                </div>
            ) : (
                <>
                    {/* Stat Cards */}
                    <div className="p-6 grid grid-cols-8 gap-2">
                        <StatCard title="Nguy Cấp" value={stats.critical} subtext="Tồn 0 / Thấp" icon={AlertTriangle} colorClass="bg-red-600 text-red-500" active={quickFilter === 'CRITICAL'} onClick={() => setQuickFilter('CRITICAL')} />
                        <StatCard title="Lệnh Kéo Hàng" value={stats.pullLogic} subtext="Lực bán cao" icon={Truck} colorClass="bg-blue-600 text-blue-500" active={quickFilter === 'PULL_LOGIC'} onClick={() => setQuickFilter('PULL_LOGIC')} />
                        <StatCard title="Cần Bổ Sung" value={stats.normalRestock} subtext="Kéo hàng" icon={ShoppingCart} colorClass="bg-yellow-500 text-yellow-500" active={quickFilter === 'NORMAL_RESTOCK'} onClick={() => setQuickFilter('NORMAL_RESTOCK')} />
                        <StatCard title="Nhóm A - Chủ Lực" value={stats.abcA} subtext="Top 80% Doanh Thu" icon={BarChart4} colorClass="bg-green-600 text-green-500" active={quickFilter === 'ABC_A'} onClick={() => setQuickFilter('ABC_A')} />
                        <StatCard title="Hàng Mới" value={stats.newArrivals} subtext="Chưa có kho này" icon={CheckCircle2} colorClass="bg-blue-500 text-blue-500" active={quickFilter === 'NEW'} onClick={() => setQuickFilter('NEW')} />
                        <StatCard title="QL Trưng Bày" value={stats.displayIssues} subtext="Cần trưng/Trả" icon={Monitor} colorClass="bg-purple-500 text-purple-500" active={quickFilter === 'DISPLAY_CHECK'} onClick={() => setQuickFilter('DISPLAY_CHECK')} />
                        <StatCard title="Tồn Lâu" value={stats.slowMoving} subtext="Chậm luân chuyển" icon={Hourglass} colorClass="bg-orange-500 text-orange-500" active={quickFilter === 'SLOW_MOVING'} onClick={() => setQuickFilter('SLOW_MOVING')} />
                        <StatCard title="Tổng Mã" value={stats.total} subtext="Tất cả" icon={Database} colorClass="bg-white text-white" active={quickFilter === 'ALL'} onClick={() => setQuickFilter('ALL')} />
                    </div>

                    <div className="px-6 pb-4 flex items-center justify-between space-x-4">
                        {quickFilter !== 'PROMO_CHECK' ? (
                            <div className="flex items-center space-x-2 flex-1 bg-[#1b1b1b] border border-gray-700 rounded-lg px-3 py-2 shadow-sm focus-within:border-orange-500 transition-all">
                                <Search className="w-4 h-4 text-gray-500" />
                                <input type="text" placeholder={searchMode === 'STARTS_WITH' ? "Nhập mã bắt đầu..." : "Tìm mã hoặc tên..."} className="flex-1 outline-none text-sm bg-transparent text-white placeholder-gray-600" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
                                <div className="flex items-center space-x-1 border-l pl-2 border-gray-700">
                                    <button onClick={() => setSearchMode('CONTAINS')} className={`text-[10px] font-bold px-2 py-1 rounded ${searchMode === 'CONTAINS' ? 'bg-orange-500 text-black' : 'text-gray-500 hover:text-gray-300'}`}>Chứa</button>
                                    <button onClick={() => setSearchMode('STARTS_WITH')} className={`text-[10px] font-bold px-2 py-1 rounded ${searchMode === 'STARTS_WITH' ? 'bg-orange-500 text-black' : 'text-gray-500 hover:text-gray-300'}`}>Bắt đầu</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center space-x-2">
                                 <button onClick={handleCopyPromoDisplayed} className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#2d2a3e] text-purple-400 hover:bg-[#3d3852] rounded-lg border border-purple-900/50 text-xs font-bold transition-colors">
                                    <CopyCheck className="w-3.5 h-3.5" /> <span>Copy Đã Trưng</span>
                                </button>
                                <button onClick={handleCopyPromoOpportunity} className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#2a3441] text-blue-400 hover:bg-[#324053] rounded-lg border border-blue-900/50 text-xs font-bold transition-colors">
                                    <ListPlus className="w-3.5 h-3.5" /> <span>Copy Chưa Trưng</span>
                                </button>
                            </div>
                        )}
                        <div className="flex items-center space-x-2">
                             <button onClick={handleExportDisplayData} className="bg-purple-800 hover:bg-purple-700 text-white px-3 py-2 rounded-lg shadow-sm flex items-center text-sm font-semibold transition-colors whitespace-nowrap"><FileDown className="w-4 h-4 mr-2" /> Backup Trưng Bày</button>
                             <button onClick={handleExport} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg shadow-sm flex items-center text-sm font-semibold transition-colors whitespace-nowrap"><Download className="w-4 h-4 mr-2" /> Xuất Excel</button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto px-6 pb-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-black">
                        <div className="bg-[#1b1b1b] rounded-xl shadow-sm border border-gray-800 overflow-hidden min-w-full">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-black text-gray-400 font-semibold border-b border-orange-500/50 text-xs uppercase tracking-wider sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4 cursor-pointer hover:bg-gray-900" onClick={() => handleSort('code')}>
                                            <div className="flex items-center space-x-1"><span>Sản Phẩm</span><ArrowUpDown className="w-3 h-3 text-gray-600" /></div>
                                        </th>
                                        {quickFilter === 'PROMO_CHECK' ? (
                                            <>
                                                {/* Main Stock with Filter */}
                                                <th className="px-4 py-4 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <div onClick={() => handleSort('currentStockBT')} className="cursor-pointer mb-1 flex items-center justify-center space-x-1 hover:text-white transition-colors">
                                                            <span>Tồn Chính</span><ArrowUpDown className="w-3 h-3 text-gray-600" />
                                                        </div>
                                                        <select 
                                                            value={filterBT} 
                                                            onChange={(e) => setFilterBT(e.target.value)} 
                                                            className="bg-[#121212] border border-gray-700 rounded text-[10px] text-gray-300 px-1 py-0.5 outline-none focus:border-orange-500"
                                                        >
                                                            <option value="ALL">Tất cả</option>
                                                            <option value=">0">Còn hàng</option>
                                                            <option value="0">Hết hàng (0)</option>
                                                            <option value="<5">Thấp (&lt;5)</option>
                                                        </select>
                                                    </div>
                                                </th>
                                                
                                                <th className="px-4 py-4 text-center">
                                                     <div onClick={() => handleSort('currentStockTBA')} className="cursor-pointer flex items-center justify-center space-x-1 hover:text-white transition-colors">
                                                        <span>Tồn TBA</span><ArrowUpDown className="w-3 h-3 text-gray-600" />
                                                    </div>
                                                </th>

                                                {/* Display Info with Filter & Sort */}
                                                <th className="px-4 py-4 text-center w-1/6">
                                                     <div className="flex flex-col items-center">
                                                        <div onClick={() => handleSort('displayDays')} className="cursor-pointer mb-1 flex items-center justify-center space-x-1 hover:text-white transition-colors">
                                                            <span>Trưng Bày</span><ArrowUpDown className="w-3 h-3 text-gray-600" />
                                                        </div>
                                                        <select 
                                                            value={filterCondition} 
                                                            onChange={(e) => setFilterCondition(e.target.value)} 
                                                            className="bg-[#121212] border border-gray-700 rounded text-[10px] text-gray-300 px-1 py-0.5 outline-none focus:border-orange-500"
                                                        >
                                                            <option value="ALL">Tất cả</option>
                                                            <option value="New">Mới (New)</option>
                                                            <option value="Used">Used</option>
                                                            <option value="Scratched">Trầy</option>
                                                        </select>
                                                    </div>
                                                </th>

                                                {/* Sales Column (New) */}
                                                <th className="px-4 py-4 text-center cursor-pointer hover:bg-gray-900" onClick={() => handleSort('sold30Days')}>
                                                    <div className="flex items-center justify-center space-x-1"><span>Bán 30N</span><ArrowUpDown className="w-3 h-3 text-gray-600" /></div>
                                                </th>

                                                {/* Top Warehouses */}
                                                <th className="px-2 py-4 text-center text-[10px] w-16">Top 1</th>
                                                <th className="px-2 py-4 text-center text-[10px] w-16">Top 2</th>

                                                <th className="px-4 py-4 text-center cursor-pointer hover:bg-gray-900" onClick={() => handleSort('needsRestock')}>
                                                    <div className="flex items-center justify-center space-x-1"><span>Nhu Cầu</span><ArrowUpDown className="w-3 h-3 text-gray-600" /></div>
                                                </th>
                                                
                                                {/* Sourcing with Filter */}
                                                <th className="px-4 py-4 w-1/5">
                                                     <div className="flex items-center justify-between">
                                                        <div onClick={() => handleSort('sourcingQty')} className="cursor-pointer flex items-center space-x-1 hover:text-white transition-colors">
                                                            <span>Phân Bổ</span><ArrowUpDown className="w-3 h-3 text-gray-600" />
                                                        </div>
                                                        <select 
                                                            value={selectedSource} 
                                                            onChange={(e) => setSelectedSource(e.target.value)} 
                                                            className="bg-[#121212] border border-gray-700 rounded text-[10px] text-gray-300 px-1 py-0.5 outline-none focus:border-orange-500 max-w-[80px]"
                                                        >
                                                            <option value="ALL">All Sources</option>
                                                            {availableWarehouses.map(wh => (
                                                                <option key={wh} value={wh}>{wh}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </th>
                                            </>
                                        ) : (
                                            <>
                                                {/* STOCK FILTER HEADER */}
                                                <th className="px-4 py-4 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <div onClick={() => handleSort('currentStockBT')} className="cursor-pointer mb-1 flex items-center space-x-1 hover:text-white transition-colors">
                                                            <span>Tồn Chính</span><ArrowUpDown className="w-3 h-3 text-gray-600" />
                                                        </div>
                                                        <select 
                                                            value={filterBT} 
                                                            onChange={(e) => setFilterBT(e.target.value)} 
                                                            className="bg-[#121212] border border-gray-700 rounded text-[10px] text-gray-300 px-1 py-0.5 outline-none focus:border-orange-500"
                                                        >
                                                            <option value="ALL">Tất cả</option>
                                                            <option value=">0">Còn hàng</option>
                                                            <option value="0">Hết hàng (0)</option>
                                                            <option value="<5">Thấp (&lt;5)</option>
                                                        </select>
                                                    </div>
                                                </th>
                                                
                                                {quickFilter === 'DISPLAY_CHECK' ? (
                                                     <>
                                                        <th className="px-4 py-4 text-center w-1/6">
                                                            <div className="flex flex-col items-center">
                                                                <div onClick={() => handleSort('currentStockTBA')} className="cursor-pointer mb-1 flex items-center space-x-1 hover:text-white transition-colors">
                                                                    <span>Tồn Trưng Bày</span><ArrowUpDown className="w-3 h-3 text-gray-600" />
                                                                </div>
                                                                <select 
                                                                    value={filterTBA} 
                                                                    onChange={(e) => setFilterTBA(e.target.value)} 
                                                                    className="bg-[#121212] border border-gray-700 rounded text-[10px] text-gray-300 px-1 py-0.5 outline-none focus:border-orange-500"
                                                                >
                                                                    <option value="ALL">Tất cả</option>
                                                                    <option value=">0">Còn hàng</option>
                                                                    <option value="0">Hết hàng (0)</option>
                                                                </select>
                                                            </div>
                                                        </th>
                                                        {/* DISPLAY CONDITION FILTER HEADER */}
                                                        <th className="px-4 py-4 text-center w-1/4">
                                                            <div className="flex flex-col items-center">
                                                                <div onClick={() => handleSort('displayDays')} className="cursor-pointer mb-1 flex items-center space-x-1 hover:text-white transition-colors">
                                                                    <span>Chi Tiết Trưng Bày</span><ArrowUpDown className="w-3 h-3 text-gray-600" />
                                                                </div>
                                                                <select 
                                                                    value={filterCondition} 
                                                                    onChange={(e) => setFilterCondition(e.target.value)} 
                                                                    className="bg-[#121212] border border-gray-700 rounded text-[10px] text-gray-300 px-1 py-0.5 outline-none focus:border-orange-500"
                                                                >
                                                                    <option value="ALL">Tất cả</option>
                                                                    <option value="New">Mới (New)</option>
                                                                    <option value="Used">Đã sử dụng (Used)</option>
                                                                    <option value="Scratched">Trầy xước</option>
                                                                </select>
                                                            </div>
                                                        </th>
                                                        <th className="px-4 py-4 w-1/4">
                                                             <div className="flex flex-col items-center">
                                                                <div onClick={() => handleSort('otherStockQty')} className="cursor-pointer mb-1 flex items-center space-x-1 hover:text-white transition-colors">
                                                                    <span>Tồn Kho Khác</span><ArrowUpDown className="w-3 h-3 text-gray-600" />
                                                                </div>
                                                                <select 
                                                                    value={filterOtherStock} 
                                                                    onChange={(e) => setFilterOtherStock(e.target.value)} 
                                                                    className="bg-[#121212] border border-gray-700 rounded text-[10px] text-gray-300 px-1 py-0.5 outline-none focus:border-orange-500"
                                                                >
                                                                    <option value="ALL">Tất cả</option>
                                                                    <option value=">0">Còn hàng</option>
                                                                    <option value="0">Hết hàng (0)</option>
                                                                </select>
                                                            </div>
                                                        </th>

                                                        {/* Sales Column Header */}
                                                        <th className="px-4 py-4 text-center cursor-pointer hover:bg-gray-900" onClick={() => handleSort('sold30Days')}>
                                                             <div className="flex items-center justify-center space-x-1"><span>Bán 30N</span><ArrowUpDown className="w-3 h-3 text-gray-600" /></div>
                                                        </th>

                                                        <th className="px-4 py-4 text-center">Action</th>
                                                     </>
                                                ) : (
                                                    <>
                                                        {/* STATUS & ABC FILTER HEADER */}
                                                        <th className="px-4 py-4 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <div onClick={() => handleSort('abcClass')} className="cursor-pointer mb-1 flex items-center space-x-1 hover:text-white transition-colors">
                                                                     <span>ABC/Status</span><ArrowUpDown className="w-3 h-3 text-gray-600" />
                                                                </div>
                                                                <div className="flex space-x-1">
                                                                    <select 
                                                                        value={filterABC} 
                                                                        onChange={(e) => setFilterABC(e.target.value)} 
                                                                        className="bg-[#121212] border border-gray-700 rounded text-[10px] text-gray-300 px-1 py-0.5 outline-none focus:border-orange-500"
                                                                    >
                                                                        <option value="ALL">ABC</option>
                                                                        <option value="A">A</option>
                                                                        <option value="B">B</option>
                                                                        <option value="C">C</option>
                                                                    </select>
                                                                    <select 
                                                                        value={filterStatus} 
                                                                        onChange={(e) => setFilterStatus(e.target.value)} 
                                                                        className="bg-[#121212] border border-gray-700 rounded text-[10px] text-gray-300 px-1 py-0.5 outline-none focus:border-orange-500"
                                                                    >
                                                                        <option value="ALL">TT</option>
                                                                        <option value="Critical">Nguy</option>
                                                                        <option value="Normal">Thường</option>
                                                                        <option value="Review">Xem</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </th>
                                                        {/* Branch Stock */}
                                                        <th className="px-4 py-4 text-center w-1/5">
                                                            <div className="flex flex-col items-center">
                                                                <div onClick={() => handleSort('otherStockQty')} className="cursor-pointer mb-1 flex items-center justify-center space-x-1 hover:text-white transition-colors">
                                                                    <span>Tồn Chi Nhánh</span><ArrowUpDown className="w-3 h-3 text-gray-600" />
                                                                </div>
                                                                <select 
                                                                    value={filterOtherStock} 
                                                                    onChange={(e) => setFilterOtherStock(e.target.value)} 
                                                                    className="bg-[#121212] border border-gray-700 rounded text-[10px] text-gray-300 px-1 py-0.5 outline-none focus:border-orange-500"
                                                                >
                                                                    <option value="ALL">Tất cả</option>
                                                                    <option value=">0">Còn hàng</option>
                                                                    <option value="0">Hết hàng (0)</option>
                                                                </select>
                                                            </div>
                                                        </th>
                                                        <th className="px-4 py-4 text-center cursor-pointer hover:bg-gray-900" onClick={() => handleSort('sold30Days')}>
                                                             <div className="flex items-center justify-center space-x-1"><span>Bán 30N</span><ArrowUpDown className="w-3 h-3 text-gray-600" /></div>
                                                        </th>
                                                        <th className="px-4 py-4 text-center cursor-pointer hover:bg-gray-900" onClick={() => handleSort('needsRestock')}>
                                                             <div className="flex items-center justify-center space-x-1"><span>Dự Báo</span><ArrowUpDown className="w-3 h-3 text-gray-600" /></div>
                                                        </th>
                                                        {quickFilter === 'PULL_LOGIC' && (
                                                            <th className="px-4 py-4 text-left">
                                                                <div className="flex items-center space-x-1"><span>Lực Bán & Lý Do</span></div>
                                                            </th>
                                                        )}
                                                        
                                                        {/* SOURCE FILTER HEADER */}
                                                        <th className="px-4 py-4 w-1/4">
                                                            <div className="flex items-center justify-between">
                                                                <div onClick={() => handleSort('sourcingQty')} className="cursor-pointer flex items-center space-x-1 hover:text-white transition-colors">
                                                                    <span>Nguồn Kéo</span><ArrowUpDown className="w-3 h-3 text-gray-600" />
                                                                </div>
                                                                <select 
                                                                    value={selectedSource} 
                                                                    onChange={(e) => setSelectedSource(e.target.value)} 
                                                                    className="bg-[#121212] border border-gray-700 rounded text-[10px] text-gray-300 px-1 py-0.5 outline-none focus:border-orange-500 max-w-[100px]"
                                                                >
                                                                    <option value="ALL">Tất cả kho</option>
                                                                    {availableWarehouses.map(wh => (
                                                                        <option key={wh} value={wh}>{wh}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </th>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {filteredResults.map((r, idx) => {
                                        const isCritical = r.urgency === 'Critical';
                                        const sortedSources = [...r.sourcing].sort((a, b) => b.quantity - a.quantity);
                                        const usedWarehouses = new Set(r.sourcing.map(s => s.sourceWarehouse));
                                        
                                        // Display Logic Helper
                                        const daysDisp = getDaysDisplayed(r.displayInfo?.startDate);
                                        const isDisplayWarning = r.currentStockTBA > 0 && daysDisp > 20 && r.displayInfo?.condition === 'New';

                                        // Top warehouses logic (ensure array is sorted by stock desc in utils)
                                        const top1 = r.allWarehousesStock[0];
                                        const top2 = r.allWarehousesStock[1];

                                        return (
                                        <tr key={idx} className={`group transition-colors ${isCritical && quickFilter !== 'DISPLAY_CHECK' ? 'bg-[#2a1212] hover:bg-[#3a1a1a]' : 'bg-[#1b1b1b] hover:bg-[#252525]'}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center space-x-2">
                                                        <span className={`font-bold ${isCritical ? 'text-red-500' : 'text-gray-200'}`}>{r.code}</span>
                                                        <button onClick={() => copyToClipboard(r.code)} className="opacity-0 group-hover:opacity-100 p-1.5 bg-gray-800 hover:bg-orange-600 text-gray-400 hover:text-white rounded transition-all"><Copy className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                    <span className={`text-xs truncate max-w-xs mt-0.5 ${isCritical ? 'text-red-400' : 'text-gray-500'}`} title={r.name}>{r.name}</span>
                                                </div>
                                            </td>
                                            
                                            {quickFilter === 'PROMO_CHECK' ? (
                                                <>
                                                    <td className="px-4 py-4 text-center font-bold text-blue-400">{r.currentStockBT}</td>
                                                    
                                                    <td className="px-4 py-4 text-center font-bold text-purple-400">{r.currentStockTBA}</td>

                                                    {/* Display Info Logic for Promo Check */}
                                                    <td className="px-4 py-4 text-center">
                                                        {r.displayInfo ? (
                                                            <div className="flex flex-col items-center">
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.displayInfo.condition === 'New' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
                                                                    {r.displayInfo.condition}
                                                                </span>
                                                                <span className="text-[10px] text-gray-500 mt-0.5">{r.displayInfo.startDate}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-gray-600">-</span>
                                                        )}
                                                    </td>

                                                    {/* Sales */}
                                                    <td className="px-4 py-4 text-center text-gray-400">{r.sold30Days}</td>

                                                    {/* Top 1 Stock */}
                                                    <td className="px-2 py-4 text-center">
                                                        {top1 ? (
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] text-gray-400 truncate max-w-[60px]" title={top1.name}>{top1.name}</span>
                                                                <span className="text-xs font-bold text-white">{top1.stock}</span>
                                                            </div>
                                                        ) : <span className="text-gray-700">-</span>}
                                                    </td>
                                                    
                                                    {/* Top 2 Stock */}
                                                    <td className="px-2 py-4 text-center">
                                                        {top2 ? (
                                                             <div className="flex flex-col">
                                                                <span className="text-[10px] text-gray-400 truncate max-w-[60px]" title={top2.name}>{top2.name}</span>
                                                                <span className="text-xs font-bold text-white">{top2.stock}</span>
                                                            </div>
                                                        ) : <span className="text-gray-700">-</span>}
                                                    </td>

                                                    <td className="px-4 py-4 text-center font-bold text-red-500">{r.needsRestock}</td>
                                                    <td className="px-4 py-4">
                                                         <div className="flex flex-col gap-1.5">
                                                            {sortedSources.map((s, i) => (
                                                                <div key={i} className="flex items-center justify-between border rounded px-2 py-1 text-xs bg-[#121212] border-gray-700 text-gray-400">
                                                                    <div className="flex flex-col"><span className="font-bold">{s.sourceWarehouse}</span></div>
                                                                    <span className="font-bold text-green-400">{s.quantity}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center"><button onClick={() => setEditingItem(r)} className="hover:bg-gray-800 p-2 rounded-full"><Edit className="w-4 h-4 text-blue-400"/></button></td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-4 py-4 text-center font-bold text-gray-400">{r.currentStockBT}</td>
                                                    {quickFilter === 'DISPLAY_CHECK' ? (
                                                        <>
                                                            {/* STOCK TBA */}
                                                            <td className="px-4 py-4 text-center font-bold text-purple-400">{r.currentStockTBA}</td>
                                                            
                                                            {/* DISPLAY DETAILS (Restored) */}
                                                            <td className="px-4 py-4">
                                                                {r.displayInfo ? (
                                                                    <div className="flex flex-col items-center">
                                                                        <div className="flex items-center space-x-1 mb-1">
                                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${r.displayInfo.condition === 'New' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
                                                                                {r.displayInfo.condition}
                                                                            </span>
                                                                            {isDisplayWarning && (
                                                                                <span className="bg-orange-500 text-black text-[10px] font-bold px-1 rounded animate-pulse" title="Hàng New trưng > 20 ngày!">Check</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-[10px] text-gray-500 flex items-center">
                                                                            <Clock className="w-3 h-3 mr-1" />
                                                                            <span>{r.displayInfo.startDate} ({daysDisp} ngày)</span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    r.currentStockTBA > 0 ? (
                                                                        <span className="text-xs text-red-500 italic block text-center">Chưa cập nhật ngày</span>
                                                                    ) : (
                                                                        <span className="text-gray-600 text-[10px] block text-center">-</span>
                                                                    )
                                                                )}
                                                            </td>
                                                            
                                                            {/* OTHER WAREHOUSES (Added as requested) */}
                                                            <td className="px-4 py-4">
                                                                <div className="flex flex-col gap-1 max-h-20 overflow-y-auto">
                                                                    {r.allWarehousesStock.slice(0, 4).map((w, i) => (
                                                                         <div key={i} className="flex justify-between text-[10px] bg-[#121212] border border-gray-800 px-2 py-0.5 rounded">
                                                                            <span className="text-gray-400">{w.name}</span>
                                                                            <span className="font-bold text-gray-200">{w.stock}</span>
                                                                        </div>
                                                                    ))}
                                                                    {r.allWarehousesStock.length === 0 && <span className="text-center text-[10px] text-gray-600">--</span>}
                                                                </div>
                                                            </td>

                                                            {/* NEW: Sales Column Data */}
                                                            <td className="px-4 py-4 text-center text-gray-400">{r.sold30Days}</td>

                                                            <td className="px-4 py-4 text-center"><button onClick={() => setEditingItem(r)} className="hover:bg-gray-800 p-2 rounded-full"><Edit className="w-4 h-4 text-blue-400"/></button></td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {/* ABC Class Column */}
                                                            <td className="px-4 py-4 text-center">
                                                                {r.abcClass === 'A' && <span className="px-2 py-0.5 bg-green-900 text-green-400 text-xs font-bold rounded border border-green-700">A (VIP)</span>}
                                                                {r.abcClass === 'B' && <span className="px-2 py-0.5 bg-yellow-900/40 text-yellow-400 text-xs font-bold rounded border border-yellow-800">B</span>}
                                                                {r.abcClass === 'C' && <span className="px-2 py-0.5 bg-gray-800 text-gray-500 text-xs font-bold rounded border border-gray-700">C</span>}
                                                                {r.abcClass === 'N' && <span className="text-gray-600 text-xs">-</span>}
                                                            </td>
                                                            
                                                            {/* NEW: Explicit "Branch Stock" Column instead of just TBA */}
                                                            <td className="px-4 py-4">
                                                                <div className="flex flex-col gap-1 max-h-20 overflow-y-auto">
                                                                    {r.allWarehousesStock.length > 0 ? (
                                                                        r.allWarehousesStock.map((w, i) => (
                                                                             <div key={i} className="flex justify-between text-[10px] bg-[#121212] border border-gray-800 px-1.5 py-0.5 rounded">
                                                                                <span className="text-gray-400 truncate max-w-[60px]" title={w.name}>{w.name}</span>
                                                                                <span className="font-bold text-purple-400">{w.stock}</span>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <span className="text-center text-[10px] text-gray-600 block">-</span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            <td className="px-4 py-4 text-center text-gray-400">{r.sold30Days}</td>
                                                            <td className="px-4 py-4 text-center">
                                                                <div className="flex flex-col items-center">
                                                                    <span className="font-bold text-blue-400 text-base">{r.needsRestock}</span>
                                                                    {r.safetyStockAdjustment > 0 && (
                                                                         <span className="text-[10px] text-green-500 bg-green-900/30 px-1 rounded flex items-center mt-1">
                                                                             <ShieldCheck className="w-3 h-3 mr-0.5" /> +{r.safetyStockAdjustment} an toàn
                                                                         </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            {quickFilter === 'PULL_LOGIC' && (
                                                                <td className="px-4 py-4">
                                                                    <div className="flex flex-col">
                                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded w-max mb-1 ${
                                                                            r.velocityStatus === 'Hàng cực hot' ? 'bg-red-900 text-red-400' : 
                                                                            r.velocityStatus === 'Chậm' ? 'bg-gray-800 text-gray-400' : 'bg-blue-900 text-blue-400'
                                                                        }`}>
                                                                            {r.velocityStatus}
                                                                        </span>
                                                                        <span className="text-[10px] text-gray-400 leading-tight">{r.pullReason}</span>
                                                                    </div>
                                                                </td>
                                                            )}
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col gap-2">
                                                                    {sortedSources.length > 0 ? (
                                                                        <>
                                                                            {sortedSources.map((s, i) => (
                                                                                <div key={i} className={`flex items-center justify-between border rounded px-3 py-1.5 text-xs 
                                                                                    ${i === 0 ? 'bg-blue-900/20 border-blue-500/50 shadow-md transform scale-[1.02]' : 'bg-[#121212] border-gray-800 text-gray-500'}
                                                                                `}>
                                                                                    <div className="flex flex-col">
                                                                                        <span className={`font-bold ${i===0 ? 'text-blue-300 text-sm' : ''}`}>{s.sourceWarehouse}</span>
                                                                                        <span className={`text-[10px] ${i===0 ? 'text-blue-400/70' : 'text-gray-600'}`}>Tồn thực tế: {s.sourceStock}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center">
                                                                                        <span className="text-[10px] mr-1 opacity-50">Lấy</span>
                                                                                        <span className={`font-bold ${i===0 ? 'text-green-400 text-sm' : 'text-gray-400'}`}>{s.quantity}</span>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </>
                                                                    ) : (
                                                                        r.missingQuantity > 0 && !r.isDiscontinued ? (
                                                                            <span className="text-red-500 font-bold text-xs bg-red-900/20 border border-red-900 px-2 py-1 rounded text-center">HẾT HÀNG (NHẬP NCC: {r.missingQuantity})</span>
                                                                        ) : (
                                                                            <span className="text-gray-700 text-xs italic text-center block">--</span>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </tr>
                                    );})}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
            </div>
        </div>
      </div>
    </div>
  );
};