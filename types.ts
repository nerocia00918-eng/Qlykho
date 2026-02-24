
export interface CellData {
  value: string; // The raw input (e.g., "=A1+B1")
  computed?: string | number | null; // The displayed result
}

export interface SheetData {
  [row: number]: {
    [col: number]: CellData;
  };
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model'
}

export interface ChatMessage {
  role: MessageRole;
  text: string;
}

export interface AnalysisResult {
  summary: string;
  insights: string[];
}

// --- Inventory Types ---

export interface ProductStats {
  code: string;
  name: string;
  sold30Days: number;
}

export interface WarehouseItem {
  code: string;
  name: string;
  currentStock: number;
  maxStock: number; // Column Y or O in BT
  price: number;
  pendingOrders?: number; // Column S
  ahCoefficient?: number; // Column AH
}

export interface SourcingPlan {
  sourceWarehouse: string;
  quantity: number;
  sourceStock: number; // Available stock in this source warehouse
}

export interface DisplayInfo {
  startDate: string; // ISO Date String (YYYY-MM-DD)
  condition: string; // Changed from fixed union to string to allow custom inputs
}

export interface SlowStockInfo {
    reportedStock: number; // Stock reported in the "Slow" file (Col C)
    monthsUnsold: number; // Months unsold (Col G)
}

export interface WarehouseStockInfo {
    name: string;
    stock: number;
}

// NEW: ABC Analysis Types
export type ABCClass = 'A' | 'B' | 'C' | 'N'; // N for New/No Sales

export interface RestockRecommendation {
  code: string;
  name: string;
  category: string;
  currentStockBT: number;
  currentStockTBA: number; // Stock in Display Warehouse (Col E)
  tbaMaxStock: number; // Max/Target Stock in Display Warehouse (Col Y)
  sold30Days: number;
  dailyRunRate: number;
  stockCoverDays: number; // How many days current stock will last
  targetStockDay: number; // 4 or 7
  targetStockQty: number; // Calculated ideal stock
  maxStock: number;
  needsRestock: number; // Amount needed
  canPull: number; // Amount actually found in other warehouses
  sourcing: SourcingPlan[];
  allWarehousesStock: WarehouseStockInfo[];
  status: 'Critical' | 'Warning' | 'Healthy' | 'Overstock' | 'Review'; // Updated status
  missingQuantity: number; // needsRestock - canPull
  isDiscontinued: boolean; // True if name starts with "0."
  isNewArrival: boolean; // True if pushed from 64/7BC without sales history
  urgency: 'Critical' | 'Normal' | 'Low'; // Derived urgency
  displayInfo?: DisplayInfo; // New field for Display Tab
  isTbaSolo: boolean; // NEW: TBA > 0 but BT = 0
  shouldDisplay: boolean; // NEW: BT > 0, !Discontinued, needs display
  slowStockInfo?: SlowStockInfo; // NEW: Data from "Slow" file
  
  // NEW FIELDS FOR ANALYTICS
  price: number;
  revenue30Days: number;
  abcClass: ABCClass;
  safetyStockAdjustment: number; // Suggested extra stock based on class

  // NEW FIELDS FOR PULL LOGIC (LỰC BÁN)
  pendingOrders: number; // S
  ahCoefficient: number; // AH
  velocityStatus: 'Hàng cực hot' | 'Bình thường' | 'Chậm';
  pullReason: string;
}
