/// <reference path="./globals.d.ts" />
/**
 * ============================================================================
 * MODULE XUẤT EXCEL THEO THÁNG (MONTH EXCEL EXPORT) - src/input/month-excel.js
 * ============================================================================
 * Xử lý sự kiện nhấn nút "Xuất dữ liệu" tại Phần 1 (bên trái nút Gửi Zalo).
 * Xuất bảng 16 cột đầy đủ chỉ số, tiêu thụ và các khoản tiền của 12 phòng
 * kèm dòng tổng cộng (SUM) theo định dạng chuẩn OpenXML (.xlsx).
 */

/**
 * Xử lý khi người dùng nhấn nút "Xuất dữ liệu" trên thanh công cụ của Bảng chính (Phần 1)
 */
async function handleExportMonthExcelClick() {
  if (!window.api || typeof window.api.exportMonthExcel !== 'function') {
    if (typeof showToast === 'function') {
      showToast('Tính năng xuất Excel chỉ khả dụng trong môi trường ứng dụng Desktop!', 'error');
    }
    return;
  }

  const btn = /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-export-month-excel'));
  const btnText = document.getElementById('btn-export-month-excel-text');
  if (btn && btn.disabled) return;

  const targetMonth = currentLoadedMonth || (/** @type {HTMLSelectElement | null} */ (document.getElementById('month-year-select'))?.value) || '';
  if (!targetMonth) {
    if (typeof showToast === 'function') {
      showToast('Vui lòng chọn một tháng dữ liệu trước khi xuất!', 'warning');
    }
    return;
  }

  const baseFolder = (typeof appSettings !== 'undefined' && appSettings && appSettings.baseFolder)
    ? String(appSettings.baseFolder).trim()
    : '';

  if (!baseFolder) {
    if (typeof showToast === 'function') {
      showToast('Chưa thiết lập thư mục gốc (BaseFolder). Vui lòng vào Phần 2: Cài Đặt Chung để chọn thư mục!', 'warning');
    }
    if (typeof showExcelExportResultModal === 'function') {
      showExcelExportResultModal({
        success: false,
        code: 'NO_BASE_FOLDER',
        message: 'Chưa thiết lập thư mục gốc (BaseFolder). Vui lòng vào Phần 2: Cài Đặt Chung để chọn thư mục lưu dữ liệu trước khi xuất Excel!'
      });
    }
    return;
  }

  if (!Array.isArray(roomsData) || roomsData.length === 0) {
    if (typeof showToast === 'function') {
      showToast('Không có dữ liệu phòng để xuất!', 'warning');
    }
    return;
  }

  try {
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Đang xuất...';

    const activeSettings = typeof getActiveMonthSettings === 'function' ? getActiveMonthSettings() : appSettings;

    // Tính toán lại toàn bộ 12 phòng để đảm bảo số liệu xuất ra khớp 100% với màn hình
    let grandTotal = 0;
    const calculatedRooms = roomsData.map(room => {
      const dienCuNum = (room.dienCu !== '' && room.dienCu !== null && room.dienCu !== undefined) ? Number(room.dienCu) : 0;
      const effectiveDienStart = typeof getEffectiveDienStartForRollover === 'function' ? getEffectiveDienStartForRollover(room) : dienCuNum;
      const dienMoiNum = (room.dienMoi !== '' && room.dienMoi !== null && room.dienMoi !== undefined) ? Number(room.dienMoi) : effectiveDienStart;

      const nuocCuNum = (room.nuocCu !== '' && room.nuocCu !== null && room.nuocCu !== undefined) ? Number(room.nuocCu) : 0;
      const effectiveNuocStart = typeof getEffectiveNuocStartForRollover === 'function' ? getEffectiveNuocStartForRollover(room) : nuocCuNum;
      const nuocMoiNum = (room.nuocMoi !== '' && room.nuocMoi !== null && room.nuocMoi !== undefined) ? Number(room.nuocMoi) : effectiveNuocStart;

      const surrogate = {
        ...room,
        dienCu: dienCuNum,
        dienMoi: dienMoiNum,
        nuocCu: nuocCuNum,
        nuocMoi: nuocMoiNum,
        tienPhong: activeSettings.giaPhong
      };

      const res = typeof calcRoom === 'function' ? calcRoom(surrogate, activeSettings) : {};
      const tCong = Number(res.tongCong) || 0;
      grandTotal += tCong;

      return {
        phong: room.phong,
        dienCu: room.dienCu,
        dienMoi: room.dienMoi,
        dienKwh: res.dienKwh || 0,
        nuocCu: room.nuocCu,
        nuocMoi: room.nuocMoi,
        nuocKhoi: res.nuocKhoi || 0,
        tienDien: res.tienDien || 0,
        tienNuoc: res.tienNuoc || 0,
        tienPhong: res.tienPhong || 0,
        rac: res.rac || 0,
        internet: res.internet || 0,
        haoTaiKwh: res.haoTaiKwh || 0,
        tienHaoTai: res.tienHaoTai || 0,
        tongCong: tCong
      };
    });

    const result = await window.api.exportMonthExcel({
      baseFolder,
      monthKey: targetMonth,
      roomsData: calculatedRooms
    });

    if (result && result.success) {
      // Ghi Nhật Ký Hoạt Động
      if (typeof logExportMonthExcelEvent === 'function') {
        await logExportMonthExcelEvent({
          monthKey: targetMonth,
          fileName: result.fileName || '',
          totalRevenue: grandTotal,
          roomCount: calculatedRooms.length
        });
      }

      if (typeof showToast === 'function') {
        showToast(`Xuất dữ liệu Excel thành công: ${result.fileName}`, 'success');
      }

      showMonthExcelExportResultModal(result, targetMonth);
    } else {
      const msg = (result && result.message) || 'Không thể xuất file dữ liệu Excel!';
      if (typeof showToast === 'function') {
        showToast(msg, 'error');
      }
      showMonthExcelExportResultModal(result || { success: false, message: msg }, targetMonth);
    }
  } catch (err) {
    console.error('Lỗi khi xuất dữ liệu tháng ra Excel:', err);
    const errMsg = `Lỗi khi xuất dữ liệu Excel: ${err && err.message ? err.message : String(err)}`;
    if (typeof showToast === 'function') {
      showToast(errMsg, 'error');
    }
    showMonthExcelExportResultModal({ success: false, message: errMsg }, targetMonth);
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Xuất dữ liệu';
  }
}

