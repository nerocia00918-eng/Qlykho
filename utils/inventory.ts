import * as XLSX from 'xlsx';
import { RestockRecommendation, SourcingPlan, WarehouseItem, DisplayInfo, SlowStockInfo } from '../types';

// Optimization: Use a Prefix Map instead of linear if-else scan
const PREFIX_MAP: Record<string, string> = {
  'V.': 'VGA', 'M.': 'Mainboard', 'L.': 'LCD', 'Ca.': 'Case',
  'Lt.': 'Laptop', 'HP.': 'Headphone', 'Mo.': 'Mouse', 'KB.': 'Keyboard',
  'SS.': 'SSD', 'R3.': 'RAM D3', 'R4.': 'RAM D4', 'R5.': 'RAM D5',
  'P.': 'Nguồn (PSU)', 'F.': 'Tản Nhiệt (Fan)', 'CB.': 'Combo Phím Chuột',
  'Lo.': 'Loa', 'MB.': 'Máy Bộ', 'MI.': 'Máy In', 'TN.': 'Thẻ Nhớ',
  'KTN.': 'Keo Tản Nhiệt', 'cmr.': 'Camera', 'WC.': 'Webcam', 'MP.': 'Mousepad',
  'RT.': 'Router', 'SW.': 'Switch', 'GT.': 'Giá Treo', 'Gia.': 'Giá Đỡ',
  'U.': 'USB/Hub', 'Cap.': 'Cable'
};

const categorizeProduct = (code: string, name: string): string => {
  const c = code.trim(); 
  
  // Fast Lookup
  for (const prefix in PREFIX_MAP) {
      if (c.startsWith(prefix)) return PREFIX_MAP[prefix];
  }
  
  const n = name.toLowerCase();
  if (n.includes('ghế')) return 'Ghế';
  if (n.includes('bàn')) return 'Bàn';
  
  return 'Khác';
};

const getTargetDays = (category: string): number => {
  if (['VGA', 'Mainboard', 'Laptop', 'LCD', 'Máy Bộ', 'Máy In'].includes(category)) return 4;
  return 7;
};

// Helper to determine if a category should have a display unit by default
const getDefaultDisplayStock = (category: string): number => {
    // Categories that typically require 1 unit on display
    const displayCategories = [
        'LCD', 'Laptop', 'Mainboard', 'VGA', 'Case', 
        'Loa', 'Headphone', 'Keyboard', 'Mouse', 
        'Combo Phím Chuột', 'Máy Bộ', 'Ghế', 'Bàn'
    ];
    return displayCategories.includes(category) ? 1 : 0;
};

interface WhEntry {
    stock: number;
    maxStock: number; // Added for TBA Max (Col Y)
    name: string;
}

// Updated Parsing Functions to use new optimized reader
export const parseWarehouseFile = async (file: File): Promise<Map<string, WhEntry>> => {
  const data = await readFileToJson(file);
  const stockMap = new Map<string, WhEntry>();
  
  data.forEach((row: any[]) => {
    if (!row || row.length < 2) return; 
    
    const code = String(row[1] || '').trim(); 
    if (!code || code === 'Mã SP') return; 

    const name = String(row[2] || ''); 
    const stock = parseInt(String(row[4] || '0')); 
    
    // Safer parsing for Max Stock (Col Y / Index 24)
    let maxStock = 0;
    const rawMax = row[24];
    if (rawMax !== undefined && rawMax !== null && String(rawMax).trim() !== '') {
        maxStock = parseInt(String(rawMax));
    }

    if (code) {
      stockMap.set(code, { stock, maxStock, name });
    }
  });
  return stockMap;
};

export const parseBTFile = async (file: File): Promise<WarehouseItem[]> => {
  const data = await readFileToJson(file);
  const items: WarehouseItem[] = [];

  data.forEach((row: any[]) => {
    if (!row || row.length < 3) return;
    
    const code = String(row[1] || '').trim(); 
    if (!code || code.toLowerCase() === 'mã sp') return; 

    const name = String(row[2] || ''); 
    const currentStock = parseInt(String(row[4] || '0')); 
    const price = parseFloat(String(row[5] || '0')); 
    
    let maxStock = 9999; 
    if (row[24] !== undefined && row[24] !== null && String(row[24]).trim() !== '') {
        maxStock = parseInt(String(row[24]));
    }

    items.push({ code, name, currentStock, maxStock, price });
  });
  return items;
};

