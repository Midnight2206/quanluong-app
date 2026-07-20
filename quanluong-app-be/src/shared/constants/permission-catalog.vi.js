/**
 * Bản dịch hiển thị (tiếng Việt) cho Permission — nguồn chuẩn khi đồng bộ DB.
 * Khi thêm route có `permission` mới: bổ sung entry tại đây (xem skill permission-vi-catalog).
 */
const PERMISSION_CATALOG_VI = {
  "users.read": {
    name: "Xem danh sách người dùng",
    description:
      "Xem danh sách tài khoản người dùng và thông tin tóm tắt trong phạm vi đơn vị bạn được phép quản lý.",
  },
  "users.detail": {
    name: "Xem chi tiết người dùng",
    description:
      "Xem chi tiết một người dùng: hồ sơ, đơn vị, chức danh và quyền hiệu lực (trong phạm vi được phép).",
  },
  "users.create": {
    name: "Tạo người dùng",
    description:
      "Tạo tài khoản người dùng mới và hồ sơ đi kèm trong đơn vị được phép.",
  },
  "users.patch": {
    name: "Cập nhật một phần người dùng",
    description:
      "Sửa từng phần thông tin tài khoản hoặc hồ sơ người dùng (không thay thế toàn bộ bản ghi).",
  },
  "users.put": {
    name: "Thay thế toàn bộ người dùng",
    description:
      "Thay thế toàn bộ dữ liệu tài khoản và hồ sơ cho một người dùng (PUT đầy đủ).",
  },
  "users.delete": {
    name: "Xóa mềm người dùng",
    description:
      "Đánh dấu ngừng sử dụng tài khoản (xóa mềm), không xóa vật lý khỏi hệ thống.",
  },
  "units.read": {
    name: "Xem cây đơn vị",
    description:
      "Xem danh sách và cấu trúc đơn vị tổ chức trong phạm vi được phép (theo nhánh đơn vị).",
  },
  "units.detail": {
    name: "Xem chi tiết đơn vị",
    description:
      "Xem một đơn vị cụ thể kèm số liệu liên quan (path, cấp, số user con, số đơn vị con…).",
  },
  "units.create": {
    name: "Tạo đơn vị",
    description:
      "Thêm đơn vị mới vào cây tổ chức: chọn đơn vị cha (hoặc gốc nếu được phép).",
  },
  "units.patch": {
    name: "Cập nhật đơn vị",
    description:
      "Sửa tên, mô tả, đơn vị cha hoặc trạng thái hoạt động của một đơn vị.",
  },
  "units.delete": {
    name: "Ngưng hoạt động đơn vị",
    description:
      "Ngưng hoạt động một đơn vị khi không còn người dùng gán và không còn đơn vị con.",
  },
  "units.privateDataShare.manage": {
    name: "Chia sẻ quyền đọc dữ liệu private",
    description:
      "Gán cho đơn vị cấp dưới được đọc dữ liệu private (mặt hàng LTTP, bảng giá, chức danh…) lưu tại đơn vị mình — theo bảng UnitPrivateDataShareGrant.",
  },
  "registrations.read": {
    name: "Xem đăng ký chờ duyệt",
    description:
      "Xem danh sách tài khoản đăng ký đang chờ phê duyệt trong phạm vi đơn vị.",
  },
  "registrations.review": {
    name: "Duyệt / từ chối đăng ký",
    description:
      "Phê duyệt hoặc từ chối đăng ký người dùng mới trên nhánh đơn vị được phép.",
  },
  "jobTitles.read": {
    name: "Xem danh sách chức danh",
    description:
      "Xem các chức danh công việc trong phạm vi đơn vị (và nhánh con nếu có quyền).",
  },
  "jobTitles.detail": {
    name: "Xem chi tiết chức danh",
    description:
      "Xem chi tiết một chức danh, gồm bộ quyền gán cho chức danh đó.",
  },
  "jobTitles.create": {
    name: "Tạo chức danh",
    description:
      "Tạo chức danh mới gắn với một đơn vị cụ thể (trong phạm vi được phép).",
  },
  "jobTitles.patch": {
    name: "Sửa chức danh và phân quyền",
    description:
      "Cập nhật thông tin chức danh (tên, mô tả, trạng thái) và thay đổi bộ quyền gán cho chức danh (chỉ được gán quyền mà bạn cũng có).",
  },
  "jobTitles.delete": {
    name: "Ngưng chức danh",
    description:
      "Ngưng sử dụng một chức danh khi không còn người dùng nào đang được gán chức danh đó.",
  },
  "unitLevel.read": {
    name: "Xem mô tả cấp đơn vị",
    description:
      "Đọc nhãn và mô tả theo từng cấp độ sâu trong cây đơn vị (metadata cấp).",
  },
  "unitLevel.manage": {
    name: "Quản lý mô tả cấp đơn vị",
    description:
      "Cập nhật nhãn/mô tả hiển thị cho một cấp độ trong cây đơn vị (thường dành cho quản trị tổng).",
  },
  "unitLevelCaps.read": {
    name: "Xem trần quyền theo cấp",
    description:
      "Xem ma trận quyền tối đa được phép hiệu lực ở mỗi cấp độ đơn vị (theo depth).",
  },
  "unitLevelCaps.manage": {
    name: "Cấu hình trần quyền theo cấp",
    description:
      "Thiết lập tập quyền được phép giao ở từng cấp độ đơn vị (giới hạn theo nhánh).",
  },
  "permissions.read": {
    name: "Xem danh mục quyền",
    description:
      "Xem toàn bộ danh sách quyền hệ thống, mã quyền và mô tả hiển thị (catalog).",
  },
  "permissions.patch": {
    name: "Sửa mô tả quyền",
    description:
      "Chỉnh sửa văn bản mô tả hiển thị cho một quyền trong catalog (dùng chung cho toàn hệ thống).",
  },
  "lttp.commodities.read": {
    name: "Xem mặt hàng LTTP",
    description: "Xem danh mục mặt hàng lương thực thực phẩm theo đơn vị.",
  },
  "lttp.commodities.write": {
    name: "Quản lý mặt hàng LTTP",
    description: "Thêm, sửa, xóa (hoặc ngưng) mặt hàng lương thực thực phẩm trong đơn vị.",
  },
  "lttp.prices.read": {
    name: "Xem bảng giá LTTP",
    description:
      "Xem phiên bản bảng giá theo ngày áp dụng và giá hiệu lực (theo ngày chọn hoặc ngày gần nhất trước đó).",
  },
  "lttp.prices.write": {
    name: "Cập nhật & nhập bảng giá LTTP",
    description:
      "Tạo hoặc sửa phiên bản bảng giá có ngày áp dụng, xóa phiên bản, nhập từ Excel.",
  },
  "lttp.groups.read": {
    name: "Xem nhóm mặt hàng LTTP",
    description: "Xem danh mục nhóm lương thực thực phẩm dùng chung (chọn khi khai báo mặt hàng).",
  },
  "lttp.groups.manage": {
    name: "Quản lý nhóm mặt hàng LTTP",
    description: "Thêm, sửa, ngưng dùng nhóm LTTP toàn hệ thống (chỉ superadmin).",
  },
  "lttp.issue-slips.read": {
    name: "Xem phiếu xuất LTTP",
    description:
      "Xem danh sách và chi tiết phiếu xuất lương thực thực phẩm theo ngày; tra mã mặt hàng cùng đơn giá tham chiếu theo bảng giá hiệu lực tại ngày; tổng hợp đặt hàng theo ngày từ các phiếu (trong phạm vi đơn vị dữ liệu và nhánh đơn vị).",
  },
  "lttp.issue-slips.write": {
    name: "Lập, sửa & xóa phiếu xuất LTTP",
    description:
      "Tạo, cập nhật (giữ ngày xuất và số phiếu) và xóa phiếu xuất theo đơn vị; mỗi thay đổi tự đồng bộ công nợ đối tác.",
  },
  "mealAllowanceRates.manage": {
    name: "Quản lý mức tiền ăn (Thông tư)",
    description:
      "Thêm, sửa, xóa bản ghi đối tượng và mức tiền ăn/ngày trong danh mục công khai (ăn tiêu chuẩn / ăn thêm). Chỉ superadmin được gọi API ghi.",
  },
  "mealRoster.access": {
    name: "Chấm cơm — danh sách bảo đảm & sổ chấm",
    description:
      "Danh sách bảo đảm theo tháng; cấu hình mức tiền ăn áp dụng (ăn tiêu chuẩn / ăn thêm); sổ chấm cơm theo ngày; tải mẫu và nhập Excel; sao chép tháng. Dữ liệu private theo đơn vị.",
  },
  "kitchenBooks.access": {
    name: "Sổ sách bếp ăn",
    description:
      "Danh mục món và thực đơn ngày theo buổi; tính số lượng LTTP từ quân số chấm cơm; dữ liệu theo kho LTTP của đơn vị.",
  },
};

function getPermissionVi(code) {
  if (!code) {
    return null;
  }
  return PERMISSION_CATALOG_VI[code] ?? null;
}

export { getPermissionVi, PERMISSION_CATALOG_VI };
