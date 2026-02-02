import React, { useState, useMemo } from 'react';
import { 
  X, UploadCloud, FileSpreadsheet, Calculator, 
  Download, RefreshCw, Filter, Search, 
  AlertTriangle, CheckCircle2, TrendingUp, PackageX,
  ArrowRight, Database, ShoppingCart, Monitor, Copy, History, Edit, Save, CalendarPlus,
  Settings, ArrowDownToLine, ArrowUpFromLine, Truck, ArrowUpDown, ChevronUp, ChevronDown, Clock,
  Hourglass, SearchCode, Eye, CopyCheck, ListPlus, CircleHelp, FileText
} from 'lucide-react';
import { calculateRestockPlan } from '../utils/inventory';
import { RestockRecommendation, DisplayInfo } from '../types';
import * as XLSX from 'xlsx';

interface InventoryPanelProps {
  onClose: () => void;
}

// Helper types for sorting and filtering
type SortDirection = 'asc' | 'desc';
interface SortConfig {
  key: keyof RestockRecommendation | 'displayDays' | 'sourceStatus' | 'displayStatus';
  direction: SortDirection;
}

type QuickFilterType = 'ALL' | 'CRITICAL' | 'NORMAL_RESTOCK' | 'NEW' | 'DISCONTINUED' | 'DISPLAY_CHECK' | 'SLOW_MOVING' | 'PROMO_CHECK';

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
                    <h3 className="font-bold text-white text-lg">Hướng Dẫn Sử Dụng Hệ Thống</h3>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8 text-gray-300">
                <section>
                    <h4 className="text-orange-400 font-bold text-base mb-3 border-b border-gray-700 pb-2">1. Nhập Dữ Liệu (Quan Trọng)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-[#252525] p-4 rounded-lg">
                            <h5 className="font-bold text-white mb-2">File Kho Chính (Của Bạn)</h5>
                            <p className="text-sm text-gray-400 mb-2">Đây là file tồn kho tại chi nhánh bạn đang ngồi (VD: Bình Thạnh, Quận 9...).</p>
                            <ul className="list-disc list-inside text-xs space-y-1 text-gray-500">
                                <li>Hệ thống sẽ dùng file này để tính toán xem bạn đang thiếu hàng gì.</li>
                                <li>Định dạng: Excel xuất từ phần mềm kho (Cột B=Mã, Cột E=Tồn).</li>
                            </ul>
                        </div>
                        <div className="bg-[#252525] p-4 rounded-lg">
                            <h5 className="font-bold text-white mb-2">File Kho Khác / Chi Nhánh</h5>
                            <p className="text-sm text-gray-400 mb-2">Nơi chứa các file kho từ nơi khác mà bạn có thể kéo hàng về (VD: Kho 64, Kho 7BC, Kho Q7...).</p>
                            <ul className="list-disc list-inside text-xs space-y-1 text-gray-500">
                                <li>Hệ thống dùng tên File làm tên Kho (VD: `Kho_Q9.xlsx` -> Kho Q9).</li>
                                <li>Có thể chọn nhiều file cùng lúc.</li>
                            </ul>
                        </div>
                    </div>
                </section>

                <section>
                    <h4 className="text-blue-400 font-bold text-base mb-3 border-b border-gray-700 pb-2">2. Giải Thích Tính Năng</h4>
                    <div className="space-y-4">
                        <div>
                            <span className="text-sm font-bold text-white bg-red-900/50 px-2 py-1 rounded border border-red-900">Nguy Cấp</span>
                            <p className="text-sm mt-1">Sản phẩm bán chạy (có doanh số 30 ngày) nhưng tồn kho = 0 hoặc rất thấp (dưới 3 cái hoặc bán chưa được 2 ngày là hết). Cần ưu tiên nhập ngay.</p>
                        </div>
                        <div>
                             <span className="text-sm font-bold text-white bg-purple-900/50 px-2 py-1 rounded border border-purple-900">QL Trưng Bày</span>
                             <p className="text-sm mt-1">Quản lý hàng mẫu trưng bày. Hệ thống tự động đề xuất:</p>
                             <ul className="list-disc list-inside text-xs mt-1 pl-2 text-gray-400">
                                 <li><strong className="text-blue-400">Kéo Trưng Bày:</strong> Kho chính có hàng nhưng chưa trưng -> Cần lấy ra trưng.</li>
                                 <li><strong className="text-red-400">Trả Kho (&gt;20N):</strong> Hàng trưng bày (Mới) đã để trên kệ quá 20 ngày -> Cần trả về kho để bán mới, tránh trôi bảo hành/cũ. (Chỉ báo khi kho trưng bày thực sự có hàng).</li>
                                 <li><strong className="text-yellow-500">Cân Nhắc Trả:</strong> Kho trưng bày còn hàng, nhưng kho chính đã hết sạch. Có thể cân nhắc trả hàng trưng về bán cho khách nếu cần gấp.</li>
                             </ul>
                        </div>
                        <div>
                             <span className="text-sm font-bold text-white bg-orange-900/50 px-2 py-1 rounded border border-orange-900">Tồn Lâu</span>
                             <p className="text-sm mt-1">So sánh tồn kho thực tế với File "Hàng tồn lâu" để phát hiện lệch kho hoặc nhắc nhở đẩy hàng.</p>
                        </div>
                    </div>
                </section>

                <section>
                    <h4 className="text-green-400 font-bold text-base mb-3 border-b border-gray-700 pb-2">3. Mẹo Sử Dụng</h4>
                    <ul className="list-disc list-inside text-sm space-y-2 text-gray-300">
                        <li><strong>Cập nhật Tình Trạng Trưng Bày:</strong> Bạn có thể bấm vào nút <Edit className="w-3 h-3 inline"/> trong bảng để sửa ngày bắt đầu trưng hoặc tình trạng (Mới/Cũ). Bạn có thể tự nhập tình trạng khác (VD: "Mất hộp").</li>
                        <li><strong>Tra Cứu List/Promo:</strong> Dán một danh sách mã vào ô bên trái để kiểm tra nhanh tồn kho và trạng thái trưng bày của riêng danh sách đó.</li>
                        <li><strong>Đa Chi Nhánh:</strong> Ứng dụng này dùng được cho mọi chi nhánh. Chỉ cần bạn nạp đúng File Tồn Kho Của Bạn vào ô đầu tiên, và các file kho khác vào ô "Kho Khác".</li>
                    </ul>
                </section>
            </div>
            
            <div className="p-4 bg-[#121212] border-t border-gray-800 text-center">
                <button onClick={onClose} className="px-6 py-2 bg-orange-500 text-black font-bold rounded-lg hover:bg-orange-600 transition-colors">
                    Đã Hiểu
                </button>
            </div>
        </div>
    </div>
);

