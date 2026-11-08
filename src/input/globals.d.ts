// Ambient type declarations for Renderer DOM & Electron Preload API
// Chỉ phục vụ trình kiểm tra kiểu của IDE (VS Code / Antigravity), không ảnh hưởng logic runtime.

interface Window {
  api?: any;
  VIETNAM_BANKS_LIST?: any[];
  VIETNAM_BANKS_MAP?: Record<string, any>;
  clipboardData?: DataTransfer | null;
  calcRoom?: (room: any, settings?: any) => any;
  calcAllRooms?: (rooms: any[], settings?: any) => any;
  round1000?: (val: number) => number;
  round1?: (val: number) => number;
  MAX_DONG_HO_DIEN?: number;
  getMeterLimitByDigits?: (digits: any, defaultVal?: number) => number;
  DateMaskInput?: any;
  DatePicker?: any;
  formatMoney?: (val: any) => string;
  formatDecimalVN?: (val: any) => string;
  getNgayThangNam?: (date?: any) => any;
  toReceiptData?: (room: any, calcResult: any, settings?: any) => any;
}

interface HTMLElement {
  value?: any;
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  src?: string;
  options?: any;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  setSelectionRange?: (start: number, end: number, direction?: 'forward' | 'backward' | 'none') => void;
  select?: () => void;
  _datePicker?: any;
  _dateMaskInput?: any;
}

interface Element {
  style?: any;
  title?: string;
  value?: any;
  checked?: boolean;
  focus?: (options?: FocusOptions) => void;
  select?: () => void;
}

interface EventTarget {
  value?: any;
  tagName?: string;
  type?: string;
  id?: string;
  classList?: DOMTokenList;
  blur?: () => void;
  getAttribute?: (qualifiedName: string) => string | null;
}

declare function calcRoom(room: any, settings?: any): any;
declare function calcAllRooms(rooms: any[], settings?: any): any;
declare function getMeterLimitByDigits(digits: any, defaultVal?: number): number;
declare const MAX_DONG_HO_DIEN: number;
declare var DatePicker: any;
