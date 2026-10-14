/**
 * Worker-UI strings. zh-Hant + Vietnamese.
 * Single source of truth — every UI string comes from here.
 * NOTE (v1): Vietnamese translations are first-draft; have a native
 * speaker review before the factory trial.
 */

export type Lang = 'zh' | 'vi';

/** Shape of the dictionary — zh and vi must have identical keys. */
export type Dict = {
  appName: string;
  login: Record<'title' | 'pinFallback' | 'pinTitle' | 'pinPlaceholder' | 'submit' | 'scanHint' | 'error', string>;
  jobs: Record<'title' | 'empty' | 'workOrderNo' | 'product' | 'plannedQty' | 'machine' | 'mold' | 'dueDate' | 'open', string>;
  job: Record<'start' | 'report' | 'complete' | 'shots' | 'shotsHint' | 'goodQty' | 'ngQty' | 'submitReport' | 'reportSuccess' | 'confirmComplete' | 'back', string>;
  status: Record<'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED', string>;
  common: Record<'logout' | 'cancel' | 'confirm' | 'loading' | 'error', string>;
};

const zh: Dict = {
  appName: '腦工 BrainFactory',
  login: {
    title: '請掃描員工證',
    pinFallback: '沒帶證？用 PIN 登入',
    pinTitle: '輸入 4 位 PIN',
    pinPlaceholder: '••••',
    submit: '登入',
    scanHint: '將掃描槍對準員工證條碼',
    error: '登入失敗，請重試',
  },
  jobs: {
    title: '我的工單',
    empty: '目前沒有指派給你的工單',
    workOrderNo: '工單號',
    product: '產品',
    plannedQty: '計畫數量',
    machine: '機台',
    mold: '模具',
    dueDate: '交期',
    open: '進入',
  },
  job: {
    start: '開工',
    report: '報工',
    complete: '完工',
    shots: '模次',
    shotsHint: '本次生產的射出次數',
    goodQty: '良品數',
    ngQty: '不良數',
    submitReport: '送出報工',
    reportSuccess: '已報工',
    confirmComplete: '確定完工嗎？',
    back: '返回',
  },
  status: {
    SCHEDULED: '待生產',
    IN_PROGRESS: '生產中',
    COMPLETED: '已完工',
    CANCELLED: '已取消',
  },
  common: {
    logout: '登出',
    cancel: '取消',
    confirm: '確定',
    loading: '載入中…',
    error: '發生錯誤，請重試',
  },
};

const vi: Dict = {
  appName: 'BrainFactory',
  login: {
    title: 'Vui lòng quét thẻ nhân viên',
    pinFallback: 'Quên thẻ? Đăng nhập bằng mã PIN',
    pinTitle: 'Nhập mã PIN 4 số',
    pinPlaceholder: '••••',
    submit: 'Đăng nhập',
    scanHint: 'Hướng máy quét vào mã vạch trên thẻ',
    error: 'Đăng nhập thất bại, vui lòng thử lại',
  },
  jobs: {
    title: 'Việc của tôi',
    empty: 'Hiện không có lệnh sản xuất nào được giao cho bạn',
    workOrderNo: 'Mã lệnh',
    product: 'Sản phẩm',
    plannedQty: 'Số lượng kế hoạch',
    machine: 'Máy',
    mold: 'Khuôn',
    dueDate: 'Ngày giao',
    open: 'Mở',
  },
  job: {
    start: 'Bắt đầu',
    report: 'Báo sản lượng',
    complete: 'Hoàn thành',
    shots: 'Số shot',
    shotsHint: 'Số lần ép trong ca/lần báo cáo này',
    goodQty: 'Hàng đạt',
    ngQty: 'Hàng lỗi',
    submitReport: 'Gửi báo cáo',
    reportSuccess: 'Đã báo cáo',
    confirmComplete: 'Xác nhận hoàn thành?',
    back: 'Quay lại',
  },
  status: {
    SCHEDULED: 'Chờ sản xuất',
    IN_PROGRESS: 'Đang sản xuất',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
  },
  common: {
    logout: 'Đăng xuất',
    cancel: 'Hủy',
    confirm: 'Xác nhận',
    loading: 'Đang tải…',
    error: 'Có lỗi xảy ra, vui lòng thử lại',
  },
};

const dicts: Record<Lang, Dict> = { zh, vi };

export function t(lang: Lang): Dict {
  return dicts[lang] ?? dicts.zh;
}
