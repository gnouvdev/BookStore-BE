const mongoose = require("mongoose");
const ragService = require("./rag.service");
const policyData = require("./policyData");
// Nếu sau này cần dùng trực tiếp Book/Category/Author thì giữ lại, còn không có thể xoá cho sạch
const Book = require("../books/book.model");
const Category = require("../categories/category.model");
const Author = require("../authors/author.model");
const Order = require("../orders/order.model");
const User = require("../users/user.model");
const Voucher = require("../../vouchers/voucher.model");
const Payment = require("../payments/payment.model");

class ChatbotService {
  constructor() {
    // Câu trả lời cho các tình huống đơn giản
    this.responses = {
      greeting: [
        "Xin chào! Tôi là chatbot AI hỗ trợ của cửa hàng sách. Tôi có thể gợi ý sách, tóm tắt nội dung, tư vấn theo sở thích đọc hoặc trả lời các câu hỏi về cửa hàng. Bạn cần hỗ trợ gì?",
        "Chào bạn! Tôi là chatbot AI, có thể hiểu ngữ cảnh và giúp bạn tìm những cuốn sách phù hợp. Bạn đang muốn tìm loại sách nào?",
        "Xin chào! Tôi sẵn sàng giúp bạn tìm sách hay hoặc giải đáp thắc mắc liên quan đến đọc sách, đơn hàng, và cửa hàng. Bạn cần gì?",
      ],
      goodbye: [
        "Cảm ơn bạn đã sử dụng dịch vụ! Chúc bạn một ngày tốt lành!",
        "Hẹn gặp lại bạn! Nếu cần hỗ trợ thêm, cứ quay lại nhé!",
        "Tạm biệt! Chúc bạn tìm được những cuốn sách hay!",
      ],
    };

    // Quản lý trạng thái hội thoại đặt hàng (in-memory, keyed by userId)
    this.orderConversations = new Map();

    // Timeout để xóa conversation state sau 30 phút không hoạt động
    this.conversationTimeouts = new Map();

    // Lưu context sách vừa được hiển thị cho mỗi user (để xử lý "đặt nó", "đặt quyển này")
    this.recentBooksContext = new Map();
  }

  // Phát hiện các tình huống đơn giản (chào / tạm biệt)
  isSimpleIntent(message) {
    const lowerMessage = message.toLowerCase().trim();
    const greetings = [
      "xin chào",
      "chào",
      "hello",
      "hi",
      "hey",
      "chào bạn",
      "chào bot",
    ];
    const goodbyes = ["tạm biệt", "bye", "goodbye", "hẹn gặp lại", "cảm ơn"];

    // Coi là greeting nếu câu ngắn và không mô tả sách
    const isShortMessage = message.length < 30;
    const hasBookDescription =
      /(sách|truyện|tiểu thuyết|muốn|thích|tìm|gợi ý|đề xuất)/i.test(message);

    if (greetings.some((g) => lowerMessage.includes(g))) {
      if (hasBookDescription) {
        // Câu kiểu: "chào bot, gợi ý giúp mình vài cuốn sách" -> không coi là greeting đơn thuần
        return null;
      }
      if (isShortMessage) {
        return "greeting";
      }
    }

    if (goodbyes.some((g) => lowerMessage.includes(g))) {
      return "goodbye";
    }

    return null;
  }

  // Nhận diện câu hỏi thuộc "domain sách" hay là hỏi linh tinh / support / small talk
  isBookDomainMessage(message) {
    const lower = message.toLowerCase();

    const bookKeywords = [
      "sách",
      "truyện",
      "tiểu thuyết",
      "ebook",
      "book",
      "tác giả",
      "thể loại",
      "đọc gì",
      "nên đọc",
      "gợi ý sách",
      "review sách",
      "giới thiệu sách",
      "trinh thám",
      "kinh doanh",
      "phát triển bản thân",
      "light novel",
      "manga",
      "comic",
    ];

    return bookKeywords.some((kw) => lower.includes(kw));
  }

  // Phát hiện intent đặt hàng
  isOrderIntent(message) {
    const lower = message.toLowerCase();
    const orderKeywords = [
      "đặt hàng",
      "mua hàng",
      "order",
      "muốn mua",
      "muốn đặt",
      "cho tôi đặt",
      "tôi muốn đặt",
      "đặt mua",
      "mua sách",
      "đặt sách",
      "cho tôi mua",
      "tôi muốn mua",
      "đặt nó",
      "đặt quyển này",
      "đặt cuốn này",
      "mua nó",
      "mua quyển này",
      "mua cuốn này",
    ];
    return orderKeywords.some((kw) => lower.includes(kw));
  }

  // Kiểm tra xem message có chứa tên sách và có thể là intent đặt hàng không
  async hasBookInMessage(message) {
    const books = await this.findBooksInMessage(message, true);
    return books.length > 0;
  }

  // Kiểm tra xem có phải là câu hỏi về sách cụ thể (có tên sách) hay thể loại/mô tả
  isSpecificBookQuery(message) {
    const lower = message.toLowerCase();

    // Các từ khóa chỉ thể loại/mô tả (không phải tên sách cụ thể)
    const genreKeywords = [
      "thể loại",
      "genre",
      "loại sách",
      "sách về",
      "sách liên quan",
      "gợi ý",
      "đề xuất",
      "recommend",
      "suggest",
      "tìm sách",
      "sách như thế nào",
      "sách nào",
      "những sách",
      "các sách",
      "danh sách",
    ];

    // Nếu có từ khóa thể loại -> không phải sách cụ thể
    if (genreKeywords.some((kw) => lower.includes(kw))) {
      return false;
    }

    // Nếu có từ "có" + tên sách -> có thể là hỏi về sách cụ thể
    // Pattern: "có sách [tên]" hoặc "có [tên]" hoặc chỉ có tên sách
    const hasBookNamePattern =
      /(có|tìm|sách|cuốn|quyển)\s+([a-zà-ỹ]{2,})/i.test(message);

    // Nếu message ngắn và có vẻ là tên sách cụ thể (không có từ khóa thể loại)
    const isShortAndSpecific =
      message.length < 50 && !genreKeywords.some((kw) => lower.includes(kw));

    return hasBookNamePattern || isShortAndSpecific;
  }

  // Lấy hoặc tạo conversation state
  getConversationState(userId) {
    if (!userId) return null;

    if (!this.orderConversations.has(userId)) {
      this.orderConversations.set(userId, {
        step: "idle", // idle, collecting_items, checking_profile, asking_voucher, selecting_payment, confirming
        items: [],
        profileData: {},
        voucherCode: null,
        selectedVoucher: null,
        paymentMethod: null,
        totalPrice: 0,
        discount: 0,
        finalPrice: 0,
        createdAt: new Date(),
      });
    }

    // Reset timeout
    this.resetConversationTimeout(userId);

    return this.orderConversations.get(userId);
  }

