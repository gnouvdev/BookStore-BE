const policyData = {
  lastUpdated: "15 tháng 12, 2024",
  terms: {
    intro:
      "Khi sử dụng WebBookStore bạn đồng ý tuân thủ toàn bộ điều khoản bên dưới.",
    userDuties: [
      "Cung cấp thông tin đăng ký chính xác và cập nhật liên tục.",
      "Giữ bí mật thông tin đăng nhập và chịu trách nhiệm cho mọi hoạt động trong tài khoản.",
      "Sử dụng dịch vụ đúng pháp luật và không xâm phạm quyền lợi bên thứ ba.",
      "Không dùng nền tảng cho mục đích bất hợp pháp hoặc gây hại.",
    ],
    payment: [
      "Tất cả giá hiển thị bằng VND và đã bao gồm VAT.",
      "Đơn hàng chỉ xác nhận sau khi thanh toán thành công.",
      "Cửa hàng có quyền từ chối hoặc hủy các đơn bất thường.",
      "Khách có thể hủy đơn trong vòng 24 giờ sau khi đặt.",
    ],
    shipping:
      "Giao hàng dự kiến 1–7 ngày làm việc tùy địa điểm. Khách cần cung cấp địa chỉ chính xác và có mặt để nhận.",
  },
  privacy: {
    collection: {
      personal: [
        "Họ tên, email, số điện thoại.",
        "Địa chỉ giao hàng.",
        "Thông tin thanh toán.",
      ],
      technical: [
        "Địa chỉ IP, trình duyệt.",
        "Cookies và session.",
        "Lịch sử truy cập.",
      ],
    },
    usage: [
      "Xử lý đơn và chăm sóc khách hàng.",
      "Gửi thông báo về đơn hàng, cập nhật dịch vụ.",
      "Cải thiện trải nghiệm người dùng, phát triển sản phẩm.",
      "Tuân thủ yêu cầu pháp lý và bảo mật.",
    ],
    security: [
      "Mã hóa SSL/TLS cho truyền tải dữ liệu.",
      "Firewall nhiều lớp và phân quyền truy cập.",
      "Kiểm tra bảo mật định kỳ để phát hiện rủi ro.",
    ],
  },
  cookies: {
    purpose:
      "Cookies giúp ghi nhớ tùy chọn và cá nhân hóa nội dung mỗi lần bạn truy cập.",
    types: [
      { name: "Essential", note: "Bắt buộc cho chức năng cơ bản." },
      { name: "Analytics", note: "Hiểu cách bạn sử dụng website (tùy chọn)." },
      {
        name: "Functional",
        note: "Ghi nhớ cài đặt và trải nghiệm (tùy chọn).",
      },
      { name: "Marketing", note: "Hiển thị ưu đãi phù hợp (tùy chọn)." },
    ],
    controls: [
      "Thay đổi cài đặt trình duyệt để chặn hoặc xóa cookies.",
      "Dùng chế độ duyệt web riêng tư/ẩn danh.",
      "Tùy chỉnh đồng ý cookies trực tiếp trên website.",
    ],
  },
  refund: {
    accepted: [
      "Sản phẩm lỗi từ nhà sản xuất.",
      "Giao sai sản phẩm.",
      "Sản phẩm hư hại do vận chuyển.",
      "Không hài lòng trong vòng 30 ngày kể từ khi nhận.",
    ],
    rejected: [
      "Sản phẩm đã qua sử dụng.",
      "Quá 30 ngày kể từ ngày mua.",
      "Không có hóa đơn hoặc chứng từ hợp lệ.",
      "Hàng khuyến mãi hoặc sản phẩm đặc biệt.",
    ],
    steps: [
      "Liên hệ qua email/hotline để gửi yêu cầu.",
      "Cửa hàng xác nhận và hướng dẫn chi tiết.",
      "Khách gửi sản phẩm về kho.",
      "Hoàn tiền trong 5–7 ngày làm việc sau khi kiểm tra.",
    ],
    sla: {
      response: "Phản hồi yêu cầu trong 24 giờ.",
      inspection: "Kiểm tra sản phẩm 3–5 ngày.",
      refund: "Hoàn tiền 5–7 ngày.",
    },
  },
  contact: {
    email: "support@company.com",
    hotline: "1900 1234",
    address: "123 Đường ABC, TP.HCM",
  },
};

module.exports = policyData;
