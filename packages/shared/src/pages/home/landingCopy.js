/**
 * Landing-page copy. Add a language by appending its code to LANDING_LOCALES
 * and a matching object below. Unknown codes fall back to Vietnamese.
 */
import { quanLuongPageMeta } from "../../lib/quanLuongPageMeta.js";

export const LANDING_LOCALES = ["vi", "en"];
export const DEFAULT_LANDING_LOCALE = "vi";
export const LANDING_LOCALE_COOKIE = "ql_locale";
export const LANDING_LOCALE_STORAGE_KEY = "ql_locale";
export const LANDING_LOCALE_MAX_AGE = 60 * 60 * 24 * 365;

const vi = {
  htmlLang: "vi",
  ogLocale: "vi_VN",
  metaTitle: "Trang chủ",
  metaDescription:
    "Phần mềm quân lương đa đơn vị: phiếu xuất kho LTTP, sổ sách bếp ăn, chứng từ quyết toán PDF khổ A4, phân quyền theo vai trò, đồng bộ offline và trợ lý AI chỉ lập bản nháp.",
  loading: "Đang tải…",
  languageLabel: "Ngôn ngữ",
  languageNames: { vi: "Tiếng Việt", en: "English" },
  heroKicker: "Phần mềm quân lương cho bếp và kho",
  heroTitle: "Sổ bếp và kho LTTP trên cùng một hệ thống",
  heroBody:
    "Lập phiếu xuất kho, ghi sổ nhập xuất, chấm cơm và in chứng từ quyết toán. Đăng nhập bằng phiên bảo mật. Mỗi tài khoản chỉ làm trong đơn vị và quyền được cấp.",
  ctaLogin: "Đăng nhập",
  ctaLoginTitle: "Mở trang đăng nhập",
  ctaRegister: "Đăng ký tài khoản",
  ctaRegisterTitle: "Mở trang đăng ký tài khoản",
  ctaDashboard: "Vào bảng điều khiển",
  ctaDashboardTitle: "Mở bảng điều khiển theo quyền",
  greeting: "Xin chào, {name}",
  greetingAnonymous: "Xin chào",
  featuresTitle: "Việc phần mềm làm được",
  featuresLead: "Các màn hình đơn vị đang dùng.",
  features: [
    {
      title: "Phiếu xuất kho LTTP",
      body: "Lập phiếu xuất, xem lịch sử xuất, đặt hàng và cấu hình chữ ký in trên phiếu. Mất mạng thì phiếu và bản nháp vẫn nằm trên máy, rồi đồng bộ khi có mạng.",
    },
    {
      title: "Sổ sách bếp ăn",
      body: "Sổ chấm cơm, danh sách bảo đảm, thực đơn, phiếu nhập kho, phiếu xuất kho bếp, sổ nhập xuất LTTP và sổ theo dõi LTTP tại kho.",
    },
    {
      title: "Chứng từ quyết toán",
      body: "Xuất chứng từ ra PDF khổ A4. Ảnh chữ ký đã lưu được đóng vào khối ký trên trang in.",
    },
    {
      title: "Trợ lý AI chỉ lập bản nháp",
      body: "Trợ lý đọc sổ rồi đề xuất quân số, dòng hàng, lịch hoặc thực đơn. Số chỉ được ghi khi bạn bấm chấp nhận. AI không tự sửa số trên sổ hay trên phiếu.",
    },
  ],
  workflowTitle: "Luồng làm việc",
  workflowLead: "Từ lúc đăng nhập đến lúc đối soát, theo việc bếp và kho đang làm.",
  steps: [
    {
      title: "Đăng nhập vào đơn vị",
      body: "Xác thực bằng cookie phiên (httpOnly) và JWT. Menu và API chỉ mở đúng việc của vai trò. Số liệu nằm trong phạm vi đơn vị của tài khoản.",
    },
    {
      title: "Xuất kho và ghi sổ",
      body: "Lập phiếu xuất LTTP, hoặc phiếu nhập và phiếu xuất của bếp. Sổ nhập xuất LTTP theo dõi nhập, xuất và tồn theo ngày.",
    },
    {
      title: "In chứng từ",
      body: "Xuất PDF khổ A4 cho phiếu và chứng từ quyết toán. Khối chữ ký in tên người ký và ảnh chữ ký đã cấu hình.",
    },
    {
      title: "Đối soát",
      body: "Người có quyền mở nhật ký hệ thống (audit log). Quản trị toàn hệ thống nằm ở ứng dụng superadmin. Nhà cung cấp dùng cổng riêng để đặt hàng và xem sổ công nợ.",
    },
  ],
  securityTitle: "Bảo mật và dữ liệu",
  securityLead: "Cách phần mềm giữ quyền truy cập và số liệu.",
  security: [
    {
      title: "Phân quyền theo vai trò",
      body: "Mỗi màn hình gắn một mã quyền. Thiếu quyền thì mục menu ẩn và máy chủ từ chối thao tác.",
    },
    {
      title: "Đa đơn vị",
      body: "Số liệu gắn với cây đơn vị. Tài khoản không ghi số của đơn vị ngoài phạm vi được cấp.",
    },
    {
      title: "Đồng bộ offline-first",
      body: "Trình duyệt lưu phiếu xuất LTTP và bản nháp trong IndexedDB. Hàng đợi outbox gửi lên API khi mạng trở lại.",
    },
    {
      title: "Xác thực",
      body: "Đăng nhập đặt cookie httpOnly. Máy chủ kiểm tra JWT gắn với phiên làm việc.",
    },
    {
      title: "Nhật ký hệ thống",
      body: "Thao tác quan trọng được ghi audit log để người có quyền đối soát.",
    },
    {
      title: "Triển khai Docker",
      body: "Bản triển khai Docker gồm ứng dụng web, API, MariaDB, Redis, dịch vụ xuất PDF và trợ lý AI.",
    },
  ],
  ctaTitle: "Vào ca làm việc",
  ctaBody:
    "Dùng tài khoản đơn vị đã được cấp. Khi đăng ký mới, quản trị có thể cần duyệt, hoặc bạn cần xác minh email trước khi đăng nhập.",
  drive: {
    title: "Google Drive",
    body: "Liên kết tuỳ chọn với thư mục «midnight-app» trên Drive của bạn. Sổ bếp và phiếu vẫn lưu trong phần mềm này.",
    linked: "Đã liên kết.",
    folderId: "Mã thư mục",
    unverified:
      "Xác minh email trước khi liên kết Drive. Tài khoản quản trị hệ thống không bị bước này chặn.",
    open: "Mở thư mục làm việc",
    unlink: "Huỷ liên kết",
    unlinking: "Đang huỷ…",
    link: "Liên kết Google Drive",
    linking: "Đang mở Google…",
    unlinkTitle: "Huỷ liên kết Google Drive",
    unlinkMessage:
      "Hệ thống sẽ xóa token và mã thư mục đã lưu. Thư mục trên Drive của bạn không bị xóa. Bạn có thể liên kết lại sau.",
    unlinkConfirm: "Huỷ liên kết",
    linkedToast: "Đã liên kết Google Drive. Thư mục «midnight-app» sẵn sàng.",
    unlinkedToast: "Đã huỷ liên kết Google Drive.",
    unlinkFail: "Không gỡ được liên kết.",
    startFail: "Không bắt đầu được liên kết Google Drive.",
    badUrl: "Máy chủ không trả về URL Google hợp lệ.",
    network: "Lỗi mạng. Kiểm tra kết nối rồi thử lại.",
    sessionFallback:
      "Phiên đăng nhập không hợp lệ. Đăng xuất, đăng nhập lại trên cùng địa chỉ (localhost hoặc 127.0.0.1, không trộn), rồi thử lại.",
    folderMissing: "Thư mục làm việc trên Google Drive không còn. Hệ thống đã huỷ liên kết cũ.",
  },
  driveErrors: {
    denied: "Bạn đã hủy cấp quyền hoặc Google từ chối liên kết.",
    missing: "Thiếu mã xác nhận từ Google. Hãy bắt đầu lại từ nút «Liên kết Google Drive».",
    state:
      "Phiên liên kết không khớp hoặc đã hết hạn. Mở lại từ trang chủ (đã đăng nhập) và thử liên kết lại.",
    no_refresh:
      "Google không cấp refresh token. Vào Tài khoản Google → Bảo mật → Quyền truy cập của bên thứ ba, gỡ ứng dụng này rồi liên kết lại.",
    config: "Google OAuth chưa được cấu hình đúng trên máy chủ (CLIENT_ID / SECRET / REDIRECT_URI).",
    folder: "Không tạo hoặc tìm được thư mục «midnight-app» trên Drive. Thử lại sau vài phút.",
    scope: "Google chưa cấp đủ quyền Drive/Sheets. Gỡ quyền ứng dụng trong Tài khoản Google rồi liên kết lại.",
    token: "Google không trả về access token hợp lệ. Thử liên kết lại.",
    unknown: "Liên kết Google Drive thất bại. Thử lại hoặc kiểm tra cấu hình OAuth.",
  },
};