/**
 * Hiển thị Modal thông báo kết quả xuất dữ liệu Excel tháng
 * (Tái sử dụng modal kết quả chung excel-export-result-modal để đồng bộ trải nghiệm người dùng)
 * @param {any} result
 * @param {string} monthKey
 */
function showMonthExcelExportResultModal(result, monthKey) {
  const modal = document.getElementById('excel-export-result-modal');
  if (!modal) return;

  const badge = document.getElementById('excel-export-modal-badge');
  const titleEl = document.getElementById('excel-export-modal-title');
  const subtitleEl = document.getElementById('excel-export-modal-subtitle');
  const successBox = document.getElementById('excel-export-success-box');
  const errorBox = document.getElementById('excel-export-error-box');
  const statusEl = document.getElementById('excel-export-status-text');
  const countEl = document.getElementById('excel-export-count-text');
  const fileNameEl = document.getElementById('excel-export-filename');
  const filePathEl = document.getElementById('excel-export-filepath');
  const btnOpenFolder = document.getElementById('btn-open-exported-excel-folder');
  const btnOpenFile = document.getElementById('btn-open-exported-excel-file');

  const monthLabel = typeof formatMonthLabel === 'function' ? formatMonthLabel(monthKey) : monthKey;

  if (result && result.success) {
    if (typeof lastExportedResidentsExcelPath !== 'undefined') {
      lastExportedResidentsExcelPath = result.filePath || '';
    }
    if (typeof window !== 'undefined') {
      window.lastExportedExcelPath = result.filePath || '';
    }
    if (badge) {
      badge.style.background = '#dcfce7';
      badge.style.color = '#15803d';
    }
    if (titleEl) titleEl.textContent = 'Xuất dữ liệu Excel thành công';
    if (subtitleEl) subtitleEl.textContent = `Đã lưu bảng dữ liệu ${monthLabel} trực tiếp vào thư mục gốc (BaseFolder)`;
    if (successBox) successBox.style.display = 'flex';
    if (errorBox) errorBox.style.display = 'none';
    if (statusEl) statusEl.textContent = 'Xuất Excel thành công';
    if (countEl) countEl.textContent = `${result.totalRooms || 12} phòng (${monthLabel})`;
    if (fileNameEl) fileNameEl.textContent = result.fileName || '-';
    if (filePathEl) filePathEl.textContent = result.filePath || '-';
    if (btnOpenFolder) btnOpenFolder.style.display = (result.filePath) ? 'inline-flex' : 'none';
    if (btnOpenFile) btnOpenFile.style.display = (result.filePath) ? 'inline-flex' : 'none';
  } else {
    if (typeof lastExportedResidentsExcelPath !== 'undefined') {
      lastExportedResidentsExcelPath = '';
    }
    if (typeof window !== 'undefined') {
      window.lastExportedExcelPath = '';
    }
    if (badge) {
      badge.style.background = '#fee2e2';
      badge.style.color = '#b91c1c';
    }
    if (titleEl) titleEl.textContent = 'Không thể xuất file Excel';
    if (subtitleEl) subtitleEl.textContent = `Vui lòng kiểm tra lại dữ liệu và thư mục lưu trữ của ${monthLabel}`;
    if (successBox) successBox.style.display = 'none';
    if (errorBox) {
      errorBox.style.display = 'block';
      errorBox.style.background = '#fef2f2';
      errorBox.style.borderColor = '#fecaca';
      errorBox.style.color = '#991b1b';
      errorBox.textContent = (result && result.message) || 'Đã xảy ra lỗi khi xuất file Excel.';
    }
    if (btnOpenFolder) btnOpenFolder.style.display = 'none';
    if (btnOpenFile) btnOpenFile.style.display = 'none';
  }

  modal.style.display = 'flex';
}

