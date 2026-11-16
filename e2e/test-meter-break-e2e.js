/**
 * ============================================================================
 * E2E TEST SUITE ON REAL ELECTRON APP (npm start environment)
 * Kiểm tra toàn bộ luồng Break chỉ số Điện / Nước (Phần 1 + Xuất Excel / Phiếu Thu / Zalo)
 * Chạy hoàn toàn trong thư mục TEMP & APPDATA cô lập, không ảnh hưởng dữ liệu thật.
 *
 * Chạy: node e2e/test-meter-break-e2e.js
 * ============================================================================
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawn, execFileSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ELECTRON_BIN = require('electron');

const CDP_PORT = 9450 + Math.floor(Math.random() * 400);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeTempDirs() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phongtro-mb-e2e-'));
  const userDataDir = path.join(root, 'ElectronUserData');
  const baseFolder = path.join(root, 'BaseFolder');
  const dataDir = path.join(baseFolder, 'data');
  const historyDir = path.join(dataDir, 'history');

  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(path.join(userDataDir, 'project-tools-phongtro'), { recursive: true });
  fs.mkdirSync(historyDir, { recursive: true });

  const pointerContent = JSON.stringify({ baseFolder, dataFolderName: 'data', phieuThuFolderName: 'PhieuThu' }, null, 2);
  fs.writeFileSync(path.join(userDataDir, 'pointer.json'), pointerContent, 'utf8');
  fs.writeFileSync(path.join(userDataDir, 'project-tools-phongtro', 'pointer.json'), pointerContent, 'utf8');

  const settings = {
    appId: 'phong-tro-app',
    baseFolder,
    dienThoai: '0900000000',
    giaPhong: 2500000,
    giaDien: 3500,
    giaNuoc: 20000,
    tienRac: 20000,
    tienInternet: 50000,
    tyLeHaoTai: 0.07,
    enableRolloverPopup: true,
    enableAnomalyPopup: true,
    zaloSendReceiptImage: true,
    zaloSendPaymentQr: false,
    zaloSendMessageText: true,
    zaloIncludeMeterChangeNote: true,
    zaloMessageTemplate: 'Chào {tenChuPhong} phòng {phong}:\nĐiện: {dienCu} -> {dienMoi} ({dienKwh} kWh)\n{ghiChuThayDien}\n{ghiChuThayNuoc}\nTổng: {tongCong}đ',
    confirmedAlerts: {},
    meterDigits: {
      '1A': { dien: 5, nuoc: 4 },
      '2A': { dien: 4, nuoc: 4 },
      '3A': { dien: 5, nuoc: 4 }
    }
  };
  fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify(settings, null, 2), 'utf8');

  const roomNames = ['1A', '2A', '3A', '4A', '5A', '6A', '1B', '2B', '3B', '4B', '5B', '6B'];
  fs.writeFileSync(
    path.join(dataDir, 'rooms.json'),
    JSON.stringify(roomNames.map(phong => ({ phong, tenKhach: phong === '1A' ? 'Nguyễn Văn An' : '', cmnd: '', chuPhong: null, thanhVien: [] })), null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(dataDir, 'residents.json'),
    JSON.stringify([
      {
        id: 'res_1A_host',
        phong: '1A',
        hoTen: 'Nguyễn Văn An',
        vaiTro: 'Chủ phòng',
        sdtZalo: '0901111222',
        sdtGoi: '0901111222'
      }
    ], null, 2),
    'utf8'
  );

  // Seed 2026-07 đã đóng đủ 12 phòng
  const julyRooms = roomNames.map(phong => {
    if (phong === '1A') return { phong, dienCu: 50, dienMoi: 100, nuocCu: 10, nuocMoi: 20, confirmedRollover: false, confirmedAnomaly: false };
    if (phong === '2A') return { phong, dienCu: 9800, dienMoi: 9980, nuocCu: 50, nuocMoi: 60, confirmedRollover: false, confirmedAnomaly: false };
    return { phong, dienCu: 100, dienMoi: 200, nuocCu: 10, nuocMoi: 15, confirmedRollover: false, confirmedAnomaly: false };
  });
  fs.writeFileSync(path.join(historyDir, '2026-07.json'), JSON.stringify(julyRooms, null, 2), 'utf8');

  // Seed 2026-08 mở khóa (1A & 2A chưa chốt, 3A..6B đã đủ)
  const augRooms = roomNames.map(phong => {
    if (phong === '1A') return { phong, dienCu: 100, dienMoi: '', nuocCu: 20, nuocMoi: '', confirmedRollover: false, confirmedAnomaly: false };
    if (phong === '2A') return { phong, dienCu: 9980, dienMoi: '', nuocCu: 60, nuocMoi: '', confirmedRollover: false, confirmedAnomaly: false };
    return { phong, dienCu: 200, dienMoi: 250, nuocCu: 15, nuocMoi: 18, confirmedRollover: false, confirmedAnomaly: false };
  });
  fs.writeFileSync(path.join(historyDir, '2026-08.json'), JSON.stringify(augRooms, null, 2), 'utf8');

  return { root, userDataDir, baseFolder, dataDir, historyDir };
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', ev => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
    await this.send('Runtime.enable');
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      const errText = res.exceptionDetails.exception?.description || res.exceptionDetails.text || 'Eval exception';
      throw new Error(`CDP Eval Error: ${errText}`);
    }
    return res.result ? res.result.value : undefined;
  }

  close() {
    try { this.ws.close(); } catch { }
  }
}

async function waitForPageTarget(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      const list = await res.json();
      const page = list.find(t => t.type === 'page' && t.url && t.url.includes('index.html'));
      if (page && page.webSocketDebuggerUrl) return page;
    } catch { }
    await sleep(200);
  }
  throw new Error('Timeout chờ Electron main window mở cổng CDP');
}

async function waitUntil(cdp, jsPredicate, timeoutMs = 8000, label = 'condition') {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await cdp.eval(`Boolean(${jsPredicate})`);
    if (ok) return true;
    await sleep(100);
  }
  throw new Error(`Timeout waiting for: ${label}`);
}

/**
 * Kiểm tra tất cả text hiển thị thực tế trong 1 container có fontSize >= 16px hay không.
 */