const en = {
  htmlLang: "en",
  ogLocale: "en_US",
  metaTitle: "Home",
  metaDescription:
    "Multi-unit ration software: LTTP warehouse issue slips, kitchen books, A4 settlement PDFs, role-based access, offline sync, and an AI assistant that only drafts.",
  loading: "Loading…",
  languageLabel: "Language",
  languageNames: { vi: "Tiếng Việt", en: "English" },
  heroKicker: "Ration software for the kitchen and the warehouse",
  heroTitle: "Kitchen books and the LTTP warehouse, in one system",
  heroBody:
    "Create issue slips, keep the in/out ledger, record meals, and print settlement documents. You sign in with a secure session. Each account works only inside its unit and the permissions it was granted.",
  ctaLogin: "Sign in",
  ctaLoginTitle: "Open the sign-in page",
  ctaRegister: "Create an account",
  ctaRegisterTitle: "Open the registration page",
  ctaDashboard: "Open the dashboard",
  ctaDashboardTitle: "Open the dashboard for your permissions",
  greeting: "Hello, {name}",
  greetingAnonymous: "Hello",
  featuresTitle: "What the software does",
  featuresLead: "The screens a unit actually uses.",
  features: [
    {
      title: "LTTP issue slips",
      body: "Create an issue slip, review issue history, place an order, and set the signature printed on the slip. If the network drops, the slip and drafts stay on the device and sync when the connection returns.",
    },
    {
      title: "Kitchen books",
      body: "Meal attendance, the ration roster, menus, kitchen receipt slips, kitchen issue slips, the LTTP in/out ledger, and the warehouse stock ledger.",
    },
    {
      title: "Settlement documents",
      body: "Export settlement documents as A4 PDF. A saved signature image is stamped into the signature block on the printed page.",
    },
    {
      title: "AI assistant that only drafts",
      body: "The assistant reads the book and proposes headcount, stock lines, a schedule, or a menu. Figures are saved only after you accept. The AI does not change numbers on the ledger or on a slip by itself.",
    },
  ],
  workflowTitle: "How a shift runs",
  workflowLead: "From sign-in to review, in the order the kitchen and warehouse work.",
  steps: [
    {
      title: "Sign in to your unit",
      body: "Authentication uses an httpOnly session cookie and a JWT. Menus and API calls open only the tasks your role allows. Data stays inside the account's unit.",
    },
    {
      title: "Issue stock and post the books",
      body: "Create an LTTP issue slip, or a kitchen receipt or issue slip. The LTTP in/out ledger tracks receipts, issues, and the balance for each day.",
    },
    {
      title: "Print the documents",
      body: "Export A4 PDFs for slips and settlement documents. The signature block prints the configured name and signature image.",
    },
    {
      title: "Review",
      body: "People with permission open the system audit log. System-wide administration is the superadmin app. Suppliers use a separate portal to place orders and read the debt ledger.",
    },
  ],
  securityTitle: "Security and data",
  securityLead: "How access and records are kept.",
  security: [
    {
      title: "Role-based access",
      body: "Each screen is tied to a permission code. Without it, the menu item is hidden and the server rejects the action.",
    },
    {
      title: "Multiple units",
      body: "Records belong to the unit tree. An account cannot post figures for a unit outside its granted scope.",
    },
    {
      title: "Offline-first sync",
      body: "The browser stores LTTP issue slips and drafts in IndexedDB. An outbox queue sends them to the API when the network returns.",
    },
    {
      title: "Authentication",
      body: "Sign-in sets an httpOnly cookie. The server checks the JWT against the working session.",
    },
    {
      title: "Audit log",
      body: "Important actions are written to the audit log so someone with permission can review them.",
    },
    {
      title: "Docker deployment",
      body: "The Docker deployment runs the web app, the API, MariaDB, Redis, the PDF service, and the AI assistant.",
    },
  ],
  ctaTitle: "Open your shift",
  ctaBody:
    "Use the unit account you were given. A new registration may need an administrator to approve it, or you may need to verify your email before signing in.",
  drive: {
    title: "Google Drive",
    body: "Optional link to a «midnight-app» folder on your Drive. Kitchen books and slips stay in this software.",
    linked: "Linked.",
    folderId: "Folder ID",
    unverified:
      "Verify your email before linking Drive. System-administrator accounts are not blocked by this step.",
    open: "Open the working folder",
    unlink: "Unlink",
    unlinking: "Unlinking…",
    link: "Link Google Drive",
    linking: "Opening Google…",
    unlinkTitle: "Unlink Google Drive",
    unlinkMessage:
      "The system deletes the saved token and folder ID. The folder on your Drive is not deleted. You can link again later.",
    unlinkConfirm: "Unlink",
    linkedToast: "Google Drive is linked. The «midnight-app» folder is ready.",
    unlinkedToast: "Google Drive was unlinked.",
    unlinkFail: "Could not remove the link.",
    startFail: "Could not start the Google Drive link.",
    badUrl: "The server did not return a valid Google URL.",
    network: "Network error. Check the connection and try again.",
    sessionFallback:
      "The sign-in session is not valid. Sign out, sign in again on the same address (do not mix localhost and 127.0.0.1), then try again.",
    folderMissing: "The working folder on Google Drive is gone. The old link was removed.",
  },
  driveErrors: {
    denied: "You cancelled the permission, or Google refused the link.",
    missing: "The confirmation code from Google is missing. Start again from «Link Google Drive».",
    state: "The link session does not match or has expired. Open the home page while signed in and try again.",
    no_refresh:
      "Google did not issue a refresh token. In your Google Account, open Security → Third-party access, remove this app, then link again.",
    config: "Google OAuth is not configured correctly on the server (CLIENT_ID / SECRET / REDIRECT_URI).",
    folder: "The «midnight-app» folder could not be created or found on Drive. Try again in a few minutes.",
    scope: "Google did not grant enough Drive/Sheets access. Remove the app's access in your Google Account, then link again.",
    token: "Google did not return a valid access token. Try linking again.",
    unknown: "Linking Google Drive failed. Try again or check the OAuth configuration.",
  },
};

