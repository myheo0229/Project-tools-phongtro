/// <reference path="./globals.d.ts" />
/**
 * ============================================================================
 * MODULE UI MODAL THAY ĐỔI ĐỒNG HỒ ĐIỆN / NƯỚC - src/input/meter-change-modal.js
 * ============================================================================
 * Hoàn thiện giao diện, animation push-in/push-out (--dir), đọc trực tiếp
 * danh sách phòng & trạng thái tháng trước từ bảng chính (chỉ đọc, chưa lưu DB),
 * kiểm tra hợp lệ 3 bước và tính toán xem trước theo thời gian thực.
 */

const MC_FALLBACK_ROOMS = ['1A', '2A', '3A', '4A', '5A', '6A', '1B', '2B', '3B', '4B', '5B', '6B'];

let mcRoomsSnapshot = [];
let mcSelectedRoom = null;
let mcCurrentStep = 1;
let mcIsTransitioning = false;
let mcTransitionTimer = null;

/**
 * Trạng thái nhập liệu tạm trong Modal (tách riêng điện / nước)
 * @type {{ elec: Array<any>, water: Array<any> }}
 */
let mcState = {
  elec: [],
  water: []
};

/**
 * Lấy danh sách 12 phòng & chỉ số tháng trước trực tiếp từ dữ liệu bảng chính (chỉ đọc)
 */
function getRoomsForMeterChangeModal() {
  if (typeof roomsData !== 'undefined' && Array.isArray(roomsData) && roomsData.length > 0) {
    return roomsData.map(r => {
      const hasPrevElec = Boolean(r.isDienCuLocked);
      const hasPrevWater = Boolean(r.isNuocCuLocked);
      const prevElec = (r.dienCu !== '' && r.dienCu !== null && r.dienCu !== undefined && !isNaN(Number(r.dienCu)))
        ? Number(r.dienCu)
        : null;
      const prevWater = (r.nuocCu !== '' && r.nuocCu !== null && r.nuocCu !== undefined && !isNaN(Number(r.nuocCu)))
        ? Number(r.nuocCu)
        : null;

      return {
        phong: String(r.phong || ''),
        hasPrevElec,
        hasPrevWater,
        prevElec,
        prevWater
      };
    });
  }

  return MC_FALLBACK_ROOMS.map(phong => ({
    phong,
    hasPrevElec: false,
    hasPrevWater: false,
    prevElec: null,
    prevWater: null
  }));
}

/**
 * Định dạng hiển thị số an toàn trên UI
 * @param {number} num
 */
function formatMcNumber(num) {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  return Number.isInteger(num) ? String(num) : String(Math.round(num * 100) / 100);
}

/**
 * Escape HTML đơn giản chống lỗi render chuỗi
 * @param {any} str
 */
function escapeMcAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Mở Modal Ghi nhận thay đổi đồng hồ (luôn reset về Bước 1 sạch sẽ)
 */
function openMeterChangeModal() {
  const modal = document.getElementById('meter-change-modal');
  if (!modal) return;

  mcRoomsSnapshot = getRoomsForMeterChangeModal();
  mcSelectedRoom = null;
  mcCurrentStep = 1;
  mcIsTransitioning = false;

  if (mcTransitionTimer) {
    clearTimeout(mcTransitionTimer);
    mcTransitionTimer = null;
  }

  // Cập nhật nhãn tháng đang xem
  const monthLabelEl = document.getElementById('mc-current-month-label');
  if (monthLabelEl) {
    const rawMonth = (typeof currentLoadedMonth !== 'undefined' && currentLoadedMonth)
      ? currentLoadedMonth
      : (/** @type {HTMLSelectElement | null} */ (document.getElementById('month-year-select'))?.value || '');
    if (rawMonth && rawMonth.includes('-')) {
      const [yyyy, mm] = rawMonth.split('-');
      monthLabelEl.textContent = `Tháng ${mm}/${yyyy}`;
    } else {
      monthLabelEl.textContent = rawMonth || 'Tháng hiện tại';
    }
  }

  // Reset trang về Bước 1 ngay lập tức (không animation lúc vừa mở)
  const p1 = document.getElementById('mc-page1');
  const p2 = document.getElementById('mc-page2');
  const stepBadge = document.getElementById('mc-step-badge');
  if (p1 && p2) {
    p1.classList.remove('page-in', 'page-out');
    p2.classList.remove('active', 'page-in', 'page-out');
    p1.classList.add('active');
  }
  if (stepBadge) {
    stepBadge.textContent = 'Bước 1/2: Chọn phòng & loại';
  }

  // Mặc định chọn Điện để tiện thao tác nhanh (cho phép chọn lại tự do)
  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-water'));
  const lblElec = document.getElementById('mc-lbl-elec');
  const lblWater = document.getElementById('mc-lbl-water');
  if (chkElec) chkElec.checked = true;
  if (chkWater) chkWater.checked = false;
  if (lblElec) lblElec.classList.add('checked');
  if (lblWater) lblWater.classList.remove('checked');

  renderMeterChangeRoomGrid();
  validateMeterChangeStep1();

  modal.style.display = 'flex';
}

