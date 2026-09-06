/**
 * ============================================================
 * DATE-PICKER.JS - REUSABLE DATE INPUT & POPUP CALENDAR
 * Masked input: dd/mm/yyyy with auto-jump, arrow navigation,
 * and popup calendar with month/year selects (100+ years).
 * Matching date-input-picker-template.html exact behavior
 * ============================================================
 */

class DateMaskInput {
  constructor(input) {
    this.input = input;
    this.digits = [null, null, null, null, null, null, null, null]; // d d m m y y y y
    this.slotForCharIndex = [0, 1, null, 2, 3, null, 4, 5, 6, 7];
    this.charIndexForSlot = [0, 1, 3, 4, 6, 7, 8, 9];
    this.activeSlot = 0;
    this.onChange = null;
    this.input._dateMaskInput = this;
    this.render();
    this.bind();
  }

  placeholderChar(slot) {
    return slot < 2 ? 'd' : (slot < 4 ? 'm' : 'y');
  }

  render() {
    const d = this.digits;
    const c = i => (d[i] !== null ? d[i] : this.placeholderChar(i));
    this.input.value = `${c(0)}${c(1)}/${c(2)}${c(3)}/${c(4)}${c(5)}${c(6)}${c(7)}`;
    this.input.classList.toggle('filled', d.some(x => x !== null));
    if (this.onChange) this.onChange(this.getDate(), this.getValue());
  }

  setCursor(i) {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => this.input.setSelectionRange(i, i));
    } else {
      setTimeout(() => this.input.setSelectionRange(i, i), 0);
    }
  }

  focusSlot(slot) {
    this.activeSlot = Math.max(0, Math.min(7, slot));
    this.setCursor(this.charIndexForSlot[this.activeSlot]);
  }

  bind() {
    this.input.addEventListener('beforeinput', e => {
      // Chặn ký tự không phải số
      if (e.data && !/^\d+$/.test(e.data)) {
        e.preventDefault();
      }
    });

    this.input.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        this.digits[this.activeSlot] = e.key;
        const wasLast = this.activeSlot === 7;
        this.render();
        if (!wasLast) {
          this.activeSlot++;
          this.setCursor(this.charIndexForSlot[this.activeSlot]);
        } else {
          this.setCursor(10);
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        if (this.digits[this.activeSlot] !== null) {
          this.digits[this.activeSlot] = null;
        } else if (this.activeSlot > 0) {
          this.activeSlot--;
          this.digits[this.activeSlot] = null;
        }
        this.render();
        this.setCursor(this.charIndexForSlot[this.activeSlot]);
      } else if (e.key === 'Delete') {
        e.preventDefault();
        this.digits[this.activeSlot] = null;
        this.render();
        this.setCursor(this.charIndexForSlot[this.activeSlot]);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.focusSlot(this.activeSlot - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.focusSlot(this.activeSlot + 1);
      } else if (e.key === 'Tab') {
        // Cho phép tab điều hướng bình thường
      } else if (e.key.length === 1) {
        // Chặn hoàn toàn phím chữ và ký tự đặc biệt, không làm mất số đã gõ
        e.preventDefault();
      }
    });

    this.input.addEventListener('click', () => {
      const pos = this.input.selectionStart ?? 0;
      let slot = this.slotForCharIndex[Math.min(pos, 9)];
      if (slot === null || slot === undefined) {
        for (let i = Math.min(pos, 9); i >= 0; i--) {
          if (this.slotForCharIndex[i] !== null) {
            slot = this.slotForCharIndex[i];
            break;
          }
        }
        slot = slot ?? 0;
      }
      this.focusSlot(slot);
    });

    this.input.addEventListener('focus', () => {
      if (this.activeSlot === 0) this.setCursor(this.charIndexForSlot[0]);
    });

    this.input.addEventListener('paste', e => {
      e.preventDefault();
      const pasteText = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      const cleanDigits = pasteText.replace(/\D/g, '');
      if (cleanDigits.length === 8) {
        const d = cleanDigits.slice(0, 2);
        const m = cleanDigits.slice(2, 4);
        const y = cleanDigits.slice(4, 8);
        this.setDate(d, m, y);
      }
    });
  }

  setDate(day, month, year) {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (isNaN(d) || isNaN(m) || isNaN(y)) {
      this.clear();
      return;
    }
    this.digits = [
      String(Math.floor(d / 10)),
      String(d % 10),
      String(Math.floor(m / 10)),
      String(m % 10),
      ...String(y).padStart(4, '0').split('')
    ];
    this.activeSlot = 7;
    this.render();
  }

  clear() {
    this.digits = [null, null, null, null, null, null, null, null];
    this.activeSlot = 0;
    this.render();
  }

  getDate() {
    if (this.digits.some(d => d === null)) return null;
    return {
      day: parseInt(this.digits[0] + this.digits[1], 10),
      month: parseInt(this.digits[2] + this.digits[3], 10),
      year: parseInt(this.digits.slice(4).join(''), 10)
    };
  }

  getValue() {
    if (this.isEmpty()) return '';
    const d = this.getDate();
    if (!d) return '';
    return `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}/${d.year}`;
  }

  isComplete() {
    return this.digits.every(d => d !== null);
  }

  isEmpty() {
    return this.digits.every(d => d === null);
  }

  isValidDate() {
    if (this.isEmpty()) return true;
    if (!this.isComplete()) return false;
    const d = this.getDate();
    if (!d) return false;
    if (d.month < 1 || d.month > 12) return false;
    if (d.year < 1900 || d.year > 2150) return false;
    const dObj = new Date(d.year, d.month - 1, d.day);
    return (
      dObj.getFullYear() === d.year &&
      dObj.getMonth() === d.month - 1 &&
      dObj.getDate() === d.day
    );
  }
}