export const landingCopy = { vi, en };

/** Boot script: set `<html lang>` from the locale cookie before paint. */
export const LANDING_LANG_BOOT_SCRIPT = `(function(){try{var allow=${JSON.stringify(
  LANDING_LOCALES.filter((code) => code !== DEFAULT_LANDING_LOCALE),
)};var m=document.cookie.match(/(?:^|; )${LANDING_LOCALE_COOKIE}=([^;]*)/);var v=m?decodeURIComponent(m[1]):"";document.documentElement.lang=allow.indexOf(v)>=0?v:"${DEFAULT_LANDING_LOCALE}";}catch(e){}})();`;

/**
 * @param {string | null | undefined} value
 * @returns {"vi" | "en"}
 */
export function resolveLandingLocale(value) {
  const code = String(value ?? "").trim().toLowerCase();
  return LANDING_LOCALES.includes(code) ? code : DEFAULT_LANDING_LOCALE;
}

/** @param {string | null | undefined} locale */
export function getLandingCopy(locale) {
  return landingCopy[resolveLandingLocale(locale)];
}

/** @param {string | null | undefined} locale */
export function landingRouteMetadata(locale) {
  const copy = getLandingCopy(locale);
  return quanLuongPageMeta({
    title: copy.metaTitle,
    description: copy.metaDescription,
    ogLocale: copy.ogLocale,
  });
}