/**
 * Đóng Modal Thay đổi đồng hồ
 */
function closeMeterChangeModal() {
  const modal = document.getElementById('meter-change-modal');
  if (!modal) return;
  if (mcTransitionTimer) {
    clearTimeout(mcTransitionTimer);
    mcTransitionTimer = null;
  }
  mcIsTransitioning = false;
  modal.style.display = 'none';
}

/**
 * Render lưới 12 phòng tại Bước 1
 */
function renderMeterChangeRoomGrid() {
  const roomGrid = document.getElementById('mc-room-grid');
  if (!roomGrid) return;

  roomGrid.innerHTML = '';
  mcRoomsSnapshot.forEach(room => {
    const card = document.createElement('div');
    card.className = 'mc-room-card';
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', 'false');
    card.tabIndex = 0;

    let statusClass = '';
    let statusText = '';

    if (room.hasPrevElec && room.hasPrevWater) {
      statusText = `Đ: ${formatMcNumber(room.prevElec)} | N: ${formatMcNumber(room.prevWater)}`;
    } else if (!room.hasPrevElec && !room.hasPrevWater) {
      statusClass = 'new';
      statusText = 'Chưa có dữ liệu cũ';
    } else {
      statusClass = 'partial';
      const eText = room.hasPrevElec ? `Đ: ${formatMcNumber(room.prevElec)}` : 'Đ: chưa cũ';
      const wText = room.hasPrevWater ? `N: ${formatMcNumber(room.prevWater)}` : 'N: chưa cũ';
      statusText = `${eText} | ${wText}`;
    }

    card.innerHTML = `
      <div class="mc-r-name">Phòng ${escapeMcAttr(room.phong)}</div>
      <div class="mc-r-status ${statusClass}">${statusText}</div>
    `;

    const selectThisRoom = () => {
      roomGrid.querySelectorAll('.mc-room-card').forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-checked', 'false');
      });
      card.classList.add('selected');
      card.setAttribute('aria-checked', 'true');
      mcSelectedRoom = room;
      validateMeterChangeStep1();
    };

    card.onclick = selectThisRoom;
    card.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectThisRoom();
      }
    };

    roomGrid.appendChild(card);
  });
}

/**
 * Đổi trạng thái ô tích chọn Điện / Nước tại Bước 1
 * @param {string} labelId
 * @param {HTMLInputElement} checkbox
 */
function toggleMeterChangeType(labelId, checkbox) {
  const lbl = document.getElementById(labelId);
  if (lbl) lbl.classList.toggle('checked', Boolean(checkbox && checkbox.checked));
  validateMeterChangeStep1();
}

/**
 * Kích hoạt / vô hiệu hóa nút Tiếp theo tại Bước 1
 */
function validateMeterChangeStep1() {
  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-water'));
  const btnNext = /** @type {HTMLButtonElement | null} */ (document.getElementById('mc-btn-next'));
  const hasType = Boolean((chkElec && chkElec.checked) || (chkWater && chkWater.checked));
  if (btnNext) {
    btnNext.disabled = !(mcSelectedRoom && hasType);
  }
}

/**
 * Khởi tạo state mặc định cho Bước 2 theo phòng đã chọn
 */
function initMeterChangeStep2State() {
  if (!mcSelectedRoom) return;

  const initElecStart = mcSelectedRoom.prevElec !== null ? String(mcSelectedRoom.prevElec) : '';
  const initWaterStart = mcSelectedRoom.prevWater !== null ? String(mcSelectedRoom.prevWater) : '';

  mcState = {
    elec: [{ date: '', start: initElecStart, oldEnd: '', newStart: '0', monthEnd: '' }],
    water: [{ date: '', start: initWaterStart, oldEnd: '', newStart: '0', monthEnd: '' }]
  };
}