class DatePicker {
  constructor(wrapElement, options = {}) {
    if (typeof wrapElement === 'string') {
      wrapElement = document.querySelector(wrapElement);
    }
    if (!wrapElement) return;

    this.wrap = wrapElement;
    this.wrap._datePicker = this;
    this.options = Object.assign({
      yearsBack: 100,
      yearsForward: 10,
      placeholder: 'dd/mm/yyyy',
      onChange: null
    }, options);

    this.input = this.wrap.querySelector('input');
    if (!this.input) return;

    this.today = new Date();
    this.viewMonth = this.today.getMonth();
    this.viewYear = this.today.getFullYear();
    this.selected = null;
    this.changeCallbacks = [];
    if (typeof this.options.onChange === 'function') {
      this.changeCallbacks.push(this.options.onChange);
    }

    this.buildUI();

    // Khởi tạo mask input
    this.mask = new DateMaskInput(this.input);
    this.mask.onChange = (dateObj) => {
      if (dateObj && this.mask.isValidDate()) {
        this.selected = dateObj;
        this.viewMonth = dateObj.month - 1;
        this.viewYear = dateObj.year;
      } else if (this.mask.isEmpty()) {
        this.selected = null;
      }
      this.renderCalendar();
      this.notifyChange();
    };

    this.bindEvents();
    this.renderCalendar();
  }

