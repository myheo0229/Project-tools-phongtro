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
  toReceiptData?: (room: any, calcResult: any, settings?: any, roomMcRecord?: any) => any;
  formatMcDateVN?: (isoDateStr: string) => string;
  buildMeterChangeDetailForType?: (typeRecord: any, type: 'elec' | 'water') => any;
  formatRoomMeterChangeNotes?: (roomMcRecord: any) => any;
  renderZaloTemplateWithMeterChange?: (template: string, values: Record<string, any>) => string;
  applyZaloMeterChangeNote?: (renderedMsg: string, rawTemplate: string, noteBlock: string, shouldInclude: boolean) => string;
  handleExportMonthExcelClick?: () => Promise<any>;
  showMonthExcelExportResultModal?: (result: any, monthKey?: string) => void;
  logExportMonthExcelEvent?: (params: any) => Promise<any>;
  handleOpenExportedExcelFile?: () => Promise<any>;
  lastExportedExcelPath?: string;
  meterChangesStore?: { version: number; months: Record<string, Record<string, any>> };
  loadMeterChangesStore?: () => Promise<any>;
  getRoomMeterChangeRecord?: (monthKey: string, phong: string) => any;
  getUnfinishedMeterChangesForMonth?: (monthKey: string) => any[];
  openMeterChangeModal?: (preselectPhong?: string, preselectType?: string) => void;
  closeMeterChangeModal?: () => void;
  toggleMeterChangeType?: (labelId: string, checkbox: any) => void;
  goToMeterChangeStep?: (step: number, dir: number) => void;
  handleMcStep2Back?: () => void;
  handleToggleEditMcRecordClick?: () => void;
  closeMcUnlockEditModal?: () => void;
  confirmUnlockMcRecordForEditing?: () => void;
  openMeterChangeHistoryCard?: (monthKey: string, phong: string) => Promise<void>;
  addMeterChangeRow?: (type: string) => void;
  removeMeterChangeRow?: (type: string, idx: number) => void;
  onMcIntKeyDown?: (event: any) => boolean;
  onMeterChangeDateInput?: (type: string, idx: number, val: string) => void;
  onMeterChangeNumInput?: (type: string, idx: number, field: string, inputEl: any) => void;
  onMcOldEndBlur?: (type: string, idx: number) => void;
  onMcMonthEndBlur?: (type: string, idx: number) => void;
  openMcMissingPrevModal?: (type: string) => void;
  closeMcMissingPrevModal?: () => void;
  confirmManualInitFromMc?: () => void;
  confirmGoToPrevMonthFromMc?: () => Promise<void>;
  openMcRolloverForRow?: (type: string, idx: number) => void;
  cancelMcRolloverModal?: () => void;
  confirmMcRolloverModal?: () => void;
  openMcDigitsModalManual?: (type: string) => void;
  stepMcNewMeterDigits?: (delta: number) => void;
  validateMcDigitInputRealtime?: (inputEl: any) => void;
  enforceMcDigitRange?: (inputEl: any) => void;
  confirmMcNewMeterDigits?: () => Promise<void>;
  handleSaveMeterChange?: () => Promise<void>;
  handleDeleteSectionMeterChange?: (type: string) => Promise<void>;
  handleDeleteRoomMeterChanges?: () => Promise<void>;
  suppressMcBlurBriefly?: (ms?: number) => void;
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

declare function toReceiptData(calcResult: any, monthKey?: string, dienThoai?: string, roomMcRecord?: any): any;
declare function formatMcDateVN(isoDateStr: string): string;
declare function buildMeterChangeDetailForType(typeRecord: any, type: 'elec' | 'water'): any;
declare function formatRoomMeterChangeNotes(roomMcRecord: any): any;
declare function renderZaloTemplateWithMeterChange(template: string, values: Record<string, any>): string;
declare function applyZaloMeterChangeNote(renderedMsg: string, rawTemplate: string, noteBlock: string, shouldInclude: boolean): string;
declare function calcRoom(room?: any, settings?: any): any;
declare function calcAllRooms(rooms: any[], settings?: any): any;
declare function getMeterLimitByDigits(digits: any, defaultVal?: number): number;
declare const MAX_DONG_HO_DIEN: number;
declare var DatePicker: any;

declare function showToast(message: string, type?: string): void;
declare function getActiveMonthSettings(): any;
declare function getEffectiveDienStartForRollover(room: any): number;
declare function getEffectiveNuocStartForRollover(room: any): number;
declare function showExcelExportResultModal(result: any): void;
declare function formatMonthLabel(monthKey: string): string;
declare function logExportMonthExcelEvent(params: any): Promise<any>;
declare function handleExportMonthExcelClick(): Promise<any>;
declare function showMonthExcelExportResultModal(result: any, monthKey?: string): void;
declare function isMcReadonlyMode(): boolean;
declare function renderInitialTable(): void;
declare function populateMonthSelect(): Promise<void>;
declare function loadRoomsForMonth(monthKey: string): Promise<void>;
declare function onMonthYearChange(): Promise<void>;
declare function autoSaveCurrentMonthData(monthKey?: string): Promise<void>;
declare function renderMeterDigitsSettingsList(): void;
declare function saveSettingsFile(isSilent?: boolean): Promise<boolean>;
declare function recordActivityLog(payload: any, immediate?: boolean): Promise<any>;
declare function loadMeterChangesStore(): Promise<any>;
declare function getRoomMeterChangeRecord(monthKey: string, phong: string): any;
declare function getUnfinishedMeterChangesForMonth(monthKey: string): any[];
declare function extractHistoryPayload(rawData: any): { isLocked: boolean; settingsSnapshot: any; rooms: any[] };
declare function readHistoryFile(monthYearStr: string): Promise<any>;
declare function writeHistoryFile(monthYearStr: string, data: any): Promise<boolean>;
declare function openMeterChangeModal(preselectPhong?: string, preselectType?: string): void;