async function assertMinFontSize16(cdp, containerSelector, contextLabel) {
  const violations = await cdp.eval(`(() => {
    const root = document.querySelector(${JSON.stringify(containerSelector)});
    if (!root) return ['Missing container: ' + ${JSON.stringify(containerSelector)}];
    const issues = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      const el = node.parentElement;
      if (!el || el.closest('svg')) continue;
      if (el.offsetWidth === 0 && el.offsetHeight === 0) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const fs = parseFloat(style.fontSize || '0');
      if (fs < 15.95) {
        issues.push({
          tag: el.tagName,
          id: el.id || '',
          cls: el.className || '',
          fontSize: style.fontSize,
          text: node.nodeValue.trim().slice(0, 40)
        });
      }
    }
    return issues;
  })()`);
  assert.strictEqual(
    violations.length,
    0,
    `${contextLabel}: Phát hiện text < 16px: ${JSON.stringify(violations)}`
  );
}

/**
 * Giải nén file .xlsx bằng PowerShell (.NET ZipFile) để đọc chuỗi hiển thị từ sharedStrings + sheet1.xml.
 */
function readXlsxAllStrings(xlsxPath, tempRoot) {
  const unzipDir = path.join(tempRoot, 'xlsx_unzip_' + Date.now());
  const cmd = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${xlsxPath.replace(/'/g, "''")}', '${unzipDir.replace(/'/g, "''")}')`;
  execFileSync('powershell', ['-NoProfile', '-Command', cmd], { stdio: 'pipe' });

  const ssPath = path.join(unzipDir, 'xl', 'sharedStrings.xml');
  const sheetPath = path.join(unzipDir, 'xl', 'worksheets', 'sheet1.xml');
  const sharedStringsXml = fs.existsSync(ssPath) ? fs.readFileSync(ssPath, 'utf8') : '';
  const sheetXml = fs.existsSync(sheetPath) ? fs.readFileSync(sheetPath, 'utf8') : '';
  return { sharedStringsXml, sheetXml };
}