  buildUI() {
    let toggleBtn = this.wrap.querySelector('.calendar-toggle, #calToggle');
    if (!toggleBtn) {
      toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'calendar-toggle';
      toggleBtn.setAttribute('aria-label', 'Chọn ngày');
      toggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="16" rx="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M8 3v4M16 3v4M3.5 10h17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      `;
      this.wrap.appendChild(toggleBtn);
    }
    this.toggleBtn = toggleBtn;

    let popup = this.wrap.querySelector('.calendar-popup, #calPopup');
    if (!popup) {
      popup = document.createElement('div');
      popup.className = 'calendar-popup';
      popup.innerHTML = `
        <div class="cal-head">
          <button type="button" class="cal-nav cal-prev-btn" aria-label="Tháng trước">
            <svg viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="cal-selects">
            <select class="cal-month-select"></select>
            <select class="cal-year-select"></select>
          </div>
          <button type="button" class="cal-nav cal-next-btn" aria-label="Tháng sau">
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="cal-weekdays">
          <span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span>
        </div>
        <div class="cal-days"></div>
        <div class="cal-foot">
          <button type="button" class="cal-link cal-today-btn">Hôm nay</button>
          <button type="button" class="cal-link muted cal-clear-btn">Xóa</button>
        </div>
      `;
      this.wrap.appendChild(popup);
    }
    this.popup = popup;

    this.prevBtn = popup.querySelector('.cal-prev-btn, #prevMonth');
    this.nextBtn = popup.querySelector('.cal-next-btn, #nextMonth');
    this.monthSelect = popup.querySelector('.cal-month-select, #monthSelect');
    this.yearSelect = popup.querySelector('.cal-year-select, #yearSelect');
    this.calDays = popup.querySelector('.cal-days, #calDays');
    this.todayBtn = popup.querySelector('.cal-today-btn, #todayBtn');
    this.clearBtn = popup.querySelector('.cal-clear-btn, #clearBtn');

    // Nạp danh sách tháng
    const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
    if (this.monthSelect) {
      this.monthSelect.innerHTML = '';
      monthNames.forEach((m, i) => {
        const o = document.createElement('option');
        o.value = i;
        o.textContent = m;
        this.monthSelect.appendChild(o);
      });
    }

    // Nạp danh sách năm (100 năm về trước, 10 năm về sau)
    const yStart = this.today.getFullYear() - this.options.yearsBack;
    const yEnd = this.today.getFullYear() + this.options.yearsForward;
    if (this.yearSelect) {
      this.yearSelect.innerHTML = '';
      for (let y = yEnd; y >= yStart; y--) {
        const o = document.createElement('option');
        o.value = y;
        o.textContent = y;
        this.yearSelect.appendChild(o);
      }
    }
  }

