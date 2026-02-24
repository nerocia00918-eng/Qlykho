import * as XLSX from 'xlsx';
import { RestockRecommendation, SourcingPlan, WarehouseItem, DisplayInfo, SlowStockInfo, WarehouseStockInfo, ABCClass } from '../types';

// Optimization: Use a Prefix Map instead of linear if-else scan
// Added 'TN.' and 'U.' as requested
const PREFIX_MAP: Record<string, string> = {
  'V.': 'VGA', 'M.': 'Mainboard', 'L.': 'LCD', 'Ca.': 'Case',
  'Lt.': 'Laptop', 'HP.': 'Headphone', 'Mo.': 'Mouse', 'KB.': 'Keyboard',
  'SS.': 'SSD', 'R3.': 'RAM D3', 'R4.': 'RAM D4', 'R5.': 'RAM D5',
  'P.': 'Nguồn (PSU)', 'F.': 'Tản Nhiệt (Fan)', 'CB.': 'Combo Phím Chuột',
  'Lo.': 'Loa', 'MB.': 'Máy Bộ', 'MI.': 'Máy In', 'TN.': 'Thẻ Nhớ',
  'KTN.': 'Keo Tản Nhiệt', 'cmr.': 'Camera', 'WC.': 'Webcam', 'MP.': 'Mousepad',
  'RT.': 'Router', 'SW.': 'Switch', 'GT.': 'Giá Treo', 'Gia.': 'Giá Đỡ',
  'U.': 'USB/Hub', 'Cap.': 'Cable', 'CPU.': 'Vi Xử Lý (CPU)'
};

// Helper: Safe Integer Parsing handles "1.200" => 1200 (VN Format)
const safeParseInt = (value: any): number => {
    if (typeof value === 'number') return Math.floor(value);
    if (!value) return 0;
    
    let str = String(value).trim();
    if (str === '') return 0;

    // Handle Vietnamese/European formatting where dot (.) is thousand separator
    if (str.includes('.') && !str.includes(',')) {
        str = str.replace(/\./g, '');
    } else if (str.includes(',') && !str.includes('.')) {
         str = str.replace(/,/g, '');
    }

    const parsed = parseInt(str, 10);
    return isNaN(parsed) ? 0 : parsed;
};

// Helper: Safe Float Parsing for Price
const safeParseFloat = (value: any): number => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    let str = String(value).trim();
    if (str === '') return 0;

    if (str.includes('.') && !str.includes(',')) {
         str = str.replace(/\./g, '');
    } else if (str.includes(',') && !str.includes('.')) {
         str = str.replace(/,/g, '');
    }
    
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
};

const categorizeProduct = (code: string, name: string): string => {
  const c = code.trim().toUpperCase(); 
  
  for (const prefix in PREFIX_MAP) {
      if (c.startsWith(prefix.toUpperCase())) return PREFIX_MAP[prefix];
  }
  
  const n = name.toLowerCase();
  if (n.includes('ghế')) return 'Ghế';
  if (n.includes('bàn')) return 'Bàn';
  
  return 'Khác';
};

const getTargetDays = (category: string): number => {
  if (['VGA', 'Mainboard', 'Laptop', 'LCD', 'Máy Bộ', 'Máy In', 'Vi Xử Lý (CPU)', 'Thẻ Nhớ', 'USB/Hub'].includes(category)) return 4;
  return 7;
};

const getDefaultDisplayStock = (category: string): number => {
    const displayCategories = [
        'LCD', 'Laptop', 'Mainboard', 'VGA', 'Case', 
        'Loa', 'Headphone', 'Keyboard', 'Mouse', 
        'Combo Phím Chuột', 'Máy Bộ', 'Ghế', 'Bàn'
    ];
    return displayCategories.includes(category) ? 1 : 0;
};

interface WhEntry {
    stock: number;
    maxStock: number; 
    name: string;
    whNameFromRow?: string; 
}

