import { QUANLUONG_SITE_NAME } from "./quanLuongPageMeta.js";
import { normalizeMidnightLocale } from "./midnightLocale.js";

/**
 * Midnight landing copy. Vietnamese is the default. Add a locale object to support another language.
 * Product tags are technologies this repository actually runs. Studio tags are skills that do not power Quân lương.
 */
const vi = {
  meta: {
    title: "Midnight",
    description:
      "Midnight làm web app, website và firmware. Quân lương là web app quản lý quân nhu đang chạy, với phân quyền theo vai trò (RBAC), sổ sách và đồng bộ dữ liệu.",
  },
  loading: "Đang tải…",
  nav: {
    homeAria: "Midnight — trang chủ",
    navAria: "Điều hướng trang",
    login: "Đăng nhập",
    register: "Đăng ký",
    langAria: "Ngôn ngữ",
    langVi: "Tiếng Việt",
    langEn: "English",
  },
  theme: {
    mode: "Chế độ",
    light: "Sáng",
    dark: "Tối",
    accent: "Màu chủ đạo",
    contrast: "Tương phản cao",
    trigger: "Giao diện",
    accentNames: {
      teal: "Xanh ngọc",
      blue: "Xanh dương",
      green: "Xanh lá",
      olive: "Xanh lính",
      rose: "Hồng",
      amber: "Hổ phách",
    },
  },
  hero: {
    lead: "Midnight làm web app, website và firmware.",
    support:
      "Quân lương — web app quản lý quân nhu đang chạy — có đăng nhập, phân quyền theo vai trò (RBAC) và đồng bộ dữ liệu.",
    login: "Đăng nhập",
    samples: "Xem mẫu giao diện",
  },
  strip: {
    title: "Mẫu giao diện",
    intro: "Các thẻ dưới đây là mẫu màn hình: tìm lệnh, phân quyền, phiếu và biểu đồ.",
  },
  marquee: {
    aria: "Mẫu giao diện nghiệp vụ",
    cmdk: {
      label: "Bảng lệnh",
      placeholder: "Tìm lệnh hoặc trang…",
      rows: [
        { k: "↵", t: "Mở sổ nhập xuất LTTP", hot: true },
        { k: "G", t: "Mở chứng từ xuất" },
        { k: "P", t: "Hồ sơ · Google Drive" },
      ],
    },
    kanban: {
      label: "Bảng Kanban",
      columns: [
        { col: "Đang làm", cards: ["Phiếu xuất · A", "Đối chiếu giá"] },
        { col: "Chờ duyệt", cards: ["Chữ ký số"] },
      ],
    },
    matrix: {
      label: "Ma trận quyền",
      roleHeader: "Vai trò",
      perms: ["Xem", "Sửa", "Duyệt"],
      rows: [
        { r: "Thủ kho", c: [1, 1, 0] },
        { r: "Chỉ huy", c: [1, 0, 1] },
        { r: "Nhà cung cấp", c: [1, 0, 0] },
      ],
    },
    chat: {
      label: "Chat hỗ trợ",
      incoming: "Đơn hàng LTTP tuần này đã khóa chưa?",
      outgoing: "Đã khóa lúc 14:20. Bạn vẫn xem được phiếu.",
      placeholder: "Nhập tin nhắn…",
      send: "Gửi",
    },
    wizard: {
      label: "Các bước",
      steps: ["Chọn", "Ký", "Xuất"],
      currentTitle: "Bước 2 · Chữ ký",
      currentBody: "Thủ kho đã ký. Đang chờ chỉ huy.",
    },
    analytics: { label: "Biểu đồ", caption: "Xuất kho · 7 ngày" },
    calendar: {
      label: "Lịch tuần",
      days: ["T2", "T3", "T4", "T5", "T6"],
      events: { 1: "Xuất", 2: "Họp", 4: "Soát" },
    },
    form: {
      label: "Form có kiểm tra",
      emailLabel: "Email đơn vị",
      emailValue: "kho@donvi",
      emailError: "Email chưa có đuôi tên miền",
      codeLabel: "Mã đơn vị",
      codeValue: "DV-024 · Hợp lệ",
    },
    tree: {
      label: "Cây thư mục",
      lines: ["▾ sổ-bếp/", "· nx-lttp.xlsx", "· chữ-ký/", "· thu-kho.png", "▸ chứng-từ/"],
    },
    funnel: {
      label: "Phễu xử lý",
      steps: ["Phiếu 240", "Đã xuất 187", "Đối chiếu 125", "Khóa sổ 74"],
    },
    heat: { label: "Mật độ việc" },
    invoice: {
      label: "Phiếu xuất",
      title: "Phiếu xuất #1842",
      rows: [
        { name: "Gạo tẻ", qty: "42 kg" },
        { name: "Thịt heo", qty: "18 kg" },
      ],
      totalLabel: "Tổng",
      totalValue: "2.4M",
    },
    notify: {
      label: "Thông báo",
      items: [
        { t: "Phiếu #1842 chờ ký", m: "2 phút" },
        { t: "Đồng bộ Drive xong", m: "1 giờ" },
        { t: "Drive còn 14%", m: "Hôm nay" },
      ],
    },
    scope: {
      label: "Phạm vi đơn vị",
      leftName: "Một đơn vị",
      leftValue: "1",
      leftNote: "Sổ và phiếu",
      rightName: "Nhiều đơn vị",
      rightValue: "N",
      rightNote: "Offline · Drive · NCC",
    },
    signin: {
      label: "Đăng nhập",
      title: "Đăng nhập",
      hint: "Mật khẩu hoặc Zalo",
    },
  },
  tech: {
    title: "Công nghệ đang dùng",
    intro: "Các thẻ bên dưới là công nghệ Quân lương đang chạy.",
    listAria: "Công nghệ",
    blocks: [
      {
        key: "frontend",
        title: "Frontend",
        tags: ["React", "Next.js", "Tailwind CSS", "TanStack Query", "Zustand"],
        body: "React vẽ giao diện trên trình duyệt. Next.js App Router tách phần render trên server (khung trang, metadata) và phần chạy trên client (form, trạng thái). Tailwind CSS đặt màu, chữ và theme sáng/tối. Zustand giữ phiên đăng nhập và quyền trên máy. TanStack Query gọi API và lưu bộ nhớ đệm phản hồi để mở lại khi mất mạng.",
      },
      {
        key: "backend",
        title: "Backend",
        tags: ["Node.js", "Express", "Prisma", "MariaDB", "Redis", "Socket.io", "BullMQ"],
        body: "API viết bằng Node.js và Express. Prisma giữ schema, migration và câu truy vấn cho MariaDB. Redis lưu phiên đăng nhập, bộ đếm giới hạn tần suất, và kết nối hàng đợi. BullMQ là hàng đợi tác vụ nền: gửi email xác minh, xử lý ảnh đại diện và ghi nhật ký kiểm tra (audit log), tách khỏi request người dùng đang chờ. Socket.io đẩy tin nhắn chat theo thời gian thực.",
      },
      {
        key: "delivery",
        title: "Triển khai",
        tags: ["Docker", "Python", "PWA"],
        body: "Docker đóng gói ứng dụng, MariaDB, Redis và worker để máy dev và production khởi động giống nhau. Python xuất Excel và PDF, gồm phiếu gắn ảnh chữ ký. PWA cài web app từ trình duyệt và lưu file tĩnh để mở khi mạng chậm. Phiếu ghi lúc mất mạng được giữ trên trình duyệt (IndexedDB), rồi đồng bộ khi có mạng.",
      },
    ],
    studioLead:
      "UI và API viết bằng JavaScript — chỉ file cấu hình Prisma là TypeScript. API dùng Express, không dùng NestJS.",
    studioTags: ["TypeScript", "NestJS"],
    studioAria: "Kỹ năng studio",
  },
  services: {
    title: "Ba dịch vụ",
    intro: "Mỗi dịch vụ cho một kết quả khác nhau.",
    items: [
      {
        key: "webapp",
        title: "Web app",
        lead: "Phần mềm trên trình duyệt để nhiều người cùng làm một quy trình.",
        detail:
          "Gồm đăng nhập, phân quyền theo vai trò (RBAC), đồng bộ dữ liệu, và offline-first cho nghiệp vụ cần ghi khi mất mạng. Quân lương là web app loại này.",
      },
      {
        key: "website",
        title: "Website",
        lead: "Trang công khai để giới thiệu hoặc tra cứu.",
        detail:
          "Next.js trả HTML kèm title và mô tả từng trang. Giao diện có theme sáng và tối. Chuyển động chỉ chạy khi giúp người xem thấy nội dung, và dừng nếu máy tắt hiệu ứng.",
      },
      {
        key: "firmware",
        title: "Firmware",
        lead: "Phần mềm gắn trên thiết bị, chạy không cần trình duyệt.",
        detail:
          "Mục tiêu là bật lên ổn định và kiểm được trên máy thật. Khi cần, thiết bị đồng bộ dữ liệu với web app qua API.",
      },
    ],
  },
  about: {
    title: "Về chúng tôi",
    body: "Midnight làm web app, website và firmware. API giữ một định dạng dữ liệu ổn định, giao diện chạy ở theme sáng và tối, và phần mềm được đưa lên môi trường thật. Quân lương — quản lý quân nhu, sổ sách và phân quyền — là một sản phẩm đang vận hành.",
  },
  contact: {
    title: "Liên hệ",
    hint: "Chọn một kênh bên dưới.",
    labels: {
      phone: "Điện thoại",
      zalo: "Zalo",
      facebook: "Facebook",
      gmail: "Gmail",
    },
  },
};