/**
 * @param {{ greeting: string, greetingAnonymous: string }} copy
 * @param {string | null | undefined} name
 */
export function formatLandingGreeting(copy, name) {
  const who = name != null ? String(name).trim() : "";
  if (!who) return copy.greetingAnonymous;
  return copy.greeting.replaceAll("{name}", who);
}

/** @param {string | null | undefined} locale */
export function landingLocaleSetCookie(locale) {
  const value = encodeURIComponent(resolveLandingLocale(locale));
  return `${LANDING_LOCALE_COOKIE}=${value}; Path=/; Max-Age=${LANDING_LOCALE_MAX_AGE}; SameSite=Lax`;
}

/** Persist the choice in a cookie and in localStorage. Returns the resolved code. */
export function writeLandingLocale(locale) {
  const resolved = resolveLandingLocale(locale);
  if (typeof document !== "undefined") {
    document.cookie = landingLocaleSetCookie(resolved);
  }
  try {
    localStorage.setItem(LANDING_LOCALE_STORAGE_KEY, resolved);
  } catch {
    /* Private mode can block localStorage. The cookie still holds the choice. */
  }
  return resolved;
}

/** Explicit localStorage value, or null when missing or unreadable. */
export function readExplicitStoredLandingLocale() {
  try {
    const raw = localStorage.getItem(LANDING_LOCALE_STORAGE_KEY);
    if (raw == null || String(raw).trim() === "") return null;
    return resolveLandingLocale(raw);
  } catch {
    return null;
  }
}

/** Set `lang`, `document.title`, and the description meta to the active landing locale. */
export function applyLandingDocumentLocale(locale) {
  const copy = getLandingCopy(locale);
  if (typeof document === "undefined") return copy;
  document.documentElement.lang = copy.htmlLang;
  document.title = `Quân lương - ${copy.metaTitle}`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", copy.metaDescription);
  const ogLocale = document.querySelector('meta[property="og:locale"]');
  if (ogLocale) ogLocale.setAttribute("content", copy.ogLocale);
  return copy;
}