// Updated Parsing Functions
export const parseWarehouseFile = async (file: File): Promise<Map<string, WhEntry>> => {
  const data = await readFileToJson(file);
  const stockMap = new Map<string, WhEntry>();
  
  if (data.length === 0) return stockMap;

  // --- STRICT FALLBACK CONFIG ---
  // If headers fail, we trust these columns based on user image/description
  // B (Index 1) = Code
  // C (Index 2) = Name
  // E (Index 4) = Stock
  let codeIdx = 1;
  let nameIdx = 2;
  let stockIdx = 4;
  let whIdx = 0; 
  let headerFound = false;

  const headerRowLimit = Math.min(data.length, 10);
  for (let r = 0; r < headerRowLimit; r++) {
      const row = data[r];
      if (!Array.isArray(row)) continue;
      
      let matchedCols = 0;
      let tempCode = -1, tempStock = -1;

      row.forEach((cell, idx) => {
          const txt = String(cell).toLowerCase().trim().replace(/\s+/g, ' '); 
          if (txt.includes('mã sp') || txt.includes('mã hàng') || txt === 'mã') {
              tempCode = idx; matchedCols++;
          }
          if (txt === 'số lượng' || txt === 'tồn kho' || txt === 'tồn' || txt === 'sl' || txt === 'thực tồn') {
              tempStock = idx; matchedCols++;
          }
          if (txt === 'kho' || txt === 'tên kho') whIdx = idx;
      });
      
      if (tempCode !== -1 && tempStock !== -1) {
          codeIdx = tempCode;
          stockIdx = tempStock;
          // Look for name around code
          if (row[tempCode + 1]) nameIdx = tempCode + 1;
          headerFound = true;
          break;
      }
  }

  // If header not found, we proceed with defaults (1, 2, 4) aggressively
  
  data.forEach((row: any[]) => {
    // Safety check: row must have at least enough length for code
    if (!row || row.length <= codeIdx) return; 
    
    // Skip obvious header rows if they contain "Mã" in the code column
    const rawCode = String(row[codeIdx] || '').trim();
    if (rawCode.toLowerCase().includes('mã') || rawCode.toLowerCase() === 'code') return;

    // FORCE UPPERCASE and Remove Zero-Width spaces
    const code = rawCode.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toUpperCase(); 
    if (!code) return; 

    // Capture other data
    const whNameInRow = String(row[whIdx] || '').trim();
    const name = String(row[nameIdx] || ''); 
    const stock = safeParseInt(row[stockIdx]); 

    // We accept the code even if stock is 0, to ensure it appears in the total list
    const current = stockMap.get(code);
    if (current) {
        stockMap.set(code, { 
            ...current, 
            stock: current.stock + stock
        });
    } else {
        stockMap.set(code, { stock, maxStock: 0, name, whNameFromRow: whNameInRow });
    }
  });
  return stockMap;
};

export const parseBTFile = async (file: File): Promise<Map<string, WarehouseItem>> => {
  const data = await readFileToJson(file);
  const itemMap = new Map<string, WarehouseItem>();

  // Detect format
  let isNewFormat = false;
  if (data.length > 0) {
      const firstRow = data[0] || [];
      const headerA = String(firstRow[0] || '').toLowerCase();
      // If column A is "mã sp" or similar, it's the new format
      if (headerA.includes('mã') || headerA === 'code') {
          isNewFormat = true;
      }
  }

  data.forEach((row: any[], index: number) => {
    if (!row || row.length < 2) return;
    
    let code = '';
    let name = '';
    let currentStock = 0;
    let maxStock = 9999;
    let price = 0;
    let pendingOrders = 0;
    let ahCoefficient = 0;

    if (isNewFormat) {
        // New Format: A(0)=Mã, B(1)=Tên, K(10)=Xuất bán, M(12)=Tồn cuối, O(14)=Tồn Max, S(18)=Đơn treo, AH(33)=Hệ số
        if (index === 0) return; // Skip header
        code = String(row[0] || '').trim().toUpperCase();
        if (!code || code.includes('MÃ')) return;
        
        name = String(row[1] || '');
        currentStock = safeParseInt(row[12]); // M
        maxStock = safeParseInt(row[14]) || 9999; // O
        pendingOrders = safeParseInt(row[18]); // S
        ahCoefficient = safeParseFloat(row[33]); // AH
        price = 0; // Not specified in new format, default to 0
    } else {
        // Old Format: B(1)=Mã, C(2)=Tên, E(4)=Tồn, F(5)=Giá, Y(24)=Max
        code = String(row[1] || '').trim().toUpperCase(); 
        if (!code || code.includes('MÃ')) return; 

        name = String(row[2] || ''); 
        currentStock = safeParseInt(row[4]); 
        price = safeParseFloat(row[5]); 
        
        if (row[24]) {
            maxStock = safeParseInt(row[24]);
        }
    }

    if (itemMap.has(code)) {
        const existing = itemMap.get(code)!;
        itemMap.set(code, {
            ...existing,
            currentStock: existing.currentStock + currentStock,
            pendingOrders: (existing.pendingOrders || 0) + pendingOrders,
        });
    } else {
        itemMap.set(code, { code, name, currentStock, maxStock, price, pendingOrders, ahCoefficient });
    }
  });
  return itemMap;
};