  // Lưu context sách vừa được hiển thị
  saveRecentBooksContext(userId, books) {
    if (!userId || !books || books.length === 0) return;
    this.recentBooksContext.set(userId, {
      books: books,
      timestamp: new Date(),
    });
  }

  // Lấy context sách vừa được hiển thị
  getRecentBooksContext(userId) {
    if (!userId) return null;
    const context = this.recentBooksContext.get(userId);
    // Chỉ trả về context nếu còn mới (trong vòng 5 phút)
    if (context && new Date() - context.timestamp < 5 * 60 * 1000) {
      return context.books;
    }
    return null;
  }

  // Reset timeout cho conversation
  resetConversationTimeout(userId) {
    if (this.conversationTimeouts.has(userId)) {
      clearTimeout(this.conversationTimeouts.get(userId));
    }

    const timeout = setTimeout(() => {
      this.orderConversations.delete(userId);
      this.conversationTimeouts.delete(userId);
    }, 30 * 60 * 1000); // 30 phút

    this.conversationTimeouts.set(userId, timeout);
  }

  // Xóa conversation state
  clearConversationState(userId) {
    this.orderConversations.delete(userId);
    if (this.conversationTimeouts.has(userId)) {
      clearTimeout(this.conversationTimeouts.get(userId));
      this.conversationTimeouts.delete(userId);
    }
  }

  // ==== Order Flow Handlers ====
  async handleOrderFlow(message, userId) {
    const state = this.getConversationState(userId);
    if (!state) {
      return {
        text: "Xin lỗi, bạn cần đăng nhập để đặt hàng.",
        books: [],
        hasBooks: false,
      };
    }

    const lowerMessage = message.toLowerCase().trim();

    // Nếu đang trong flow đặt hàng, xử lý theo step hiện tại
    if (state.step !== "idle") {
      return await this.processOrderStep(message, state, userId);
    }

    // Bắt đầu flow đặt hàng
    const hasOrderIntent = this.isOrderIntent(message);
    const hasBook = await this.hasBookInMessage(message);

    // Nếu có intent đặt hàng
    if (hasOrderIntent) {
      // Nếu có sách trong message, bắt đầu luôn với sách đó (không hỏi lại)
      if (hasBook) {
        state.step = "collecting_items";
        return await this.handleCollectingItems(message, state, userId);
      } else {
        // Có intent đặt hàng nhưng chưa có tên sách, hỏi lại
        state.step = "collecting_items";
        return {
          text: "Tuyệt vời! Tôi sẽ giúp bạn đặt hàng. Bạn muốn đặt những sách nào? Bạn có thể cho tôi biết tên sách hoặc mô tả sách bạn muốn mua.",
          books: [],
          hasBooks: false,
          orderState: state,
        };
      }
    }

    // Nếu không có intent đặt hàng rõ ràng nhưng có sách trong message
    // và state đang idle, có thể người dùng đang hỏi về sách, không phải đặt hàng
    // (để RAG service xử lý)
    return null;

    return null;
  }

  async processOrderStep(message, state, userId) {
    const lowerMessage = message.toLowerCase().trim();

    // Hủy đơn hàng
    if (
      lowerMessage.includes("hủy") ||
      lowerMessage.includes("cancel") ||
      lowerMessage.includes("thôi")
    ) {
      this.clearConversationState(userId);
      return {
        text: "Đã hủy quá trình đặt hàng. Bạn có cần hỗ trợ gì khác không?",
        books: [],
        hasBooks: false,
      };
    }

    switch (state.step) {
      case "collecting_items":
        return await this.handleCollectingItems(message, state, userId);
      case "checking_profile":
        return await this.handleCheckingProfile(message, state, userId);
      case "asking_voucher":
        return await this.handleAskingVoucher(message, state, userId);
      case "selecting_payment":
        return await this.handleSelectingPayment(message, state, userId);
      case "confirming":
        return await this.handleConfirming(message, state, userId);
      default:
        this.clearConversationState(userId);
        return {
          text: "Có lỗi xảy ra trong quá trình đặt hàng. Vui lòng thử lại.",
          books: [],
          hasBooks: false,
        };
    }
  }

  async handleCollectingItems(message, state, userId) {
    // Tìm sách trong message - chỉ lấy 1 cuốn phù hợp nhất khi đặt hàng
    const books = await this.findBooksInMessage(message, true); // true = chỉ lấy 1 cuốn

    if (books.length === 0) {
      return {
        text: "Tôi chưa tìm thấy sách nào trong tin nhắn của bạn. Bạn có thể:\n• Gửi tên sách cụ thể (ví dụ: 'Đắc Nhân Tâm', 'Sách kinh doanh')\n• Gửi link sách từ trang web (ví dụ: /books/1234567890abcdef12345678)\n• Mô tả sách bạn muốn mua\n\nVí dụ: 'Tôi muốn mua cuốn Đắc Nhân Tâm' hoặc 'Cho tôi đặt 2 cuốn sách kinh doanh'",
        books: [],
        hasBooks: false,
        orderState: state,
      };
    }

    // Thêm sách vào state
    for (const book of books) {
      const existingItem = state.items.find(
        (item) => item.productId.toString() === book._id.toString()
      );
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        // Xử lý giá sách (có thể là object {oldPrice, newPrice} hoặc số)
        let bookPrice = 0;
        if (book.price) {
          if (typeof book.price === "object") {
            bookPrice = book.price.newPrice || book.price.oldPrice || 0;
          } else if (typeof book.price === "number") {
            bookPrice = book.price;
          }
        }

        // Đảm bảo giá là số hợp lệ
        bookPrice = Number(bookPrice) || 0;

        state.items.push({
          productId: book._id,
          quantity: 1,
          title: book.title,
          price: bookPrice,
        });
      }
    }

    // Tính tổng tiền
    state.totalPrice = state.items.reduce(
      (sum, item) => sum + (item.price || 0) * item.quantity,
      0
    );

    const itemsList = state.items
      .map((item) => `• ${item.title} x${item.quantity}`)
      .join("\n");
    const totalFormatted = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(state.totalPrice);