// --- Edit Modal Component ---
const EditDisplayModal = ({ item, onClose, onSave }: { item: RestockRecommendation, onClose: () => void, onSave: (date: string, condition: string) => void }) => {
    const [startDate, setStartDate] = useState(item.displayInfo?.startDate || new Date().toISOString().split('T')[0]);
    // Allow condition to be edited freely
    const [condition, setCondition] = useState<string>(item.displayInfo?.condition || 'New');
    const [isCustom, setIsCustom] = useState(false);

    // Predefined options
    const options = [
        { val: 'New', label: 'Mới (New)' },
        { val: 'Scratched', label: 'Trầy xước' },
        { val: 'Used', label: 'Đã dùng / Cũ' }
    ];

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
                            <input 
                                type="date" 
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full border border-gray-700 bg-black text-white rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tình trạng</label>
                            <div className="relative">
                                {isCustom || !isPredefined ? (
                                    <div className="flex space-x-1">
                                         <input 
                                            type="text"
                                            value={condition}
                                            onChange={(e) => setCondition(e.target.value)}
                                            placeholder="Nhập tình trạng..."
                                            className="w-full border border-gray-700 bg-black text-white rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none"
                                            autoFocus
                                        />
                                        <button 
                                            onClick={() => { setIsCustom(false); setCondition('New'); }}
                                            className="px-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700"
                                            title="Chọn từ danh sách"
                                        >
                                            <ListPlus className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <select 
                                        value={condition}
                                        onChange={(e) => {
                                            if (e.target.value === 'CUSTOM') setIsCustom(true);
                                            else setCondition(e.target.value);
                                        }}
                                        className="w-full border border-gray-700 bg-black text-white rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none appearance-none"
                                    >
                                        {options.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                                        <option value="CUSTOM">+ Khác (Nhập tay)</option>
                                    </select>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg text-xs text-gray-400">
                        <p>Hệ thống sẽ tự động tính số ngày đã trưng bày từ ngày bạn chọn đến hôm nay.</p>
                    </div>
                </div>

                <div className="px-6 py-4 bg-black border-t border-gray-800 flex justify-end space-x-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 rounded-lg transition-colors">Hủy</button>
                    <button 
                        onClick={() => onSave(startDate, condition)}
                        className="px-4 py-2 text-sm bg-orange-500 text-black font-bold rounded-lg hover:bg-orange-600 transition-colors shadow-sm"
                    >
                        Lưu Cập Nhật
                    </button>
                </div>
            </div>
        </div>
    );
};

export const InventoryPanel: React.FC<InventoryPanelProps> = ({ onClose }) => {
  // --- State ---
  const [btFile, setBtFile] = useState<File | null>(null);
  const [tkFile, setTkFile] = useState<File | null>(null);
  const [displayFile, setDisplayFile] = useState<File | null>(null);
  const [slowFile, setSlowFile] = useState<File | null>(null);
  const [whFiles, setWhFiles] = useState<File[]>([]);
  const [rawResults, setRawResults] = useState<RestockRecommendation[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  // Promo / List Check
  const [promoInput, setPromoInput] = useState('');
  
  // Editing State
  const [editingItem, setEditingItem] = useState<RestockRecommendation | null>(null);

  // Filters & Sorting
  const [searchText, setSearchText] = useState('');
  const [searchMode, setSearchMode] = useState<'CONTAINS' | 'STARTS_WITH'>('CONTAINS');
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  
  // Column Filters
  const [filterBT, setFilterBT] = useState<string>('ALL');
  const [filterTBA, setFilterTBA] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  
  // Promo Specific Filters
  const [filterPromoDisplay, setFilterPromoDisplay] = useState<string>('ALL');

  // Sorting
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // --- Logic ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'BT' | 'TK' | 'WH' | 'DISP' | 'SLOW') => {
    if (!e.target.files?.length) return;
    if (type === 'BT') setBtFile(e.target.files[0]);
    else if (type === 'TK') setTkFile(e.target.files[0]);
    else if (type === 'WH') setWhFiles(Array.from(e.target.files));
    else if (type === 'DISP') setDisplayFile(e.target.files[0]);
    else if (type === 'SLOW') setSlowFile(e.target.files[0]);
  };

  const handleCalculate = async () => {
    if (!btFile || !tkFile) {
        alert("Vui lòng tải lên đủ File Tồn Kho và File Bán Hàng để tính toán.");
        return;
    }
    
    // START LOADING UI
    setIsCalculating(true);

    // Use setTimeout to allow the UI to render the loading state BEFORE blocking the thread with calculation
    setTimeout(async () => {
        try {
            const data = await calculateRestockPlan(btFile, tkFile, whFiles, displayFile || undefined, slowFile || undefined);
            setRawResults(data);
            setQuickFilter('CRITICAL'); 
        } catch (error) {
            console.error(error);
            alert("Lỗi xử lý file. Vui lòng kiểm tra định dạng file Excel.");
        } finally {
            setIsCalculating(false);
        }
    }, 100);
  };

  const handleUpdateDisplay = (startDate: string, condition: string) => {
      if (!editingItem) return;

      setRawResults(prev => prev.map(item => {
          if (item.code === editingItem.code) {
              return {
                  ...item,
                  displayInfo: { startDate, condition }
              };
          }
          return item;
      }));
      setEditingItem(null);
  };

  const handleSort = (key: SortConfig['key']) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleExportDisplayData = () => {
      const displayItems = rawResults
          .filter(r => r.displayInfo || r.currentStockTBA > 0) 
          .map(r => ({
              'Mã SP': r.code,
              'Ngày Bắt Đầu': r.displayInfo?.startDate || '',
              'Tình Trạng': r.displayInfo?.condition || 'New',
              'Tên SP': r.name
          }));
      
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(displayItems);
      XLSX.utils.book_append_sheet(wb, ws, "Theo_Doi_Trung_Bay");
      XLSX.writeFile(wb, "Du_Lieu_Trung_Bay_Moi.xlsx");
  };

  // --- Copy Handlers for Promo ---
  const handleCopyPromoDisplayed = () => {
    // 1. Get base list from Promo Input
    const codes = promoInput.split(/[\n,;]+/).map(s => s.trim().toLowerCase()).filter(s => s);
    if (codes.length === 0) return;

    // 2. Filter from raw results (ignoring current view filters)
    const displayed = rawResults
        .filter(r => codes.some(c => r.code.toLowerCase().includes(c))) // In list
        .filter(r => r.currentStockTBA > 0) // Is Displayed
        .map(r => r.code)
        .join('\n');

    navigator.clipboard.writeText(displayed);
    alert(`Đã copy ${displayed.split('\n').filter(Boolean).length} mã ĐANG TRƯNG BÀY vào clipboard.`);
  };

  const handleCopyPromoOpportunity = () => {
     // 1. Get base list
     const codes = promoInput.split(/[\n,;]+/).map(s => s.trim().toLowerCase()).filter(s => s);
     if (codes.length === 0) return;

     // 2. Filter from raw results
     const opportunity = rawResults
        .filter(r => codes.some(c => r.code.toLowerCase().includes(c))) // In list
        .filter(r => r.currentStockTBA === 0 && r.currentStockBT > 0) // Not displayed BUT has Stock
        .map(r => r.code)
        .join('\n');

     navigator.clipboard.writeText(opportunity);
     alert(`Đã copy ${opportunity.split('\n').filter(Boolean).length} mã CHƯA TRƯNG (CÓ HÀNG) vào clipboard.`);
  };

  const availableWarehouses = useMemo(() => {
    const whSet = new Set<string>();
    rawResults.forEach(r => r.sourcing.forEach(s => whSet.add(s.sourceWarehouse)));
    return Array.from(whSet).sort();
  }, [rawResults]);

  const getDaysDisplayed = (startDateStr?: string) => {
      if (!startDateStr) return 0;
      const start = new Date(startDateStr);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - start.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  };

  const stats = useMemo(() => {
    return {
      critical: rawResults.filter(r => !r.isDiscontinued && !r.isNewArrival && r.urgency === 'Critical').length,
      normalRestock: rawResults.filter(r => !r.isDiscontinued && !r.isNewArrival && r.urgency === 'Normal').length,
      newArrivals: rawResults.filter(r => r.isNewArrival).length,
      discontinued: rawResults.filter(r => r.isDiscontinued).length,
      displayIssues: rawResults.filter(r => {
          const daysDisp = getDaysDisplayed(r.displayInfo?.startDate);
          // FIX: Only consider return needed if TBA stock > 0
          const isReturnNeeded = r.currentStockTBA > 0 && daysDisp > 20 && r.displayInfo?.condition === 'New';
          return r.isTbaSolo || r.shouldDisplay || isReturnNeeded || (r.tbaMaxStock < 1);
      }).length,
      slowMoving: rawResults.filter(r => !!r.slowStockInfo).length,
      total: rawResults.length
    };
  }, [rawResults]);

  // Main Filter Logic
  const filteredResults = useMemo(() => {
    let result = [...rawResults]; // Clone array to avoid mutation bugs during sorts
    
    // 1. Initial Filtering (Promo List OR Text Search)
    if (quickFilter === 'PROMO_CHECK') {
        const codes = promoInput.split(/[\n,;]+/).map(s => s.trim().toLowerCase()).filter(s => s);
        if (codes.length > 0) {
            result = result.filter(r => codes.some(c => r.code.toLowerCase().includes(c)));
        }
        
        // 1.1 Apply Promo Specific Filters (BT and Display Status)
        if (filterBT !== 'ALL') {
             if (filterBT === '0') result = result.filter(r => r.currentStockBT === 0);
             else if (filterBT === '>0') result = result.filter(r => r.currentStockBT > 0);
             else if (filterBT === '<5') result = result.filter(r => r.currentStockBT > 0 && r.currentStockBT < 5);
        }

        if (filterPromoDisplay !== 'ALL') {
            if (filterPromoDisplay === 'DISPLAYED') result = result.filter(r => r.currentStockTBA > 0);
            else if (filterPromoDisplay === 'NOT_DISPLAYED') result = result.filter(r => r.currentStockTBA === 0);
        }

    } else {
        const text = searchText.toLowerCase().trim();
        if (text) {
            if (searchMode === 'STARTS_WITH') {
                result = result.filter(r => r.code.toLowerCase().startsWith(text));
            } else {
                result = result.filter(r => r.code.toLowerCase().includes(text) || r.name.toLowerCase().includes(text));
            }
        }
    }

    // 2. Secondary Filtering (Tabs & Column Filters)
    result = result.filter(r => {
        // Tab Filters
        switch (quickFilter) {
            case 'CRITICAL':
                if (r.isDiscontinued || r.isNewArrival || r.urgency !== 'Critical') return false;
                break;
            case 'NORMAL_RESTOCK':
                if (r.isDiscontinued || r.isNewArrival || r.urgency !== 'Normal') return false;
                break;
            case 'NEW':
                if (!r.isNewArrival) return false;
                break;
            case 'DISCONTINUED':
                if (!r.isDiscontinued) return false;
                break;
            case 'DISPLAY_CHECK':
                // FIX: Filter needs to match the Stats logic
                const daysDisp = getDaysDisplayed(r.displayInfo?.startDate);
                const isReturnNeeded = r.currentStockTBA > 0 && daysDisp > 20 && r.displayInfo?.condition === 'New';
                const relevant = r.currentStockTBA > 0 || r.shouldDisplay || r.isTbaSolo || r.tbaMaxStock > 0 || isReturnNeeded;
                if (!relevant) return false;
                break;
            case 'SLOW_MOVING':
                if (!r.slowStockInfo) return false;
                break;
            // PROMO_CHECK is handled in step 1
        }

        // Source Filter (Applies to all modes including Promo Check)
        if (selectedSource !== 'ALL') {
             const hasSource = r.sourcing.some(s => s.sourceWarehouse === selectedSource);
             if (!hasSource) return false;
        }

        // Column Specific Filters (Only for non-promo, or if reused carefully)
        // For Promo Mode, we handled filterBT above to be explicit. 
        // For Normal modes:
        if (quickFilter !== 'PROMO_CHECK') {
            if (filterBT === '0') { if (r.currentStockBT !== 0) return false; }
            else if (filterBT === '>0') { if (r.currentStockBT <= 0) return false; }
            else if (filterBT === '<5') { if (r.currentStockBT >= 5) return false; }

            if (filterTBA === '0') { if (r.currentStockTBA !== 0) return false; }
            else if (filterTBA === '>0') { if (r.currentStockTBA <= 0) return false; }
            
            if (filterStatus !== 'ALL') {
                 const daysDisp = getDaysDisplayed(r.displayInfo?.startDate);
                 // FIX: Logic consistency in filter
                 const isReturnNeeded = r.currentStockTBA > 0 && daysDisp > 20 && r.displayInfo?.condition === 'New';
                 const isMissingMax = r.tbaMaxStock < 1;

                 if (filterStatus === 'Cân nhắc trả' && !r.isTbaSolo) return false;
                 if (filterStatus === 'Kéo trưng bày' && !r.shouldDisplay) return false;
                 if (filterStatus === 'Trả kho' && !isReturnNeeded) return false;
                 if (filterStatus === 'Thiếu định mức' && !(r.currentStockTBA < r.tbaMaxStock && !isMissingMax)) return false;
                 if (filterStatus === 'OK' && (r.isTbaSolo || r.shouldDisplay || isMissingMax || isReturnNeeded)) return false;
            }
        }

        return true;
    });

    // 3. Sorting
    if (sortConfig) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof RestockRecommendation];
        let bValue: any = b[sortConfig.key as keyof RestockRecommendation];

        // Custom Sort Keys
        if (sortConfig.key === 'displayStatus') {
             // Sort by: Has Display (1) vs No Display (0)
             aValue = a.currentStockTBA > 0 ? 1 : 0;
             bValue = b.currentStockTBA > 0 ? 1 : 0;
        } else if (sortConfig.key === 'displayDays') {
            aValue = getDaysDisplayed(a.displayInfo?.startDate);
            bValue = getDaysDisplayed(b.displayInfo?.startDate);
        } else if (sortConfig.key === 'code') {
            // Explicit string sort for Code
            return sortConfig.direction === 'asc' 
                ? a.code.localeCompare(b.code) 
                : b.code.localeCompare(a.code);
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rawResults, searchText, searchMode, quickFilter, selectedSource, filterBT, filterTBA, filterStatus, sortConfig, promoInput, filterPromoDisplay]);

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
  };

  const handleExport = () => {
    if (filteredResults.length === 0) return;
    const exportData = filteredResults.map(r => ({
        'Độ Khẩn': r.urgency === 'Critical' ? 'Gấp (Đỏ)' : 'Thường',
        'Trạng Thái': r.isDiscontinued ? 'Bỏ Mẫu' : (r.isNewArrival ? 'Hàng Mới' : 'Đang Bán'),
        'Mã SP': r.code,
        'Tên SP': r.name,
        'Loại': r.category,
        'Tồn Kho Chính': r.currentStockBT,
        'Tồn TBA/Kho Khác': r.currentStockTBA,
        'Định Mức Trưng (TBA Max)': r.tbaMaxStock,
        'Bán 30N': r.sold30Days,
        'Cần Kéo': r.needsRestock,
        'Có Thể Kéo': r.canPull,
        'Thiếu (Nhập NCC)': r.missingQuantity > 0 ? r.missingQuantity : 0,
        'Nguồn Lấy': r.sourcing.map(s => `${s.sourceWarehouse}: ${s.quantity}`).join(', '),
        'Ngày Trưng': r.displayInfo?.startDate || '-',
        'Số Ngày Đã Trưng': getDaysDisplayed(r.displayInfo?.startDate) || 0,
        'Tình Trạng': r.displayInfo?.condition || '-'
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "De_Xuat");
    XLSX.writeFile(wb, "De_Xuat_Inventory.xlsx");
  };

  return (
    <div className="absolute inset-0 bg-black text-gray-200 z-50 flex flex-col font-sans">
      {/* Help Modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      
      {/* Edit Modal */}
      {editingItem && (
          <EditDisplayModal 
            item={editingItem} 
            onClose={() => setEditingItem(null)} 
            onSave={handleUpdateDisplay}
          />
      )}

      {/* 1. Top Navigation Bar - HUB STYLE */}
      <div className="bg-black border-b border-orange-500 px-6 py-4 flex items-center justify-between shadow-lg z-20">
        <div className="flex items-center space-x-3">
             {/* HUB LOGO */}
            <div className="flex items-center tracking-tighter text-2xl font-bold select-none">
              <span className="text-white mr-1">Inventory&Display</span>
              <span className="bg-orange-500 text-black px-2 rounded-md pb-1 pt-0.5">hub</span>
            </div>
            
            <button 
                onClick={() => setShowHelp(true)}
                className="ml-4 text-xs flex items-center space-x-1 text-gray-500 hover:text-orange-400 transition-colors border border-gray-800 hover:border-orange-500 rounded-full px-2 py-1"
            >
                <CircleHelp className="w-4 h-4" />
                <span>Hướng dẫn</span>
            </button>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* 2. Left Sidebar */}
        <div className="w-80 bg-[#1b1b1b] border-r border-orange-500/30 flex flex-col z-10 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
            <div className="p-6 flex-1 overflow-y-auto">
                <h3 className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-6">1. Nhập Dữ Liệu Nguồn</h3>
                <FileUploadBox 
                    label="File Kho Chính (Của Bạn)"
                    description="File tồn kho chi nhánh hiện tại (VD: BT, Q9...)."
                    file={btFile}
                    onChange={(e: any) => handleFileChange(e, 'BT')}
                />
                <FileUploadBox 
                    label="File Thống Kê Bán"
                    description="File Excel thống kê bán hàng 30 ngày (tk)."
                    file={tkFile}
                    onChange={(e: any) => handleFileChange(e, 'TK')}
                />
                <FileUploadBox 
                    label="File Tồn Lâu (Tùy chọn)"
                    description="Excel: A(Mã), C(Tồn), G(Tháng chưa bán)."
                    file={slowFile}
                    onChange={(e: any) => handleFileChange(e, 'SLOW')}
                />
                <FileUploadBox 
                    label="Theo Dõi Trưng Bày (Tùy chọn)"
                    description="Excel: Cột A (Mã), B (Ngày), C (Tình trạng)."
                    file={displayFile}
                    onChange={(e: any) => handleFileChange(e, 'DISP')}
                />
                <div className="border-t border-gray-700 my-4"></div>
                <FileUploadBox 
                    label="File Kho Khác / Chi Nhánh"
                    description="Chọn file kho các nơi khác (TBA, 64, 7BC...) để kéo hàng."
                    file={whFiles}
                    multiple={true}
                    onChange={(e: any) => handleFileChange(e, 'WH')}
                />

                <div className="mt-6 bg-[#2a2a2a] p-4 rounded-xl border border-gray-700">
                    <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center">
                        <SearchCode className="w-4 h-4 mr-1.5 text-orange-500" />
                        2. Tra Cứu List / Promo
                    </h3>
                    <textarea 
                        className="w-full border border-gray-600 rounded-lg p-3 text-xs h-24 focus:ring-1 focus:ring-orange-500 outline-none bg-[#121212] text-white placeholder-gray-600"
                        placeholder="Paste mã sản phẩm vào đây (xuống dòng hoặc dấu phẩy)..."
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                    ></textarea>
                    <button 
                        onClick={() => setQuickFilter('PROMO_CHECK')}
                        disabled={!promoInput.trim()}
                        className="mt-2 w-full bg-orange-500 text-black py-2 rounded-lg text-xs font-bold hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center justify-center shadow-sm"
                    >
                        <Eye className="w-3 h-3 mr-1.5" />
                        Kiểm Tra Ngay
                    </button>
                    {quickFilter === 'PROMO_CHECK' && (
                        <div className="text-[10px] text-center text-orange-400 mt-2 font-medium">
                            Đang hiển thị chế độ danh sách riêng
                        </div>
                    )}
                </div>
            </div>
            <div className="p-6 border-t border-gray-700 bg-[#121212]">
                <button 
                    onClick={handleCalculate}
                    disabled={isCalculating || !btFile || !tkFile}
                    className="w-full bg-orange-500 text-black py-3.5 rounded-xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-900/20 disabled:opacity-50 disabled:shadow-none flex items-center justify-center space-x-2"
                >
                    {isCalculating ? <RefreshCw className="w-5 h-5 animate-spin"/> : <Calculator className="w-5 h-5" />}
                    <span>{isCalculating ? 'Đang Phân Tích...' : 'Tính Toán Ngay'}</span>
                </button>
            </div>
        </div>

        {/* 3. Main Dashboard Area */}
        <div className="flex-1 flex flex-col bg-black overflow-hidden relative">
            {/* Background Texture/Gradient for modern feel */}
            <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0a0a0a] to-[#121212] pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col h-full">
            {rawResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <div className="w-24 h-24 bg-[#1b1b1b] border border-gray-800 rounded-full flex items-center justify-center shadow-sm mb-6">
                        <UploadCloud className="w-10 h-10 text-orange-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-300">Chưa có dữ liệu</h3>
                    <p className="max-w-md text-center mt-2 text-sm text-gray-600">
                        Vui lòng nhập các file Excel ở cột bên trái và nhấn "Tính Toán Ngay".
                    </p>
                    <button onClick={() => setShowHelp(true)} className="mt-4 text-blue-500 hover:text-blue-400 text-sm font-medium underline">
                        Xem hướng dẫn sử dụng
                    </button>
                </div>
            ) : (
                <>
                    {/* 3a. Smart Stats Cards */}
                    <div className="p-6 grid grid-cols-7 gap-2">
                        <StatCard 
                            title="Nguy Cấp" 
                            value={stats.critical} 
                            subtext="Tồn 0 / Thấp"
                            icon={AlertTriangle} 
                            colorClass="bg-red-600 text-red-500" 
                            active={quickFilter === 'CRITICAL'}
                            onClick={() => setQuickFilter('CRITICAL')}
                        />
                        <StatCard 
                            title="Cần Bổ Sung" 
                            value={stats.normalRestock} 
                            subtext="Kéo hàng"
                            icon={ShoppingCart} 
                            colorClass="bg-yellow-500 text-yellow-500" 
                            active={quickFilter === 'NORMAL_RESTOCK'}
                            onClick={() => setQuickFilter('NORMAL_RESTOCK')}
                        />
                        <StatCard 
                            title="Hàng Mới" 
                            value={stats.newArrivals} 
                            subtext="Chưa có ở kho này"
                            icon={CheckCircle2} 
                            colorClass="bg-blue-500 text-blue-500" 
                            active={quickFilter === 'NEW'}
                            onClick={() => setQuickFilter('NEW')}
                        />
                        <StatCard 
                            title="QL Trưng Bày" 
                            value={stats.displayIssues} 
                            subtext="Cần trưng/Trả"
                            icon={Monitor} 
                            colorClass="bg-purple-500 text-purple-500" 
                            active={quickFilter === 'DISPLAY_CHECK'}
                            onClick={() => setQuickFilter('DISPLAY_CHECK')}
                        />
                        <StatCard 
                            title="Tồn Lâu" 
                            value={stats.slowMoving} 
                            subtext="Chậm luân chuyển"
                            icon={Hourglass} 
                            colorClass="bg-orange-500 text-orange-500" 
                            active={quickFilter === 'SLOW_MOVING'}
                            onClick={() => setQuickFilter('SLOW_MOVING')}
                        />
                        <StatCard 
                            title="Bỏ Mẫu" 
                            value={stats.discontinued} 
                            subtext="Mã 0.xxx"
                            icon={PackageX} 
                            colorClass="bg-gray-500 text-gray-400" 
                            active={quickFilter === 'DISCONTINUED'}
                            onClick={() => setQuickFilter('DISCONTINUED')}
                        />
                         <StatCard 
                            title="Tổng Mã" 
                            value={stats.total} 
                            subtext="Tất cả"
                            icon={Database} 
                            colorClass="bg-white text-white" 
                            active={quickFilter === 'ALL'}
                            onClick={() => setQuickFilter('ALL')}
                        />
                    </div>

                    {/* 3b. Smart Toolbar & Filters */}
                    <div className="px-6 pb-4 flex items-center justify-between space-x-4">
                        {/* Search Input: Only show if NOT in Promo Mode (to avoid confusion) */}
                        {quickFilter !== 'PROMO_CHECK' ? (
                            <div className="flex items-center space-x-2 flex-1 bg-[#1b1b1b] border border-gray-700 rounded-lg px-3 py-2 shadow-sm focus-within:border-orange-500 transition-all">
                                <Search className="w-4 h-4 text-gray-500" />
                                <input 
                                    type="text"
                                    placeholder={searchMode === 'STARTS_WITH' ? "Nhập mã bắt đầu..." : "Tìm mã hoặc tên..."}
                                    className="flex-1 outline-none text-sm bg-transparent text-white placeholder-gray-600"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                />
                                <div className="flex items-center space-x-1 border-l pl-2 border-gray-700">
                                    <button 
                                        onClick={() => setSearchMode('CONTAINS')}
                                        className={`text-[10px] font-bold px-2 py-1 rounded ${searchMode === 'CONTAINS' ? 'bg-orange-500 text-black' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Chứa
                                    </button>
                                    <button 
                                        onClick={() => setSearchMode('STARTS_WITH')}
                                        className={`text-[10px] font-bold px-2 py-1 rounded ${searchMode === 'STARTS_WITH' ? 'bg-orange-500 text-black' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Bắt đầu
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // PROMO MODE TOOLBAR ACTIONS
                            <div className="flex-1 flex items-center space-x-2">
                                <div className="text-sm text-gray-500 italic mr-2 border-r border-gray-700 pr-4">
                                    Chế độ Danh Sách
                                </div>
                                <button 
                                    onClick={handleCopyPromoDisplayed}
                                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#2d2a3e] text-purple-400 hover:bg-[#3d3852] rounded-lg border border-purple-900/50 text-xs font-bold transition-colors"
                                >
                                    <CopyCheck className="w-3.5 h-3.5" />
                                    <span>Copy Đã Trưng</span>
                                </button>
                                <button 
                                    onClick={handleCopyPromoOpportunity}
                                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#2a3441] text-blue-400 hover:bg-[#324053] rounded-lg border border-blue-900/50 text-xs font-bold transition-colors"
                                >
                                    <ListPlus className="w-3.5 h-3.5" />
                                    <span>Copy Chưa Trưng (Có Tồn)</span>
                                </button>
                            </div>
                        )}

                        <div className="flex items-center space-x-2">
                             {quickFilter === 'DISPLAY_CHECK' ? (
                                <button 
                                    onClick={handleExportDisplayData}
                                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-sm flex items-center text-sm font-semibold transition-colors whitespace-nowrap"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    Lưu DL Trưng Bày
                                </button>
                             ) : (
                                <>
                                    {/* Source Filter - Always visible for filtering Actions */}
                                    <div className="flex items-center bg-[#1b1b1b] border border-gray-700 rounded-lg px-3 py-2 shadow-sm">
                                        <Filter className="w-4 h-4 text-gray-500 mr-2" />
                                        <span className="text-xs font-semibold text-gray-500 mr-2 uppercase">Nguồn:</span>
                                        <select 
                                            className="text-sm font-medium text-gray-300 bg-transparent outline-none cursor-pointer"
                                            value={selectedSource}
                                            onChange={(e) => setSelectedSource(e.target.value)}
                                        >
                                            <option value="ALL">Tất cả kho ({availableWarehouses.length})</option>
                                            {availableWarehouses.map(wh => (
                                                <option key={wh} value={wh}>{wh}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button 
                                        onClick={handleExport}
                                        className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg shadow-sm flex items-center text-sm font-semibold transition-colors whitespace-nowrap"
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Xuất Excel
                                    </button>
                                </>
                             )}
                        </div>
                    </div>

                    {/* 3c. Data Table */}
                    <div className="flex-1 overflow-auto px-6 pb-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-black">
                        <div className="bg-[#1b1b1b] rounded-xl shadow-sm border border-gray-800 overflow-hidden min-w-full">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-black text-gray-400 font-semibold border-b border-orange-500/50 text-xs uppercase tracking-wider sticky top-0 z-10">
                                    <tr>
                                        {/* Sản Phẩm - Sortable */}
                                        <th className="px-6 py-4 cursor-pointer hover:bg-gray-900" onClick={() => handleSort('code')}>
                                             <div className="flex items-center gap-1">
                                                Sản Phẩm
                                                {sortConfig?.key === 'code' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}
                                             </div>
                                        </th>
                                        
                                        {/* Dynamic Headers based on Mode */}
                                        {quickFilter === 'PROMO_CHECK' ? (
                                            <>
                                                 <th className="px-4 py-4 text-center text-blue-400 bg-blue-900/20 min-w-[120px]">
                                                     <div className="flex flex-col items-center gap-1">
                                                        <button onClick={() => handleSort('currentStockBT')} className="flex items-center gap-1 hover:text-blue-300 mb-1">
                                                            Tồn Chính
                                                            {sortConfig?.key === 'currentStockBT' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}
                                                        </button>
                                                        <select 
                                                            value={filterBT} 
                                                            onChange={(e) => setFilterBT(e.target.value)}
                                                            className="w-full text-[10px] border border-blue-800 rounded px-1 py-0.5 font-normal bg-black text-blue-400"
                                                        >
                                                            <option value="ALL">Tất cả</option>
                                                            <option value="0">Hết (0)</option>
                                                            <option value=">0">Có hàng</option>
                                                            <option value="<5">Thấp (&lt;5)</option>
                                                        </select>
                                                     </div>
                                                 </th>
                                                 <th className="px-4 py-4 text-center text-purple-400 bg-purple-900/20 cursor-pointer hover:bg-purple-900/30" onClick={() => handleSort('currentStockTBA')}>
                                                      <div className="flex items-center justify-center gap-1">
                                                        Tồn Khác / Max
                                                        {sortConfig?.key === 'currentStockTBA' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}
                                                     </div>
                                                 </th>
                                                 <th className="px-4 py-4 text-center text-gray-300 min-w-[140px]">
                                                     <div className="flex flex-col items-center gap-1">
                                                        <button onClick={() => handleSort('displayStatus')} className="flex items-center gap-1 hover:text-white mb-1">
                                                            Trạng Thái TB
                                                            {sortConfig?.key === 'displayStatus' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}
                                                        </button>
                                                        <select 
                                                            value={filterPromoDisplay} 
                                                            onChange={(e) => setFilterPromoDisplay(e.target.value)}
                                                            className="w-full text-[10px] border border-gray-700 rounded px-1 py-0.5 font-normal bg-black text-gray-300"
                                                        >
                                                            <option value="ALL">Tất cả</option>
                                                            <option value="DISPLAYED">Đã Trưng</option>
                                                            <option value="NOT_DISPLAYED">Chưa Trưng</option>
                                                        </select>
                                                     </div>
                                                 </th>
                                                 <th className="px-4 py-4 text-center text-red-400 bg-red-900/20 cursor-pointer hover:bg-red-900/30" onClick={() => handleSort('needsRestock')}>
                                                     <div className="flex items-center justify-center gap-1">
                                                        Nhu Cầu Nhập
                                                        {sortConfig?.key === 'needsRestock' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}
                                                     </div>
                                                 </th>
                                                 <th className="px-4 py-4 w-1/4">Hành Động (Nguồn)</th>
                                            </>
                                        ) : (
                                            /* Normal Headers */
                                            <>
                                                {/* Tồn BT Header & Filter */}
                                                <th className="px-4 py-4 text-center min-w-[100px]">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <button onClick={() => handleSort('currentStockBT')} className="flex items-center gap-1 hover:text-orange-500">
                                                            Tồn Chính
                                                            {sortConfig?.key === 'currentStockBT' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}
                                                        </button>
                                                        <select 
                                                            value={filterBT} 
                                                            onChange={(e) => setFilterBT(e.target.value)}
                                                            className="w-full text-[10px] border border-gray-700 rounded px-1 py-0.5 font-normal bg-black text-gray-300"
                                                        >
                                                            <option value="ALL">Tất cả</option>
                                                            <option value="0">Hết (0)</option>
                                                            <option value=">0">Có hàng</option>
                                                            <option value="<5">Thấp (&lt;5)</option>
                                                        </select>
                                                    </div>
                                                </th>

                                                {quickFilter === 'DISPLAY_CHECK' ? (
                                                     <>
                                                        <th className="px-4 py-4 text-center min-w-[100px]">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <button onClick={() => handleSort('currentStockTBA')} className="flex items-center gap-1 hover:text-orange-500">
                                                                    Tồn Kho Khác
                                                                    {sortConfig?.key === 'currentStockTBA' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}
                                                                </button>
                                                                <select 
                                                                    value={filterTBA} 
                                                                    onChange={(e) => setFilterTBA(e.target.value)}
                                                                    className="w-full text-[10px] border border-gray-700 rounded px-1 py-0.5 font-normal bg-black text-gray-300"
                                                                >
                                                                    <option value="ALL">Tất cả</option>
                                                                    <option value="0">Hết (0)</option>
                                                                    <option value=">0">Đang trưng</option>
                                                                </select>
                                                            </div>
                                                        </th>
                                                        <th className="px-4 py-4 text-center text-purple-400 bg-purple-900/10">Tồn Max</th>
                                                        <th className="px-4 py-4 text-center min-w-[120px]">
                                                             <div className="flex flex-col items-center gap-1">
                                                                <span>Trạng Thái</span>
                                                                <select 
                                                                    value={filterStatus} 
                                                                    onChange={(e) => setFilterStatus(e.target.value)}
                                                                    className="w-full text-[10px] border border-gray-700 rounded px-1 py-0.5 font-normal bg-black text-gray-300"
                                                                >
                                                                    <option value="ALL">Tất cả</option>
                                                                    <option value="Cân nhắc trả">Cân nhắc trả</option>
                                                                    <option value="Kéo trưng bày">Kéo trưng bày</option>
                                                                    <option value="Trả kho">Trả kho (&gt;20N)</option>
                                                                    <option value="Thiếu định mức">Thiếu định mức</option>
                                                                    <option value="OK">OK</option>
                                                                </select>
                                                            </div>
                                                        </th>
                                                        <th className="px-4 py-4 text-center">Cập Nhật</th>
                                                     </>
                                                ) : quickFilter === 'SLOW_MOVING' ? (
                                                    <>
                                                        <th className="px-4 py-4 text-center text-orange-500">Tồn Theo File</th>
                                                        <th className="px-4 py-4 text-center text-red-500">Lệch Tồn</th>
                                                        <th className="px-4 py-4 text-center text-gray-300">Tháng Chưa Bán</th>
                                                        <th className="px-6 py-4 w-1/4">Đề Xuất</th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th className="px-4 py-4 text-center">Tồn Khác</th>
                                                        <th className="px-4 py-4 text-center" onClick={() => handleSort('sold30Days')}>
                                                            <div className="flex items-center justify-center gap-1 cursor-pointer hover:text-orange-500">
                                                                Bán 30N 
                                                                {sortConfig?.key === 'sold30Days' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}
                                                            </div>
                                                        </th>
                                                        <th className="px-4 py-4 text-center bg-blue-900/10 text-blue-400 cursor-pointer" onClick={() => handleSort('needsRestock')}>
                                                            <div className="flex items-center justify-center gap-1">
                                                                Cần Thêm
                                                                {sortConfig?.key === 'needsRestock' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}
                                                            </div>
                                                        </th>
                                                        <th className="px-4 py-4 text-center bg-green-900/10 text-green-400">Lấy Được</th>
                                                        <th className="px-6 py-4 w-1/4">Phân Bổ Nguồn Kéo</th>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {filteredResults.map((r, idx) => {
                                        const isCritical = r.urgency === 'Critical';
                                        
                                        // Display Logic Vars
                                        const tbaMax = r.tbaMaxStock;
                                        const tbaCurr = r.currentStockTBA;
                                        const isMissingMax = tbaMax < 1;
                                        
                                        const daysDisp = getDaysDisplayed(r.displayInfo?.startDate);
                                        const condition = r.displayInfo?.condition || 'Unknown';
                                        // FIX: Ensure stock > 0 for return logic in render as well
                                        const isReturnNeeded = r.currentStockTBA > 0 && daysDisp > 20 && condition === 'New';

                                        // Supplier Logic
                                        const needExternalSupply = r.missingQuantity > 0;
                                        const isBestSeller = r.sold30Days >= 5;

                                        // Slow Stock Logic
                                        const mismatch = r.slowStockInfo ? (r.currentStockBT !== r.slowStockInfo.reportedStock) : false;

                                        return (
                                        <tr key={idx} className={`group transition-colors ${isCritical && (quickFilter as string) !== 'DISPLAY_CHECK' ? 'bg-[#2a1212] hover:bg-[#3a1a1a]' : 'bg-[#1b1b1b] hover:bg-[#252525]'}`}>
                                            {/* Product Info */}
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center space-x-2">
                                                        <span className={`font-bold transition-colors ${isCritical ? 'text-red-500' : 'text-gray-200'}`}>{r.code}</span>
                                                        <button onClick={() => copyToClipboard(r.code)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded text-gray-400">
                                                            <Copy className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                    <span className={`text-xs truncate max-w-xs mt-0.5 ${isCritical ? 'text-red-400' : 'text-gray-500'}`} title={r.name}>{r.name}</span>
                                                    <div className="mt-1 flex gap-1">
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border bg-gray-900 text-gray-400 border-gray-700`}>{r.category}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            
                                            {/* RENDER LOGIC BASED ON FILTER MODE */}
                                            
                                            {quickFilter === 'PROMO_CHECK' ? (
                                                <>
                                                    {/* 1. Tồn BT */}
                                                    <td className={`px-4 py-4 text-center font-bold ${r.currentStockBT > 0 ? 'text-blue-400' : 'text-red-500'}`}>
                                                        {r.currentStockBT}
                                                    </td>

                                                    {/* 2. Tồn TBA / Max */}
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="flex flex-col items-center">
                                                            <span className={`font-bold ${r.currentStockTBA > 0 ? 'text-purple-400' : 'text-gray-600'}`}>
                                                                {r.currentStockTBA} <span className="text-gray-600 font-normal">/ {r.tbaMaxStock}</span>
                                                            </span>
                                                            {isMissingMax && <span className="text-[9px] text-red-500 italic">Chưa set max</span>}
                                                        </div>
                                                    </td>

                                                    {/* 3. Trạng Thái Trưng Bày */}
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            {r.currentStockTBA > 0 ? (
                                                                <span className="text-green-500 text-xs font-bold bg-green-900/30 px-2 py-0.5 rounded border border-green-900">Đã Trưng Bày</span>
                                                            ) : (
                                                                <span className="text-gray-600 text-xs font-medium">Chưa trưng</span>
                                                            )}
                                                            
                                                            {r.shouldDisplay && (
                                                                <div className="flex items-center text-xs text-blue-400 font-bold animate-pulse">
                                                                    <ArrowUpFromLine className="w-3 h-3 mr-1" />
                                                                    Cần Kéo
                                                                </div>
                                                            )}
                                                            {r.isTbaSolo && <span className="text-[10px] text-yellow-500 bg-yellow-900/30 px-1 rounded">Cân nhắc trả</span>}
                                                        </div>
                                                    </td>

                                                    {/* 4. Nhu Cầu Nhập (Needs Restock) */}
                                                    <td className="px-4 py-4 text-center">
                                                        {r.needsRestock > 0 ? (
                                                             <div className="flex flex-col items-center">
                                                                 <span className="text-red-500 font-bold text-sm">Cần: {r.needsRestock}</span>
                                                                 {r.missingQuantity > 0 && (
                                                                     <span className="text-[10px] text-orange-500 font-semibold bg-orange-900/30 px-1 rounded mt-0.5">
                                                                         Nhập NCC: {r.missingQuantity}
                                                                     </span>
                                                                 )}
                                                             </div>
                                                        ) : (
                                                            <span className="text-green-500 text-xs">Đủ hàng</span>
                                                        )}
                                                    </td>
                                                    
                                                    {/* 5. Nguồn / Hành Động */}
                                                    <td className="px-4 py-4">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {r.sourcing.map((s, i) => (
                                                                <div key={i} className={`flex items-center border rounded-md px-2 py-0.5 text-xs bg-[#121212] border-blue-900 text-blue-400`}>
                                                                    <span className="font-bold mr-1">{s.sourceWarehouse}</span>
                                                                    <ArrowRight className="w-3 h-3 mr-1" />
                                                                    <span className="font-bold">{s.quantity}</span>
                                                                </div>
                                                            ))}
                                                            {r.sourcing.length === 0 && r.needsRestock === 0 && (
                                                                <span className="text-gray-700 italic text-xs">--</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    {/* Standard View Columns */}
                                                    <td className={`px-4 py-4 text-center font-bold ${r.currentStockBT === 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                                        {r.currentStockBT}
                                                    </td>
                                                    
                                                    {quickFilter === 'DISPLAY_CHECK' ? (
                                                        <>
                                                            <td className={`px-4 py-4 text-center font-bold ${tbaCurr === 0 ? 'text-gray-600' : 'text-purple-400'}`}>
                                                                {tbaCurr}
                                                            </td>
                                                            <td className="px-4 py-4 text-center font-bold text-gray-400 bg-purple-900/10">
                                                                {isMissingMax ? (
                                                                    <span className="text-red-500 text-xs italic">Chưa set</span>
                                                                ) : tbaMax}
                                                            </td>
                                                            <td className="px-4 py-4 text-center flex flex-col items-center justify-center space-y-1">
                                                                {r.isTbaSolo && (
                                                                    <div className="flex items-center space-x-1 bg-yellow-900/30 text-yellow-500 px-2 py-0.5 rounded text-[10px] font-bold border border-yellow-900/50">
                                                                        <ArrowDownToLine className="w-3 h-3" />
                                                                        <span>CÂN NHẮC TRẢ</span>
                                                                    </div>
                                                                )}

                                                                {r.shouldDisplay && (
                                                                    <div className="flex items-center space-x-1 bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-900/50">
                                                                        <ArrowUpFromLine className="w-3 h-3" />
                                                                        <span>KÉO TRƯNG BÀY</span>
                                                                    </div>
                                                                )}

                                                                {isMissingMax && !r.shouldDisplay && (
                                                                    <span className="bg-red-900/20 text-red-500 px-2 py-0.5 rounded text-[10px] font-bold border border-red-900/50">CÀI ĐẶT LẠI</span>
                                                                )}
                                                                
                                                                {isReturnNeeded && (
                                                                    <span className="bg-red-900/30 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold border border-red-900">TRẢ KHO (&gt;20N)</span>
                                                                )}

                                                                {!r.isTbaSolo && !r.shouldDisplay && !isMissingMax && !isReturnNeeded && (
                                                                    <span className="text-green-500 text-[10px] font-bold">OK</span>
                                                                )}
                                                                
                                                                {/* Show existing display info if present */}
                                                                {r.displayInfo && (
                                                                    <div className="mt-2 flex flex-col items-center gap-1">
                                                                        {r.currentStockTBA > 0 ? (
                                                                            <>
                                                                                <div className={`text-[10px] font-bold flex items-center justify-center space-x-1 ${daysDisp > 15 ? 'text-orange-500' : 'text-gray-500'}`}>
                                                                                    <Clock className="w-3 h-3" />
                                                                                    <span>{daysDisp} ngày</span>
                                                                                </div>
                                                                                
                                                                                {/* Condition Label */}
                                                                                <div className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                                                                    r.displayInfo.condition === 'New' ? 'bg-blue-900/20 text-blue-400 border-blue-900' :
                                                                                    r.displayInfo.condition === 'Scratched' ? 'bg-orange-900/20 text-orange-400 border-orange-900' :
                                                                                    r.displayInfo.condition === 'Used' ? 'bg-gray-800 text-gray-400 border-gray-700' :
                                                                                    'bg-[#1a1a1a] text-gray-300 border-gray-600'
                                                                                }`}>
                                                                                    {r.displayInfo.condition === 'New' ? 'Mới' : 
                                                                                    r.displayInfo.condition === 'Scratched' ? 'Trầy xước' : 
                                                                                    r.displayInfo.condition === 'Used' ? 'Đã dùng' : r.displayInfo.condition}
                                                                                </div>

                                                                                <span className="text-[9px] text-gray-600">({r.displayInfo.startDate})</span>
                                                                            </>
                                                                        ) : (
                                                                            <span className="text-[10px] text-gray-500 italic">
                                                                                Lịch sử: {r.displayInfo.startDate}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-4 text-center">
                                                                <button 
                                                                    onClick={() => setEditingItem(r)}
                                                                    className="p-1.5 bg-gray-800 hover:bg-orange-900 text-gray-400 hover:text-orange-500 rounded-md transition-colors"
                                                                    title="Cập nhật thông tin"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </>
                                                    ) : quickFilter === 'SLOW_MOVING' ? (
                                                        <>
                                                            <td className="px-4 py-4 text-center font-bold text-gray-500">
                                                                {r.slowStockInfo?.reportedStock || '-'}
                                                            </td>
                                                            <td className="px-4 py-4 text-center font-bold">
                                                                {mismatch ? (
                                                                    <span className="text-red-500 bg-red-900/30 px-2 py-1 rounded text-xs animate-pulse">Lệch SL</span>
                                                                ) : (
                                                                    <span className="text-green-500 text-xs">Khớp</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-4 text-center text-gray-400">
                                                                {r.slowStockInfo?.monthsUnsold || 0} tháng
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-wrap gap-1">
                                                                    <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded">Kiểm tra tem</span>
                                                                    <span className="text-[10px] bg-orange-900/30 text-orange-500 px-2 py-1 rounded">Chụp ảnh</span>
                                                                </div>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className={`px-4 py-4 text-center font-bold ${r.currentStockTBA > 0 ? 'text-purple-400' : 'text-gray-600'}`}>
                                                                {r.currentStockTBA}
                                                            </td>

                                                            <td className="px-4 py-4 text-center text-gray-400">{r.sold30Days}</td>
                                                            
                                                            {/* Action Numbers */}
                                                            <td className="px-4 py-4 text-center font-bold text-blue-400 bg-blue-900/20">
                                                                {r.needsRestock}
                                                            </td>
                                                            <td className="px-4 py-4 text-center font-bold text-green-400 bg-green-900/20">
                                                                {r.canPull}
                                                            </td>

                                                            {/* Sourcing Visuals */}
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-wrap gap-2">
                                                                    {/* Internal Transfers */}
                                                                    {r.sourcing.map((s, i) => (
                                                                        <div key={i} className={`flex items-center border rounded-md pl-2 pr-3 py-1 shadow-sm text-xs bg-[#121212] border-gray-700`}>
                                                                            <span className="font-bold text-gray-400 mr-1.5">{s.sourceWarehouse}</span>
                                                                            <ArrowRight className="w-3 h-3 text-gray-600 mr-1.5" />
                                                                            <span className="font-bold text-green-500">{s.quantity}</span>
                                                                        </div>
                                                                    ))}

                                                                    {/* SUPPLIER WARNING */}
                                                                    {needExternalSupply && !r.isDiscontinued && (
                                                                        <div className={`flex items-center border rounded-md pl-2 pr-3 py-1 shadow-sm text-xs 
                                                                            ${isBestSeller ? 'bg-red-900/30 border-red-900 animate-pulse' : 'bg-orange-900/20 border-orange-900/50'}
                                                                        `}>
                                                                            {isBestSeller && <AlertTriangle className="w-3 h-3 text-red-500 mr-1" />}
                                                                            <span className={`font-bold mr-1.5 ${isBestSeller ? 'text-red-400' : 'text-orange-500'}`}>
                                                                                NHẬP NCC
                                                                            </span>
                                                                            <span className={`font-bold ${isBestSeller ? 'text-red-400' : 'text-orange-400'}`}>
                                                                                {r.missingQuantity}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {r.sourcing.length === 0 && !needExternalSupply && <span className="text-gray-700 text-xs italic">--</span>}
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
