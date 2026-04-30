/** Title + mô tả cho `/dashboard/lttp/:lttpSub` (khớp tab AdminLttpPanel). */
export const DASHBOARD_LTTP_SUB_PAGE_META = {
  "food-groups": {
    title: "LTTP — Nhóm LTTP",
    description: "Danh mục nhóm lương thực thực phẩm dùng khi khai báo mặt hàng và bảng giá LTTP.",
  },
  commodities: {
    title: "LTTP — Mặt hàng",
    description: "Danh mục mặt hàng LTTP, mã, đơn vị tính và đối tác mặc định theo đơn vị.",
  },
  suppliers: {
    title: "LTTP — Đối tác cung cấp",
    description: "Danh sách đối tác cung cấp trên dòng phiếu và bảng giá LTTP.",
  },
  tables: {
    title: "LTTP — Lịch sử bảng giá",
    description: "Các phiên bản bảng giá đã lưu theo ngày hiệu lực.",
  },
  effective: {
    title: "LTTP — Giá theo ngày",
    description: "Tra đơn giá hiệu lực tại một ngày theo bảng giá LTTP.",
  },
  newtable: {
    title: "LTTP — Cập nhật bảng giá",
    description: "Tạo hoặc điều chỉnh bảng giá LTTP cho ngày áp dụng.",
  },
  import: {
    title: "LTTP — Nhập Excel bảng giá",
    description: "Nhập bảng giá LTTP hàng loạt tệp Excel.",
  },
};

/**
 * @param {string|string[]|undefined} rawSub
 */
export function getDashboardLttpSubPageMeta(rawSub) {
  const key = Array.isArray(rawSub) ? rawSub[0] : rawSub ?? "";
  return (
    DASHBOARD_LTTP_SUB_PAGE_META[key] ?? {
      title: "LTTP — Bảng giá",
      description: "Quản trị nhóm, mặt hàng và bảng giá lương thực thực phẩm trong bảng điều khiển.",
    }
  );
}