export const parseStatsFile = async (file: File): Promise<Map<string, number>> => {
  const data = await readFileToJson(file);
  const stats = new Map<string, number>();

  data.forEach((row: any[]) => {
    if (!row || row.length < 1) return;
    const code = String(row[0] || '').trim();
    if (!code || code.toLowerCase() === 'mã sp') return;

    const sold = parseInt(String(row[10] || '0')); 
    if (!isNaN(sold)) {
        stats.set(code, sold);
    }
  });
  return stats;
};

// Parse Display Info File 
export const parseDisplayFile = async (file: File): Promise<Map<string, DisplayInfo>> => {
    const data = await readFileToJson(file);
    const map = new Map<string, DisplayInfo>();
    
    data.forEach((row: any[]) => {
        if (!row || row.length < 1) return;
        const code = String(row[0] || '').trim();
        let startDate = '';
        const rawDate = row[1];

        // Handle Date parsing
        if (rawDate) {
            if (typeof rawDate === 'number') {
                const date = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
                startDate = date.toISOString().split('T')[0];
            } else {
                const dateStr = String(rawDate).trim();
                if (dateStr.includes('/')) {
                   const parts = dateStr.split('/');
                   if (parts.length === 3) {
                       startDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                   }
                } else {
                   startDate = dateStr;
                }
            }
        }

        let condition: DisplayInfo['condition'] = 'New';
        const condStr = String(row[2] || '').toLowerCase();
        if (condStr.includes('trầy') || condStr.includes('xước') || condStr.includes('cũ')) condition = 'Scratched';
        else if (condStr.includes('dùng') || condStr.includes('use')) condition = 'Used';

        if (code && startDate) {
            map.set(code, { startDate, condition });
        }
    });
    return map;
};

// NEW: Parse Slow Stock File (Cols A, B, C, G)
export const parseSlowStockFile = async (file: File): Promise<Map<string, SlowStockInfo>> => {
    const data = await readFileToJson(file);
    const map = new Map<string, SlowStockInfo>();
    
    data.forEach((row: any[]) => {
        if (!row || row.length < 1) return;
        const code = String(row[0] || '').trim(); // Col A
        if (!code || code === 'Mã SP') return;

        // Col C (Index 2) is Reported Stock
        const reportedStock = parseInt(String(row[2] || '0'));
        
        // Col G (Index 6) is Months Unsold
        const monthsUnsold = parseFloat(String(row[6] || '0'));

        map.set(code, { reportedStock, monthsUnsold });
    });
    return map;
};

const readFileToJson = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // Optimization: use array buffer which is faster for XLSX library
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        resolve(json as any[]);
      } catch (err) {
        reject(err);
      }
    };
    // Optimization: Read as ArrayBuffer instead of BinaryString
    reader.readAsArrayBuffer(file);
  });
};