export const parseStatsFile = async (file: File): Promise<Map<string, number>> => {
  const data = await readFileToJson(file);
  const stats = new Map<string, number>();

  data.forEach((row: any[]) => {
    if (!row || row.length < 1) return;
    const code = String(row[0] || '').trim().toUpperCase();
    if (!code || code.includes('MÃ')) return;

    // Column K is Index 10
    const sold = safeParseInt(row[10]); 
    
    if (sold > 0) {
        const currentTotal = stats.get(code) || 0;
        stats.set(code, currentTotal + sold);
    }
  });
  return stats;
};

export const parseDisplayFile = async (file: File): Promise<Map<string, DisplayInfo>> => {
    const data = await readFileToJson(file);
    const map = new Map<string, DisplayInfo>();
    
    data.forEach((row: any[]) => {
        if (!row || row.length < 1) return;
        const code = String(row[0] || '').trim().toUpperCase();
        let startDate = '';
        const rawDate = row[1];

        if (rawDate) {
            if (typeof rawDate === 'number') {
                const date = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
                startDate = date.toISOString().split('T')[0];
            } else {
                const dateStr = String(rawDate).trim();
                startDate = dateStr;
            }
        }
        let condition = String(row[2] || '').trim();
        if (!condition) condition = 'New';

        if (code && startDate) {
            map.set(code, { startDate, condition });
        }
    });
    return map;
};

export const parseSlowStockFile = async (file: File): Promise<Map<string, SlowStockInfo>> => {
    const data = await readFileToJson(file);
    const map = new Map<string, SlowStockInfo>();
    
    data.forEach((row: any[]) => {
        if (!row || row.length < 1) return;
        const code = String(row[0] || '').trim().toUpperCase(); 
        if (!code || code.includes('MÃ')) return;
        const reportedStock = safeParseInt(row[2]);
        const monthsUnsold = safeParseFloat(row[6]);
        map.set(code, { reportedStock, monthsUnsold });
    });
    return map;
};

const readFileToJson = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        resolve(json as any[]);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
};

const performABCAnalysis = (items: RestockRecommendation[]): RestockRecommendation[] => {
    const itemsWithRevenue = items.map(item => ({
        ...item,
        revenue30Days: item.sold30Days * item.price
    }));

    const totalRevenue = itemsWithRevenue.reduce((sum, item) => sum + item.revenue30Days, 0);
    const useQuantity = totalRevenue === 0; 
    
    if (useQuantity) {
        itemsWithRevenue.sort((a, b) => b.sold30Days - a.sold30Days);
    } else {
        itemsWithRevenue.sort((a, b) => b.revenue30Days - a.revenue30Days);
    }

    const totalMetric = useQuantity 
        ? itemsWithRevenue.reduce((sum, item) => sum + item.sold30Days, 0)
        : totalRevenue;
        
    let runningMetric = 0;

    return itemsWithRevenue.map(item => {
        let abcClass: ABCClass = 'N';
        let safetyStockAdjustment = 0;

        if (item.sold30Days > 0) {
            runningMetric += (useQuantity ? item.sold30Days : item.revenue30Days);
            const percentage = totalMetric > 0 ? runningMetric / totalMetric : 0;

            if (percentage <= 0.80) {
                abcClass = 'A';
                safetyStockAdjustment = Math.ceil(item.dailyRunRate * 2);
            } else if (percentage <= 0.95) {
                abcClass = 'B';
                safetyStockAdjustment = Math.ceil(item.dailyRunRate * 1);
            } else {
                abcClass = 'C';
                safetyStockAdjustment = 0;
            }
        }

        let adjustedNeed = item.needsRestock;
        if (abcClass === 'A') adjustedNeed += safetyStockAdjustment;

        const spaceAvailable = Math.max(0, item.maxStock - item.currentStockBT);
        adjustedNeed = Math.min(adjustedNeed, spaceAvailable);

        return {
            ...item,
            abcClass,
            safetyStockAdjustment,
            needsRestock: adjustedNeed, 
            missingQuantity: item.isDiscontinued ? 0 : Math.max(0, adjustedNeed - item.canPull)
        };
    });
};


