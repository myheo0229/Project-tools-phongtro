/**
 * ============================================================================
 * MODULE TÌM KIẾM NGƯỜI THUÊ THÔNG MINH (VANILLA JS) - src/input/resident-search.js
 * ============================================================================
 * Kiến trúc 2 pha + 2 lớp dấu tiếng Việt (Có dấu NFC > Không dấu):
 *  - Tiền xử lý & cache danh sách đã chuẩn hóa để đạt độ trễ < 2ms khi gõ.
 *  - Pha 1 (Strict Multi-Token AND + Ranked Scoring):
 *    + Ưu tiên tuyệt đối khớp mã phòng (1A..6B), Chủ phòng đứng trước Thành viên.
 *    + Hỗ trợ ngữ nghĩa vai trò/trạng thái: "chủ phòng", "thành viên", "chủ 1A", "chưa xếp".
 *    + Hỗ trợ tìm SĐT/CCCD theo đầu số, 4 số cuối hoặc cụm số >= 3 ký tự (bỏ qua ., -, dấu cách).
 *    + Hỗ trợ tìm ngày sinh / ngày vào ở theo DD/MM/YYYY, DD-MM-YYYY, MM/YYYY, YYYY.
 *    + Khớp có dấu chuẩn luôn được cộng điểm cao hơn chỉ khớp không dấu.
 *  - Pha 2 (Automatic Fuzzy Fallback - Damerau-Levenshtein):
 *    + CHỈ chạy tự động khi Pha 1 trả về 0 kết quả.
 *    + Chỉ áp dụng tìm gần đúng cho từ khóa chữ cái >= 3 ký tự trên Họ tên & Quê quán.
 *    + Tuyệt đối KHÔNG fuzzy mã phòng, SĐT và số CCCD để tránh nhầm lẫn dữ liệu.
 * ============================================================================
 */