export const calculateRestockPlan = async (
  btFile: File,
  tkFile: File,
  otherFiles: File[],
  displayFile?: File,
  slowFile?: File
): Promise<RestockRecommendation[]> => {
  
  // Optimization: Parallel Reading using Promise.all
  const [btItems, salesStats, displayMap, slowStockMap, ...otherStocksData] = await Promise.all([
      parseBTFile(btFile),
      parseStatsFile(tkFile),
      displayFile ? parseDisplayFile(displayFile) : Promise.resolve(new Map<string, DisplayInfo>()),
      slowFile ? parseSlowStockFile(slowFile) : Promise.resolve(new Map<string, SlowStockInfo>()),
      ...otherFiles.map(f => parseWarehouseFile(f))
  ]);

  // 2. Process Warehouse Data from parallel results
  const warehouseStocks: { name: string; priority: number; data: Map<string, WhEntry> }[] = [];
  let tbaStockMap = new Map<string, WhEntry>();
  
  otherFiles.forEach((f, index) => {
      const fname = f.name.toLowerCase();
      const stock = otherStocksData[index]; 
      const whName = f.name.replace(/\.[^/.]+$/, "");

      if (fname.includes('tba')) {
          tbaStockMap = stock;
      } else {
        let priority = 3;
        if (fname.includes('64')) priority = 1;
        else if (fname.includes('7bc')) priority = 2;
        warehouseStocks.push({ name: whName, priority, data: stock });
      }
  });

  warehouseStocks.sort((a, b) => a.priority - b.priority);

  const recommendations: RestockRecommendation[] = [];
  const processedCodes = new Set<string>();

  // 3. Calculation Loop (Main BT Items)
  for (const item of btItems) {
    processedCodes.add(item.code);

    const isDiscontinued = item.name.trim().startsWith('0.');
    const sold30 = salesStats.get(item.code) || 0;
    const runRate = sold30 / 30; 
    
    // Optimized categorize call
    const category = categorizeProduct(item.code, item.name);
    const targetDays = getTargetDays(category);
    
    let targetQty = Math.ceil(runRate * targetDays);
    if (!isDiscontinued && targetQty < 1) {
        targetQty = 1;
    }
    
    const spaceAvailable = Math.max(0, item.maxStock - item.currentStock);
    let need = Math.max(0, targetQty - item.currentStock);
    need = Math.min(need, spaceAvailable);

    // --- DISPLAY LOGIC ---
    const tbaEntry = tbaStockMap.get(item.code);
    const currentStockTBA = tbaEntry ? tbaEntry.stock : 0;
    
    // Logic: Use value from file if present, otherwise smart default for display items
    let tbaMaxStock = tbaEntry ? tbaEntry.maxStock : 0; 
    
    // Fallback: If Max is 0/Missing, but this is a category that SHOULD be displayed, default to 1.
    if (tbaMaxStock === 0 && !isDiscontinued) {
        tbaMaxStock = getDefaultDisplayStock(category);
    }
    
    const displayInfo = displayMap.get(item.code);

    const isDisplayLimitMissing = tbaMaxStock < 1;

    // NEW LOGIC 1: TBA Solo (Exists in TBA, Empty in BT)
    const isTbaSolo = currentStockTBA > 0 && item.currentStock === 0;

    // NEW LOGIC 2: Should Display
    const hasShortageAgainstMax = !isDisplayLimitMissing && currentStockTBA < tbaMaxStock;
    const hasNoDisplayButStock = isDisplayLimitMissing && currentStockTBA === 0; 
    
    const shouldDisplay = !isDiscontinued && item.currentStock > 0 && (hasShortageAgainstMax || (hasNoDisplayButStock && getDefaultDisplayStock(category) > 0));

    // Logic: Return if > 20 days and New (Existing)
    let isReturnNeeded = false;
    if (currentStockTBA > 0 && displayInfo) {
        const start = new Date(displayInfo.startDate);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        if (diffDays > 20 && displayInfo.condition === 'New') {
            isReturnNeeded = true;
        }
    }

    // SLOW STOCK LOGIC
    const slowStockInfo = slowStockMap.get(item.code);

    // Inclusion Logic
    const hasDisplayIssue = shouldDisplay || isTbaSolo || isReturnNeeded || isDisplayLimitMissing;
    // We include if there is a slow stock report for this item
    const hasSlowIssue = !!slowStockInfo;

    if (need <= 0 && item.currentStock > 0 && !isDiscontinued && !hasDisplayIssue && currentStockTBA === 0 && !hasSlowIssue) continue;

    // Urgency Logic
    const stockCoverDays = runRate > 0 ? (item.currentStock / runRate) : (item.currentStock > 0 ? 999 : 0);
    let urgency: 'Critical' | 'Normal' | 'Low' = 'Normal';

    if (item.currentStock === 0 && !isDiscontinued) {
        urgency = 'Critical';
    } else if (item.currentStock <= 3 && sold30 > 0 && !isDiscontinued) {
        urgency = 'Critical';
    } else if (stockCoverDays < 2 && sold30 > 0 && !isDiscontinued) {
        urgency = 'Critical';
    }

    // Sourcing Logic
    const sourcing: SourcingPlan[] = [];
    let remainingNeed = need;

    if (need > 0) {
        for (const wh of warehouseStocks) {
        if (remainingNeed <= 0) break;
        
        const entry = wh.data.get(item.code);
        const available = entry ? entry.stock : 0;
        
        if (available > 0) {
            const take = Math.min(available, remainingNeed);
            sourcing.push({ sourceWarehouse: wh.name, quantity: take });
            remainingNeed -= take;
        }
        }
    }

    const canPull = need - remainingNeed;
    const missingQuantity = isDiscontinued ? 0 : remainingNeed;

    recommendations.push({
        code: item.code,
        name: item.name,
        category,
        currentStockBT: item.currentStock,
        currentStockTBA, // Pass TBA stock
        tbaMaxStock, // Pass TBA Max
        sold30Days: sold30,
        dailyRunRate: parseFloat(runRate.toFixed(2)),
        stockCoverDays: parseFloat(stockCoverDays.toFixed(1)),
        targetStockDay: targetDays,
        targetStockQty: targetQty,
        maxStock: item.maxStock,
        needsRestock: need,
        canPull,
        sourcing,
        missingQuantity,
        status: urgency === 'Critical' ? 'Critical' : 'Warning',
        isDiscontinued,
        isNewArrival: false,
        urgency,
        displayInfo,
        isTbaSolo,
        shouldDisplay,
        slowStockInfo
    });
  }

  // 4. Check for Orphaned Items in TBA 
  for (const [code, entry] of tbaStockMap.entries()) {
      if (processedCodes.has(code)) continue; 
      
      if (entry.stock > 0) {
          processedCodes.add(code);
          const category = categorizeProduct(code, entry.name);
          const isDiscontinued = entry.name.trim().startsWith('0.');
          const slowStockInfo = slowStockMap.get(code);

          recommendations.push({
              code: code,
              name: entry.name,
              category,
              currentStockBT: 0,
              currentStockTBA: entry.stock,
              tbaMaxStock: entry.maxStock,
              sold30Days: 0,
              dailyRunRate: 0,
              stockCoverDays: 0,
              targetStockDay: 0,
              targetStockQty: 0,
              maxStock: 9999, 
              needsRestock: 0,
              canPull: 0,
              sourcing: [],
              missingQuantity: 0,
              status: 'Warning',
              isDiscontinued,
              isNewArrival: false,
              urgency: 'Normal',
              displayInfo: undefined,
              isTbaSolo: true, 
              shouldDisplay: false,
              slowStockInfo
          });
      }
  }

  // 5. New Arrival Logic 
  const centralWarehouses = warehouseStocks.filter(w => w.priority <= 2);
  for (const wh of centralWarehouses) {
      for (const [code, entry] of wh.data.entries()) {
          if (processedCodes.has(code)) continue; 
          if (entry.name.trim().startsWith('0.')) continue;
          
          const available = entry.stock;
          const slowStockInfo = slowStockMap.get(code);

          if (available > 0 || slowStockInfo) {
              processedCodes.add(code);
              const category = categorizeProduct(code, entry.name);
              recommendations.push({
                  code: code,
                  name: entry.name,
                  category,
                  currentStockBT: 0,
                  currentStockTBA: 0,
                  tbaMaxStock: 0,
                  sold30Days: 0,
                  dailyRunRate: 0,
                  stockCoverDays: 0,
                  targetStockDay: 0,
                  targetStockQty: 0,
                  maxStock: 9999, 
                  needsRestock: 2,
                  canPull: Math.min(available, 2),
                  sourcing: [{ sourceWarehouse: wh.name, quantity: Math.min(available, 2) }],
                  missingQuantity: 0,
                  status: 'Review',
                  isDiscontinued: false,
                  isNewArrival: true,
                  urgency: 'Normal',
                  displayInfo: undefined,
                  isTbaSolo: false,
                  shouldDisplay: true,
                  slowStockInfo
              });
          }
      }
  }

  // 6. Handle Orphaned Slow Stock Items (In Slow File but not in BT or Warehouse)
  for (const [code, entry] of slowStockMap.entries()) {
      if (processedCodes.has(code)) continue;
      
      // Probably discontinued or error, but user wants to see it
      processedCodes.add(code);
      recommendations.push({
            code: code,
            name: "Sản phẩm trong file tồn lâu (Không có ở BT)",
            category: "Khác",
            currentStockBT: 0,
            currentStockTBA: 0,
            tbaMaxStock: 0,
            sold30Days: 0,
            dailyRunRate: 0,
            stockCoverDays: 0,
            targetStockDay: 0,
            targetStockQty: 0,
            maxStock: 9999, 
            needsRestock: 0,
            canPull: 0,
            sourcing: [],
            missingQuantity: 0,
            status: 'Review',
            isDiscontinued: false, // assumption
            isNewArrival: false,
            urgency: 'Low',
            isTbaSolo: false,
            shouldDisplay: false,
            slowStockInfo: entry
      });
  }

  recommendations.sort((a, b) => {
      if (a.urgency === 'Critical' && b.urgency !== 'Critical') return -1;
      if (a.urgency !== 'Critical' && b.urgency === 'Critical') return 1;
      return b.needsRestock - a.needsRestock;
  });

  return recommendations;
};