/**
 * Hiệu ứng chuyển tiếp push-in / push-out với biến --dir (1: tiến, -1: lùi)
 * @param {1 | 2} step
 * @param {1 | -1} dir
 */
function goToMeterChangeStep(step, dir) {
  if (mcIsTransitioning || step === mcCurrentStep) return;

  const p1 = document.getElementById('mc-page1');
  const p2 = document.getElementById('mc-page2');
  const viewport = document.getElementById('mc-viewport');
  const stepBadge = document.getElementById('mc-step-badge');
  if (!p1 || !p2 || !viewport) return;

  mcIsTransitioning = true;
  mcCurrentStep = step;
  viewport.style.setProperty('--dir', String(dir));

  const outEl = step === 2 ? p1 : p2;
  const inEl = step === 2 ? p2 : p1;

  if (step === 2) {
    initMeterChangeStep2State();
    renderMeterChangeStep2Form();
    if (stepBadge) stepBadge.textContent = 'Bước 2/2: Nhập chỉ số thay đổi';
  } else {
    if (stepBadge) stepBadge.textContent = 'Bước 1/2: Chọn phòng & loại';
  }

  outEl.classList.remove('active', 'page-in', 'page-out');
  inEl.classList.remove('active', 'page-in', 'page-out');

  void outEl.offsetWidth; // Force reflow để animation chạy mượt từ đầu
  outEl.classList.add('page-out');
  inEl.classList.add('page-in');

  mcTransitionTimer = setTimeout(() => {
    outEl.classList.remove('page-out');
    inEl.classList.remove('page-in');
    inEl.classList.add('active');
    mcIsTransitioning = false;
    mcTransitionTimer = null;
  }, 700);
}

/**
 * Thêm 1 lần thay đồng hồ trong tháng (lần 2, 3...)
 * Giữ nguyên toàn bộ giá trị đã nhập trước đó và chuyển Ô 4 (nếu đã nhập) sang lần cuối mới
 * @param {'elec' | 'water'} type
 */
function addMeterChangeRow(type) {
  const list = mcState[type];
  if (!Array.isArray(list) || list.length === 0) return;

  const lastRow = list[list.length - 1];
  const carriedMonthEnd = lastRow.monthEnd || '';
  lastRow.monthEnd = '';

  const prevNewStart = lastRow.newStart !== undefined && lastRow.newStart !== '' ? String(lastRow.newStart) : '0';
  list.push({
    date: '',
    start: prevNewStart,
    oldEnd: '',
    newStart: '0',
    monthEnd: carriedMonthEnd
  });

  renderMeterChangeStep2Form();
}

/**
 * Xóa một lần thay đồng hồ (từ lần 2 trở đi)
 * @param {'elec' | 'water'} type
 * @param {number} idx
 */
function removeMeterChangeRow(type, idx) {
  const list = mcState[type];
  if (!Array.isArray(list) || idx <= 0 || idx >= list.length) return;

  const wasLast = idx === list.length - 1;
  const removedMonthEnd = list[idx].monthEnd || '';
  list.splice(idx, 1);

  if (wasLast && removedMonthEnd && list.length > 0) {
    list[list.length - 1].monthEnd = removedMonthEnd;
  }

  // Đồng bộ lại chuỗi Ô 1 = Ô 3 của lần trước cho các dòng sau
  for (let i = 1; i < list.length; i++) {
    list[i].start = list[i - 1].newStart !== undefined ? String(list[i - 1].newStart) : '0';
  }

  renderMeterChangeStep2Form();
}

/**
 * Render toàn bộ khối nhập liệu ở cột trái Bước 2
 */