  bindEvents() {
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.popup.classList.contains('open') ? this.close() : this.open();
      });
    }

    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.viewMonth--;
        if (this.viewMonth < 0) {
          this.viewMonth = 11;
          this.viewYear--;
        }
        this.renderCalendar();
      });
    }

    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.viewMonth++;
        if (this.viewMonth > 11) {
          this.viewMonth = 0;
          this.viewYear++;
        }
        this.renderCalendar();
      });
    }

    if (this.monthSelect) {
      this.monthSelect.addEventListener('change', e => {
        e.stopPropagation();
        this.viewMonth = parseInt(this.monthSelect.value, 10);
        this.renderCalendar();
      });
    }

    if (this.yearSelect) {
      this.yearSelect.addEventListener('change', e => {
        e.stopPropagation();
        this.viewYear = parseInt(this.yearSelect.value, 10);
        this.renderCalendar();
      });
    }

    if (this.todayBtn) {
      this.todayBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.setToday();
        this.close();
      });
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.clear();
        this.close();
      });
    }

    document.addEventListener('click', e => {
      if (this.popup && !this.popup.contains(e.target) && this.toggleBtn && !this.toggleBtn.contains(e.target)) {
        this.close();
      }
    });
  }

  renderCalendar() {
    if (!this.monthSelect || !this.yearSelect || !this.calDays) return;

    this.monthSelect.value = this.viewMonth;
    this.yearSelect.value = this.viewYear;
    this.calDays.innerHTML = '';

    const firstDay = new Date(this.viewYear, this.viewMonth, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Thứ 2 = 0
    const daysInMonth = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(this.viewYear, this.viewMonth, 0).getDate();

    for (let i = 0; i < startOffset; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day muted';
      btn.textContent = daysInPrevMonth - startOffset + i + 1;
      btn.disabled = true;
      this.calDays.appendChild(btn);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day';
      btn.textContent = d;
      const isToday = d === this.today.getDate() && this.viewMonth === this.today.getMonth() && this.viewYear === this.today.getFullYear();
      const isSelected = this.selected && this.selected.day === d && this.selected.month === this.viewMonth + 1 && this.selected.year === this.viewYear;
      if (isToday) btn.classList.add('today');
      if (isSelected) btn.classList.add('selected');

      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.selected = {
          day: d,
          month: this.viewMonth + 1,
          year: this.viewYear
        };
        if (this.mask) this.mask.setDate(d, this.viewMonth + 1, this.viewYear);
        this.renderCalendar();
        this.close();
      });

      this.calDays.appendChild(btn);
    }

    const totalCells = startOffset + daysInMonth;
    const trailing = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= trailing; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day muted';
      btn.textContent = i;
      btn.disabled = true;
      this.calDays.appendChild(btn);
    }
  }

  setToday() {
    const t = new Date();
    this.viewMonth = t.getMonth();
    this.viewYear = t.getFullYear();
    this.selected = {
      day: t.getDate(),
      month: t.getMonth() + 1,
      year: t.getFullYear()
    };
    if (this.mask) this.mask.setDate(this.selected.day, this.selected.month, this.selected.year);
    this.renderCalendar();
    this.notifyChange();
  }

  open() {
    document.querySelectorAll('.calendar-popup.open').forEach(p => {
      if (p !== this.popup) p.classList.remove('open');
    });
    if (this.popup) this.popup.classList.add('open');
    this.renderCalendar();
  }

  close() {
    if (this.popup) this.popup.classList.remove('open');
  }

  getValue() {
    return this.mask ? this.mask.getValue() : (this.input ? this.input.value : '');
  }

  setValue(val) {
    if (!val) {
      this.clear();
      return;
    }

    if (val instanceof Date && !isNaN(val.getTime())) {
      this.selected = {
        day: val.getDate(),
        month: val.getMonth() + 1,
        year: val.getFullYear()
      };
      this.viewMonth = this.selected.month - 1;
      this.viewYear = this.selected.year;
      if (this.mask) this.mask.setDate(this.selected.day, this.selected.month, this.selected.year);
      this.renderCalendar();
      this.notifyChange();
      return;
    }

    if (typeof val === 'string') {
      const parts = val.trim().split(/[/\-.]/);
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y) && d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2150) {
          this.selected = { day: d, month: m, year: y };
          this.viewMonth = m - 1;
          this.viewYear = y;
          if (this.mask) this.mask.setDate(d, m, y);
          this.renderCalendar();
          this.notifyChange();
          return;
        }
      }
    }

    this.clear();
  }

  clear() {
    this.selected = null;
    if (this.mask) this.mask.clear();
    this.renderCalendar();
    this.notifyChange();
  }

  isComplete() {
    return this.mask ? this.mask.isComplete() : false;
  }

  isEmpty() {
    return this.mask ? this.mask.isEmpty() : true;
  }

  isValid() {
    return this.mask ? this.mask.isValidDate() : false;
  }

  onChange(callback) {
    if (typeof callback === 'function') {
      this.changeCallbacks.push(callback);
    }
  }

  notifyChange() {
    const val = this.getValue();
    const dateObj = this.mask ? this.mask.getDate() : null;
    this.changeCallbacks.forEach(cb => {
      try {
        cb(val, dateObj, this);
      } catch (err) {
        console.error('DatePicker onChange callback error:', err);
      }
    });
  }

  focus() {
    if (this.input) {
      this.input.focus();
    }
  }
}

// Expose to window for vanilla JS application and module.exports for Node
if (typeof window !== 'undefined') {
  window.DateMaskInput = DateMaskInput;
  window.DatePicker = DatePicker;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DateMaskInput, DatePicker };
}
