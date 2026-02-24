/**
 * STAR-LOGISTIC GENIUS: SCRIPT KÉO HÀNG TỰ ĐỘNG
 * 
 * Hướng dẫn sử dụng:
 * 1. Mở Google Sheets -> Tiện ích mở rộng -> Apps Script.
 * 2. Dán toàn bộ code này vào và lưu lại.
 * 3. Chạy hàm `generatePullOrders()` để tạo lệnh kéo hàng.
 */

function generatePullOrders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet(); // Hoặc ss.getSheetByName('Tên_Sheet')
  
  // Lấy toàn bộ dữ liệu một lần để tối ưu tốc độ (Tránh dùng getValue trong vòng lặp)
  const data = sheet.getDataRange().getValues();
  
  if (data.length < 2) {
    Logger.log("Không có dữ liệu.");
    return;
  }

  const headers = data[0];
  const results = [];
  
  // Cấu trúc cột (Index = Cột - 1)
  // A(0): Mã SP, B(1): Tên, F(5): Nhập NCC, H(7): Nhập nội bộ, I(8): Xuất nội bộ
  // K(10): Xuất bán, M(12): Tồn cuối, O(14): Tồn Max, Q(16): Ước tính
  // S(18): Đơn treo, AH(33): Hệ số
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const code = row[0];
    const name = row[1];
    
    if (!code) continue; // Bỏ qua dòng trống
    
    const sold = Number(row[10]) || 0;         // K
    const currentStock = Number(row[12]) || 0; // M
    const maxStock = Number(row[14]) || 0;     // O
    const pendingOrders = Number(row[18]) || 0;// S
    const ahCoefficient = Number(row[33]) || 0;// AH
    
    // 1. LOGIC TÍNH LỰC BÁN
    let isHot = false;
    if (currentStock > 0 && sold > (currentStock * 0.5)) {
      isHot = true;
    }
    
    // 2. QUY TRÌNH KÉO HÀNG
    const effectiveStock = currentStock - pendingOrders;
    const safeThreshold = isHot ? (maxStock * 0.4) : 0;
    
    let needsPull = false;
    let pullReason = "";
    let pullQty = 0;
    
    if (isHot && effectiveStock < safeThreshold) {
      needsPull = true;
      pullReason = "Hàng cực hot (Bán > 50% tồn). Mức báo động.";
      pullQty = maxStock - currentStock + pendingOrders;
    } else if (effectiveStock <= 0 && (currentStock > 0 || pendingOrders > 0)) {
      needsPull = true;
      pullReason = "Hết hàng hoặc Đơn treo cao.";
      pullQty = maxStock - currentStock + pendingOrders;
    }
    
    if (pullQty < 0) pullQty = 0;
    
    // 3. KIỂM TRA HỆ SỐ AH (Max 130)
    if (needsPull && pullQty > 0) {
      if (ahCoefficient + pullQty > 130) {
        const allowedPull = Math.max(0, 130 - ahCoefficient);
        if (allowedPull < pullQty) {
          pullReason += ` (Đã giảm số lượng do AH chạm trần 130. Đề xuất ban đầu: ${pullQty})`;
          pullQty = allowedPull;
        }
      }
      
      // Lọc và lưu kết quả
      if (pullQty > 0) {
        results.push({
          code: code,
          name: name,
          pullQty: pullQty,
          reason: pullReason,
          ahAfter: ahCoefficient + pullQty
        });
      }
    }
  }
  
  // 4. TRẢ KẾT QUẢ HOẶC GHI RA SHEET MỚI
  if (results.length > 0) {
    let outputSheet = ss.getSheetByName("Lệnh Kéo Hàng");
    if (!outputSheet) {
      outputSheet = ss.insertSheet("Lệnh Kéo Hàng");
    } else {
      outputSheet.clear();
    }
    
    // Ghi Header
    outputSheet.appendRow(["Mã SP", "Tên SP", "SL Cần Kéo", "Lý Do", "AH Dự Kiến"]);
    
    // Ghi Data (Dùng setValues để tối ưu)
    const outputData = results.map(r => [r.code, r.name, r.pullQty, r.reason, r.ahAfter]);
    outputSheet.getRange(2, 1, outputData.length, 5).setValues(outputData);
    
    // Format
    outputSheet.getRange("A1:E1").setFontWeight("bold").setBackground("#f3f3f3");
    outputSheet.autoResizeColumns(1, 5);
    
    SpreadsheetApp.getUi().alert(`Đã tạo thành công ${results.length} lệnh kéo hàng! Xem tại sheet "Lệnh Kéo Hàng".`);
  } else {
    SpreadsheetApp.getUi().alert("Không có sản phẩm nào cần kéo hàng lúc này.");
  }
}
