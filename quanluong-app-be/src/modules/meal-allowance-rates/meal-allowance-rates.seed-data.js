/**
 * Dữ liệu khởi tạo theo thongtu96.txt (Phụ lục I / II).
 * Chạy một lần qua `npm run seed:meal-allowance` sau migrate (chỉ thêm khi bảng trống).
 */
const MEAL_ALLOWANCE_INITIAL_ROWS = [
  {
    type: "an_tieu_chuan",
    sortOrder: 10,
    doiTuong: "A — Mức tiền ăn cơ bản bộ binh — Hạ sĩ quan, binh sĩ bộ binh",
    mucTienAn: 72_000,
  },
  {
    type: "an_tieu_chuan",
    sortOrder: 20,
    doiTuong:
      "B — Mức 1 — Học viên phi công quân sự; Học viên dự khóa bay; Học viên tàu ngầm quân sự; Đặc công người nhái; Lực lượng chuyên trách phòng chống khủng bố của đặc công người nhái.",
    mucTienAn: 187_000,
  },
  {
    type: "an_tieu_chuan",
    sortOrder: 30,
    doiTuong:
      "B — Mức 2 — Tàu chiến đấu, tàu kiểm ngư, tàu đặc nhiệm đi biển; Lực lượng chuyên trách phòng chống khủng bố của đặc công nước.",
    mucTienAn: 173_000,
  },
  {
    type: "an_tieu_chuan",
    sortOrder: 40,
    doiTuong:
      "B — Mức 3 — Đặc công nước; Giáo viên dạy nhảy dù; Tàu bổ trợ đi biển; Lực lượng chuyên trách phòng chống khủng bố (trừ đặc công người nhái, đặc công nước); Trinh sát chống bạo loạn - khủng bố; Trinh sát bắn tỉa thuộc Tổng cục II.",
    mucTienAn: 158_000,
  },
  {
    type: "an_tieu_chuan",
    sortOrder: 50,
    doiTuong: "B — Mức 4 — Đặc công biệt động; Xuồng đi biển; Đặc công đổ bộ đường không.",
    mucTienAn: 144_000,
  },
  {
    type: "an_tieu_chuan",
    sortOrder: 60,
    doiTuong:
      "B — Mức 5 — Đặc công bộ; Trinh sát đặc nhiệm; Bộ đội nhảy dù; Cơ vụ sân bay; Hải quân đánh bộ; Hải quân đánh bộ cơ giới; Điệp báo trinh sát đặc nhiệm; Trinh sát luồn sâu; Trinh sát ngoại tuyến; Công binh công trình đường hầm; Tàu chiến đấu, tàu kiểm ngư, tàu đặc nhiệm ở cảng.",
    mucTienAn: 130_000,
  },
  {
    type: "an_tieu_chuan",
    sortOrder: 70,
    doiTuong:
      "B — Mức 6 — Tiêu binh; Gác Lăng, vận hành Lăng Chủ tịch Hồ Chí Minh; Quân nhạc; Bộ đội danh dự; Điệp báo; Trinh sát vũ trụ; Xe tăng bánh xích; Pháo tự hành; Pháo ZCY 23; Tên lửa A89, S300; Tên lửa đất đối hải; Tên lửa Spyder; Công binh xây dựng công trình chiến đấu, vật cản; Công binh sở chỉ huy - trận địa; Công binh dò tìm, xử lý bom mìn; Công binh vượt sông; Công binh sân bay; Cứu hỏa sân bay; Tàu bổ trợ ở cảng.",
    mucTienAn: 119_000,
  },
  {
    type: "an_tieu_chuan",
    sortOrder: 80,
    doiTuong:
      "B — Mức 7 — Ra đa; Tác chiến điện tử; Tên lửa đất đối đất; Tên lửa đất đối không (C75-M, C125-M); Pháo phòng không 37 ly, 57 ly; Tên lửa A72, A87, Igla; Pháo binh mặt đất từ 76,2 ly trở lên; Súng cối 82 ly; Súng cối 100 ly; Súng chống tăng SPG-9; Súng DKZ 75; Súng máy phòng không 12,7 ly; Tên lửa chống tăng B72, B87; Biên phòng, đoàn kinh tế quốc phòng có phụ cấp khu vực ≥ 0,5; Trinh sát ngoại biên phòng chống ma túy; Huấn luyện chó nghiệp vụ; Thiết giáp bánh lốp; Công binh bánh xích; Trinh sát phóng xạ, CBRN; Trinh sát kỹ thuật, cơ giới, bộ đội; Cảnh sát biển, lực lượng phòng chống tội phạm ma túy; Xuồng ở cảng; Lực lượng tác chiến không gian mạng.",
    mucTienAn: 109_000,
  },
  {
    type: "an_tieu_chuan",
    sortOrder: 90,
    doiTuong:
      "B — Mức 8 — Lực lượng vận tải đường sông; Công binh cầu đường; Công binh ngụy trang; Công binh bảo quản công trình ATK; Thông tin tiếp sức đối lưu; Thông tin VIBA, VISAT; Thông tin truyền dẫn, cáp quang; Thông tin cơ động; Bảo đảm kỹ thuật an toàn thông tin mạng; Biên phòng khu vực phụ cấp 0,1 - 0,4; Đóng quân tuyến biên giới Tây Nam; Đoàn kinh tế quốc phòng phụ cấp 0,1 - 0,4; Học viên đào tạo sĩ quan; Kiểm soát quân sự chuyên nghiệp; Văn công.",
    mucTienAn: 101_000,
  },
  {
    type: "an_tieu_chuan",
    sortOrder: 100,
    doiTuong:
      "C — Mức tiền ăn bệnh nhân — Bệnh viện trong và ngoài Quân đội; Đội điều trị; Bệnh xá; Đại đội, Tiểu đoàn quân y.",
    mucTienAn: 126_000,
  },
  {
    type: "an_them",
    sortOrder: 10,
    doiTuong: "D — I — Mức 1 — Làm nhiệm vụ chiến đấu; Làm nhiệm vụ A2.",
    mucTienAn: 122_000,
  },
  {
    type: "an_them",
    sortOrder: 20,
    doiTuong: "D — I — Mức 2 — Trực sở chỉ huy Bộ Quốc phòng ban đêm từ 04 giờ trở lên.",
    mucTienAn: 94_000,
  },
  {
    type: "an_them",
    sortOrder: 30,
    doiTuong:
      "D — I — Mức 3 — Diễn tập; Khắc phục hậu quả thiên tai, thảm họa; Trực ban đêm cấp Bộ Quốc phòng; Trinh sát ngoại biên; Phòng chống ma túy; Lực lượng vận chuyển quân sự đặc biệt.",
    mucTienAn: 72_000,
  },
  {
    type: "an_them",
    sortOrder: 40,
    doiTuong:
      "D — I — Mức 4 — Bộ đội danh dự khi làm nhiệm vụ; Huấn luyện ban đêm lực lượng chống khủng bố; Trực sẵn sàng chiến đấu tăng cường.",
    mucTienAn: 65_000,
  },
  {
    type: "an_them",
    sortOrder: 50,
    doiTuong:
      "D — I — Mức 5 — Trực đêm từ 02h - dưới 04h; Nhiệm vụ tuần tra biên giới; Phục vụ nhảy dù; Phục vụ bay; Khẩu phần đảo có phụ cấp ≥ 0,4 (trừ Trường Sa, Nhà giàn DK).",
    mucTienAn: 51_000,
  },
  {
    type: "an_them",
    sortOrder: 60,
    doiTuong:
      "D — I — Mức 6 — Trực đêm từ 02h - dưới 04h cấp đơn vị; Huấn luyện đêm đặc công; Trinh sát luồn sâu, ngoại tuyến; Khẩu phần phụ đi biển; Khẩu phần đảo phụ cấp < 0,4.",
    mucTienAn: 36_000,
  },
  {
    type: "an_them",
    sortOrder: 70,
    doiTuong:
      "D — II — Ốm đau điều trị tại tổ quân y có giường lưu; ốm tại trại.",
    mucTienAn: 22_000,
  },
  {
    type: "an_them",
    sortOrder: 80,
    doiTuong:
      "Học viên quân sự Lào và Campuchia — Mức 1 — Học viên nguồn kế thừa; học viên trung cấp; học viên học tiếng Việt để vào trung cấp và tương đương.",
    mucTienAn: 91_000,
  },
  {
    type: "an_them",
    sortOrder: 90,
    doiTuong:
      "Học viên quân sự Lào và Campuchia — Mức 2 — Học viên đại học, sau đại học; học viên học tiếng Việt để vào đại học, sau đại học và tương đương.",
    mucTienAn: 101_000,
  },
  {
    type: "an_them",
    sortOrder: 100,
    doiTuong:
      "Học viên quân sự Lào và Campuchia — Mức 3 — Học viên học tập, tập huấn, bồi dưỡng ngắn hạn dưới 12 tháng.",
    mucTienAn: 116_000,
  },
  {
    type: "an_them",
    sortOrder: 110,
    doiTuong:
      "Học viên quân sự Lào và Campuchia — Mức 4 — Học viên cao cấp học tập, tập huấn, bồi dưỡng ngắn hạn dưới 12 tháng; tại Học viện Quốc phòng và Học viện Chính trị.",
    mucTienAn: 161_000,
  },
  {
    type: "an_them",
    sortOrder: 120,
    doiTuong:
      "Học viên quân sự quốc tế (ngoài học viên quân sự Lào và Campuchia) — mức thường xuyên.",
    mucTienAn: 161_000,
  },
];

export { MEAL_ALLOWANCE_INITIAL_ROWS };