export const calculateRestockPlan = async (
  btFile: File,
  tkFile: File,
  otherFiles: File[],
  displayFile?: File,
  slowFile?: File
): Promise<RestockRecommendation[]> => {
  
  // 1. PARSE ALL FILES
  const [btMap, salesStats, displayMap, slowStockMap, ...otherStocksData] = await Promise.all([
      parseBTFile(btFile),
      parseStatsFile(tkFile),
      displayFile ? parseDisplayFile(displayFile) : Promise.resolve(new Map<string, DisplayInfo>()),
      slowFile ? parseSlowStockFile(slowFile) : Promise.resolve(new Map<string, SlowStockInfo>()),
      ...otherFiles.map(f => parseWarehouseFile(f))
  ]);

  // 2. ORGANIZE WAREHOUSES
  const warehouseStocks: { name: string; priority: number; data: Map<string, WhEntry> }[] = [];
  let tbaStockMap = new Map<string, WhEntry>();
  
  otherFiles.forEach((f, index) => {
      const fname = f.name.toLowerCase();
      const stock = otherStocksData[index]; 
      
      let whName = f.name.replace(/\.[^/.]+$/, "");
      const firstEntry = stock.values().next().value;
      if (firstEntry && firstEntry.whNameFromRow) {
          const rowName = firstEntry.whNameFromRow.trim();
          if (rowName.length > 0 && !rowName.toLowerCase().includes('kho') && !rowName.toLowerCase().includes('tên')) {
              whName = rowName; 
          }
      }
      const checkName = whName.toLowerCase();

      if (checkName.includes('tba') || checkName.includes('trưng bày') || fname.includes('tba')) {
          tbaStockMap = stock;
      } else {
        let priority = 3;
        if (checkName.includes('64')) priority = 1;
        else if (checkName.includes('7bc')) priority = 2;
        warehouseStocks.push({ name: whName, priority, data: stock });
      }
  });
  warehouseStocks.sort((a, b) => a.priority - b.priority);

  // 3. MASTER SET CREATION (Union of all codes)
  const allCodes = new Set<string>();
  for (const k of btMap.keys()) allCodes.add(k);
  for (const k of tbaStockMap.keys()) allCodes.add(k);
  for (const k of slowStockMap.keys()) allCodes.add(k);
  for (const wh of warehouseStocks) {
      for (const k of wh.data.keys()) allCodes.add(k);
  }

  const rawRecommendations: RestockRecommendation[] = [];

  // 4. MAIN CALCULATION LOOP
  for (const code of allCodes) {
      const btItem = btMap.get(code);
      const tbaItem = tbaStockMap.get(code);
      const sales = salesStats.get(code) || 0;
      const display = displayMap.get(code);
      const slowInfo = slowStockMap.get(code);

      // Name Resolution
      let name = btItem?.name || tbaItem?.name || slowInfo && "Sản phẩm tồn lâu" || "";
      if (!name) {
          for (const wh of warehouseStocks) {
              const item = wh.data.get(code);
              if (item) { name = item.name; break; }
          }
      }
      if (!name) name = "Sản phẩm chưa xác định tên";
      
      const price = btItem?.price || 0;

      // --- FILTERS ---
      // 1. PRICE CHECK (Only if from BT)
      // Logic: If item exists in any branch (Kho 64, 7BC, etc.), KEEP IT regardless of price.
      // Filter out ONLY if it's BT-only AND price is low.
      const existsInAnyBranch = warehouseStocks.some(wh => wh.data.has(code));
      if (btItem && price <= 10 && !existsInAnyBranch) continue;

      // 2. "0.Mới" FILTER
      // Logic: Drop "0.Mới" ONLY if it comes exclusively from Kho 64. 
      // Keep if it exists in BT or any other branch (7BC, Q9, etc).
      const nameTrimmed = name.trim();
      const is0Moi = nameTrimmed.startsWith('0.Mới') || nameTrimmed.startsWith('0.');
      
      if (is0Moi) {
           const inBT = !!btItem;
           const inOtherBranches = warehouseStocks.some(w => !w.name.includes('64') && w.data.has(code));
           const inKho64 = warehouseStocks.some(w => w.name.includes('64') && w.data.has(code));

           // If NOT in BT, NOT in other branches, BUT is in Kho 64 -> Drop it
           if (!inBT && !inOtherBranches && inKho64) {
               continue;
           }
      }


      const currentStockBT = btItem?.currentStock || 0;
      const maxStock = btItem?.maxStock || 9999;
      const currentStockTBA = tbaItem?.stock || 0;
      let tbaMaxStock = tbaItem?.maxStock || 0;

      const runRate = sales / 30;
      const category = categorizeProduct(code, name);
      
      const targetDays = getTargetDays(category);
      let targetQty = Math.ceil(runRate * targetDays);
      if (targetQty < 1) targetQty = 1;
      
      const spaceAvailable = Math.max(0, maxStock - currentStockBT);
      let need = Math.max(0, targetQty - currentStockBT);
      need = Math.min(need, spaceAvailable);

      // --- NEW PULL LOGIC (LỰC BÁN) ---
      const pendingOrders = btItem?.pendingOrders || 0;
      const ahCoefficient = btItem?.ahCoefficient || 0;
      
      let velocityStatus: 'Hàng cực hot' | 'Bình thường' | 'Chậm' = 'Bình thường';
      if (currentStockBT > 0 && sales > (currentStockBT * 0.5)) {
          velocityStatus = 'Hàng cực hot';
      } else if (sales === 0) {
          velocityStatus = 'Chậm';
      }

      let pullReason = '';
      let suggestedPull = need; // default to old logic
      const effectiveStock = currentStockBT - pendingOrders;
      const safeThreshold = velocityStatus === 'Hàng cực hot' ? (maxStock * 0.4) : 0;
      
      if (velocityStatus === 'Hàng cực hot' && effectiveStock < safeThreshold) {
          pullReason = `BÁN CỰC CHẠY (K=${sales}, M=${currentStockBT}). Mức báo động.`;
          suggestedPull = maxStock - currentStockBT + pendingOrders;
      } else if (effectiveStock <= 0 && (currentStockBT > 0 || pendingOrders > 0)) {
          pullReason = `Hết hàng hoặc Đơn treo cao (M=${currentStockBT}, S=${pendingOrders}).`;
          suggestedPull = maxStock - currentStockBT + pendingOrders;
      }

      // Ensure we don't pull negative
      if (suggestedPull < 0) suggestedPull = 0;

      // AH Coefficient Check (Max 130)
      if (suggestedPull > 0) {
          if (ahCoefficient + suggestedPull > 130) {
              const allowedPull = Math.max(0, 130 - ahCoefficient);
              if (allowedPull < suggestedPull) {
                  pullReason += ` TỪ CHỐI KÉO FULL: Hệ số AH hiện tại (${ahCoefficient}) sát mức trần 130. Chỉ kéo tối đa ${allowedPull} cái.`;
                  suggestedPull = allowedPull;
              }
          }
      }

      // Override need with our new suggestedPull
      if (suggestedPull > 0 && pullReason !== '') {
          need = suggestedPull;
      }

      // --- CRITICAL / SOURCING FIX ---
      let status: RestockRecommendation['status'] = 'Healthy';
      let urgency: RestockRecommendation['urgency'] = 'Normal';
      const stockCoverDays = runRate > 0 ? (currentStockBT / runRate) : (currentStockBT > 0 ? 999 : 0);

      // Urgency Calculation
      if (currentStockBT === 0) urgency = 'Critical';
      else if (currentStockBT <= 3 && sales > 0) urgency = 'Critical';
      else if (stockCoverDays < 2 && sales > 0) urgency = 'Critical';

      if (urgency === 'Critical') status = 'Critical';

      // FORCE SOURCING IF CRITICAL
      // If item is critical but formula says need=0 (due to low runRate), force need to 5
      if (urgency === 'Critical' && need === 0) {
          need = 5; 
          // Respect maxStock only if explicitly set low in file.
          if (btItem && btItem.maxStock < 9999) {
               need = Math.min(need, Math.max(0, btItem.maxStock - currentStockBT));
          }
      }

      // --- SOURCING LOGIC RE-RUN ---
      const allWarehousesStock: WarehouseStockInfo[] = [];
      const sourcing: SourcingPlan[] = [];
      let remainingNeed = need;
      let totalBranchStock = 0;

      for (const wh of warehouseStocks) {
          const entry = wh.data.get(code);
          if (entry) {
              if (entry.stock > 0) totalBranchStock += entry.stock;
              allWarehousesStock.push({ name: wh.name, stock: entry.stock });
              
              if (remainingNeed > 0 && entry.stock > 0) {
                  const take = Math.min(entry.stock, remainingNeed);
                  sourcing.push({
                      sourceWarehouse: wh.name,
                      quantity: take,
                      sourceStock: entry.stock
                  });
                  remainingNeed -= take;
              }
          }
      }
      allWarehousesStock.sort((a, b) => b.stock - a.stock);

      const canPull = need - remainingNeed;
      const missingQuantity = remainingNeed;

      // New Arrival Logic
      let isNewArrival = false;
      if (sales === 0 && currentStockBT === 0 && totalBranchStock > 0) {
          if (name.includes('3.Mới') || name.includes('3.') || name.includes('5.Mới') || name.includes('8.Mới') || name.includes('9.Mới') || name.startsWith('B.') || name.includes('5.QT')) {
              isNewArrival = true;
              status = 'Review';
              if (need === 0) need = 2; 
          } else {
              status = 'Review';
          }
      }

      // Display Logic
      if (tbaMaxStock === 0) tbaMaxStock = getDefaultDisplayStock(category);
      const isDisplayLimitMissing = tbaMaxStock < 1;
      const isTbaSolo = currentStockTBA > 0 && currentStockBT === 0;
      const hasShortageAgainstMax = !isDisplayLimitMissing && currentStockTBA < tbaMaxStock;
      const hasNoDisplayButStock = isDisplayLimitMissing && currentStockTBA === 0;
      const shouldDisplay = currentStockBT > 0 && (hasShortageAgainstMax || (hasNoDisplayButStock && getDefaultDisplayStock(category) > 0));

      rawRecommendations.push({
          code, name, category,
          currentStockBT, currentStockTBA, tbaMaxStock,
          sold30Days: sales,
          dailyRunRate: parseFloat(runRate.toFixed(2)),
          stockCoverDays: parseFloat(stockCoverDays.toFixed(1)),
          targetStockDay: targetDays, targetStockQty: targetQty, maxStock,
          needsRestock: need, canPull,
          sourcing, allWarehousesStock,
          missingQuantity,
          status, urgency,
          isDiscontinued: false, 
          isNewArrival,
          isTbaSolo, shouldDisplay,
          displayInfo: display,
          slowStockInfo: slowInfo,
          price, revenue30Days: 0, abcClass: 'N', safetyStockAdjustment: 0,
          pendingOrders, ahCoefficient, velocityStatus, pullReason
      });
  }

  const finalRecommendations = performABCAnalysis(rawRecommendations);

  finalRecommendations.sort((a, b) => {
      if (a.urgency === 'Critical' && b.urgency !== 'Critical') return -1;
      if (a.urgency !== 'Critical' && b.urgency === 'Critical') return 1;
      if (a.abcClass !== b.abcClass) return a.abcClass.localeCompare(b.abcClass);
      if (a.isNewArrival && !b.isNewArrival) return -1;
      if (!a.isNewArrival && b.isNewArrival) return 1;
      return b.needsRestock - a.needsRestock;
  });

  return finalRecommendations;
};