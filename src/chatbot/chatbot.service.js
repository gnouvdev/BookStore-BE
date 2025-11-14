const ragService = require("./rag.service");
// Nếu sau này cần dùng trực tiếp Book/Category/Author thì giữ lại, còn không có thể xoá cho sạch
const Book = require("../books/book.model");
const Category = require("../categories/category.model");
const Author = require("../authors/author.model");

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

      return {
        text:
          typeof response.text === "string" && response.text.trim()
            ? response.text
            : "Xin lỗi, tôi chưa trả lời được rõ ràng. Bạn có thể nói cụ thể hơn về nhu cầu của mình không?",
        books: Array.isArray(response.books) ? response.books : [],
        hasBooks: !!response.hasBooks && !!response.books?.length,
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
}

module.exports = new ChatbotService();