/**
 * Mở trực tiếp file Excel vừa xuất bằng ứng dụng mặc định trên máy tính (Excel, WPS, Calc...)
 */
async function handleOpenExportedExcelFile() {
  const targetPath = (typeof window !== 'undefined' && window.lastExportedExcelPath)
    || (typeof lastExportedResidentsExcelPath !== 'undefined' ? lastExportedResidentsExcelPath : '')
    || document.getElementById('excel-export-filepath')?.textContent;

  if (!targetPath || targetPath === '-' || !window.api || !window.api.openExcelFile) {
    if (typeof showToast === 'function') {
      showToast('Không tìm thấy đường dẫn file Excel để mở!', 'warning');
    }
    return;
  }

  try {
    const res = await window.api.openExcelFile(targetPath);
    if (res && !res.ok && res.message) {
      if (typeof showToast === 'function') {
        showToast(res.message, 'error');
      }
    }
  } catch (err) {
    console.error('Lỗi khi mở file Excel:', err);
    if (typeof showToast === 'function') {
      showToast(`Không thể mở file Excel: ${err && err.message ? err.message : String(err)}`, 'error');
    }
  }
}

// Phơi hàm ra global window để HTML gọi onclick
if (typeof window !== 'undefined') {
  window.handleExportMonthExcelClick = handleExportMonthExcelClick;
  window.showMonthExcelExportResultModal = showMonthExcelExportResultModal;
  window.handleOpenExportedExcelFile = handleOpenExportedExcelFile;
}