(function (rootFactory) {
  const api = rootFactory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    Object.keys(api).forEach(key => {
      window[key] = api[key];
    });
  }
})(function () {
  const DEFAULT_ROOM_CODE_REGEX = /^(?:p\.?|phong)?([1-6][ab])$/i;
  const ROLE_PHRASE_PATTERNS = [
    { source: '(?:^|\\s)chu\\s+phong(?=\\s|$)', toneSource: '(?:^|\\s)chủ\\s+phòng(?=\\s|$)', role: 'chu_phong' },
    { source: '(?:^|\\s)thanh\\s+vien(?=\\s|$)', toneSource: '(?:^|\\s)thành\\s+viên(?=\\s|$)', role: 'thanh_vien' }
  ];
  const UNASSIGNED_PHRASE_PATTERNS = [
    { source: '(?:^|\\s)chua\\s+xep\\s+phong(?=\\s|$)', toneSource: '(?:^|\\s)chưa\\s+xếp\\s+phòng(?=\\s|$)' },
    { source: '(?:^|\\s)chua\\s+co\\s+phong(?=\\s|$)', toneSource: '(?:^|\\s)chưa\\s+có\\s+phòng(?=\\s|$)' },
    { source: '(?:^|\\s)chua\\s+xep(?=\\s|$)', toneSource: '(?:^|\\s)chưa\\s+xếp(?=\\s|$)' },
    { source: '(?:^|\\s)phong\\s+trong(?=\\s|$)', toneSource: '(?:^|\\s)phòng\\s+trống(?=\\s|$)' }
  ];

  // Cache chỉ mục tìm kiếm (vô hiệu tự động khi danh sách hoặc phân bổ phòng thay đổi)
  let cachedResRef = null;
  let cachedRoomsRef = null;
  let cachedResLen = -1;
  let cachedResSig = '';
  let cachedRoomsSig = '';
  let cachedEntries = [];

  /**
   * Escapes ký tự đặc biệt HTML an toàn khi xuất thẻ <mark>
   * @param {any} str
   * @returns {string}
   */
  function escapeSearchHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Chuẩn hóa 1 ký tự NFC về chữ thường không dấu (bảo toàn vị trí 1-1 để highlight không lệch)
   * @param {string} ch
   * @returns {string}
   */
  function normalizeCharVi(ch) {
    if (!ch) return '';
    return String(ch)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase();
  }

  /**
   * Chuẩn hóa giữ nguyên dấu tiếng Việt ở dạng NFC chữ thường
   * @param {any} str
   * @returns {string}
   */
  function normalizeSearchWithTone(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .normalize('NFC')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Chuẩn hóa bỏ dấu tiếng Việt về ASCII chữ thường (dùng riêng cho tìm kiếm, độc lập với module Ngân hàng)
   * @param {any} str
   * @returns {string}
   */
  function normalizeSearchNoTone(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Lấy nhãn vai trò của người thuê trong phòng ("Chủ phòng" / "Thành viên" / "")
   * @param {any} person
   * @param {any[]} [roomsOverride]
   * @returns {string}
   */
  function getResidentRoleLabel(person, roomsOverride) {
    if (!person || !person.phong) return '';
    const sourceRooms = Array.isArray(roomsOverride)
      ? roomsOverride
      : (typeof roomsList !== 'undefined' && Array.isArray(roomsList) ? roomsList : []);
    const room = sourceRooms.find(rm => rm && rm.phong === person.phong);
    if (room && room.chuPhong === person.id) {
      return 'Chủ phòng';
    }
    return 'Thành viên';
  }

  /**
   * Sinh các biến thể ngày tháng phổ biến (DD/MM/YYYY, D/M/YYYY, YYYY-MM-DD, MM/YYYY, YYYY)
   * @param {any} rawDate
   * @returns {string[]}
   */
  function buildDateVariants(rawDate) {
    const raw = normalizeSearchNoTone(rawDate);
    if (!raw) return [];
    const variants = new Set([raw, raw.replace(/-/g, '/')]);

    // Nếu là ISO YYYY-MM-DD -> bổ sung DD/MM/YYYY và D/M/YYYY
    const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(raw);
    if (isoMatch) {
      const yyyy = isoMatch[1];
      const mm = isoMatch[2].padStart(2, '0');
      const dd = isoMatch[3].padStart(2, '0');
      variants.add(`${dd}/${mm}/${yyyy}`);
      variants.add(`${Number(dd)}/${Number(mm)}/${yyyy}`);
    }

    // Nếu là DD/MM/YYYY -> bổ sung D/M/YYYY & DD-MM-YYYY
    const vnMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(raw);
    if (vnMatch) {
      const dd = vnMatch[1].padStart(2, '0');
      const mm = vnMatch[2].padStart(2, '0');
      const yyyy = vnMatch[3];
      variants.add(`${dd}/${mm}/${yyyy}`);
      variants.add(`${Number(dd)}/${Number(mm)}/${yyyy}`);
      variants.add(`${dd}${mm}${yyyy}`);
    }

    return Array.from(variants);
  }

  /**
   * Tính khoảng cách Damerau–Levenshtein (Optimal String Alignment):
   * hỗ trợ thêm, xóa, thay thế và đảo vị trí 2 ký tự kề nhau với chi phí 1.
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  function damerauLevenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    if (a === b) return 0;

    /** @type {number[][]} */
    const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) d[i][0] = i;
    for (let j = 0; j <= n; j++) d[0][j] = j;

    for (let i = 1; i <= m; i++) {
      const ai = a.charCodeAt(i - 1);
      for (let j = 1; j <= n; j++) {
        const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
        let val = Math.min(
          d[i - 1][j] + 1,      // xóa
          d[i][j - 1] + 1,      // thêm
          d[i - 1][j - 1] + cost // thay thế
        );
        if (
          i > 1 &&
          j > 1 &&
          a.charCodeAt(i - 1) === b.charCodeAt(j - 2) &&
          a.charCodeAt(i - 2) === b.charCodeAt(j - 1)
        ) {
          val = Math.min(val, d[i - 2][j - 2] + 1); // đảo 2 ký tự kề nhau
        }
        d[i][j] = val;
      }
    }
    return d[m][n];
  }

  /**
   * Đối chiếu gần đúng 1 từ khóa chữ cái trên mảng các từ đích
   * @param {string} queryWordNoTone
   * @param {string[]} targetWordsOrig
   * @param {string[]} targetWordsNoTone
   * @returns {{ matched: boolean, distance: number, wordIndex: number, matchedWordOrig: string, matchedWordNoTone: string }}
   */
  function getFuzzyWordMatch(queryWordNoTone, targetWordsOrig, targetWordsNoTone) {
    const empty = { matched: false, distance: 99, wordIndex: -1, matchedWordOrig: '', matchedWordNoTone: '' };
    if (!queryWordNoTone || !/^[a-z]+$/.test(queryWordNoTone) || queryWordNoTone.length < 3) {
      return empty;
    }

    const qLen = queryWordNoTone.length;
    const maxDist = qLen >= 7 ? 2 : 1;
    let best = empty;

    for (let i = 0; i < targetWordsNoTone.length; i++) {
      const tWord = targetWordsNoTone[i];
      if (!tWord || tWord.length < 2) continue;
      if (Math.abs(qLen - tWord.length) > maxDist) continue;

      // Yêu cầu ký tự đầu khớp HOẶC 2 ký tự đầu bị gõ đảo chỗ (tránh nối nhiễu các từ ngắn)
      const sameFirst = queryWordNoTone[0] === tWord[0];
      const swappedFirstTwo =
        qLen >= 3 &&
        tWord.length >= 3 &&
        queryWordNoTone[0] === tWord[1] &&
        queryWordNoTone[1] === tWord[0];

      if (!sameFirst && !(qLen >= 4 && swappedFirstTwo)) {
        continue;
      }

      const dist = damerauLevenshtein(queryWordNoTone, tWord);
      if (dist <= maxDist && dist < best.distance) {
        best = {
          matched: true,
          distance: dist,
          wordIndex: i,
          matchedWordOrig: targetWordsOrig[i] || tWord,
          matchedWordNoTone: tWord
        };
      }
    }

    return best;
  }

  /**
   * Tiền xử lý danh sách phòng thành tập hợp mã phòng hợp lệ
   * @param {any[]} roomsArr
   * @returns {Set<string>}
   */
  function buildKnownRoomSet(roomsArr) {
    const set = new Set();
    if (Array.isArray(roomsArr)) {
      roomsArr.forEach(rm => {
        if (rm && rm.phong) {
          set.add(normalizeSearchNoTone(rm.phong));
        }
      });
    }
    return set;
  }

  /**
   * Kiểm tra một token có phải mã phòng hay không (VD: 1A, p1a, p.1a)
   * @param {string} cleanNoToneToken
   * @param {Set<string>} knownRooms
   * @returns {string | null}
   */
  function extractRoomCodeFromToken(cleanNoToneToken, knownRooms) {
    if (!cleanNoToneToken) return null;
    const m = DEFAULT_ROOM_CODE_REGEX.exec(cleanNoToneToken);
    if (m) return m[1].toLowerCase();

    const strippedPrefix = cleanNoToneToken.replace(/^(?:p\.?|phong)/, '');
    if (strippedPrefix && knownRooms && knownRooms.has(strippedPrefix)) {
      return strippedPrefix;
    }
    return null;
  }

  /**
   * Phân tích truy vấn tìm kiếm thành các chỉ thị (phòng/vai trò/chưa xếp) và danh sách token
   * @param {string} rawQuery
   * @param {any[]} [roomsOverride]
   */
  function parseResidentSearchQuery(rawQuery, roomsOverride) {
    const empty = {
      hasQuery: false,
      rawQuery: '',
      withTone: '',
      noTone: '',
      unassignedDirective: false,
      roleDirective: '',
      roomTokens: [],
      tokens: [],
      textTokensForPhrase: []
    };
    if (!rawQuery || typeof rawQuery !== 'string') return empty;

    const trimmedRaw = rawQuery.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!trimmedRaw) return empty;

    const sourceRooms = Array.isArray(roomsOverride)
      ? roomsOverride
      : (typeof roomsList !== 'undefined' && Array.isArray(roomsList) ? roomsList : []);
    const knownRooms = buildKnownRoomSet(sourceRooms);

    let phraseTone = normalizeSearchWithTone(trimmedRaw);
    let phraseNoTone = normalizeSearchNoTone(trimmedRaw);

    let unassignedDirective = false;
    let roleDirective = '';

    // 1. Trích xuất chỉ thị trạng thái "chưa xếp" / "phòng trống" / "trống" (chỉ nhận chữ "trống" có dấu ở dạng đứng riêng để không chặn tên anh "Trọng")
    for (const pat of UNASSIGNED_PHRASE_PATTERNS) {
      const rxNoTone = new RegExp(pat.source, 'g');
      if (rxNoTone.test(phraseNoTone)) {
        unassignedDirective = true;
        phraseNoTone = phraseNoTone.replace(new RegExp(pat.source, 'g'), ' ').replace(/\s+/g, ' ').trim();
        phraseTone = phraseTone.replace(new RegExp(pat.toneSource, 'g'), ' ').replace(/\s+/g, ' ').trim();
      }
    }
    if (/(?:^|\s)trống(?=\s|$)/.test(phraseTone)) {
      unassignedDirective = true;
      phraseTone = phraseTone.replace(/(?:^|\s)trống(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
      phraseNoTone = phraseNoTone.replace(/(?:^|\s)trong(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // 2. Trích xuất chỉ thị vai trò đầy đủ: "chủ phòng", "thành viên"
    for (const rp of ROLE_PHRASE_PATTERNS) {
      if (new RegExp(rp.source).test(phraseNoTone)) {
        roleDirective = rp.role;
        phraseNoTone = phraseNoTone.replace(new RegExp(rp.source, 'g'), ' ').replace(/\s+/g, ' ').trim();
        phraseTone = phraseTone.replace(new RegExp(rp.toneSource, 'g'), ' ').replace(/\s+/g, ' ').trim();
      }
    }

    // 3. Tách các token còn lại theo dấu cách / dấu phẩy / chấm phẩy
    const rawToneParts = phraseTone.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
    const rawNoToneParts = phraseNoTone.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);

    // Gộp cặp ["phong"|"p", "1a"] thành 1 room token duy nhất ("1a"), đồng thời nhận dạng "chủ 1A" -> roleDirective = 'chu_phong'
    const parsedTokens = [];
    const roomTargets = [];

    // Phát hiện trước xem có mã phòng trong dãy token không để xử lý "chủ 1A"
    const preliminaryRoomCodes = rawNoToneParts.map(p => extractRoomCodeFromToken(p, knownRooms));
    const hasAnyRoomToken = preliminaryRoomCodes.some(Boolean);

    for (let i = 0; i < rawNoToneParts.length; i++) {
      const noToneWord = rawNoToneParts[i];
      const withToneWord = rawToneParts[i] || noToneWord;
      const nextNoTone = i + 1 < rawNoToneParts.length ? rawNoToneParts[i + 1] : '';

      // Bỏ chữ "phong" / "p" đứng ngay trước mã phòng hợp lệ (VD: "phong 1a" -> token phòng "1a")
      if ((noToneWord === 'phong' || noToneWord === 'p') && extractRoomCodeFromToken(nextNoTone, knownRooms)) {
        continue;
      }

      // Hỗ trợ viết tắt "chủ 1A" hoặc "1A chủ" khi đã có mã phòng đi kèm
      if (!roleDirective && hasAnyRoomToken && (noToneWord === 'chu' || withToneWord === 'chủ')) {
        roleDirective = 'chu_phong';
        continue;
      }

      const roomCode = extractRoomCodeFromToken(noToneWord, knownRooms);
      if (roomCode) {
        roomTargets.push(roomCode);
        parsedTokens.push({
          raw: withToneWord,
          withTone: roomCode,
          noTone: roomCode,
          digitsOnly: '',
          isPureDigits: false,
          isDateLike: false,
          isRoomCode: true,
          roomTarget: roomCode
        });
        continue;
      }

      const digitsOnly = noToneWord.replace(/[\s.-]/g, '');
      const isPureDigits = /^\d+$/.test(digitsOnly);
      const isDateLike = /^\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?$/.test(noToneWord) || /^\d{1,2}[-/]\d{4}$/.test(noToneWord);

      parsedTokens.push({
        raw: withToneWord,
        withTone: withToneWord,
        noTone: noToneWord,
        digitsOnly,
        isPureDigits,
        isDateLike,
        isRoomCode: false,
        roomTarget: ''
      });
    }

    const textTokensForPhrase = parsedTokens
      .filter(t => !t.isRoomCode && !t.isPureDigits && !t.isDateLike)
      .map(t => ({ withTone: t.withTone, noTone: t.noTone }));

    return {
      hasQuery: Boolean(unassignedDirective || roleDirective || parsedTokens.length > 0),
      rawQuery: trimmedRaw,
      withTone: normalizeSearchWithTone(trimmedRaw),
      noTone: normalizeSearchNoTone(trimmedRaw),
      unassignedDirective,
      roleDirective,
      roomTokens: roomTargets,
      tokens: parsedTokens,
      textTokensForPhrase
    };
  }

  /**
   * Tách chuỗi tìm kiếm thành mảng token chữ thường không dấu (giữ chữ ký tương thích ngược cho highlightSearchText)
   * @param {string} rawQuery
   * @param {any[]} [roomsOverride]
   * @returns {string[] & { _parsed?: any, _highlightExtras?: string[] }}
   */
  function tokenizeSearchQuery(rawQuery, roomsOverride) {
    const parsed = parseResidentSearchQuery(rawQuery, roomsOverride);
    /** @type {string[] & { _parsed?: any, _highlightExtras?: string[] }} */
    const list = [];

    if (parsed.unassignedDirective) list.push('chua', 'xep');
    if (parsed.roleDirective === 'chu_phong') list.push('chu', 'phong');
    if (parsed.roleDirective === 'thanh_vien') list.push('thanh', 'vien');

    parsed.tokens.forEach(t => {
      if (t.isRoomCode && t.roomTarget) {
        list.push(t.roomTarget);
      } else if (t.noTone) {
        list.push(t.noTone);
      }
    });

    list._parsed = parsed;
    return list;
  }

  /**
   * Xây dựng bản ghi chỉ mục tìm kiếm cho 1 người thuê
   * @param {any} r
   * @param {any[]} roomsArr
   * @param {number} idx
   */
  function buildResidentSearchEntry(r, roomsArr, idx) {
    const hoTenRaw = String(r.hoTen || '').normalize('NFC').replace(/\s+/g, ' ').trim();
    const nameWithTone = normalizeSearchWithTone(hoTenRaw);
    const nameNoTone = normalizeSearchNoTone(hoTenRaw);

    const wordsOrig = hoTenRaw ? hoTenRaw.split(/\s+/).filter(Boolean) : [];
    const wordsWithTone = nameWithTone ? nameWithTone.split(/\s+/).filter(Boolean) : [];
    const wordsNoTone = nameNoTone ? nameNoTone.split(/\s+/).filter(Boolean) : [];
    const givenWithTone = wordsWithTone.length > 0 ? wordsWithTone[wordsWithTone.length - 1] : '';
    const givenNoTone = wordsNoTone.length > 0 ? wordsNoTone[wordsNoTone.length - 1] : '';
    const initials = wordsNoTone.map(w => w[0]).join('');

    const phongRaw = String(r.phong || '').trim();
    const phongLower = normalizeSearchNoTone(phongRaw);
    const isUnassigned = !phongLower;

    const roleLabel = getResidentRoleLabel(r, roomsArr);
    const roleNoTone = normalizeSearchNoTone(roleLabel);
    const isHost = roleLabel === 'Chủ phòng';

    const sdtGoiDigits = String(r.sdtGoi || '').replace(/[\s.-]/g, '').toLowerCase();
    const sdtZaloDigits = String(r.sdtZalo || '').replace(/[\s.-]/g, '').toLowerCase();
    const cccdDigits = String(r.cccd || '').replace(/\s+/g, '').toLowerCase();

    const dobVariants = buildDateVariants(r.ngaySinh || '');
    const moveInVariants = buildDateVariants(r.ngayVaoO || '');

    const genderWithTone = normalizeSearchWithTone(r.gioiTinh || '');
    const genderNoTone = normalizeSearchNoTone(r.gioiTinh || '');

    const originRaw = String(r.queQuan || '').normalize('NFC').replace(/\s+/g, ' ').trim();
    const originWithTone = normalizeSearchWithTone(originRaw);
    const originNoTone = normalizeSearchNoTone(originRaw);
    const originWordsOrig = originRaw ? originRaw.split(/[\s,.-]+/).filter(Boolean) : [];
    const originWordsNoTone = originNoTone ? originNoTone.split(/[\s,.-]+/).filter(Boolean) : [];

    const emailRaw = String(r.email || '').trim();
    const emailLower = emailRaw.toLowerCase();

    return {
      resident: r,
      idx,
      hoTenRaw,
      nameWithTone,
      nameNoTone,
      wordsOrig,
      wordsWithTone,
      wordsNoTone,
      givenWithTone,
      givenNoTone,
      initials,
      phongRaw,
      phongLower,
      isUnassigned,
      roleLabel,
      roleNoTone,
      isHost,
      sdtGoiDigits,
      sdtZaloDigits,
      cccdDigits,
      dobVariants,
      moveInVariants,
      genderWithTone,
      genderNoTone,
      originRaw,
      originWithTone,
      originNoTone,
      originWordsOrig,
      originWordsNoTone,
      emailRaw,
      emailLower
    };
  }

  /**
   * Lấy danh sách chỉ mục tìm kiếm (dùng cache tự làm mới khi residents/rooms thay đổi)
   * @param {any[]} residentsArr
   * @param {any[]} roomsArr
   */
  function getIndexedResidents(residentsArr, roomsArr) {
    const resArr = Array.isArray(residentsArr) ? residentsArr : [];
    const rmArr = Array.isArray(roomsArr) ? roomsArr : [];

    const resSig = resArr
      .map(r => `${r.id || ''}:${r.hoTen || ''}:${r.phong || ''}:${r.sdtGoi || ''}:${r.sdtZalo || ''}:${r.cccd || ''}`)
      .join('|');
    const roomsSig = rmArr
      .map(rm => `${rm.phong || ''}:${rm.chuPhong || ''}:${Array.isArray(rm.thanhVien) ? rm.thanhVien.join(',') : ''}`)
      .join('|');

    if (
      cachedResRef === resArr &&
      cachedRoomsRef === rmArr &&
      cachedResLen === resArr.length &&
      cachedResSig === resSig &&
      cachedRoomsSig === roomsSig
    ) {
      return cachedEntries;
    }

    cachedEntries = resArr.map((r, idx) => buildResidentSearchEntry(r, rmArr, idx));
    cachedResRef = resArr;
    cachedRoomsRef = rmArr;
    cachedResLen = resArr.length;
    cachedResSig = resSig;
    cachedRoomsSig = roomsSig;
    return cachedEntries;
  }

  /**
   * Xóa cache chỉ mục khi cần ép tái lập chỉ mục
   */
  function invalidateResidentSearchCache() {
    cachedResRef = null;
    cachedRoomsRef = null;
    cachedResLen = -1;
    cachedResSig = '';
    cachedRoomsSig = '';
    cachedEntries = [];
  }

  /**
   * Đánh giá 1 token đơn lẻ trên 1 hồ sơ ở chế độ Pha 1 (Strict Match)
   * @param {any} entry
   * @param {any} token
   * @returns {{ score: number, matchedOrigin: boolean, matchedEmail: boolean, matchedRole: boolean }}
   */
  function scoreStrictTokenOnEntry(entry, token) {
    let tokenScore = 0;
    let matchedOrigin = false;
    let matchedEmail = false;
    let matchedRole = false;

    // 1. Mã phòng (1A..6B): khớp tuyệt đối mã phòng và không rò sang field khác nếu đứng như mã phòng
    if (token.isRoomCode) {
      if (entry.phongLower === token.roomTarget) {
        return {
          score: 2000 + (entry.isHost ? 80 : 0),
          matchedOrigin: false,
          matchedEmail: false,
          matchedRole: false
        };
      }
      return { score: 0, matchedOrigin: false, matchedEmail: false, matchedRole: false };
    }

    const qTone = token.withTone;
    const qNoTone = token.noTone;
    const digits = token.digitsOnly;

    // 2. Họ và tên (Khớp có dấu luôn cao điểm hơn không dấu; ưu tiên tên gọi -> đầu từ -> cụm)
    if (entry.givenWithTone && entry.givenWithTone === qTone) {
      tokenScore = Math.max(tokenScore, 280);
    } else if (entry.givenNoTone && entry.givenNoTone === qNoTone) {
      tokenScore = Math.max(tokenScore, 220);
    } else if (entry.givenWithTone && entry.givenWithTone.startsWith(qTone)) {
      tokenScore = Math.max(tokenScore, 190);
    } else if (entry.givenNoTone && entry.givenNoTone.startsWith(qNoTone)) {
      tokenScore = Math.max(tokenScore, 150);
    } else if (entry.wordsWithTone.includes(qTone)) {
      tokenScore = Math.max(tokenScore, 175);
    } else if (entry.wordsNoTone.includes(qNoTone)) {
      tokenScore = Math.max(tokenScore, 140);
    } else if (entry.wordsWithTone.some(w => w.startsWith(qTone))) {
      tokenScore = Math.max(tokenScore, 130);
    } else if (entry.wordsNoTone.some(w => w.startsWith(qNoTone))) {
      tokenScore = Math.max(tokenScore, 105);
    } else if (qNoTone.length >= 2 && entry.initials && entry.initials.startsWith(qNoTone)) {
      tokenScore = Math.max(tokenScore, 95);
    } else if (qNoTone.length >= 3 && entry.nameWithTone && entry.nameWithTone.includes(qTone)) {
      tokenScore = Math.max(tokenScore, 85);
    } else if (qNoTone.length >= 3 && entry.nameNoTone && entry.nameNoTone.includes(qNoTone)) {
      tokenScore = Math.max(tokenScore, 65);
    }

    // 3. Phòng (nếu người dùng gõ tự do kiểu "p2", "phong", "b"...)
    if (!token.isPureDigits && qNoTone.length >= 2 && entry.phongLower && entry.phongLower === qNoTone) {
      tokenScore = Math.max(tokenScore, 1900 + (entry.isHost ? 80 : 0));
    } else if (qNoTone.length >= 2 && entry.isUnassigned && (qNoTone === 'chua' || qNoTone === 'xep')) {
      tokenScore = Math.max(tokenScore, 70);
    }

    // 4. SĐT Gọi / Zalo & Số CCCD (khi từ khóa là chuỗi số hoặc có dấu ngăn cách số)
    if (digits && (token.isPureDigits || digits.length >= 3)) {
      const phones = [entry.sdtGoiDigits, entry.sdtZaloDigits].filter(Boolean);
      for (const p of phones) {
        if (p === digits) {
          tokenScore = Math.max(tokenScore, 320);
        } else if (digits.length >= 3 && p.endsWith(digits)) {
          tokenScore = Math.max(tokenScore, 240);
        } else if (digits.length >= 2 && p.startsWith(digits)) {
          tokenScore = Math.max(tokenScore, 200);
        } else if (digits.length >= 3 && p.includes(digits)) {
          tokenScore = Math.max(tokenScore, 130);
        }
      }

      if (entry.cccdDigits) {
        if (entry.cccdDigits === digits) {
          tokenScore = Math.max(tokenScore, 320);
        } else if (digits.length >= 3 && entry.cccdDigits.endsWith(digits)) {
          tokenScore = Math.max(tokenScore, 230);
        } else if (digits.length >= 3 && entry.cccdDigits.startsWith(digits)) {
          tokenScore = Math.max(tokenScore, 195);
        } else if (digits.length >= 3 && entry.cccdDigits.includes(digits)) {
          tokenScore = Math.max(tokenScore, 125);
        }
      }
    }

    // 5. Ngày sinh & Ngày vào ở (hỗ trợ DD/MM/YYYY, DD-MM-YYYY, MM/YYYY, YYYY)
    const normDateQuery = qNoTone.replace(/-/g, '/');
    const canMatchDate = (token.isDateLike && normDateQuery.length >= 3) || (/^\d{4}$/.test(normDateQuery));
    if (canMatchDate) {
      if (entry.dobVariants.some(v => v.includes(normDateQuery))) {
        tokenScore = Math.max(tokenScore, 120);
      }
      if (entry.moveInVariants.some(v => v.includes(normDateQuery))) {
        tokenScore = Math.max(tokenScore, 110);
      }
    }

    // 6. Giới tính ("nam", "nữ", "nu")
    if (entry.genderWithTone && entry.genderWithTone === qTone) {
      tokenScore = Math.max(tokenScore, 110);
    } else if (entry.genderNoTone && entry.genderNoTone === qNoTone) {
      tokenScore = Math.max(tokenScore, 95);
    }

    // 7. Quê quán
    if (entry.originNoTone) {
      if (entry.originWithTone && (entry.originWithTone === qTone || (qNoTone.length >= 2 && entry.originWordsNoTone.some(w => w === qNoTone || w.startsWith(qNoTone))))) {
        const originToneExact = entry.originWithTone.split(/[\s,.-]+/).some(w => w === qTone);
        tokenScore = Math.max(tokenScore, originToneExact ? 105 : 85);
        matchedOrigin = true;
      } else if (qNoTone.length >= 3 && entry.originNoTone.includes(qNoTone)) {
        tokenScore = Math.max(tokenScore, 70);
        matchedOrigin = true;
      }
    }

    // 8. Email
    if (entry.emailLower && (token.raw.includes('@') || qNoTone.length >= 3) && entry.emailLower.includes(qNoTone)) {
      tokenScore = Math.max(tokenScore, 75);
      matchedEmail = true;
    }

    // 9. Vai trò (khi gõ đơn lẻ từ >= 3 ký tự như "chủ", "thanh", "vien")
    if (entry.roleNoTone && qNoTone.length >= 3 && entry.roleNoTone.includes(qNoTone)) {
      tokenScore = Math.max(tokenScore, 70);
      matchedRole = true;
    }

    return { score: tokenScore, matchedOrigin, matchedEmail, matchedRole };
  }

  /**
   * Lọc, xếp hạng (2 pha: Strict trước, Fuzzy Damerau–Levenshtein khi Strict = 0)
   * @param {string} rawQuery
   * @param {any[]} [residentsOverride]
   * @param {any[]} [roomsOverride]
   * @returns {Array<{ resident: any, score: number, idx: number, matchedExtra: Array<{label: string, value: string}>, isFuzzy?: boolean, fuzzyWords?: string[] }> & { isFuzzyFallback?: boolean }}
   */
  function getFilteredAndRankedResidents(rawQuery, residentsOverride, roomsOverride) {
    const sourceResidents = Array.isArray(residentsOverride)
      ? residentsOverride
      : (typeof residentsList !== 'undefined' && Array.isArray(residentsList) ? residentsList : []);
    const sourceRooms = Array.isArray(roomsOverride)
      ? roomsOverride
      : (typeof roomsList !== 'undefined' && Array.isArray(roomsList) ? roomsList : []);

    const parsed = parseResidentSearchQuery(rawQuery, sourceRooms);
    const entries = getIndexedResidents(sourceResidents, sourceRooms);

    if (!parsed.hasQuery) {
      /** @type {any} */
      const all = entries.map(e => ({
        resident: e.resident,
        score: 0,
        idx: e.idx,
        matchedExtra: [],
        isFuzzy: false,
        fuzzyWords: []
      }));
      all.isFuzzyFallback = false;
      return all;
    }

    const fullNameTone = parsed.textTokensForPhrase.map(t => t.withTone).join(' ');
    const fullNameNoTone = parsed.textTokensForPhrase.map(t => t.noTone).join(' ');

    /**
     * Đánh giá chung cho cả Pha 1 (allowFuzzy = false) và Pha 2 (allowFuzzy = true)
     * @param {boolean} allowFuzzy
     */
    function evaluateAllEntries(allowFuzzy) {
      const matchedList = [];

      for (const entry of entries) {
        if (parsed.unassignedDirective && !entry.isUnassigned) continue;
        if (parsed.roleDirective) {
          const targetRole = parsed.roleDirective === 'chu_phong' ? 'chu phong' : 'thanh vien';
          if (entry.roleNoTone !== targetRole) continue;
        }

        let totalScore = 0;
        if (parsed.unassignedDirective) totalScore += 400;
        if (parsed.roleDirective) totalScore += 350;

        // Thưởng điểm cụm họ tên đầy đủ (Có dấu > Không dấu)
        if (fullNameNoTone && !allowFuzzy) {
          if (entry.nameWithTone === fullNameTone) {
            totalScore += 500;
          } else if (entry.nameNoTone === fullNameNoTone) {
            totalScore += 380;
          } else if (entry.nameWithTone.includes(fullNameTone)) {
            totalScore += 240;
          } else if (entry.nameNoTone.includes(fullNameNoTone)) {
            totalScore += 170;
          }
        }

        let allTokensOk = true;
        let matchedOrigin = false;
        let matchedEmail = false;
        let matchedRole = parsed.roleDirective !== '';
        let usedFuzzyOnEntry = false;
        const fuzzyMatchedWords = [];

        for (const token of parsed.tokens) {
          const strictRes = scoreStrictTokenOnEntry(entry, token);
          if (strictRes.score > 0) {
            totalScore += strictRes.score;
            if (strictRes.matchedOrigin) matchedOrigin = true;
            if (strictRes.matchedEmail) matchedEmail = true;
            if (strictRes.matchedRole) matchedRole = true;
            continue;
          }

          // Chỉ bật Fuzzy cho token chữ cái >= 3 ký tự ở Pha 2 (KHÔNG fuzzy mã phòng / số ĐT / CCCD / ngày)
          const canFuzzyToken =
            allowFuzzy &&
            !token.isRoomCode &&
            !token.isPureDigits &&
            !token.isDateLike &&
            /^[a-z]+$/.test(token.noTone) &&
            token.noTone.length >= 3;

          if (!canFuzzyToken) {
            allTokensOk = false;
            break;
          }

          const nameFuzzy = getFuzzyWordMatch(token.noTone, entry.wordsOrig, entry.wordsNoTone);
          const originFuzzy = getFuzzyWordMatch(token.noTone, entry.originWordsOrig, entry.originWordsNoTone);

          let fuzzyScore = 0;
          let pickedWord = '';

          if (nameFuzzy.matched) {
            const isGivenWord = nameFuzzy.wordIndex === entry.wordsNoTone.length - 1;
            fuzzyScore = (isGivenWord ? 135 : 105) - nameFuzzy.distance * 35;
            pickedWord = nameFuzzy.matchedWordNoTone;
          }
          if (originFuzzy.matched) {
            const originScore = 80 - originFuzzy.distance * 25;
            if (originScore > fuzzyScore) {
              fuzzyScore = originScore;
              pickedWord = originFuzzy.matchedWordNoTone;
            }
            matchedOrigin = true;
          }

          if (fuzzyScore <= 0) {
            allTokensOk = false;
            break;
          }

          usedFuzzyOnEntry = true;
          if (pickedWord) fuzzyMatchedWords.push(pickedWord);
          totalScore += fuzzyScore;
        }

        if (!allTokensOk) continue;

        const matchedExtra = [];
        if (matchedRole && entry.roleLabel) {
          matchedExtra.push({ label: 'Vai trò', value: entry.roleLabel });
        }
        if (matchedOrigin && entry.originRaw) {
          matchedExtra.push({ label: 'Quê quán', value: entry.originRaw });
        }
        if (matchedEmail && entry.emailRaw) {
          matchedExtra.push({ label: 'Email', value: entry.emailRaw });
        }

        matchedList.push({
          resident: entry.resident,
          score: totalScore,
          idx: entry.idx,
          matchedExtra,
          isFuzzy: usedFuzzyOnEntry,
          fuzzyWords: fuzzyMatchedWords
        });
      }

      matchedList.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.idx - b.idx;
      });
      return matchedList;
    }

    // Pha 1: Khớp chuẩn
    /** @type {any} */
    const strictResults = evaluateAllEntries(false);
    if (strictResults.length > 0) {
      strictResults.isFuzzyFallback = false;
      return strictResults;
    }

    // Pha 2: Tự động nới sang Fuzzy khi Pha 1 = 0 kết quả
    const hasFuzzyEligibleToken = parsed.tokens.some(
      t => !t.isRoomCode && !t.isPureDigits && !t.isDateLike && /^[a-z]+$/.test(t.noTone) && t.noTone.length >= 3
    );
    if (!hasFuzzyEligibleToken) {
      strictResults.isFuzzyFallback = false;
      return strictResults;
    }

    /** @type {any} */
    const fuzzyResults = evaluateAllEntries(true);
    fuzzyResults.isFuzzyFallback = fuzzyResults.length > 0;
    return fuzzyResults;
  }

  /**
   * Tô sáng (highlight <mark class="search-hl">) các đoạn khớp từ khóa (bao gồm cả từ khớp gần đúng ở Pha 2)
   * @param {any} rawText
   * @param {string[]} tokens
   * @param {string[]} [extraFuzzyWords]
   * @returns {string}
   */
  function highlightSearchText(rawText, tokens, extraFuzzyWords) {
    if (rawText === undefined || rawText === null) return '';
    const str = String(rawText).normalize('NFC');
    if (!str) return '';

    const combinedTokens = [];
    if (Array.isArray(tokens)) {
      tokens.forEach(t => {
        if (t) combinedTokens.push(String(t));
      });
    }
    if (Array.isArray(extraFuzzyWords)) {
      extraFuzzyWords.forEach(w => {
        if (w) combinedTokens.push(String(w));
      });
    }

    if (combinedTokens.length === 0) {
      return escapeSearchHtml(str);
    }

    let normStr = '';
    let compactDigits = '';
    /** @type {number[]} */
    const compactDigitOrigIndices = [];
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      normStr += normalizeCharVi(ch);
      if (ch >= '0' && ch <= '9') {
        compactDigits += ch;
        compactDigitOrigIndices.push(i);
      }
    }

    const matchedMask = new Array(str.length).fill(false);
    let anyMatch = false;

    combinedTokens.forEach(rawToken => {
      const token = normalizeSearchNoTone(rawToken);
      if (!token) return;

      // 1. Khớp trực tiếp theo chuỗi đã bỏ dấu (bảo toàn vị trí ký tự)
      let startIndex = 0;
      while (startIndex < normStr.length) {
        const idx = normStr.indexOf(token, startIndex);
        if (idx === -1) break;
        for (let k = idx; k < idx + token.length && k < str.length; k++) {
          matchedMask[k] = true;
        }
        anyMatch = true;
        startIndex = idx + 1;
      }

      // 2. Hỗ trợ tô sáng SĐT/CCCD khi dữ liệu có dấu chấm/gạch/cách (VD: 0982.141.407 <-> 0982141407)
      const digitToken = token.replace(/[\s.-]/g, '');
      if (/^\d{3,}$/.test(digitToken) && compactDigits.length >= digitToken.length) {
        let dStart = 0;
        while (dStart < compactDigits.length) {
          const dIdx = compactDigits.indexOf(digitToken, dStart);
          if (dIdx === -1) break;
          for (let d = dIdx; d < dIdx + digitToken.length; d++) {
            matchedMask[compactDigitOrigIndices[d]] = true;
          }
          anyMatch = true;
          dStart = dIdx + 1;
        }
      }

      // 3. Hỗ trợ tô sáng ngày khi gõ dd-mm-yyyy trên dữ liệu dd/mm/yyyy
      const slashDate = token.replace(/-/g, '/');
      if (slashDate !== token && /^\d{1,2}\/\d{1,4}/.test(slashDate)) {
        let sIdx = 0;
        while (sIdx < normStr.length) {
          const hit = normStr.indexOf(slashDate, sIdx);
          if (hit === -1) break;
          for (let k = hit; k < hit + slashDate.length && k < str.length; k++) {
            matchedMask[k] = true;
          }
          anyMatch = true;
          sIdx = hit + 1;
        }
      }
    });

    if (!anyMatch) {
      return escapeSearchHtml(str);
    }

    let html = '';
    let i = 0;
    while (i < str.length) {
      const isHit = matchedMask[i];
      let j = i + 1;
      while (j < str.length && matchedMask[j] === isHit) {
        j++;
      }
      const segment = escapeSearchHtml(str.slice(i, j));
      html += isHit ? `<mark class="search-hl">${segment}</mark>` : segment;
      i = j;
    }
    return html;
  }

  return {
    normalizeCharVi,
    normalizeSearchWithTone,
    normalizeSearchNoTone,
    damerauLevenshtein,
    getFuzzyWordMatch,
    getResidentRoleLabel,
    parseResidentSearchQuery,
    tokenizeSearchQuery,
    buildResidentSearchEntry,
    getIndexedResidents,
    invalidateResidentSearchCache,
    getFilteredAndRankedResidents,
    highlightSearchText
  };
});