const en = {
  meta: {
    title: "Midnight",
    description:
      "Midnight builds web apps, websites, and firmware. Quân lương is a live military-supply web app with role-based access (RBAC), ledgers, and data sync.",
  },
  loading: "Loading…",
  nav: {
    homeAria: "Midnight — home",
    navAria: "Page navigation",
    login: "Log in",
    register: "Sign up",
    langAria: "Language",
    langVi: "Tiếng Việt",
    langEn: "English",
  },
  theme: {
    mode: "Mode",
    light: "Light",
    dark: "Dark",
    accent: "Accent",
    contrast: "High contrast",
    trigger: "Appearance",
    accentNames: {
      teal: "Teal",
      blue: "Blue",
      green: "Green",
      olive: "Olive",
      rose: "Rose",
      amber: "Amber",
    },
  },
  hero: {
    lead: "Midnight builds web apps, websites, and firmware.",
    support:
      "Quân lương — our military-supply web app, in production — has sign-in, role-based access (RBAC), and data sync.",
    login: "Log in",
    samples: "See interface samples",
  },
  strip: {
    title: "Interface samples",
    intro: "The tiles below are sample screens: commands, permissions, slips, and charts.",
  },
  marquee: {
    aria: "Business interface samples",
    cmdk: {
      label: "Command palette",
      placeholder: "Find a command or page…",
      rows: [
        { k: "↵", t: "Open the LTTP ledger", hot: true },
        { k: "G", t: "Open an issue slip" },
        { k: "P", t: "Profile · Google Drive" },
      ],
    },
    kanban: {
      label: "Kanban board",
      columns: [
        { col: "Doing", cards: ["Issue slip · A", "Price check"] },
        { col: "Review", cards: ["Digital signature"] },
      ],
    },
    matrix: {
      label: "Permission matrix",
      roleHeader: "Role",
      perms: ["View", "Edit", "Approve"],
      rows: [
        { r: "Storekeeper", c: [1, 1, 0] },
        { r: "Commander", c: [1, 0, 1] },
        { r: "Supplier", c: [1, 0, 0] },
      ],
    },
    chat: {
      label: "Support chat",
      incoming: "Is this week's LTTP order locked?",
      outgoing: "Locked at 14:20. You can still view the slip.",
      placeholder: "Write a message…",
      send: "Send",
    },
    wizard: {
      label: "Steps",
      steps: ["Choose", "Sign", "Export"],
      currentTitle: "Step 2 · Signature",
      currentBody: "Storekeeper signed. Waiting for the commander.",
    },
    analytics: { label: "Chart", caption: "Issues · 7 days" },
    calendar: {
      label: "Week schedule",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      events: { 1: "Issue", 2: "Meet", 4: "Check" },
    },
    form: {
      label: "Validated form",
      emailLabel: "Unit email",
      emailValue: "kho@donvi",
      emailError: "Email is missing a domain",
      codeLabel: "Unit code",
      codeValue: "DV-024 · Valid",
    },
    tree: {
      label: "File tree",
      lines: ["▾ sổ-bếp/", "· nx-lttp.xlsx", "· chữ-ký/", "· thu-kho.png", "▸ chứng-từ/"],
    },
    funnel: {
      label: "Pipeline",
      steps: ["Slips 240", "Issued 187", "Checked 125", "Closed 74"],
    },
    heat: { label: "Activity" },
    invoice: {
      label: "Issue slip",
      title: "Issue slip #1842",
      rows: [
        { name: "Rice", qty: "42 kg" },
        { name: "Pork", qty: "18 kg" },
      ],
      totalLabel: "Total",
      totalValue: "2.4M",
    },
    notify: {
      label: "Alerts",
      items: [
        { t: "Slip #1842 needs a signature", m: "2 min" },
        { t: "Drive sync finished", m: "1 hr" },
        { t: "Drive space left: 14%", m: "Today" },
      ],
    },
    scope: {
      label: "Unit scope",
      leftName: "One unit",
      leftValue: "1",
      leftNote: "Ledger and slips",
      rightName: "Many units",
      rightValue: "N",
      rightNote: "Offline · Drive · supplier",
    },
    signin: {
      label: "Sign in",
      title: "Sign in",
      hint: "Password or Zalo",
    },
  },
  tech: {
    title: "Technology in use",
    intro: "The tags below are what Quân lương runs today.",
    listAria: "Technology",
    blocks: [
      {
        key: "frontend",
        title: "Frontend",
        tags: ["React", "Next.js", "Tailwind CSS", "TanStack Query", "Zustand"],
        body: "React draws the interface in the browser. The Next.js App Router splits each page into server-rendered parts (shell, metadata) and client parts (forms, state). Tailwind CSS sets color, type, and the light and dark themes. Zustand stores the session and permissions on the device. TanStack Query calls the API and keeps a response cache so screens can reopen offline.",
      },
      {
        key: "backend",
        title: "Backend",
        tags: ["Node.js", "Express", "Prisma", "MariaDB", "Redis", "Socket.io", "BullMQ"],
        body: "The API is Node.js and Express. Prisma owns the MariaDB schema, migrations, and queries. Redis stores login sessions, rate-limit counters, and the queue connection. BullMQ is the background job queue: verification email, avatar processing, and the audit log, off the request the user is waiting on. Socket.io delivers chat messages in real time.",
      },
      {
        key: "delivery",
        title: "Shipping",
        tags: ["Docker", "Python", "PWA"],
        body: "Docker packages the app, MariaDB, Redis, and workers so dev and production start the same way. Python exports Excel and PDF, including slips stamped with a signature image. The PWA installs the web app from the browser and caches static files for slow networks. Slips written offline stay in the browser (IndexedDB) and sync when the network returns.",
      },
    ],
    studioLead:
      "The UI and API are JavaScript — only the Prisma config file is TypeScript. The API uses Express, not NestJS.",
    studioTags: ["TypeScript", "NestJS"],
    studioAria: "Studio skills",
  },
  services: {
    title: "Three services",
    intro: "Each service delivers a different result.",
    items: [
      {
        key: "webapp",
        title: "Web app",
        lead: "Browser software for several people sharing one workflow.",
        detail:
          "Sign-in, role-based access (RBAC), data sync, and offline-first entry when a task must be saved without a network. Quân lương is this kind of web app.",
      },
      {
        key: "website",
        title: "Website",
        lead: "A public site for an introduction or for lookup.",
        detail:
          "Next.js serves HTML with a title and description on each page. The interface has light and dark themes. Motion runs only when it helps people notice content, and it stops if the device asks for reduced motion.",
      },
      {
        key: "firmware",
        title: "Firmware",
        lead: "Software stored on a device, running without a browser.",
        detail:
          "The goal is a stable boot and behavior you can check on real hardware. When a product needs it, the device syncs data with the web app through an API.",
      },
    ],
  },
  about: {
    title: "About",
    body: "Midnight builds web apps, websites, and firmware. API data shapes stay stable, the interface works in light and dark themes, and the software runs in a real environment. Quân lương — military-supply management, ledgers, and access control — is one product in production.",
  },
  contact: {
    title: "Contact",
    hint: "Pick a channel below.",
    labels: {
      phone: "Phone",
      zalo: "Zalo",
      facebook: "Facebook",
      gmail: "Gmail",
    },
  },
};

export const MIDNIGHT_COPY = { vi, en };

/** Vietnamese about text kept for callers that import MIDNIGHT_ABOUT. */
export const MIDNIGHT_ABOUT_VI = vi.about.body;

/** @param {unknown} locale */
export function getMidnightCopy(locale) {
  return MIDNIGHT_COPY[normalizeMidnightLocale(locale)];
}

/** @param {unknown} locale */
export function midnightLandingMeta(locale) {
  const lang = normalizeMidnightLocale(locale);
  const copy = getMidnightCopy(lang);
  return {
    title: copy.meta.title,
    description: copy.meta.description,
    ogLocale: lang === "en" ? "en_US" : "vi_VN",
    documentTitle: `${QUANLUONG_SITE_NAME} - ${copy.meta.title}`,
  };
}