    // Chuyển sang bước kiểm tra profile nhưng vẫn cho phép thêm sách
    state.step = "checking_profile";
    return {
      text: `Tôi đã ghi nhận các sách bạn muốn đặt:\n${itemsList}\n\nTổng tiền: ${totalFormatted}\n\nBạn có muốn thêm sách nào nữa không? (Nếu không, gõ 'không' hoặc 'tiếp tục' để tôi kiểm tra thông tin của bạn)`,
      books: [],
      hasBooks: false,
      orderState: state,
    };
  }

  async handleCheckingProfile(message, state, userId) {
    const lowerMessage = message.toLowerCase().trim();

    // Nếu người dùng không muốn thêm sách, tiếp tục kiểm tra profile
    if (
      lowerMessage.includes("không") ||
      lowerMessage.includes("không có") ||
      lowerMessage.includes("không muốn") ||
      lowerMessage.includes("tiếp tục") ||
      lowerMessage.includes("ok") ||
      lowerMessage.includes("được")
    ) {
      // Tiếp tục với việc kiểm tra profile (bỏ qua phần thêm sách)
    } else if (
      // Nếu người dùng muốn thêm sách (sau khi đã có items)
      (lowerMessage.includes("thêm") ||
        lowerMessage.includes("có") ||
        lowerMessage.includes("muốn")) &&
      state.items.length > 0
    ) {
      // Kiểm tra xem có phải là muốn thêm sách không
      const hasBookKeywords = /(sách|truyện|book|thêm)/i.test(lowerMessage);
      if (hasBookKeywords) {
        state.step = "collecting_items";
        return {
          text: "Bạn muốn thêm sách nào?",
          books: [],
          hasBooks: false,
          orderState: state,
        };
      }
    }

    // Cập nhật profile từ message nếu có
    await this.updateProfileFromMessage(message, state, userId);

    // Lấy thông tin user (có thể đã được cập nhật)
    const user = await User.findOne({ firebaseId: userId });
    if (!user) {
      return {
        text: "Không tìm thấy thông tin tài khoản của bạn. Vui lòng đăng nhập lại.",
        books: [],
        hasBooks: false,
      };
    }

    // Kiểm tra thông tin còn thiếu
    const missingFields = [];
    if (!user.fullName) missingFields.push("Họ tên");
    if (!user.phone) missingFields.push("Số điện thoại");
    if (!user.address || !user.address.street || !user.address.city) {
      missingFields.push("Địa chỉ (số nhà, đường, thành phố)");
    }

    if (missingFields.length > 0) {
      state.step = "checking_profile";
      state.missingFields = missingFields;
      return {
        text: `Tôi thấy thông tin của bạn còn thiếu:\n${missingFields
          .map((f) => `• ${f}`)
          .join(
            "\n"
          )}\n\nBạn vui lòng cung cấp thông tin còn thiếu. Ví dụ: "Tên tôi là Nguyễn Văn A, số điện thoại 0123456789, địa chỉ 123 Đường ABC, Thành phố Hồ Chí Minh"`,
        books: [],
        hasBooks: false,
        orderState: state,
      };
    }

    // Cập nhật profile data vào state
    state.profileData = {
      name: user.fullName,
      email: user.email,
      phone: user.phone,
      address: {
        street: user.address?.street || "",
        city: user.address?.city || "",
        country: user.address?.country || "Vietnam",
        state: user.address?.state || "",
        zipcode: user.address?.zip || "",
      },
    };

    // Chuyển sang bước hỏi voucher
    state.step = "asking_voucher";
    return {
      text: "Thông tin của bạn đã đầy đủ! Bạn có voucher nào để sử dụng không? (Nếu có, vui lòng gửi mã voucher. Nếu không, gõ 'không' hoặc 'bỏ qua')",
      books: [],
      hasBooks: false,
      orderState: state,
    };
  }

  async handleAskingVoucher(message, state, userId) {
    const lowerMessage = message.toLowerCase().trim();

    // Bỏ qua voucher
    if (
      lowerMessage.includes("không") ||
      lowerMessage.includes("bỏ qua") ||
      lowerMessage.includes("skip") ||
      lowerMessage.includes("không có")
    ) {
      state.step = "selecting_payment";
      return {
        text: "Đã bỏ qua voucher. Bạn muốn thanh toán bằng phương thức nào?\n• COD (Thanh toán khi nhận hàng)\n• VNPay (Thanh toán online)\n\nVui lòng chọn một trong hai phương thức trên.",
        books: [],
        hasBooks: false,
        orderState: state,
      };
    }

    // Tìm voucher code trong message
    const voucherCodeMatch = message.match(/\b[A-Z0-9]{4,20}\b/);
    const voucherCode = voucherCodeMatch
      ? voucherCodeMatch[0].toUpperCase()
      : null;

    if (!voucherCode) {
      return {
        text: "Tôi không tìm thấy mã voucher trong tin nhắn của bạn. Vui lòng gửi lại mã voucher hoặc gõ 'không' để bỏ qua.",
        books: [],
        hasBooks: false,
        orderState: state,
      };
    }

    // Kiểm tra voucher của khách hàng
    let customerVoucher = null;
    try {
      customerVoucher = await Voucher.findOne({
        code: voucherCode,
        isActive: true,
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
      });
    } catch (error) {
      console.error("Error checking customer voucher:", error);
    }

    // Kiểm tra voucher của cửa hàng (voucher phổ biến cho tất cả)
    let storeVouchers = [];
    try {
      storeVouchers = await Voucher.find({
        isActive: true,
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
        usageLimit: { $exists: true }, // Có thể có hoặc không
      }).limit(10);
    } catch (error) {
      console.error("Error checking store vouchers:", error);
    }

    // Tính discount cho từng voucher
    const calculateDiscount = (voucher, orderAmount) => {
      if (!voucher) return 0;
      if (orderAmount < voucher.minOrderValue) return 0;
      if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit)
        return 0;

      let discount = 0;
      if (voucher.type === "percentage") {
        discount = (orderAmount * voucher.value) / 100;
        if (voucher.maxDiscount) {
          discount = Math.min(discount, voucher.maxDiscount);
        }
      } else {
        discount = voucher.value;
      }
      return Math.round(discount);
    };

    let selectedVoucher = null;
    let discount = 0;

    if (customerVoucher) {
      const customerDiscount = calculateDiscount(
        customerVoucher,
        state.totalPrice
      );
      if (customerDiscount > 0) {
        selectedVoucher = customerVoucher;
        discount = customerDiscount;
      } else {
        // Voucher hết hạn hoặc không đủ điều kiện
        return {
          text: `Voucher "${voucherCode}" đã hết hạn hoặc không đủ điều kiện sử dụng (đơn hàng tối thiểu ${customerVoucher.minOrderValue?.toLocaleString(
            "vi-VN"
          )}đ). Bạn có voucher nào khác không? (Nếu không, gõ 'không')`,
          books: [],
          hasBooks: false,
          orderState: state,
        };
      }
    }

    // So sánh với voucher của cửa hàng
    let bestStoreVoucher = null;
    let bestStoreDiscount = 0;

    for (const storeVoucher of storeVouchers) {
      const storeDiscount = calculateDiscount(storeVoucher, state.totalPrice);
      if (storeDiscount > bestStoreDiscount) {
        bestStoreDiscount = storeDiscount;
        bestStoreVoucher = storeVoucher;
      }
    }

    // Chọn voucher có discount cao hơn
    if (bestStoreDiscount > discount) {
      selectedVoucher = bestStoreVoucher;
      discount = bestStoreDiscount;
      state.voucherCode = bestStoreVoucher.code;
    } else if (customerVoucher && discount > 0) {
      state.voucherCode = customerVoucher.code;
    }

    state.selectedVoucher = selectedVoucher;
    state.discount = discount;
    state.finalPrice = Math.max(0, state.totalPrice - discount);

    const discountFormatted = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(discount);

    const finalFormatted = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(state.finalPrice);

    state.step = "selecting_payment";
    return {
      text:
        discount > 0
          ? `Đã áp dụng voucher "${
              selectedVoucher.code
            }"! Bạn được giảm ${discountFormatted}.\n\nTổng tiền ban đầu: ${new Intl.NumberFormat(
              "vi-VN",
              { style: "currency", currency: "VND", maximumFractionDigits: 0 }
            ).format(
              state.totalPrice
            )}\nGiảm giá: ${discountFormatted}\nTổng tiền sau giảm: ${finalFormatted}\n\nBạn muốn thanh toán bằng phương thức nào?\n• COD (Thanh toán khi nhận hàng)\n• VNPay (Thanh toán online)\n\nVui lòng chọn một trong hai phương thức trên.`
          : "Không tìm thấy voucher hợp lệ. Bạn muốn thanh toán bằng phương thức nào?\n• COD (Thanh toán khi nhận hàng)\n• VNPay (Thanh toán online)\n\nVui lòng chọn một trong hai phương thức trên.",
      books: [],
      hasBooks: false,
      orderState: state,
    };
  }

  async handleSelectingPayment(message, state, userId) {
    const lowerMessage = message.toLowerCase().trim();

    let paymentMethod = null;

    if (
      lowerMessage.includes("cod") ||
      lowerMessage.includes("thanh toán khi nhận")
    ) {
      paymentMethod = "COD";
    } else if (
      lowerMessage.includes("vnpay") ||
      lowerMessage.includes("vn pay") ||
      lowerMessage.includes("thanh toán online")
    ) {
      paymentMethod = "VNPay";
    } else {
      return {
        text: "Vui lòng chọn phương thức thanh toán:\n• COD (Thanh toán khi nhận hàng)\n• VNPay (Thanh toán online)",
        books: [],
        hasBooks: false,
        orderState: state,
      };
    }

    state.paymentMethod = paymentMethod;

    if (paymentMethod === "COD") {
      state.step = "confirming";
      const itemsList = state.items
        .map((item) => `• ${item.title} x${item.quantity}`)
        .join("\n");
      const finalFormatted = new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(state.finalPrice);

      return {
        text: `Xác nhận đơn hàng:\n\nSản phẩm:\n${itemsList}\n\nThông tin giao hàng:\n• Họ tên: ${state.profileData.name}\n• Số điện thoại: ${state.profileData.phone}\n• Địa chỉ: ${state.profileData.address.street}, ${state.profileData.address.city}\n\nPhương thức thanh toán: COD\nTổng tiền: ${finalFormatted}\n\nBạn có chắc chắn muốn đặt hàng không? (Gõ 'xác nhận' hoặc 'đồng ý' để đặt hàng)`,
        books: [],
        hasBooks: false,
        orderState: state,
      };
    } else {
      // VNPay - cần tạo order và redirect
      return await this.createOrderAndRedirect(state, userId, "VNPay");
    }
  }

  async handleConfirming(message, state, userId) {
    const lowerMessage = message.toLowerCase().trim();

    if (
      lowerMessage.includes("xác nhận") ||
      lowerMessage.includes("đồng ý") ||
      lowerMessage.includes("ok") ||
      lowerMessage.includes("yes")
    ) {
      return await this.createOrderAndRedirect(state, userId, "COD");
    } else if (
      lowerMessage.includes("hủy") ||
      lowerMessage.includes("cancel") ||
      lowerMessage.includes("không")
    ) {
      this.clearConversationState(userId);
      return {
        text: "Đã hủy đơn hàng. Bạn có cần hỗ trợ gì khác không?",
        books: [],
        hasBooks: false,
      };
    } else {
      return {
        text: "Vui lòng xác nhận đặt hàng bằng cách gõ 'xác nhận' hoặc 'đồng ý', hoặc 'hủy' để hủy đơn hàng.",
        books: [],
        hasBooks: false,
        orderState: state,
      };
    }
  }

  async createOrderAndRedirect(state, userId, paymentMethodName) {
    try {
      const user = await User.findOne({ firebaseId: userId });
      if (!user) {
        return {
          text: "Không tìm thấy thông tin tài khoản. Vui lòng đăng nhập lại.",
          books: [],
          hasBooks: false,
        };
      }

      // Tìm payment method
      const payment = await Payment.findOne({
        name: paymentMethodName,
        isActive: true,
      });

      if (!payment) {
        return {
          text: "Không tìm thấy phương thức thanh toán. Vui lòng thử lại.",
          books: [],
          hasBooks: false,
        };
      }

      // Áp dụng voucher nếu có
      if (state.selectedVoucher && state.voucherCode) {
        try {
          const voucher = await Voucher.findOne({ code: state.voucherCode });
          if (
            voucher &&
            voucher.usageLimit &&
            voucher.usedCount < voucher.usageLimit
          ) {
            voucher.usedCount += 1;
            await voucher.save();
          }
        } catch (error) {
          console.error("Error applying voucher:", error);
        }
      }

      // Tính lại tổng tiền từ sách thực tế trong database để đảm bảo đúng
      let calculatedTotal = 0;
      for (const item of state.items) {
        const book = await Book.findById(item.productId).lean();
        if (book) {
          let bookPrice = 0;
          if (book.price) {
            if (typeof book.price === "object") {
              bookPrice = book.price.newPrice || book.price.oldPrice || 0;
            } else if (typeof book.price === "number") {
              bookPrice = book.price;
            }
          }
          calculatedTotal += (bookPrice || 0) * item.quantity;
        }
      }

      // Áp dụng discount nếu có
      const finalCalculatedPrice = Math.max(
        0,
        calculatedTotal - (state.discount || 0)
      );

      // Tạo đơn hàng
      const orderData = {
        user: user._id,
        name: state.profileData.name,
        email: state.profileData.email,
        phone: state.profileData.phone,
        address: state.profileData.address,
        productIds: state.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        totalPrice:
          finalCalculatedPrice > 0 ? finalCalculatedPrice : state.finalPrice,
        paymentMethod: payment._id,
        status: "pending",
        paymentStatus: paymentMethodName === "COD" ? "pending" : "pending",
      };

      const order = await Order.create(orderData);

      // Xóa conversation state
      this.clearConversationState(userId);

      if (paymentMethodName === "COD") {
        return {
          text: `Đặt hàng thành công! Mã đơn hàng: ${order._id
            .toString()
            .slice(-6)
            .toUpperCase()}\n\nĐơn hàng của bạn đã được xác nhận. Chúng tôi sẽ liên hệ với bạn sớm nhất có thể. Cảm ơn bạn đã mua sắm!`,
          books: [],
          hasBooks: false,
          orderCreated: true,
          orderId: order._id.toString(),
          redirectTo: "/orders/thanks",
        };
      } else {
        // VNPay - cần redirect đến trang thanh toán
        return {
          text: `Đơn hàng đã được tạo! Mã đơn hàng: ${order._id
            .toString()
            .slice(-6)
            .toUpperCase()}\n\nBạn sẽ được chuyển đến trang thanh toán VNPay.`,
          books: [],
          hasBooks: false,
          orderCreated: true,
          orderId: order._id.toString(),
          redirectTo: `/payments/vnpay/create`,
        };
      }
    } catch (error) {
      console.error("Error creating order:", error);
      return {
        text: `Có lỗi xảy ra khi tạo đơn hàng: ${error.message}. Vui lòng thử lại hoặc liên hệ hỗ trợ.`,
        books: [],
        hasBooks: false,
      };
    }
  }

  async findBooksInMessage(message, singleResult = false) {
    try {
      // 1. Kiểm tra xem có link sách trong message không
      // Pattern bắt link có thể có domain hoặc không, có query params hoặc hash
      const bookUrlPattern =
        /(?:https?:\/\/[^\s]+)?\/books\/([a-fA-F0-9]{24})(?:\?[^\s]*|#.*)?/gi;
      const urlMatches = [...message.matchAll(bookUrlPattern)];

      if (urlMatches.length > 0) {
        // Tìm sách theo ID từ URL
        const bookIds = urlMatches
          .map((match) => match[1])
          .filter((id) => mongoose.Types.ObjectId.isValid(id));

        if (bookIds.length > 0) {
          const booksById = await Book.find({
            _id: { $in: bookIds },
            quantity: { $gt: 0 },
          })
            .populate("author", "name")
            .limit(5)
            .lean();

          if (booksById.length > 0) {
            return booksById;
          }
        }
      }

      // 2. Tìm kiếm bằng ObjectId nếu message chứa ID hợp lệ
      const objectIdPattern = /([a-fA-F0-9]{24})/;
      const idMatch = message.match(objectIdPattern);
      if (idMatch && mongoose.Types.ObjectId.isValid(idMatch[1])) {
        const bookById = await Book.findOne({
          _id: idMatch[1],
          quantity: { $gt: 0 },
        })
          .populate("author", "name")
          .lean();

        if (bookById) {
          return [bookById];
        }
      }

      // 3. Làm sạch message để tìm kiếm (loại bỏ các từ không cần thiết)
      const cleanMessage = message
        .replace(/(tôi muốn|muốn|đặt|mua|cho|sách|cuốn|quyển|book)/gi, "")
        .replace(/[^\w\sÀ-ỹ]/g, " ")
        .trim();

      if (cleanMessage.length < 2) {
        return [];
      }

      // 4. Tách từ khóa từ message
      const keywords = cleanMessage
        .split(/\s+/)
        .filter((word) => word.length >= 2)
        .slice(0, 5); // Giới hạn 5 từ khóa

      if (keywords.length === 0) {
        return [];
      }

      // 5. Tìm kiếm bằng text search của MongoDB (nếu có index)
      let books = [];

      try {
        // Sử dụng text search nếu có
        books = await Book.find({
          $text: { $search: keywords.join(" ") },
          quantity: { $gt: 0 },
        })
          .populate("author", "name")
          .sort({ score: { $meta: "textScore" } })
          .limit(singleResult ? 1 : 5)
          .lean();
      } catch (error) {
        // Nếu text search không hoạt động, dùng regex
        console.log("Text search not available, using regex search");
      }

      // 6. Nếu text search không tìm thấy hoặc không có, dùng regex search
      if (books.length === 0) {
        // Tìm kiếm theo từng từ khóa
        const searchQueries = keywords.map((keyword) => ({
          $or: [
            { title: { $regex: keyword, $options: "i" } },
            { description: { $regex: keyword, $options: "i" } },
            { tags: { $regex: keyword, $options: "i" } },
          ],
        }));

        // Tìm sách có chứa ít nhất một từ khóa
        books = await Book.find({
          $and: [{ quantity: { $gt: 0 } }, { $or: searchQueries }],
        })
          .populate("author", "name")
          .limit(singleResult ? 5 : 10)
          .lean();

        // Sắp xếp theo số từ khóa khớp (ưu tiên sách khớp nhiều từ khóa hơn)
        // Ưu tiên sách có title khớp chính xác hoặc gần chính xác nhất
        books = books
          .map((book) => {
            const matchCount = keywords.filter((keyword) => {
              const titleMatch = book.title
                ?.toLowerCase()
                .includes(keyword.toLowerCase());
              const descMatch = book.description
                ?.toLowerCase()
                .includes(keyword.toLowerCase());
              const tagMatch = book.tags?.some((tag) =>
                tag.toLowerCase().includes(keyword.toLowerCase())
              );
              return titleMatch || descMatch || tagMatch;
            }).length;

            // Tính điểm ưu tiên: title match quan trọng hơn
            const titleMatchScore = keywords.filter((keyword) => {
              return book.title?.toLowerCase().includes(keyword.toLowerCase());
            }).length;

            // Kiểm tra xem title có chứa toàn bộ từ khóa không (khớp chính xác hơn)
            const fullMatch = keywords.every((keyword) =>
              book.title?.toLowerCase().includes(keyword.toLowerCase())
            );

            return {
              ...book,
              matchCount,
              titleMatchScore,
              fullMatch: fullMatch ? 1 : 0,
            };
          })
          .sort((a, b) => {
            // Ưu tiên: fullMatch > titleMatchScore > matchCount
            if (a.fullMatch !== b.fullMatch) return b.fullMatch - a.fullMatch;
            if (a.titleMatchScore !== b.titleMatchScore)
              return b.titleMatchScore - a.titleMatchScore;
            return b.matchCount - a.matchCount;
          })
          .slice(0, singleResult ? 1 : 5)
          .map(({ matchCount, titleMatchScore, fullMatch, ...book }) => book); // Loại bỏ các trường tính toán
      }

      // 7. Nếu vẫn không tìm thấy, thử tìm theo tên tác giả
      if (books.length === 0) {
        const authors = await Author.find({
          name: { $regex: cleanMessage, $options: "i" },
        }).limit(3);

        if (authors.length > 0) {
          books = await Book.find({
            author: { $in: authors.map((a) => a._id) },
            quantity: { $gt: 0 },
          })
            .populate("author", "name")
            .limit(singleResult ? 1 : 5)
            .lean();
        }
      }

      // 8. Nếu vẫn không tìm thấy, thử tìm với toàn bộ message (không làm sạch)
      if (books.length === 0 && message.length > 3) {
        books = await Book.find({
          $or: [
            { title: { $regex: message.trim(), $options: "i" } },
            { description: { $regex: message.trim(), $options: "i" } },
          ],
          quantity: { $gt: 0 },
        })
          .populate("author", "name")
          .limit(singleResult ? 1 : 5)
          .lean();
      }

      return singleResult && books.length > 0 ? [books[0]] : books;
    } catch (error) {
      console.error("Error finding books:", error);
      return [];
    }
  }

  // Xử lý cập nhật profile từ message
  async updateProfileFromMessage(message, state, userId) {
    try {
      const user = await User.findOne({ firebaseId: userId });
      if (!user) return false;

      let updated = false;

      // Tìm tên - nhiều pattern khác nhau
      const namePatterns = [
        /(?:tên|họ tên|tên tôi là|tôi tên là|tên của tôi là)\s+([A-ZÀ-Ỹ][a-zà-ỹ\s]{2,50})/i,
        /(?:tôi là|mình là)\s+([A-ZÀ-Ỹ][a-zà-ỹ\s]{2,50})/i,
      ];

      for (const pattern of namePatterns) {
        const nameMatch = message.match(pattern);
        if (
          nameMatch &&
          (!user.fullName || state.missingFields?.includes("Họ tên"))
        ) {
          const extractedName = nameMatch[1].trim();
          // Loại bỏ các từ không cần thiết ở cuối
          const cleanName = extractedName
            .replace(
              /\s+(số điện|điện thoại|phone|sđt|sdt|địa chỉ|address).*$/i,
              ""
            )
            .trim();
          if (cleanName.length > 0) {
            user.fullName = cleanName;
            updated = true;
            break;
          }
        }
      }

      // Tìm số điện thoại - nhiều pattern
      const phonePatterns = [
        /(?:số điện thoại|điện thoại|phone|sđt|sdt|số|tel)\s*:?\s*(\d{10,11})/i,
        /(\d{10,11})/,
      ];

      for (const pattern of phonePatterns) {
        const phoneMatch = message.match(pattern);
        if (
          phoneMatch &&
          (!user.phone || state.missingFields?.includes("Số điện thoại"))
        ) {
          const phone = phoneMatch[1].trim();
          if (phone.length >= 10 && phone.length <= 11) {
            user.phone = phone;
            updated = true;
            break;
          }
        }
      }

      // Tìm địa chỉ - nhiều pattern
      const addressPatterns = [
        /(?:địa chỉ|address|địa chỉ là|ở|sống tại)\s*:?\s*([^,]+),\s*([^,]+)/i,
        /(?:số nhà|đường|phố)\s+([^,]+),\s*(?:phường|xã|quận|huyện|thành phố|tp)\s+([^,]+)/i,
      ];

      for (const pattern of addressPatterns) {
        const addressMatch = message.match(pattern);
        if (
          addressMatch &&
          (!user.address?.street ||
            !user.address?.city ||
            state.missingFields?.includes("Địa chỉ"))
        ) {
          if (!user.address) user.address = {};
          user.address.street = addressMatch[1].trim();
          user.address.city = addressMatch[2].trim();
          updated = true;
          break;
        }
      }

      // Nếu không tìm thấy địa chỉ theo pattern, thử tìm đơn giản hơn
      if ((!user.address?.street || !user.address?.city) && !updated) {
        const simpleAddressMatch = message.match(/(\d+\s+[^,]+),\s*([^,]+)/i);
        if (simpleAddressMatch) {
          if (!user.address) user.address = {};
          user.address.street = simpleAddressMatch[1].trim();
          user.address.city = simpleAddressMatch[2].trim();
          updated = true;
        }
      }

      if (updated) {
        await user.save();
        // Cập nhật lại state
        state.profileData = {
          name: user.fullName,
          email: user.email,
          phone: user.phone,
          address: {
            street: user.address?.street || "",
            city: user.address?.city || "",
            country: user.address?.country || "Vietnam",
            state: user.address?.state || "",
            zipcode: user.address?.zip || "",
          },
        };
      }

      return updated;
    } catch (error) {
      console.error("Error updating profile:", error);
      return false;
    }
  }

  // Xử lý tin nhắn và tạo phản hồi sử dụng RAG + general chat
  async processMessage(message, userId = null) {
    try {
      const trimmedMessage = (message || "").trim();

      if (!trimmedMessage) {
        return {
          text: "Xin lỗi, tôi không hiểu. Bạn có thể hỏi lại rõ hơn không?",
          books: [],
          hasBooks: false,
        };
      }

      // 0. Kiểm tra nếu đang trong flow đặt hàng hoặc có intent đặt hàng
      if (userId) {
        const state = this.getConversationState(userId);
        if (state && state.step !== "idle") {
          // Đang trong flow đặt hàng - xử lý cập nhật profile nếu cần
          if (state.step === "checking_profile" && state.missingFields) {
            const profileUpdated = await this.updateProfileFromMessage(
              trimmedMessage,
              state,
              userId
            );
            if (profileUpdated) {
              // Kiểm tra lại sau khi cập nhật
              const user = await User.findOne({ firebaseId: userId });
              const stillMissing = [];
              if (!user.fullName) stillMissing.push("Họ tên");
              if (!user.phone) stillMissing.push("Số điện thoại");
              if (!user.address?.street || !user.address?.city) {
                stillMissing.push("Địa chỉ");
              }

              if (stillMissing.length === 0) {
                state.profileData = {
                  name: user.fullName,
                  email: user.email,
                  phone: user.phone,
                  address: {
                    street: user.address?.street || "",
                    city: user.address?.city || "",
                    country: user.address?.country || "Vietnam",
                    state: user.address?.state || "",
                    zipcode: user.address?.zip || "",
                  },
                };
                state.step = "asking_voucher";
                return {
                  text: "Cảm ơn bạn đã cung cấp thông tin! Thông tin của bạn đã đầy đủ. Bạn có voucher nào để sử dụng không? (Nếu có, vui lòng gửi mã voucher. Nếu không, gõ 'không' hoặc 'bỏ qua')",
                  books: [],
                  hasBooks: false,
                  orderState: state,
                };
              } else {
                return {
                  text: `Cảm ơn bạn! Tôi vẫn cần thêm thông tin:\n${stillMissing
                    .map((f) => `• ${f}`)
                    .join("\n")}\n\nBạn vui lòng cung cấp thông tin còn thiếu.`,
                  books: [],
                  hasBooks: false,
                  orderState: state,
                };
              }
            }
          }

          // Xử lý step hiện tại
          const orderResponse = await this.processOrderStep(
            trimmedMessage,
            state,
            userId
          );
          if (orderResponse) {
            return orderResponse;
          }
        } else {
          // Kiểm tra intent đặt hàng mới
          const orderFlowResponse = await this.handleOrderFlow(
            trimmedMessage,
            userId
          );
          if (orderFlowResponse) {
            return orderFlowResponse;
          }
        }
      }

      // 1. Xử lý các tình huống đơn giản (chào / tạm biệt)
      const simpleIntent = this.isSimpleIntent(trimmedMessage);
      if (simpleIntent === "greeting") {
        return {
          text: this.getRandomResponse(this.responses.greeting),
          books: [],
          hasBooks: false,
        };
      }
      if (simpleIntent === "goodbye") {
        return {
          text: this.getRandomResponse(this.responses.goodbye),
          books: [],
          hasBooks: false,
        };
      }

      // 1.1 Kiểm tra câu hỏi liên quan đến chính sách/điều khoản
      const policyAnswer = this.getPolicyAnswer(trimmedMessage);
      if (policyAnswer) {
        return {
          text: policyAnswer,
          books: [],
          hasBooks: false,
        };
      }

      // 1.2 Kiểm tra yêu cầu tra cứu đơn hàng
      const orderAnswer = await this.getOrderAnswer(trimmedMessage, userId);
      if (orderAnswer) {
        return orderAnswer;
      }

      // 2. Quyết định route: CÂU HỎI VỀ SÁCH hay CÂU HỎI TỔNG QUÁT / SUPPORT?
      const isBookDomain = this.isBookDomainMessage(trimmedMessage);

      let response;

      if (!isBookDomain && typeof ragService.generalChat === "function") {
        // Hỏi ngoài sách -> dùng general chat với OpenAI
        response = await ragService.generalChat(trimmedMessage, userId);
      } else {
        // Hỏi về sách hoặc không chắc -> dùng RAG trước
        response = await ragService.query(trimmedMessage, userId);
      }

      console.log("Chatbot service response:", {
        message: trimmedMessage,
        responseType: typeof response,
        hasBooks: response?.hasBooks,
        booksCount: response?.books?.length || 0,
        responseText:
          response?.text && response.text.substring
            ? response.text.substring(0, 100)
            : typeof response === "string"
            ? response.substring(0, 100)
            : "",
      });

      // 3. Đảm bảo luôn trả về object { text, books, hasBooks }
      if (!response) {
        return {
          text: "Xin lỗi, tôi chưa trả lời được câu này. Bạn có thể hỏi theo cách khác hoặc hỏi về sách bạn quan tâm không?",
          books: [],
          hasBooks: false,
        };
      }

      if (typeof response === "string") {
        return {
          text: response,
          books: [],
          hasBooks: false,
        };
      }

      // 4. Nếu response có sách, kiểm tra xem có phải là câu hỏi về sách cụ thể không
      let books = Array.isArray(response.books) ? response.books : [];

      // Kiểm tra xem có phải là câu hỏi về sách cụ thể (có tên sách) hay thể loại/mô tả
      const isSpecific = this.isSpecificBookQuery(trimmedMessage);

      if (isSpecific) {
        // Nếu là câu hỏi về sách cụ thể, chỉ trả về 1 cuốn phù hợp nhất
        // Tìm sách trực tiếp từ message trước, không dùng RAG response
        const bestMatch = await this.findBooksInMessage(trimmedMessage, true);
        if (bestMatch.length > 0) {
          books = [bestMatch[0]];
        } else if (books.length > 0) {
          // Nếu không tìm thấy bằng findBooksInMessage, lọc từ RAG response
          // Tìm sách có title khớp nhất với từ khóa trong message
          const keywords = trimmedMessage
            .toLowerCase()
            .replace(/(có|tìm|sách|cuốn|quyển)/gi, "")
            .trim()
            .split(/\s+/)
            .filter((w) => w.length >= 2);

          if (keywords.length > 0) {
            const scoredBooks = books.map((book) => {
              const title = (book.title || "").toLowerCase();
              const score = keywords.reduce((sum, keyword) => {
                if (title.includes(keyword)) {
                  return sum + 1;
                }
                return sum;
              }, 0);
              return { book, score };
            });

            scoredBooks.sort((a, b) => b.score - a.score);
            if (scoredBooks[0] && scoredBooks[0].score > 0) {
              books = [scoredBooks[0].book];
            } else {
              books = [books[0]];
            }
          } else {
            books = [books[0]];
          }
        }
      } else if (!isSpecific && books.length > 5) {
        // Nếu là câu hỏi về thể loại/mô tả, giới hạn 5 cuốn
        books = books.slice(0, 5);
      }

      // Lưu context sách vừa được hiển thị (để xử lý "đặt nó", "đặt quyển này")
      if (books.length > 0 && userId) {
        this.saveRecentBooksContext(userId, books);
      }

      return {
        text:
          typeof response.text === "string" && response.text.trim()
            ? response.text
            : "Xin lỗi, tôi chưa trả lời được rõ ràng. Bạn có thể nói cụ thể hơn về nhu cầu của mình không?",
        books: books,
        hasBooks: books.length > 0,
      };
    } catch (error) {
      console.error("Error processing message:", error);
      return {
        text: "Xin lỗi, tôi gặp một chút khó khăn. Bạn có thể thử hỏi lại sau một lúc không?",
        books: [],
        hasBooks: false,
      };
    }
  }

  // Lấy câu trả lời ngẫu nhiên từ mảng
  getRandomResponse(responses) {
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Tạo câu trả lời cho các câu hỏi về chính sách
  getPolicyAnswer(message) {
    if (!policyData) {
      return null;
    }

    const lower = message.toLowerCase();
    const formatList = (items) =>
      Array.isArray(items) && items.length > 0
        ? items.map((item) => `• ${item}`).join("\n")
        : "";

    const keywordMap = {
      terms: ["điều khoản", "terms", "quy định", "sử dụng dịch vụ"],
      privacy: ["bảo mật", "privacy", "dữ liệu", "thông tin cá nhân", "gdpr"],
      cookies: ["cookie", "cookies", "theo dõi trình duyệt"],
      refund: ["hoàn trả", "đổi trả", "refund", "trả hàng", "hoàn tiền"],
      contact: ["liên hệ", "hotline", "email hỗ trợ", "địa chỉ"],
    };

    const generalPolicyKeywords = ["chính sách", "policy", "terms policy"];

    const matchedSections = Object.entries(keywordMap)
      .filter(([, keywords]) =>
        keywords.some((keyword) => lower.includes(keyword))
      )
      .map(([section]) => section);

    const isGeneralPolicyQuestion = generalPolicyKeywords.some((keyword) =>
      lower.includes(keyword)
    );

    if (!matchedSections.length && !isGeneralPolicyQuestion) {
      return null;
    }

    const sectionsToAnswer = matchedSections.length
      ? matchedSections
      : ["terms", "privacy", "cookies", "refund", "contact"];

    const responses = [];

    if (sectionsToAnswer.includes("terms")) {
      responses.push(
        `Điều khoản sử dụng (cập nhật ${policyData.lastUpdated}):
${policyData.terms.intro}

Quyền và nghĩa vụ người dùng:
${formatList(policyData.terms.userDuties)}

Thanh toán:
${formatList(policyData.terms.payment)}

Giao hàng: ${policyData.terms.shipping}`
      );
    }

    if (sectionsToAnswer.includes("privacy")) {
      responses.push(
        `Chính sách bảo mật:
- Thông tin thu thập:
  • Cá nhân: ${policyData.privacy.collection.personal.join(", ")}.
  • Kỹ thuật: ${policyData.privacy.collection.technical.join(", ")}.
- Mục đích sử dụng:
${formatList(policyData.privacy.usage)}
- Bảo mật dữ liệu:
${formatList(policyData.privacy.security)}`
      );
    }

    if (sectionsToAnswer.includes("cookies")) {
      const cookieTypes = policyData.cookies.types
        .map((type) => `• ${type.name}: ${type.note}`)
        .join("\n");
      responses.push(
        `Chính sách Cookie:
${policyData.cookies.purpose}

Các loại cookie:
${cookieTypes}

Cách quản lý:
${formatList(policyData.cookies.controls)}`
      );
    }

    if (sectionsToAnswer.includes("refund")) {
      responses.push(
        `Chính sách hoàn trả/đổi trả:
Được chấp nhận:
${formatList(policyData.refund.accepted)}

Không áp dụng:
${formatList(policyData.refund.rejected)}

Quy trình:
${formatList(policyData.refund.steps)}

Thời gian xử lý:
• Phản hồi: ${policyData.refund.sla.response}
• Kiểm tra: ${policyData.refund.sla.inspection}
• Hoàn tiền: ${policyData.refund.sla.refund}`
      );
    }

    if (sectionsToAnswer.includes("contact")) {
      responses.push(
        `Thông tin liên hệ:
• Email: ${policyData.contact.email}
• Hotline: ${policyData.contact.hotline}
• Địa chỉ: ${policyData.contact.address}`
      );
    }

    return responses.join("\n\n");
  }

  // ==== Order helpers ====
  async getOrderAnswer(message, firebaseId) {
    if (!firebaseId) {
      return null;
    }

    const orderToken = this.extractOrderToken(message);
    if (!orderToken) {
      return null;
    }

    try {
      const user = await User.findOne({ firebaseId }).select(
        "_id fullName email"
      );
      if (!user) {
        return {
          text: "Mình chưa tìm thấy tài khoản của bạn trong hệ thống. Bạn hãy đăng nhập lại rồi thử cung cấp mã đơn hàng nhé.",
          books: [],
          hasBooks: false,
        };
      }

      const order = await this.findOrderForUser(orderToken, user._id);
      if (!order) {
        return {
          text: `Mình chưa tìm thấy đơn hàng khớp với mã "${orderToken}". Bạn kiểm tra lại mã (đủ 24 ký tự) hoặc cung cấp thêm thông tin giúp mình nhé.`,
          books: [],
          hasBooks: false,
        };
      }

      return {
        text: this.formatOrderResponse(order),
        books: [],
        hasBooks: false,
      };
    } catch (error) {
      console.error("Error getting order info:", error);
      return {
        text: "Mình gặp chút sự cố khi tra cứu đơn hàng. Bạn thử lại sau ít phút hoặc gửi yêu cầu cho nhân viên nhé.",
        books: [],
        hasBooks: false,
      };
    }
  }

  extractOrderToken(message) {
    const lower = message.toLowerCase();
    const keywords = [
      "đơn hàng",
      "mã đơn",
      "order",
      "tracking",
      "đơn #",
      "đơn số",
    ];
    const hasKeyword = keywords.some((keyword) => lower.includes(keyword));
    if (!hasKeyword) {
      return null;
    }

    // Ưu tiên chuỗi hex 24 ký tự (ObjectId)
    const objectIdMatch = message.match(/[0-9a-fA-F]{24}/);
    if (objectIdMatch) {
      return objectIdMatch[0];
    }

    // Cho phép người dùng gửi phần cuối mã (>=6 ký tự) kèm # hoặc khoảng trắng
    const partialMatch = message.match(/#?([0-9a-zA-Z]{6,24})/);
    if (partialMatch) {
      return partialMatch[1];
    }

    return null;
  }

  async findOrderForUser(orderToken, userObjectId) {
    let order = null;

    if (mongoose.Types.ObjectId.isValid(orderToken)) {
      order = await Order.findOne({ _id: orderToken, user: userObjectId })
        .populate("productIds.productId")
        .lean();
      if (order) {
        return order;
      }
    }

    const normalizedToken = orderToken.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (normalizedToken.length < 6) {
      return null;
    }

    const recentOrders = await Order.find({ user: userObjectId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("productIds.productId")
      .lean();

    return recentOrders.find((o) =>
      o._id.toString().toLowerCase().includes(normalizedToken)
    );
  }

  formatOrderResponse(order) {
    const orderId = order._id.toString();
    const shortId = orderId.slice(-6).toUpperCase();
    const orderDate = order.createdAt
      ? new Date(order.createdAt).toLocaleString("vi-VN")
      : "Không rõ";
    const statusMap = {
      pending: "Đang chờ xử lý",
      processing: "Đang chuẩn bị",
      shipped: "Đã giao cho đơn vị vận chuyển",
      delivered: "Đã giao hàng",
      completed: "Hoàn tất",
      cancelled: "Đã hủy",
    };
    const statusText = statusMap[order.status] || order.status || "Không rõ";
    const paymentStatusMap = {
      pending: "Chưa thanh toán",
      paid: "Đã thanh toán",
      failed: "Thanh toán thất bại",
    };
    const paymentText =
      paymentStatusMap[order.paymentStatus] ||
      order.paymentStatus ||
      "Không rõ";

    const currencyFormatter = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    });
    const total = currencyFormatter.format(order.totalPrice || 0);

    const items = (order.productIds || [])
      .map((item) => {
        const title =
          item.productId?.title ||
          item.productId?.name ||
          "Sản phẩm không xác định";
        return `• ${title} x${item.quantity || 1}`;
      })
      .slice(0, 4);

    const remaining = (order.productIds?.length || 0) - items.length;
    if (remaining > 0) {
      items.push(`• ... và ${remaining} sản phẩm khác`);
    }

    return `Đơn hàng #${shortId}
Mã đầy đủ: ${orderId}
Ngày tạo: ${orderDate}
Trạng thái: ${statusText}
Thanh toán: ${paymentText}
Tổng tiền: ${total}

Sản phẩm:
${items.join("\n")}

Nếu cần hỗ trợ thêm (đổi địa chỉ, hủy đơn...), bạn hãy mô tả yêu cầu cụ thể nhé!`;
  }
}

module.exports = new ChatbotService();