function renderMeterChangeStep2Form() {
  if (!mcSelectedRoom) return;

  const titleEl = document.getElementById('mc-selected-room-title');
  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-water'));
  const needElec = Boolean(chkElec && chkElec.checked);
  const needWater = Boolean(chkWater && chkWater.checked);

  if (titleEl) {
    let badgeText = '';
    let badgeCls = '';
    const checkElecMissing = needElec && !mcSelectedRoom.hasPrevElec;
    const checkWaterMissing = needWater && !mcSelectedRoom.hasPrevWater;

    if (!checkElecMissing && !checkWaterMissing) {
      badgeText = 'Đã có số tháng trước (Ô 1 tự động khóa)';
      badgeCls = 'has-data';
    } else if (checkElecMissing && checkWaterMissing) {
      badgeText = 'Chưa có dữ liệu tháng trước (Mở khóa nhập Ô 1)';
      badgeCls = 'no-data';
    } else {
      badgeText = checkElecMissing
        ? 'Điện chưa có số cũ (Mở khóa Ô 1 Điện)'
        : 'Nước chưa có số cũ (Mở khóa Ô 1 Nước)';
      badgeCls = 'no-data';
    }

    titleEl.innerHTML = `
      <span>🏠 Phòng ${escapeMcAttr(mcSelectedRoom.phong)}</span>
      <span class="mc-room-prev-badge ${badgeCls}">${badgeText}</span>
    `;
  }

  const container = document.getElementById('mc-dynamic-form-area');
  if (!container) return;

  let html = '';
  if (needElec) {
    html += buildMeterChangeSectionHtml('elec', '⚡ Đồng hồ Điện (kWh)', 'Thay đổi đồng hồ điện', mcSelectedRoom.hasPrevElec);
  }
  if (needWater) {
    html += buildMeterChangeSectionHtml('water', '💧 Đồng hồ Nước (m³)', 'Thay đổi đồng hồ nước', mcSelectedRoom.hasPrevWater);
  }
  container.innerHTML = html;

  if (needElec) updateMeterChangeLiveSection('elec');
  if (needWater) updateMeterChangeLiveSection('water');
}

/**
 * Tạo HTML cho 1 khối đồng hồ (Điện hoặc Nước)
 * @param {'elec' | 'water'} type
 * @param {string} mainLabel
 * @param {string} subLabelBase
 * @param {boolean} hasPrevData
 */
function buildMeterChangeSectionHtml(type, mainLabel, subLabelBase, hasPrevData) {
  const list = mcState[type];
  const isMultiple = list.length > 1;

  const rowsHtml = list.map((row, idx) => {
    const titleText = isMultiple ? `${subLabelBase} - Lần ${idx + 1}` : subLabelBase;
    const isFirst = idx === 0;
    const isLast = idx === list.length - 1;

    let box1Attr = '';
    let box1Tooltip = '';
    if (isFirst) {
      if (hasPrevData) {
        box1Attr = 'readonly';
        box1Tooltip = 'Hệ thống tự động lấy từ chỉ số chốt cuối tháng trước (Không cần nhập)';
      } else {
        box1Attr = 'placeholder="Nhập số đầu"';
        box1Tooltip = 'Phòng mới chưa có dữ liệu tháng trước: Nhập chỉ số khởi điểm ban đầu';
      }
    } else {
      box1Attr = 'readonly placeholder="Theo Ô 3"';
      box1Tooltip = 'Tự động lấy theo Số đầu ĐH mới (Ô 3) của lần thay trước đó';
    }

    const box4Attr = isLast ? 'placeholder="Tùy chọn"' : 'disabled placeholder="—"';
    const box4Tooltip = isLast
      ? 'Số chốt cuối tháng (Tùy chọn: có thể để trống nếu mới thay giữa tháng)'
      : 'Chỉ nhập số chốt cuối tháng ở lần thay cuối cùng';

    return `
      <div class="mc-change-row-block" id="mc-${type}-row-${idx}">
        <div class="mc-sub-header">
          <span>${titleText}</span>
          <input type="date" class="mc-date-input"
            value="${escapeMcAttr(row.date || '')}"
            onchange="onMeterChangeDateInput('${type}', ${idx}, this.value)"
            title="Ngày thay đổi đồng hồ (Không bắt buộc)">
          ${idx > 0
        ? `<button type="button" class="mc-btn-remove" onclick="removeMeterChangeRow('${type}', ${idx})">✕ Xóa lần này</button>`
        : ''}
        </div>
        <div class="mc-four-boxes-row">
          <div class="mc-box-unit mc-box-1">
            <label for="mc-${type}-${idx}-start">Ô 1: Đầu kỳ</label>
            <input type="number" min="0" step="any"
              id="mc-${type}-${idx}-start"
              value="${escapeMcAttr(row.start)}"
              ${box1Attr}
              oninput="onMeterChangeNumInput('${type}', ${idx}, 'start', this)"
              title="${escapeMcAttr(box1Tooltip)}">
          </div>
          <span class="mc-separator-semi">;</span>
          <div class="mc-box-unit mc-box-2">
            <label for="mc-${type}-${idx}-oldEnd">Ô 2: Cuối ĐH cũ</label>
            <input type="number" min="0" step="any"
              id="mc-${type}-${idx}-oldEnd"
              value="${escapeMcAttr(row.oldEnd)}"
              placeholder="Lúc tháo"
              oninput="onMeterChangeNumInput('${type}', ${idx}, 'oldEnd', this)"
              title="Nhập chỉ số trên mặt đồng hồ CŨ ngay trước khi tháo xuống (phải ≥ Ô 1)">
          </div>
          <span class="mc-separator-arrow">➔</span>
          <div class="mc-box-unit mc-box-3">
            <label for="mc-${type}-${idx}-newStart">Ô 3: Đầu ĐH mới</label>
            <input type="number" min="0" step="any"
              id="mc-${type}-${idx}-newStart"
              value="${escapeMcAttr(row.newStart)}"
              placeholder="0"
              oninput="onMeterChangeNumInput('${type}', ${idx}, 'newStart', this)"
              title="Nhập chỉ số khởi điểm trên đồng hồ MỚI lúc lắp vào (mặc định là 0)">
          </div>
          <span class="mc-separator-semi">;</span>
          <div class="mc-box-unit mc-box-4">
            <label for="mc-${type}-${idx}-monthEnd">Ô 4: Cuối tháng</label>
            <input type="number" min="0" step="any"
              id="mc-${type}-${idx}-monthEnd"
              value="${isLast ? escapeMcAttr(row.monthEnd) : ''}"
              ${box4Attr}
              oninput="onMeterChangeNumInput('${type}', ${idx}, 'monthEnd', this)"
              title="${escapeMcAttr(box4Tooltip)}">
          </div>
        </div>
        <div class="mc-row-feedback" id="mc-${type}-${idx}-feedback"></div>
      </div>
    `;
  }).join('');

  return `
    <div class="mc-meter-section" id="mc-section-${type}">
      <div class="mc-meter-main-title">
        <div class="mc-meter-title-left">
          <span>${mainLabel}</span>
          <span class="mc-status-pill tracking" id="mc-status-pill-${type}">⏳ Đang theo dõi</span>
        </div>
        <button type="button" class="mc-btn-add-change" onclick="addMeterChangeRow('${type}')">+ Thêm lần thay</button>
      </div>
      ${rowsHtml}
      <div class="mc-section-summary" id="mc-summary-${type}">
        <span style="color:#64748b;">Nhập chỉ số lúc tháo (Ô 2) để xem kết quả tạm tính</span>
        <span class="mc-summary-val">—</span>
      </div>
    </div>
  `;
}

