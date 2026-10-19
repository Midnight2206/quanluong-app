import ExcelJS from "exceljs";
import { listAuthEvents, listDataChanges, listUsageDaily } from "./audit-logs.service.js";

const EXPORT_CAP = 10000;

const AUTH_TYPE = { LOGIN_SUCCESS: "Đăng nhập", LOGIN_FAILED: "Thất bại", LOGOUT: "Đăng xuất" };
const ACTION = { CREATE: "Thêm", UPDATE: "Sửa", DELETE: "Xóa" };
const SOURCE = { web: "Web", supplier: "Nhà cung cấp" };
const vnTime = (d) => (d ? new Date(new Date(d).getTime() + 7 * 3600000).toISOString().replace("T", " ").slice(0, 19) : "");
const who = (r) => (r.user ? r.user.fullName || r.user.username : "");
const clip = (s) => (s && s.length > 32000 ? `${s.slice(0, 32000)}…` : s);

const SHEETS = {
  auth: {
    title: "Đăng nhập",
    load: (scope, q) => listAuthEvents(scope, q, { cap: EXPORT_CAP }),
    columns: [
      ["Thời gian (giờ VN)", 20, (r) => vnTime(r.occurredAt)],
      ["Người dùng", 24, who],
      ["Tên đăng nhập đã nhập", 22, (r) => r.identifier ?? ""],
      ["Sự kiện", 12, (r) => AUTH_TYPE[r.type] ?? r.type],
      ["Lý do", 16, (r) => r.failReason ?? ""],
      ["Cách đăng nhập", 12, (r) => r.method],
      ["Đơn vị", 24, (r) => r.unitName ?? ""],
      ["IP", 18, (r) => r.ip ?? ""],
      ["Thiết bị", 40, (r) => r.userAgent ?? ""],
    ],
  },
  changes: {
    title: "Thay đổi dữ liệu",
    load: (scope, q) => listDataChanges(scope, q, { cap: EXPORT_CAP }),
    columns: [
      ["Thời gian (giờ VN)", 20, (r) => vnTime(r.occurredAt)],
      ["Người dùng", 24, (r) => who(r) || "Hệ thống"],
      ["Thao tác", 10, (r) => ACTION[r.action] ?? r.action],
      ["Đối tượng", 24, (r) => r.modelLabel ?? r.model],
      ["Mã bản ghi", 14, (r) => r.recordId ?? ""],
      ["Đơn vị", 24, (r) => r.unitName ?? ""],
      ["Chi tiết", 60, (r) => clip(JSON.stringify(r.changes ?? {}))],
      ["Đường dẫn", 30, (r) => r.route ?? ""],
      ["IP", 18, (r) => r.ip ?? ""],
    ],
  },
  usage: {
    title: "Sử dụng",
    load: (scope, q) => listUsageDaily(scope, q, { cap: EXPORT_CAP }),
    columns: [
      ["Ngày", 12, (r) => r.day],
      ["Người dùng", 24, who],
      ["Ứng dụng", 12, (r) => SOURCE[r.source] ?? r.source ?? ""],
      ["Thời gian hoạt động (phút)", 14, (r) => Math.round((r.activeSec || 0) / 60)],
      ["Số trang xem", 12, (r) => r.pageViews],
      ["Lần đầu (giờ VN)", 20, (r) => vnTime(r.firstSeenAt)],
      ["Lần cuối (giờ VN)", 20, (r) => vnTime(r.lastSeenAt)],
      ["Đơn vị", 24, (r) => r.unitName ?? ""],
    ],
  },
};

/** Tạo file Excel theo bộ lọc hiện tại; tối đa EXPORT_CAP dòng mới nhất. */
async function buildAuditExcel(tab, scope, q) {
  const sheet = SHEETS[tab];
  const { items } = await sheet.load(scope, q);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheet.title);
  ws.columns = sheet.columns.map(([header, width]) => ({ header, width }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const r of items) ws.addRow(sheet.columns.map(([, , get]) => get(r)));
  if (items.length >= EXPORT_CAP) ws.addRow([`Đã giới hạn ${EXPORT_CAP} dòng mới nhất — thu hẹp bộ lọc để xem thêm.`]);
  return { buffer: await wb.xlsx.writeBuffer(), count: items.length };
}

export { buildAuditExcel, EXPORT_CAP, SHEETS };