async function runSuite() {
  const dirs = makeTempDirs();
  console.log('📁 Temp test dir:', dirs.root);

  const env = {
    ...process.env,
    APPDATA: dirs.userDataDir,
    LOCALAPPDATA: dirs.userDataDir
  };
  delete env.ELECTRON_RUN_AS_NODE;

  const child = spawn(ELECTRON_BIN, ['.', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${dirs.userDataDir}`], {
    cwd: PROJECT_ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stderrLog = '';
  child.stderr.on('data', d => { stderrLog += d.toString(); });

  let cdp = null;
  const runtimeErrors = [];

  function pass(name, detail = '') {
    console.log(`✅ [PASS] ${name}${detail ? ' — ' + detail : ''}`);
  }

  try {
    const page = await waitForPageTarget(CDP_PORT);
    cdp = new CDPClient(page.webSocketDebuggerUrl);
    await cdp.connect();

    cdp.ws.addEventListener('message', ev => {
      const msg = JSON.parse(String(ev.data));
      if (msg.method === 'Runtime.exceptionThrown') {
        runtimeErrors.push(msg.params?.exceptionDetails?.exception?.description || 'Uncaught exception');
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
        runtimeErrors.push((msg.params.args || []).map(a => a.value || a.description).join(' '));
      }
    });

    await waitUntil(
      cdp,
      `document.querySelectorAll('#rooms-table-body tr').length === 12 && document.getElementById('month-year-select')?.value === '2026-08'`,
      12000,
      'Main table loaded with 2026-08'
    );
    pass('App boot', '12 phòng đã nạp sạch ở 2026-08 từ thư mục cô lập');

    // =========================================================================
    // TEST 1: Vị trí nút & màu sắc nút Break chỉ số
    // =========================================================================
    const btnCheck = await cdp.eval(`(() => {
      const btnMb = document.getElementById('btn-open-meter-break-modal');
      const btnMc = document.getElementById('btn-open-meter-change-modal');
      if (!btnMb || !btnMc) return { ok: false, reason: 'Thiếu nút' };
      const rMb = btnMb.getBoundingClientRect();
      const rMc = btnMc.getBoundingClientRect();
      const parentOk = btnMb.parentElement && btnMb.parentElement.classList.contains('table-card-header-actions') && btnMb.nextElementSibling === btnMc;
      const st = window.getComputedStyle(btnMb);
      return {
        ok: parentOk && rMb.left < rMc.left && rMb.right <= rMc.left + 2,
        parentOk,
        mbLeft: rMb.left,
        mcLeft: rMc.left,
        color: st.color,
        bg: st.backgroundColor,
        label: btnMb.textContent.trim()
      };
    })()`);
    assert.strictEqual(btnCheck.ok, true, `Nút Break phải nằm ngay bên trái Thay đổi đồng hồ: ${JSON.stringify(btnCheck)}`);
    pass('Header button layout & styling', `${btnCheck.label} (left=${Math.round(btnCheck.mbLeft)} < mcLeft=${Math.round(btnCheck.mcLeft)})`);

    // =========================================================================
    // TEST 2: Font size >= 16px toàn bộ Step 1 & Step 2 & Popup con
    // =========================================================================
    await cdp.eval(`document.getElementById('btn-open-meter-break-modal').click()`);
    await waitUntil(cdp, `document.getElementById('meter-break-modal').style.display === 'flex'`, 3000, 'Open Break modal Step 1');
    await assertMinFontSize16(cdp, '#meter-break-modal', 'Break Modal Step 1');
    pass('Typography >= 16px (Step 1)', '100% text node hiển thị ở Bước 1 đều >= 16px');

    // Chọn 2A (ĐH 4 số để test quay vòng 10.000) & sang Step 2
    await cdp.eval(`(() => {
      const card2A = [...document.querySelectorAll('#mb-room-grid .mb-room-card')].find(el => el.textContent.includes('Phòng 2A'));
      if (!card2A) throw new Error('Không thấy thẻ 2A');
      card2A.click();
      document.getElementById('mb-btn-next').click();
    })()`);
    await waitUntil(cdp, `document.getElementById('mb-page2').classList.contains('active')`, 3000, 'Transition to Break Step 2');
    await assertMinFontSize16(cdp, '#meter-break-modal', 'Break Modal Step 2 (Left + Right Guide)');
    pass('Typography >= 16px (Step 2)', '100% text node ở Cột nhập liệu & Bảng hướng dẫn >= 16px');

    // =========================================================================
    // TEST 3: Khóa tuần tự Ô 1 -> Ô 2 -> Ô 3 & Popup quay vòng Ô 2 < Ô 1 (phòng 2A)
    // =========================================================================
    const seqCheck = await cdp.eval(`({
      o1Val: document.getElementById('mb-elec-start').value,
      o1Locked: document.getElementById('mb-elec-start').readOnly,
      o2Disabled: document.getElementById('mb-elec-breakEnd').disabled,
      o3Disabled: document.getElementById('mb-elec-breakStart').disabled
    })`);
    assert.strictEqual(seqCheck.o1Val, '9980');
    assert.strictEqual(seqCheck.o1Locked, true);
    assert.strictEqual(seqCheck.o2Disabled, false);
    assert.strictEqual(seqCheck.o3Disabled, true, 'Ô 3 phải bị khóa cho tới khi nhập Ô 2');

    // Nhập Ô 2 = 10 (< 9980) -> blur -> phải bật #mb-rollover-modal
    await cdp.eval(`(() => {
      const endEl = document.getElementById('mb-elec-breakEnd');
      endEl.value = '10';
      endEl.dispatchEvent(new Event('input', { bubbles: true }));
      onMbBreakEndBlur('elec');
    })()`);
    await waitUntil(cdp, `document.getElementById('mb-rollover-modal').style.display === 'flex'`, 2000, 'Rollover popup opens on Ô 2 < Ô 1');
    await assertMinFontSize16(cdp, '#mb-rollover-modal', 'Rollover Child Popup');

    const rollCalcText = await cdp.eval(`document.getElementById('mb-rollover-calc-val').textContent.trim()`);
    assert.ok(rollCalcText.includes('30'), `Chênh lệch quay vòng 9980 -> 10 (4 số) phải là 30 kWh, got: ${rollCalcText}`);

    // Bấm "Nhập lại" -> không xác nhận quay vòng & vẫn chặn lưu nếu bấm Lưu
    await cdp.eval(`cancelMbRolloverModal()`);
    await waitUntil(cdp, `document.getElementById('mb-rollover-modal').style.display === 'none'`, 2000, 'Rollover popup closed on cancel');
    const afterCancelState = await cdp.eval(`(() => {
      const bsEl = document.getElementById('mb-elec-breakStart');
      const bsUnlocked = !bsEl.disabled;
      // Thử nhập Ô 3 = 12 rồi bấm Lưu -> vẫn phải bị chặn & bật lại popup quay vòng!
      bsEl.value = '12';
      bsEl.dispatchEvent(new Event('input', { bubbles: true }));
      handleSaveMeterBreak();
      return { bsUnlocked };
    })()`);
    assert.strictEqual(afterCancelState.bsUnlocked, true, 'Ô 3 mở khóa sau khi có Ô 2');
    await waitUntil(cdp, `document.getElementById('mb-rollover-modal').style.display === 'flex'`, 2000, 'Save triggers Rollover popup when unconfirmed');

    // Xác nhận quay vòng trên popup -> lưu thành công cho 2A
    await cdp.eval(`confirmMbRolloverModal()`);
    await waitUntil(
      cdp,
      `Boolean(window.meterBreaksStore?.months?.['2026-08']?.['2A']?.elec?.confirmedEndRollover === true) && Boolean(document.querySelector('#mb-selected-room-title .month-lock-badge.locked'))`,
      4000,
      '2A Break saved after rollover confirmation and Step 2 auto-locked'
    );
    pass('Sequential lock & Rollover Ô 2 < Ô 1', 'Chặn khi hủy quay vòng, bật popup khi Lưu và tính chuẩn 30 kWh khi xác nhận');

    // Kiểm tra thêm trường hợp Ô 3 < Ô 2 khi mở khóa chỉnh sửa trên 2A (ví dụ Ô 3 = 5 < Ô 2 = 10 -> startRollover)
    await cdp.eval(`(() => {
      document.getElementById('mb-btn-toggle-edit').click();
    })()`);
    await waitUntil(cdp, `document.getElementById('mb-unlock-edit-modal').style.display === 'flex'`, 2000, 'Unlock edit modal opens');
    await assertMinFontSize16(cdp, '#mb-unlock-edit-modal', 'Unlock Edit Child Popup');
    await cdp.eval(`confirmUnlockMbRecordForEditing()`);
    await cdp.eval(`(() => {
      const bsEl = document.getElementById('mb-elec-breakStart');
      bsEl.value = '5';
      bsEl.dispatchEvent(new Event('input', { bubbles: true }));
      onMbBreakStartBlur('elec');
    })()`);
    await waitUntil(cdp, `document.getElementById('mb-rollover-modal').style.display === 'flex'`, 2000, 'Rollover popup opens on Ô 3 < Ô 2');
    await cdp.eval(`cancelMbRolloverModal()`);
    // Bấm Hủy thay đổi & Giữ nguyên -> khôi phục BreakStart = 12 & khóa lại
    await cdp.eval(`document.getElementById('mb-btn-toggle-edit').click()`);
    const afterRevert2A = await cdp.eval(`({
      locked: Boolean(document.querySelector('#mb-selected-room-title .month-lock-badge.locked')),
      bsVal: document.getElementById('mb-elec-breakStart').value
    })`);
    assert.strictEqual(afterRevert2A.locked, true);
    assert.strictEqual(afterRevert2A.bsVal, '12', 'Hủy thay đổi & Giữ nguyên phải khôi phục Ô 3 về 12');

    // Xóa Break của 2A để sang test trọng tâm phòng 1A sạch sẽ -> kiểm tra dienCu 2A quay lại 9980
    await cdp.eval(`document.getElementById('mb-btn-toggle-edit').click()`);
    await waitUntil(cdp, `document.getElementById('mb-unlock-edit-modal').style.display === 'flex'`, 2000, 'Open unlock edit for delete');
    await cdp.eval(`confirmUnlockMbRecordForEditing()`);
    await cdp.eval(`document.getElementById('mb-btn-delete-all').click()`);
    await waitUntil(cdp, `document.getElementById('meter-break-modal').style.display === 'none'`, 3000, 'Modal closed after Hủy Break 2A');
    const restored2ADienCu = await cdp.eval(`roomsData.find(r => r.phong === '2A').dienCu`);
    assert.strictEqual(Number(restored2ADienCu), 9980, 'Hủy Break phải khôi phục dienCu 2A về 9980');
    pass('Rollover Ô 3 < Ô 2 + Revert + Hủy Break', 'Chặn Ô 3 < Ô 2, Hủy thay đổi khôi phục nguyên bản, Hủy Break trả lại Số cũ gốc');

    // =========================================================================
    // TEST 4: Đã nhập trước Số mới ngoài bảng + Lưu Break kích hoạt tableEndRollover + Đồng bộ bảng không báo bất thường 40%
    // =========================================================================
    // Nhập trước ngoài bảng chính cho 1A: dienMoi = 120
    await cdp.eval(`(() => {
      const idx = roomsData.findIndex(r => r.phong === '1A');
      const input = document.querySelector('input.table-input[data-row="' + idx + '"][data-field="dienMoi"]');
      input.value = '120';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);

    // Mở Break cho 1A Điện: Ô 1 = 100, Ô 2 = 130, Ô 3 = 135 (nên tableEnd 120 < Ô 3 135 -> bấm Lưu phải bật #mb-rollover-modal!)
    await cdp.eval(`document.getElementById('btn-open-meter-break-modal').click()`);
    await waitUntil(cdp, `document.getElementById('meter-break-modal').style.display === 'flex'`, 3000, 'Open Break modal for 1A');
    await cdp.eval(`(() => {
      const card1A = [...document.querySelectorAll('#mb-room-grid .mb-room-card')].find(el => el.textContent.includes('Phòng 1A'));
      if (!card1A) throw new Error('Không thấy thẻ 1A Break');
      card1A.click();
      document.getElementById('mb-btn-next').click();
    })()`);
    await waitUntil(cdp, `document.getElementById('mb-page2').classList.contains('active')`, 3000, '1A Break Step 2');
    await cdp.eval(`(() => {
      const endEl = document.getElementById('mb-elec-breakEnd');
      const bsEl = document.getElementById('mb-elec-breakStart');
      endEl.value = '130';
      endEl.dispatchEvent(new Event('input', { bubbles: true }));
      bsEl.value = '135';
      bsEl.dispatchEvent(new Event('input', { bubbles: true }));
      handleSaveMeterBreak();
    })()`);
    await waitUntil(cdp, `document.getElementById('mb-rollover-modal').style.display === 'flex'`, 2000, 'Table Số mới < Ô 3 triggers Rollover popup on Save');

    // Hủy quay vòng -> quay ra bảng sửa dienMoi thành 220 (để kiểm tra luôn không báo lỗi bất thường 40%) rồi vào Break lưu Ô 3 = 132
    await cdp.eval(`cancelMbRolloverModal(); closeMeterBreakModal();`);
    await cdp.eval(`(() => {
      const idx = roomsData.findIndex(r => r.phong === '1A');
      const input = document.querySelector('input.table-input[data-row="' + idx + '"][data-field="dienMoi"]');
      input.value = '220';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await cdp.eval(`document.getElementById('btn-open-meter-break-modal').click()`);
    await waitUntil(cdp, `document.getElementById('meter-break-modal').style.display === 'flex'`, 3000, 'Reopen Break modal for 1A');
    await cdp.eval(`(() => {
      const card1A = [...document.querySelectorAll('#mb-room-grid .mb-room-card')].find(el => el.textContent.includes('Phòng 1A'));
      card1A.click();
      document.getElementById('mb-btn-next').click();
    })()`);
    await waitUntil(cdp, `document.getElementById('mb-page2').classList.contains('active')`, 3000, '1A Break Step 2 reload');
    await cdp.eval(`(() => {
      const endEl = document.getElementById('mb-elec-breakEnd');
      const bsEl = document.getElementById('mb-elec-breakStart');
      endEl.value = '130';
      endEl.dispatchEvent(new Event('input', { bubbles: true }));
      bsEl.value = '132';
      bsEl.dispatchEvent(new Event('input', { bubbles: true }));
      handleSaveMeterBreak();
    })()`);
    await waitUntil(
      cdp,
      `Boolean(window.meterBreaksStore?.months?.['2026-08']?.['1A']?.elec) && Boolean(document.querySelector('#mb-selected-room-title .month-lock-badge.locked'))`,
      4000,
      '1A Break saved & auto-locked'
    );
    await cdp.eval(`closeMeterBreakModal()`);

    const postSave1A = await cdp.eval(`(() => {
      const idx = roomsData.findIndex(r => r.phong === '1A');
      const r = roomsData[idx];
      const tr = document.querySelectorAll('#rooms-table-body tr')[idx];
      const pill = tr ? tr.querySelector('.meter-mb-pill') : null;
      const lockedInp = tr ? tr.querySelector('.mb-locked-input') : null;
      const calc = calcRoom({ ...r, dienCu: Number(r.dienCu), dienMoi: Number(r.dienMoi), nuocCu: Number(r.nuocCu), nuocMoi: Number(r.nuocMoi || r.nuocCu), tienPhong: appSettings.giaPhong }, appSettings);
      return {
        dienCu: r.dienCu,
        hasMbElec: r.hasMbElec,
        hasPill: Boolean(pill),
        hasLockedStyle: Boolean(lockedInp),
        dienKwh: calc.dienKwh,
        tableLocked: isCurrentMonthLocked
      };
    })()`);
    assert.strictEqual(Number(postSave1A.dienCu), 132, 'dienCu 1A phải cập nhật thành Break bắt đầu 132');
    assert.strictEqual(postSave1A.hasMbElec, true, 'Cờ hasMbElec phải bật');
    assert.strictEqual(postSave1A.hasPill, true, 'Phải hiển thị pill ✂️ ở ô Điện cũ');
    assert.strictEqual(postSave1A.hasLockedStyle, true, 'Ô Điện cũ phải khóa style mb-locked-input');
    assert.strictEqual(postSave1A.dienKwh, 88, 'Tiêu thụ phải tính 220 - 132 = 88 kWh ngay lập tức');
    assert.strictEqual(postSave1A.tableLocked, false, 'Khóa Step 2 không được khóa bảng chính Phần 1');

    // Kiểm tra bảng không kích hoạt cảnh báo bất thường 40% khi blur dienMoi 1A đã Break
    await cdp.eval(`(() => {
      const idx = roomsData.findIndex(r => r.phong === '1A');
      const input = document.querySelector('input.table-input[data-row="' + idx + '"][data-field="dienMoi"]');
      input.value = '180';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      handleDienMoiBlur(idx);
    })()`);
    const anomalyPopupVisible = await cdp.eval(`document.getElementById('anomaly-modal')?.style.display === 'flex'`);
    assert.strictEqual(anomalyPopupVisible, false, 'Phòng đã Break Điện không được bật popup bất thường 40%');
    pass('Pre-entered table check + Sync + No false 40% anomaly', 'Bật quay vòng khi Số mới < Ô 3, đồng bộ Số cũ = 132 & tiêu thụ 48 kWh tức thì');

    // =========================================================================
    // TEST 5: Loại trừ lẫn nhau Phương án 1 (Break Điện <-> Thay ĐH Nước) & Lịch sử Mục 3
    // =========================================================================
    // Mở #meter-change-modal trên phòng 1A -> Điện phải bị disable + toast cảnh báo conflict
    await cdp.eval(`document.getElementById('btn-open-meter-change-modal').click()`);
    await waitUntil(cdp, `document.getElementById('meter-change-modal').style.display === 'flex'`, 3000, 'Open Meter Change modal');
    await cdp.eval(`(() => {
      const card1A = [...document.querySelectorAll('#mc-room-grid .mc-room-card')].find(el => el.textContent.includes('Phòng 1A'));
      if (!card1A) throw new Error('Không thấy thẻ 1A trong MC modal');
      card1A.click();
    })()`);
    const mcConflictCheck = await cdp.eval(`({
      elecDisabled: document.getElementById('mc-chk-elec').disabled,
      elecChecked: document.getElementById('mc-chk-elec').checked,
      waterDisabled: document.getElementById('mc-chk-water').disabled
    })`);
    assert.strictEqual(mcConflictCheck.elecDisabled, true, '1A đã Break Điện thì checkbox Thay ĐH Điện phải disable');
    assert.strictEqual(mcConflictCheck.elecChecked, false);
    assert.strictEqual(mcConflictCheck.waterDisabled, false, 'ĐH Nước chưa Break vẫn được phép Thay đổi đồng hồ');

    // Lưu Thay đổi đồng hồ Nước cho 1A (20 -> 24, ĐH mới 0 -> 5 = 9 m³)
    await cdp.eval(`(() => {
      const chkW = document.getElementById('mc-chk-water');
      if (!chkW.checked) chkW.click();
      document.getElementById('mc-btn-next').click();
    })()`);
    await waitUntil(cdp, `document.getElementById('mc-page2').classList.contains('active')`, 3000, 'MC Step 2 for 1A Water');
    await cdp.eval(`(() => {
      const oldEnd = document.getElementById('mc-water-0-oldEnd');
      oldEnd.value = '24';
      oldEnd.dispatchEvent(new Event('input', { bubbles: true }));
      onMcOldEndBlur('water', 0);
    })()`);
    await waitUntil(cdp, `document.getElementById('mc-digits-modal').style.display === 'flex'`, 3000, 'MC Digits modal opened on Water oldEnd blur');
    await cdp.eval(`confirmMcNewMeterDigits()`);
    await waitUntil(cdp, `document.getElementById('mc-digits-modal').style.display === 'none'`, 3000, 'MC Digits modal closed');
    await cdp.eval(`(() => {
      const newStart = document.getElementById('mc-water-0-newStart');
      const monthEnd = document.getElementById('mc-water-0-monthEnd');
      newStart.value = '0'; newStart.dispatchEvent(new Event('input', { bubbles: true }));
      monthEnd.value = '5'; monthEnd.dispatchEvent(new Event('input', { bubbles: true }));
      handleSaveMeterChange();
    })()`);
    await waitUntil(
      cdp,
      `Boolean(window.meterChangesStore?.months?.['2026-08']?.['1A']?.water?.changes?.length === 1)`,
      4000,
      'Saved Meter Change Water for 1A'
    );
    await cdp.eval(`closeMeterChangeModal()`);

    // Mở lại #meter-break-modal kiểm tra: 1A Nước bị disable, đồng thời kiểm tra Mục 3 Lịch sử
    await cdp.eval(`document.getElementById('btn-open-meter-break-modal').click()`);
    await waitUntil(cdp, `document.getElementById('meter-break-modal').style.display === 'flex'`, 3000, 'Reopen Break modal');
    const mbConflictAndHist = await cdp.eval(`(() => {
      const card1A = [...document.querySelectorAll('#mb-room-grid .mb-room-card')].find(el => el.textContent.includes('Phòng 1A'));
      if (!card1A) throw new Error('Không thấy thẻ 1A Break');
      card1A.click();
      return {
        waterDisabled: document.getElementById('mb-chk-water').disabled,
        waterConflictShown: document.getElementById('mb-conflict-water').style.display !== 'none',
        histCards: document.querySelectorAll('#mb-history-list .mb-history-card').length,
        histText: document.getElementById('mb-history-list').textContent.trim()
      };
    })()`);
    assert.strictEqual(mbConflictAndHist.waterDisabled, true, '1A đã Thay ĐH Nước thì checkbox Break Nước phải disable');
    assert.strictEqual(mbConflictAndHist.waterConflictShown, true);
    assert.strictEqual(mbConflictAndHist.histCards, 1, 'Lịch sử Mục 3 phải hiển thị bản ghi 1A đã Break');
    assert.ok(mbConflictAndHist.histText.includes('132'), 'Card lịch sử phải chứa số Break bắt đầu 132');

    // Kiểm tra thứ tự Mục 3 mới nhất -> cũ nhất khi có thêm 1 tháng cũ hơn (2026-07) trong store
    await cdp.eval(`(() => {
      window.meterBreaksStore.months['2026-07'] = {
        '6B': { elec: { initialIndex: 100, breakEnd: 110, breakStart: 112 } }
      };
      renderMeterBreakHistoryList();
    })()`);
    const histOrder = await cdp.eval(`[...document.querySelectorAll('#mb-history-list .mb-history-card')].map(el => el.dataset.monthKey)`);
    assert.deepStrictEqual(histOrder, ['2026-08', '2026-07'], 'Lịch sử Break phải sắp xếp Mới nhất -> Cũ nhất');
    await cdp.eval(`(() => {
      delete window.meterBreaksStore.months['2026-07'];
      closeMeterBreakModal();
    })()`);
    pass('Mutual exclusion (Phương án 1) & Section 3 History', 'Khóa chéo Break Điện <-> Thay ĐH Nước & sắp xếp lịch sử Mới nhất -> Cũ nhất');

    // =========================================================================
    // TEST 6: Phiếu Thu + Excel Tháng (Cột Q) + Zalo
    // =========================================================================
    const receiptCheck = await cdp.eval(`(() => {
      const r1A = roomsData.find(r => r.phong === '1A');
      const mc1A = getRoomMeterChangeRecord('2026-08', '1A');
      const surrogate = {
        ...r1A,
        dienCu: Number(r1A.dienCu),
        dienMoi: Number(r1A.dienMoi),
        nuocCu: Number(r1A.nuocCu),
        nuocMoi: Number(r1A.nuocMoi),
        tienPhong: appSettings.giaPhong
      };
      const calc = calcRoom(surrogate, appSettings);
      const rec = toReceiptData(calc, '2026-08', appSettings.dienThoai, mc1A);
      return rec;
    })()`);
    assert.strictEqual(Number(receiptCheck.dienCu), 132, 'Phiếu thu phải dùng Số cũ = Break bắt đầu 132');
    assert.strictEqual(Number(receiptCheck.dienMoi), 180, 'Phiếu thu phải dùng Số mới = 180');
    assert.strictEqual(Number(receiptCheck.dienKwh), 48, 'Phiếu thu tính 180 - 132 = 48 kWh');
    assert.strictEqual(receiptCheck.dienMcLines.length, 0, 'Phiếu thu KHÔNG được chèn dòng (*) cho Break Điện');
    assert.strictEqual(receiptCheck.nuocMcLines.length, 1, 'Phiếu thu vẫn giữ dòng (*) cho Thay ĐH Nước');

    // Kiểm tra Zalo Live Preview (không chứa bất kỳ chữ Break nào)
    await cdp.eval(`(() => {
      const rSel = document.getElementById('preview-room-select');
      const mSel = document.getElementById('preview-month-select');
      if (rSel) rSel.value = '1A';
      if (mSel) mSel.value = '2026-08';
      updateZaloLivePreview();
    })()`);
    const zaloText = await cdp.eval(`document.getElementById('zalo-preview-bubble')?.textContent || ''`);
    assert.ok(!zaloText.toLowerCase().includes('break'), `Zalo message KHÔNG được chứa ghi chú Break, got: ${zaloText}`);
    assert.ok(zaloText.includes('132') && zaloText.includes('180'), `Zalo sử dụng đúng 132 -> 180, got: ${zaloText}`);

    // Xuất file Excel tháng thật & đọc XML để kiểm tra Cột Q (Ghi Chú) chứa cả MC Nước + Break Điện
    await cdp.eval(`handleExportMonthExcelClick()`);
    await waitUntil(cdp, `document.getElementById('excel-export-result-modal')?.style.display === 'flex'`, 8000, 'Month Excel exported');
    const excelModalInfo = await cdp.eval(`({
      ok: !document.getElementById('excel-export-modal-title').textContent.includes('Lỗi'),
      fileName: document.getElementById('excel-export-filename')?.textContent.trim(),
      filePath: document.getElementById('excel-export-filepath')?.textContent.trim()
    })`);
    assert.strictEqual(excelModalInfo.ok, true, `Modal xuất Excel báo lỗi: ${JSON.stringify(excelModalInfo)}`);
    const xlsxPath = excelModalInfo.filePath;
    assert.ok(xlsxPath && fs.existsSync(xlsxPath), `Phải xuất được file .xlsx trên đĩa: ${xlsxPath}`);
    const { sharedStringsXml, sheetXml } = readXlsxAllStrings(xlsxPath, dirs.root);
    const combinedExcelXml = sharedStringsXml + '\n' + sheetXml;
    assert.ok(combinedExcelXml.includes('Ghi chú Break chỉ số'), 'Excel tháng Cột Q phải có ghi chú Break chỉ số');
    assert.ok(combinedExcelXml.includes('Break kết thúc 130'), 'Excel Cột Q phải có Break kết thúc 130');
    assert.ok(combinedExcelXml.includes('Break bắt đầu 132'), 'Excel Cột Q phải có Break bắt đầu 132');
    assert.ok(combinedExcelXml.includes('Ghi chú thay đổi đồng hồ'), 'Excel Cột Q vẫn giữ ghi chú Thay ĐH Nước trên cùng phòng 1A');
    await cdp.eval(`closeExcelExportResultModal()`);
    pass('Receipt + Zalo + Month Excel Col Q', `Phiếu thu: 132->180 (0 dòng (*) Break), Zalo sạch, Excel có đủ ghi chú Break & MC`);

    // =========================================================================
    // TEST 7: Nạp lại & Popup thiếu tháng trước (!) check fontSize >= 16px
    // =========================================================================
    const julyPath = path.join(dirs.historyDir, '2026-07.json');
    const julyData = JSON.parse(fs.readFileSync(julyPath, 'utf8'));
    const r3July = julyData.find(r => r.phong === '3A');
    r3July.dienMoi = '';
    fs.writeFileSync(julyPath, JSON.stringify(julyData, null, 2), 'utf8');
    await cdp.eval(`loadRoomsForMonth('2026-08')`);

    await cdp.eval(`document.getElementById('btn-open-meter-break-modal').click()`);
    await waitUntil(cdp, `document.getElementById('meter-break-modal').style.display === 'flex'`, 3000, 'Open Break modal for 3A missing prev');
    await cdp.eval(`(() => {
      const card3A = [...document.querySelectorAll('#mb-room-grid .mb-room-card')].find(el => el.textContent.includes('Phòng 3A'));
      if (!card3A) throw new Error('Không thấy thẻ 3A');
      card3A.click();
      document.getElementById('mb-btn-next').click();
    })()`);
    await waitUntil(cdp, `document.getElementById('mb-page2').classList.contains('active')`, 3000, '3A Step 2');
    await cdp.eval(`document.querySelector('.mb-missing-prev-btn').click()`);
    await waitUntil(cdp, `document.getElementById('mb-missing-prev-modal').style.display === 'flex'`, 2000, 'Missing prev popup opens');
    await assertMinFontSize16(cdp, '#mb-missing-prev-modal', 'Missing Prev Child Popup');
    await cdp.eval(`closeMbMissingPrevModal()`);
    await cdp.eval(`closeMeterBreakModal()`);

    // Khôi phục lại dienMoi 3A của 2026-07 -> nạp lại 2026-08 để bảng sạch trước khi Lưu & Xuất
    r3July.dienMoi = 200;
    fs.writeFileSync(julyPath, JSON.stringify(julyData, null, 2), 'utf8');
    await cdp.eval(`loadRoomsForMonth('2026-08')`);
    pass('Missing previous month (!) popup >= 16px', 'Nút (!) hoạt động chuẩn với font-size >= 16px');

    // =========================================================================
    // TEST 8: Lưu & Xuất tháng (khóa tháng) -> Mở khóa chỉnh sửa -> Hủy khôi phục cả Break trên RAM & ổ đĩa
    // =========================================================================
    // Điền nốt số phòng 1A (dienMoi=180) & 2A (dienMoi=9990, nuocMoi=65) cho đủ 12 phòng rồi Lưu & Xuất tháng 2026-08
    await cdp.eval(`(() => {
      const idx1A = roomsData.findIndex(r => r.phong === '1A');
      const d1El = document.querySelector('input.table-input[data-row="' + idx1A + '"][data-field="dienMoi"]');
      d1El.value = '180'; d1El.dispatchEvent(new Event('input', { bubbles: true }));

      const idx2A = roomsData.findIndex(r => r.phong === '2A');
      const dEl = document.querySelector('input.table-input[data-row="' + idx2A + '"][data-field="dienMoi"]');
      const nEl = document.querySelector('input.table-input[data-row="' + idx2A + '"][data-field="nuocMoi"]');
      dEl.value = '9990'; dEl.dispatchEvent(new Event('input', { bubbles: true }));
      nEl.value = '65'; nEl.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await cdp.eval(`saveAndExport()`);
    await waitUntil(cdp, `isCurrentMonthLocked === true && isCurrentMonthEditing === false`, 15000, '2026-08 locked after saveAndExport');

    // Kiểm tra JPG/PDF phiếu thu phòng 1A thực tế được tạo ra (PDF hợp nhất + ảnh JPG phòng 1A)
    const phieuThuAugDir = path.join(dirs.baseFolder, 'PhieuThu', 'Thang_08_2026');
    const phieuThuFiles = fs.existsSync(phieuThuAugDir) ? fs.readdirSync(phieuThuAugDir) : [];
    assert.ok(phieuThuFiles.some(f => f.toLowerCase().endsWith('.pdf')), `Phải xuất được file PDF tổng hợp trong ${phieuThuAugDir}`);
    assert.ok(phieuThuFiles.some(f => f.includes('1A') && f.toLowerCase().endsWith('.jpg')), `Phải xuất được ảnh JPG phiếu thu phòng 1A trong ${phieuThuAugDir}`);

    // Mở khóa chỉnh sửa tháng đã khóa -> xóa Break 1A tạm -> Hủy chỉnh sửa (restoreLockedMonthFromBackup) -> Break 1A phải hồi phục hoàn chỉnh cả RAM lẫn file meter-breaks.json!
    await cdp.eval(`(() => {
      confirmUnlockMonthForEditing();
      delete window.meterBreaksStore.months['2026-08']['1A'];
    })()`);
    await cdp.eval(`restoreLockedMonthFromBackup()`);
    await waitUntil(cdp, `isCurrentMonthLocked === true && isCurrentMonthEditing === false`, 3000, 'Month restored & re-locked');
    const restoredBreakRam = await cdp.eval(`window.meterBreaksStore?.months?.['2026-08']?.['1A']?.elec?.breakStart`);
    assert.strictEqual(Number(restoredBreakRam), 132, 'restoreLockedMonthFromBackup phải khôi phục Break 1A trên RAM');

    // Đợi ghi file atomic meter-breaks.json & activity-logs.json hoàn tất
    await sleep(300);
    const mbFile = JSON.parse(fs.readFileSync(path.join(dirs.dataDir, 'meter-breaks.json'), 'utf8'));
    assert.strictEqual(Number(mbFile?.months?.['2026-08']?.['1A']?.elec?.breakStart), 132, 'meter-breaks.json trên ổ đĩa phải khôi phục chuẩn xác');
    pass('Save & Export + Locked month restore', 'Xuất PDF/PNG thực tế thành công & khôi phục Break 1A nguyên vẹn khi hủy sửa tháng đã khóa');

    // =========================================================================
    // TEST 9: Nhật Ký Hoạt Động Break chi tiết (metadata.changes + [quay vòng])
    // =========================================================================
    const logData = JSON.parse(fs.readFileSync(path.join(dirs.dataDir, 'activity-logs.json'), 'utf8'));
    const logs = Array.isArray(logData.logs) ? logData.logs : [];
    const save2ALog = logs.find(l => l.action === 'METER_BREAK_SAVE' && l.metadata?.phong === '2A');
    const del2ALog = logs.find(l => l.action === 'METER_BREAK_DELETE' && l.metadata?.phong === '2A');
    const save1ALog = logs.find(l => l.action === 'METER_BREAK_SAVE' && l.metadata?.phong === '1A');
    assert.ok(save2ALog, 'Phải có log METER_BREAK_SAVE cho phòng 2A');
    assert.ok(save2ALog.summary.includes('[quay vòng]'), `Log lưu 2A phải ghi [quay vòng], got: ${save2ALog.summary}`);
    assert.ok(Array.isArray(save2ALog.metadata?.changes) && save2ALog.metadata.changes.length >= 3, 'Log lưu 2A phải có metadata.changes (Đầu kỳ / Kết thúc / Bắt đầu)');
    assert.ok(del2ALog && Array.isArray(del2ALog.metadata?.changes) && del2ALog.metadata.changes.length >= 2, 'Log Hủy Break 2A phải có metadata.changes chi tiết');
    assert.ok(save1ALog && Array.isArray(save1ALog.metadata?.changes) && save1ALog.metadata.changes.some(c => c.displayNew === '132'), 'Log lưu 1A phải có dòng Break bắt đầu -> 132');

    await cdp.eval(`openActivityLogModal()`);
    await waitUntil(cdp, `document.getElementById('activity-log-modal')?.style.display === 'flex' && document.querySelectorAll('#activity-log-timeline-container .alog-event-row').length > 0`, 4000, 'Activity Log modal loaded rows');
    const alogUiCheck = await cdp.eval(`(() => {
      const targetRow = [...document.querySelectorAll('#activity-log-timeline-container .alog-event-row')].find(el => el.textContent.includes('Break chỉ số giữa tháng phòng 1A'));
      if (!targetRow) return { ok: false, reason: 'Không tìm thấy dòng log 1A' };
      targetRow.click();
      const tbl = document.querySelector('#activity-log-timeline-container .alog-detail-table');
      return {
        ok: Boolean(tbl && tbl.textContent.includes('Break bắt đầu') && tbl.textContent.includes('132')),
        text: tbl ? tbl.textContent.trim() : ''
      };
    })()`);
    assert.strictEqual(alogUiCheck.ok, true, `Mở rộng dòng log Break 1A phải hiện bảng chi tiết: ${JSON.stringify(alogUiCheck)}`);
    await cdp.eval(`closeActivityLogModal()`);
    pass('Activity Log Detailed Diff + [quay vòng]', 'Bảng chi tiết Trước -> Sau & thẻ [quay vòng] hiển thị chuẩn trong Nhật Ký Hoạt Động');

    assert.strictEqual(runtimeErrors.length, 0, `Phát hiện console/runtime errors: ${runtimeErrors.join(' | ')}`);
    pass('Runtime Hygiene', '0 uncaught exceptions / console errors trong suốt quá trình chạy');

    console.log('\n🎉 TẤT CẢ 9 NHÓM E2E TEST BREAK CHỈ SỐ ĐỀU ĐẠT TRÊN ELECTRON APP!');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err && err.stack ? err.stack : err);
    if (cdp) {
      try {
        const diag = await cdp.eval(`({ month: document.getElementById('month-year-select')?.value, rows: document.querySelectorAll('#rooms-table-body tr').length })`);
        console.error('Renderer diagnostic:', diag);
      } catch { }
    }
    if (runtimeErrors.length > 0) {
      console.error('Runtime console/page errors:', runtimeErrors);
    }
    if (stderrLog) {
      console.error('Electron stderr:\n', stderrLog);
    }
    process.exitCode = 1;
  } finally {
    if (cdp) cdp.close();
    try { child.kill(); } catch { }
    await sleep(400);
    try {
      fs.rmSync(dirs.root, { recursive: true, force: true });
    } catch (e) {
      console.warn('Không xóa hết temp dir:', e.message);
    }
  }
}

runSuite();