/**
 * Lưu ngày thay đổi (không bắt buộc)
 * @param {'elec' | 'water'} type
 * @param {number} idx
 * @param {string} val
 */
function onMeterChangeDateInput(type, idx, val) {
  if (mcState[type] && mcState[type][idx]) {
    mcState[type][idx].date = val;
  }
}

/**
 * Xử lý nhập số trực tiếp không làm mất focus ô đang gõ
 * @param {'elec' | 'water'} type
 * @param {number} idx
 * @param {'start' | 'oldEnd' | 'newStart' | 'monthEnd'} field
 * @param {HTMLInputElement} inputEl
 */
function onMeterChangeNumInput(type, idx, field, inputEl) {
  if (!mcState[type] || !mcState[type][idx]) return;
  mcState[type][idx][field] = inputEl.value;

  // Nếu sửa Ô 3 (newStart) của lần i -> tự động nối tiếp sang Ô 1 của lần i + 1
  if (field === 'newStart' && idx + 1 < mcState[type].length) {
    mcState[type][idx + 1].start = inputEl.value;
    const nextStartEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${idx + 1}-start`));
    if (nextStartEl) {
      nextStartEl.value = inputEl.value;
    }
  }

  updateMeterChangeLiveSection(type);
}

/**
 * Tính toán và kiểm tra hợp lệ theo đúng Logic 3 bước (UI Realtime)
 * @param {'elec' | 'water'} type
 * @returns {{ valid: boolean, status: 'tracking' | 'done' | 'error', total: number, firstErrorEl: HTMLInputElement | null, errorMsg: string }}
 */
function evaluateMeterChangeSection(type) {
  const list = mcState[type] || [];
  const unit = type === 'elec' ? 'kWh' : 'm³';
  let firstErrorEl = null;
  let firstErrorMsg = '';
  let hasLogicError = false;
  let allRequiredEntered = true;
  let totalUsed = 0;
  let lastNewStartVal = null;

  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    const startEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${i}-start`));
    const oldEndEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${i}-oldEnd`));
    const newStartEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${i}-newStart`));
    const monthEndEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${i}-monthEnd`));

    [startEl, oldEndEl, newStartEl, monthEndEl].forEach(el => {
      if (el) el.classList.remove('mc-input-error');
    });

    const startRaw = row.start !== undefined ? String(row.start).trim() : '';
    const oldEndRaw = row.oldEnd !== undefined ? String(row.oldEnd).trim() : '';
    const newStartRaw = row.newStart !== undefined ? String(row.newStart).trim() : '';

    const startNum = startRaw !== '' ? Number(startRaw) : NaN;
    const oldEndNum = oldEndRaw !== '' ? Number(oldEndRaw) : NaN;
    const newStartNum = newStartRaw !== '' ? Number(newStartRaw) : NaN;

    let rowMsg = '';
    let rowType = '';

    if (isNaN(startNum) || startNum < 0) {
      allRequiredEntered = false;
      if (startRaw !== '' && startNum < 0) {
        hasLogicError = true;
        rowType = 'error';
        rowMsg = 'Chỉ số đầu kỳ không được âm';
        if (startEl) {
          startEl.classList.add('mc-input-error');
          if (!firstErrorEl) { firstErrorEl = startEl; firstErrorMsg = rowMsg; }
        }
      }
    }

    if (oldEndRaw === '') {
      allRequiredEntered = false;
    } else if (isNaN(oldEndNum) || oldEndNum < 0) {
      hasLogicError = true;
      rowType = 'error';
      rowMsg = 'Số cuối ĐH cũ không hợp lệ';
      if (oldEndEl) {
        oldEndEl.classList.add('mc-input-error');
        if (!firstErrorEl) { firstErrorEl = oldEndEl; firstErrorMsg = rowMsg; }
      }
    } else if (!isNaN(startNum) && oldEndNum < startNum) {
      hasLogicError = true;
      rowType = 'error';
      rowMsg = `Số cuối ĐH cũ (${formatMcNumber(oldEndNum)}) phải ≥ mốc bắt đầu (${formatMcNumber(startNum)})`;
      if (oldEndEl) {
        oldEndEl.classList.add('mc-input-error');
        if (!firstErrorEl) { firstErrorEl = oldEndEl; firstErrorMsg = rowMsg; }
      }
    }

    if (newStartRaw === '' || isNaN(newStartNum) || newStartNum < 0) {
      allRequiredEntered = false;
      if (newStartRaw !== '') {
        hasLogicError = true;
        rowType = 'error';
        rowMsg = rowMsg || 'Số đầu ĐH mới phải ≥ 0';
        if (newStartEl) {
          newStartEl.classList.add('mc-input-error');
          if (!firstErrorEl) { firstErrorEl = newStartEl; firstErrorMsg = rowMsg; }
        }
      }
    } else {
      lastNewStartVal = newStartNum;
    }

    let segUsed = 0;
    const isStep2Valid = !isNaN(startNum) && !isNaN(oldEndNum) && oldEndNum >= startNum;
    if (isStep2Valid) {
      segUsed = oldEndNum - startNum;
      totalUsed += segUsed;
    }

    // Kiểm tra Bước 3 ở lần thay cuối cùng
    const isLast = i === list.length - 1;
    let finalAdded = 0;
    let monthEndValid = true;
    let hasMonthEnd = false;

    if (isLast) {
      const monthEndRaw = row.monthEnd !== undefined ? String(row.monthEnd).trim() : '';
      if (monthEndRaw !== '') {
        hasMonthEnd = true;
        const monthEndNum = Number(monthEndRaw);
        if (isNaN(monthEndNum) || monthEndNum < 0) {
          monthEndValid = false;
          hasLogicError = true;
          rowType = 'error';
          rowMsg = 'Số chốt cuối tháng không hợp lệ';
          if (monthEndEl) {
            monthEndEl.classList.add('mc-input-error');
            if (!firstErrorEl) { firstErrorEl = monthEndEl; firstErrorMsg = rowMsg; }
          }
        } else if (!isNaN(newStartNum) && monthEndNum < newStartNum) {
          monthEndValid = false;
          hasLogicError = true;
          rowType = 'error';
          rowMsg = `Số chốt cuối tháng (${formatMcNumber(monthEndNum)}) phải ≥ số đầu ĐH mới (${formatMcNumber(newStartNum)})`;
          if (monthEndEl) {
            monthEndEl.classList.add('mc-input-error');
            if (!firstErrorEl) { firstErrorEl = monthEndEl; firstErrorMsg = rowMsg; }
          }
        } else if (!isNaN(newStartNum)) {
          finalAdded = monthEndNum - newStartNum;
          totalUsed += finalAdded;
        }
      }
    }

    if (rowType !== 'error' && isStep2Valid) {
      rowType = 'valid';
      if (isLast && hasMonthEnd && monthEndValid && !isNaN(newStartNum)) {
        rowMsg = `ĐH cũ: +${formatMcNumber(segUsed)} ${unit}  |  ĐH mới: +${formatMcNumber(finalAdded)} ${unit}`;
      } else {
        rowMsg = `ĐH cũ đã dùng: +${formatMcNumber(segUsed)} ${unit}`;
      }
    }

    const fbEl = document.getElementById(`mc-${type}-${i}-feedback`);
    if (fbEl) {
      fbEl.className = `mc-row-feedback ${rowType}`;
      fbEl.textContent = rowMsg;
    }
  }

  const lastRow = list[list.length - 1];
  const lastMonthEndRaw = lastRow && lastRow.monthEnd !== undefined ? String(lastRow.monthEnd).trim() : '';
  const isCompleted = !hasLogicError && allRequiredEntered && lastMonthEndRaw !== '';

  if (hasLogicError) {
    return { valid: false, status: 'error', total: totalUsed, firstErrorEl, errorMsg: firstErrorMsg };
  }

  if (!allRequiredEntered) {
    return {
      valid: false,
      status: 'tracking',
      total: totalUsed,
      firstErrorEl: null,
      errorMsg: 'Vui lòng nhập đầy đủ Ô 1 (nếu mở), Ô 2 và Ô 3'
    };
  }

  return {
    valid: true,
    status: isCompleted ? 'done' : 'tracking',
    total: totalUsed,
    firstErrorEl: null,
    errorMsg: '',
    lastNewStart: lastNewStartVal
  };
}

/**
 * Cập nhật badge trạng thái và thanh tổng kết của 1 khối Điện / Nước
 * @param {'elec' | 'water'} type
 */
function updateMeterChangeLiveSection(type) {
  const unit = type === 'elec' ? 'kWh' : 'm³';
  const evalRes = evaluateMeterChangeSection(type);

  const pillEl = document.getElementById(`mc-status-pill-${type}`);
  const summaryEl = document.getElementById(`mc-summary-${type}`);

  if (pillEl) {
    if (evalRes.status === 'error') {
      pillEl.className = 'mc-status-pill error';
      pillEl.textContent = '⚠️ Số chưa hợp lệ';
    } else if (evalRes.status === 'done') {
      pillEl.className = 'mc-status-pill done';
      pillEl.textContent = '✅ Hoàn tất';
    } else {
      pillEl.className = 'mc-status-pill tracking';
      pillEl.textContent = '⏳ Đang theo dõi';
    }
  }

  if (summaryEl) {
    if (evalRes.status === 'error') {
      summaryEl.innerHTML = `
        <span style="color:#dc2626; font-weight:600;">${escapeMcAttr(evalRes.errorMsg)}</span>
        <span class="mc-summary-val" style="color:#dc2626;">Lỗi</span>
      `;
    } else if (!evalRes.valid) {
      summaryEl.innerHTML = `
        <span style="color:#64748b;">Nhập đủ Ô 1 (nếu phòng mới), Ô 2 lúc tháo và Ô 3 để tính tạm tính</span>
        <span class="mc-summary-val">${evalRes.total > 0 ? `+${formatMcNumber(evalRes.total)} ${unit}` : '—'}</span>
      `;
    } else if (evalRes.status === 'done') {
      summaryEl.innerHTML = `
        <span style="color:#166534; font-weight:600;">Đã chốt cuối tháng — Tổng tiêu thụ tính tiền:</span>
        <span class="mc-summary-val" style="color:#15803d; font-size:14.5px;">${formatMcNumber(evalRes.total)} ${unit}</span>
      `;
    } else {
      summaryEl.innerHTML = `
        <span style="color:#92400e; font-weight:600;">Chưa chốt cuối tháng — Tạm tính phần ĐH đã tháo:</span>
        <span class="mc-summary-val" style="color:#b45309; font-size:14.5px;">${formatMcNumber(evalRes.total)} ${unit}</span>
      `;
    }
  }
}

/**
 * Xử lý khi người dùng bấm "💾 Lưu ghi nhận" (Chế độ UI Preview chưa ghi vào Database)
 */
function handleSaveMeterChangeUI() {
  if (!mcSelectedRoom) return;

  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-water'));
  const needElec = Boolean(chkElec && chkElec.checked);
  const needWater = Boolean(chkWater && chkWater.checked);

  const summaryParts = [];
  let firstInvalidFocus = null;
  let invalidToastMsg = '';

  const checkAndCollect = (type, label, unit) => {
    const res = evaluateMeterChangeSection(type);
    if (!res.valid) {
      // Tìm ô bị thiếu/lỗi đầu tiên để focus
      const list = mcState[type];
      for (let i = 0; i < list.length; i++) {
        const startEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${i}-start`));
        const oldEndEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${i}-oldEnd`));
        const newStartEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${i}-newStart`));
        if (res.firstErrorEl && !firstInvalidFocus) {
          firstInvalidFocus = res.firstErrorEl;
          invalidToastMsg = res.errorMsg;
          return;
        }
        if (startEl && !startEl.readOnly && startEl.value.trim() === '') {
          startEl.classList.add('mc-input-error');
          if (!firstInvalidFocus) {
            firstInvalidFocus = startEl;
            invalidToastMsg = `${label} (Lần ${i + 1}): Vui lòng nhập Chỉ số đầu kỳ (Ô 1)!`;
          }
          return;
        }
        if (oldEndEl && oldEndEl.value.trim() === '') {
          oldEndEl.classList.add('mc-input-error');
          if (!firstInvalidFocus) {
            firstInvalidFocus = oldEndEl;
            invalidToastMsg = `${label} (Lần ${i + 1}): Vui lòng nhập Số cuối ĐH cũ lúc tháo (Ô 2)!`;
          }
          return;
        }
        if (newStartEl && newStartEl.value.trim() === '') {
          newStartEl.classList.add('mc-input-error');
          if (!firstInvalidFocus) {
            firstInvalidFocus = newStartEl;
            invalidToastMsg = `${label} (Lần ${i + 1}): Vui lòng nhập Số đầu ĐH mới (Ô 3)!`;
          }
          return;
        }
      }
      return;
    }

    const statusTxt = res.status === 'done' ? 'Hoàn tất' : 'Đang theo dõi';
    summaryParts.push(`${label}: ${formatMcNumber(res.total)} ${unit} (${statusTxt})`);
  };

  if (needElec) checkAndCollect('elec', '⚡ Điện', 'kWh');
  if (needWater) checkAndCollect('water', '💧 Nước', 'm³');

  if (firstInvalidFocus) {
    firstInvalidFocus.focus();
    if (typeof showToast === 'function') {
      showToast(invalidToastMsg || 'Vui lòng kiểm tra lại chỉ số vừa nhập!', 'warning');
    } else {
      alert(invalidToastMsg);
    }
    return;
  }

  const msg = `Phòng ${mcSelectedRoom.phong} — ${summaryParts.join(' | ')} (Giao diện xem trước, chưa lưu DB)`;
  if (typeof showToast === 'function') {
    showToast(msg, 'success');
  } else {
    alert(msg);
  }
  closeMeterChangeModal();
}

// Đóng Modal khi nhấn phím Esc hoặc click ra ngoài vùng tối mờ
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('meter-change-modal');
      if (modal && modal.style.display === 'flex') {
        closeMeterChangeModal();
      }
    }
  });

  document.addEventListener('click', e => {
    const modal = document.getElementById('meter-change-modal');
    if (modal && modal.style.display === 'flex' && e.target === modal) {
      closeMeterChangeModal();
    }
  });
}

// Phơi các hàm ra window để HTML onclick gọi trực tiếp
if (typeof window !== 'undefined') {
  window.openMeterChangeModal = openMeterChangeModal;
  window.closeMeterChangeModal = closeMeterChangeModal;
  window.toggleMeterChangeType = toggleMeterChangeType;
  window.goToMeterChangeStep = goToMeterChangeStep;
  window.addMeterChangeRow = addMeterChangeRow;
  window.removeMeterChangeRow = removeMeterChangeRow;
  window.onMeterChangeDateInput = onMeterChangeDateInput;
  window.onMeterChangeNumInput = onMeterChangeNumInput;
  window.handleSaveMeterChangeUI = handleSaveMeterChangeUI;
}

