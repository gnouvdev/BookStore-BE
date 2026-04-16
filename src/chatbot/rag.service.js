// LlamaIndex imports - sử dụng dynamic import để tránh ES Module issues
let VectorStoreIndex,
  Document,
  serviceContextFromDefaults,
  OpenAI,
  Settings,
  OpenAIEmbedding;
let llamaindexLoaded = false;

// Hàm load LlamaIndex async
async function loadLlamaIndex() {
  if (llamaindexLoaded) return;

  try {
    // Thử dynamic import cho ES modules
    const llamaindex = await import("llamaindex").catch(() => {
      // Nếu dynamic import fail, thử require
      try {
        return require("llamaindex");
      } catch (e) {
        throw e;
      }
    });

    // Thử các cách import khác nhau tùy theo version
    VectorStoreIndex =
      llamaindex.VectorStoreIndex || llamaindex.index?.VectorStoreIndex;
    Document = llamaindex.Document || llamaindex.node?.Document;
    serviceContextFromDefaults =
      llamaindex.serviceContextFromDefaults ||
      llamaindex.serviceContext?.serviceContextFromDefaults;
    OpenAI = llamaindex.OpenAI || llamaindex.llm?.OpenAI;
    Settings = llamaindex.Settings || llamaindex.globalSettings?.Settings;
    OpenAIEmbedding =
      llamaindex.OpenAIEmbedding || llamaindex.embeddings?.OpenAIEmbedding;

    llamaindexLoaded = true;
    console.log("✅ LlamaIndex loaded successfully");
  } catch (error) {
    console.warn(
      "⚠️ LlamaIndex not available, using intelligent fallback mode:",
      error.message
    );
    llamaindexLoaded = false;
  }
}

const mongoose = require("mongoose");
const natural = require("natural");
const { OpenAI: OpenAIClient } = require("openai");

class RAGService {
  constructor() {
    this.index = null;
    this.queryEngine = null;
    this.isInitialized = false;
    this.llm = null;
    this.serviceContext = null;
    this.openaiClient = null;

    // Sử dụng WordTokenizer từ natural package nếu có
    try {
      this.tokenizer = natural.WordTokenizer
        ? new natural.WordTokenizer()
        : null;
    } catch (error) {
      this.tokenizer = null;
    }

    // Danh sách stopwords tiếng Việt
    this.vietnameseStopwords = [
      "và",
      "của",
      "là",
      "có",
      "trong",
      "một",
      "những",
      "được",
      "cho",
      "với",
      "như",
      "khi",
      "đã",
      "sẽ",
      "đến",
      "từ",
      "vì",
      "nên",
      "rằng",
      "này",
      "đó",
      "kia",
      "tôi",
      "bạn",
      "anh",
      "chị",
      "em",
      "chúng",
      "ta",
      "họ",
      "các",
      "về",
      "trên",
      "dưới",
      "giữa",
      "qua",
      "lại",
      "nữa",
      "nhưng",
      "hay",
      "hoặc",
      "vẫn",
      "thì",
      "cũng",
      "đang",
      "rất",
      "rồi",
      "nhiều",
      "ít",
      "hơn",
      "kém",
      "mọi",
      "mỗi",
      "bất",
      "cứ",
      "đều",
      "đi",
      "vào",
      "ra",
      "lên",
      "xuống",
      "đây",
      "ấy",
      "bị",
      "do",
      "bởi",
      "nếu",
      "mà",
      "lại",
      "chỉ",
      "vừa",
      "mới",
      "sắp",
      "vậy",
      "tuy",
      "dù",
    ];

    // Danh sách stopwords tiếng Anh
    this.englishStopwords = [
      "the",
      "and",
      "is",
      "in",
      "at",
      "of",
      "a",
      "an",
      "to",
      "for",
      "on",
      "with",
      "as",
      "by",
      "this",
      "that",
      "these",
      "those",
      "it",
      "its",
      "be",
      "was",
      "were",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "done",
      "from",
      "or",
      "but",
      "so",
      "if",
      "into",
      "about",
      "than",
      "then",
      "there",
      "here",
      "when",
      "where",
      "why",
      "how",
      "what",
      "which",
      "who",
      "whom",
      "whose",
      "can",
      "could",
      "shall",
      "should",
      "will",
      "would",
      "may",
      "might",
      "must",
      "also",
      "very",
      "more",
      "most",
      "some",
      "such",
      "no",
      "not",
      "only",
      "just",
      "own",
      "same",
      "other",
      "another",
      "each",
      "every",
      "few",
      "many",
      "much",
      "any",
      "all",
      "both",
      "either",
      "neither",
    ];
  }

  // Hàm khởi tạo RAG service
  async initialize() {
    if (this.isInitialized) return;
    console.log("🔄 Initializing RAG Service...");

    try {
      await loadLlamaIndex();

      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (openaiApiKey) {
        // Khởi tạo OpenAI client cho NER + general chat
        try {
          this.openaiClient = new OpenAIClient({
            apiKey: openaiApiKey,
          });
          console.log("✅ OpenAI client initialized");
        } catch (error) {
          console.warn("⚠️ Failed to initialize OpenAI client:", error.message);
        }

        // Khởi tạo LlamaIndex OpenAI LLM
        if (OpenAI) {
          this.llm = new OpenAI({
            model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
            apiKey: openaiApiKey,
            temperature: 0.7,
          });
          console.log("✅ Using OpenAI LLM");
        }
      } else {
        console.warn(
          "⚠️ No OpenAI API key found. Using intelligent fallback mode."
        );
        this.isInitialized = true;
        return;
      }

      // Tạo service context
      if (serviceContextFromDefaults) {
        this.serviceContext = serviceContextFromDefaults({
          llm: this.llm,
          chunkSize: 512,
          chunkOverlap: 50,
        });

        if (Settings) {
          Settings.llm = this.llm;

          // Cấu hình embed model cho LlamaIndex nếu khả dụng
          if (OpenAIEmbedding && openaiApiKey) {
            try {
              Settings.embedModel = new OpenAIEmbedding({
                apiKey: openaiApiKey,
                model:
                  process.env.OPENAI_EMBEDDING_MODEL ||
                  "text-embedding-3-small",
              });
              console.log("✅ OpenAIEmbedding initialized for RAG");
            } catch (error) {
              console.warn(
                "⚠️ Failed to initialize OpenAIEmbedding:",
                error.message
              );
            }
          }

          Settings.serviceContext = this.serviceContext;
        }
      }

      await this.buildIndex();
      this.isInitialized = true;
      console.log("✅ RAG Service initialized successfully");
    } catch (error) {
      console.error("❌ Error initializing RAG Service:", error);
      this.isInitialized = true; // Cho phép fallback
    }
  }

  // Lấy tokenizer
  getTokenizer() {
    if (this.tokenizer) return this.tokenizer;

    // Fallback đơn giản nếu natural không có
    return {
      tokenize: (text) =>
        text
          .split(/\s+/)
          .map((t) => t.trim())
          .filter(Boolean),
    };
  }

  // Chuẩn hóa text cho việc tìm kiếm từ khóa
  normalizeText(text) {
    if (!text || typeof text !== "string") return "";
    let normalized = text.toLowerCase();

    // Loại bỏ dấu tiếng Việt
    normalized = normalized
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");

    // Loại bỏ ký tự đặc biệt, giữ lại chữ cái và số
    normalized = normalized.replace(/[^a-z0-9\s]/g, " ");

    // Xóa khoảng trắng dư
    normalized = normalized.replace(/\s+/g, " ").trim();

    return normalized;
  }

  // Loại bỏ stopwords và lấy từ khóa quan trọng
  extractKeywords(text) {
    const normalized = this.normalizeText(text);
    if (!normalized) return [];

    const tokenizer = this.getTokenizer();
    const tokens = tokenizer.tokenize(normalized);

    const allStopwords = new Set([
      ...this.vietnameseStopwords,
      ...this.englishStopwords,
    ]);

    const keywords = tokens.filter((token) => !allStopwords.has(token));

    // Giữ các từ có độ dài >= 2 ký tự
    return keywords.filter((word) => word.length >= 2);
  }

  // Xây dựng index RAG từ dữ liệu trong MongoDB
  async buildIndex() {
    try {
      if (!VectorStoreIndex || !Document) {
        console.warn(
          "⚠️ LlamaIndex not available. Skipping RAG index building."
        );
        return;
      }

      const Book = require("../books/book.model");
      // Lấy toàn bộ sách (schema hiện tại không có status / isActive)
      const books = await Book.find({})
        .populate("author")
        .populate("category")
        .lean();

      if (!books || books.length === 0) {
        console.warn("⚠️ No books found for building RAG index.");
        return;
      }

      console.log(`📚 Building RAG index from ${books.length} books in DB...`);

      // Tạo documents cho LlamaIndex từ dữ liệu sách
      const documents = books.map((book) => {
        const authorName =
          (book.author && book.author.name) ||
          (book.author && book.author.fullName) ||
          "";
        let categoryNames = [];

        // category trong schema là 1 ObjectId, nhưng nếu sau này là mảng vẫn xử lý được
        if (Array.isArray(book.category)) {
          categoryNames = book.category.map((c) => c && c.name).filter(Boolean);
        } else if (book.category && book.category.name) {
          categoryNames = [book.category.name];
        }

        const displayPrice =
          book.price?.newPrice ?? book.price?.oldPrice ?? null;

        const bookContent = `
Tiêu đề: ${book.title || ""}
Tác giả: ${authorName}
Thể loại: ${categoryNames.join(", ")}
Mô tả: ${book.description || ""}
Từ khóa: ${(book.tags || []).join(", ")}
Giá: ${displayPrice !== null ? displayPrice : 0}
Ngôn ngữ: ${book.language || "Không rõ"}
Số lượng: ${book.quantity ?? "Không rõ"}
        `.trim();

        return new Document({
          text: bookContent,
          metadata: {
            bookId: book._id?.toString(),
            title: book.title,
            author: authorName,
            categories: categoryNames,
            price: displayPrice,
          },
        });
      });

      console.log("📄 Documents created for RAG:", documents.length);

      // Tạo index
      this.index = await VectorStoreIndex.fromDocuments(documents, {
        serviceContext: this.serviceContext,
      });

      // Tạo query engine từ index
      this.queryEngine = this.index.asQueryEngine({
        similarityTopK: 5,
      });

      console.log("✅ RAG index built successfully");
    } catch (error) {
      console.error("❌ Error building RAG index:", error);
      // Không throw để hệ thống vẫn hoạt động với fallback mode
    }
  }

  // Hàm NER sử dụng OpenAI để trích xuất entity từ câu hỏi
  async extractEntitiesWithLLM(userMessage) {
    if (!this.openaiClient) {
      console.warn(
        "⚠️ OpenAI client not initialized. Using keyword-based entity extraction."
      );
      return this.extractEntitiesWithKeywords(userMessage);
    }

    try {
      const systemPrompt = `
Bạn là trợ lý AI của một cửa hàng sách trực tuyến.
Nhiệm vụ của bạn là phân tích câu hỏi của khách hàng và trích xuất các thông tin quan trọng liên quan đến việc tìm kiếm sách.

Hãy trả về JSON với cấu trúc:
{
  "bookTitle": string | null,
  "author": string | null,
  "categories": string[] | null,
  "keywords": string[],
  "intent": "summary" | "recommendation" | "search" | "bestseller" | "other",
  "language": "vi" | "en" | null
}

Giải thích:
- "summary": khi khách muốn tóm tắt nội dung một cuốn sách cụ thể.
- "recommendation": khi khách muốn gợi ý sách theo sở thích, thể loại, mục đích.
- "search": khi khách chỉ muốn tìm sách theo tên, tác giả, thể loại.
- "bestseller": khi khách hỏi về "best seller", "bestseller", "sách bán chạy", "sách phổ biến", "sách hot", "sách trending", "sách nổi bật", "sách được yêu thích nhất".
- "other": các trường hợp khác không liên quan nhiều tới sách.

Lưu ý quan trọng:
- Khi khách hỏi về "best seller", "bestseller", "sách bán chạy", "sách phổ biến", "sách hot", "sách trending", "sách nổi bật", "sách được yêu thích nhất" → đặt intent = "bestseller"
- Khi khách hỏi "sách nào cuốn", "sách nào hay", "sách nào đáng đọc" → đặt intent = "recommendation"
- Khi khách hỏi về một cuốn sách cụ thể như "Kẻ Trộm Sách", "Bố Già" → trích xuất bookTitle chính xác

Chỉ trả về JSON hợp lệ, không kèm giải thích.
`;

      const completion = await this.openaiClient.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        return this.extractEntitiesWithKeywords(userMessage);
      }

      // Thử parse JSON an toàn
      const jsonStartIndex = content.indexOf("{");
      const jsonEndIndex = content.lastIndexOf("}");
      if (jsonStartIndex === -1 || jsonEndIndex === -1) {
        return this.extractEntitiesWithKeywords(userMessage);
      }

      const jsonString = content.slice(jsonStartIndex, jsonEndIndex + 1);
      let result;
      try {
        result = JSON.parse(jsonString);
      } catch (parseError) {
        console.warn("⚠️ Failed to parse LLM JSON. Using keyword fallback.");
        return this.extractEntitiesWithKeywords(userMessage);
      }

      // Đảm bảo cấu trúc đầy đủ
      return {
        bookTitle: result.bookTitle || null,
        author: result.author || null,
        categories: Array.isArray(result.categories)
          ? result.categories
          : result.categories
          ? [result.categories]
          : [],
        keywords: Array.isArray(result.keywords)
          ? result.keywords
          : this.extractKeywords(userMessage),
        intent: result.intent || "search",
        language: result.language || null,
      };
    } catch (error) {
      console.error("Error in extractEntitiesWithLLM:", error);
      return this.extractEntitiesWithKeywords(userMessage);
    }
  }

  // Fallback: trích xuất entity bằng keywords nếu không dùng được OpenAI
  extractEntitiesWithKeywords(userMessage) {
    const keywords = this.extractKeywords(userMessage);

    // Đoán intent đơn giản
    let intent = "search";
    const lowerMsg = userMessage.toLowerCase();

    if (
      lowerMsg.includes("tóm tắt") ||
      lowerMsg.includes("nội dung") ||
      lowerMsg.includes("summary")
    ) {
      intent = "summary";
    } else if (
      lowerMsg.includes("gợi ý") ||
      lowerMsg.includes("đề xuất") ||
      lowerMsg.includes("nên đọc gì") ||
      lowerMsg.includes("recommend")
    ) {
      intent = "recommendation";
    }

    // Đoán language đơn giản
    let language = "vi";
    const englishPattern = /[a-z]/i;
    const vietnameseDiacriticsPattern =
      /[ăâêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệóòỏõọốồổỗộơớờởỡợúùủũụứừửữựíìỉĩịýỳỷỹỵđ]/i;

    if (
      englishPattern.test(userMessage) &&
      !vietnameseDiacriticsPattern.test(userMessage)
    ) {
      language = "en";
    }

    return {
      bookTitle: null,
      author: null,
      categories: [],
      keywords,
      intent,
      language,
    };
  }

  // Tìm sách trong MongoDB dựa trên entities
  async findBooksByQuery(entities) {
    const Book = require("../books/book.model");
    const Category = require("../categories/category.model");
    const Author = require("../authors/author.model");

    const { bookTitle, author, categories, keywords } = entities;

    // Schema hiện tại không có status / isActive
    const query = {};
    const andConditions = [];

    if (bookTitle) {
      andConditions.push({
        title: { $regex: new RegExp(bookTitle, "i") },
      });
    }

    if (author) {
      // Tìm tác giả theo tên rồi nối vào query
      const authorDocs = await Author.find({
        $or: [
          { name: { $regex: new RegExp(author, "i") } },
          { fullName: { $regex: new RegExp(author, "i") } },
        ],
      }).select("_id");

      if (authorDocs.length > 0) {
        andConditions.push({
          author: { $in: authorDocs.map((a) => a._id) },
        });
      }
    }

    if (categories && categories.length > 0) {
      // Sửa lỗi: $in không hỗ trợ RegExp, phải dùng $or
      const categoryRegexConditions = categories.map((c) => ({
        name: { $regex: new RegExp(this.escapeRegex(c), "i") },
      }));
      const categoryDocs = await Category.find({
        $or: categoryRegexConditions,
      }).select("_id");

      if (categoryDocs.length > 0) {
        andConditions.push({
          category: { $in: categoryDocs.map((c) => c._id) },
        });
      }
    }

    if (keywords && keywords.length > 0) {
      // Sửa lỗi: $in không hỗ trợ RegExp, phải dùng $regex
      const keywordConditions = [];
      keywords.forEach((k) => {
        const escapedKeyword = this.escapeRegex(k);
        const regex = new RegExp(escapedKeyword, "i");
        keywordConditions.push(
          { title: { $regex: regex } },
          { description: { $regex: regex } }
        );
        // Tags là array of strings, tìm kiếm bằng cách check từng tag
        // MongoDB sẽ tự động match regex với các phần tử trong array
        keywordConditions.push({
          tags: regex,
        });
      });

      if (keywordConditions.length > 0) {
        andConditions.push({
          $or: keywordConditions,
        });
      }
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    let books = await Book.find(query)
      .populate("author")
      .populate("category")
      .lean();

    // Thêm rating và numReviews cho mỗi sách
    if (books.length === 0) {
      return books;
    }

    const Review = require("../reviews/review.model");
    try {
      const reviewAgg = await Review.aggregate([
        {
          $match: {
            book: { $in: books.map((book) => book._id) },
          },
        },
        {
          $group: {
            _id: "$book",
            rating: { $avg: "$rating" },
            numReviews: { $sum: 1 },
          },
        },
      ]);

      const reviewMap = new Map(
        reviewAgg.map((item) => [
          item._id.toString(),
          {
            rating: item.rating || 0,
            numReviews: item.numReviews || 0,
          },
        ])
      );

      books = books.map((book) => {
        const reviewInfo = reviewMap.get(book._id.toString());
        return {
          ...book,
          rating: reviewInfo?.rating || 0,
          numReviews: reviewInfo?.numReviews || 0,
        };
      });
    } catch (error) {
      console.warn("Error batching reviews for chatbot query:", error.message);
      books = books.map((book) => ({
        ...book,
        rating: 0,
        numReviews: 0,
      }));
    }

    return books;
  }

  // Hàm escape regex
  escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Xử lý query từ user, sử dụng RAG nếu có, fallback vào MongoDB và heuristic nếu không
  async query(userMessage, userId = null) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Bước 1: trích xuất entities và intent từ câu hỏi
      const entities = await this.extractEntitiesWithLLM(userMessage);
      console.log("Extracted entities:", entities);

      // Bước 1.5: Nếu không có bookTitle từ LLM nhưng message ngắn và có vẻ là tên sách, thử extract
      let directMatchBook = null;
      if (
        !entities.bookTitle &&
        userMessage.trim().length < 50 &&
        userMessage.trim().length > 2
      ) {
        // Thử tìm sách trực tiếp bằng tên
        const Book = require("../books/book.model");
        directMatchBook = await Book.findOne({
          title: {
            $regex: new RegExp(this.escapeRegex(userMessage.trim()), "i"),
          },
        })
          .populate("author")
          .populate("category")
          .lean();

        if (directMatchBook) {
          entities.bookTitle = userMessage.trim();
          console.log(
            "Detected book title from direct match:",
            entities.bookTitle
          );
        }
      }

      // Bước 2: Tìm sách trong database dựa trên entities
      let books = [];
      if (directMatchBook) {
        // Thêm rating và numReviews cho directMatchBook
        const Review = require("../reviews/review.model");
        try {
          const reviewAgg = await Review.aggregate([
            { $match: { book: directMatchBook._id } },
            {
              $group: {
                _id: "$book",
                rating: { $avg: "$rating" },
                numReviews: { $sum: 1 },
              },
            },
          ]);
          directMatchBook.rating = reviewAgg[0]?.rating || 0;
          directMatchBook.numReviews = reviewAgg[0]?.numReviews || 0;
        } catch (error) {
          directMatchBook.rating = 0;
          directMatchBook.numReviews = 0;
        }
        books = [directMatchBook];
        console.log("Books found from direct match:", books.length);
      } else if (
        entities.bookTitle ||
        entities.author ||
        (entities.keywords && entities.keywords.length > 0)
      ) {
        books = await this.findBooksByQuery(entities);
        console.log("Books found from database:", books.length);
      }

      // Bước 3: nếu intent là summary (tóm tắt nội dung một cuốn sách)
      if (entities.intent === "summary") {
        return await this.handleSummaryIntent(userMessage, entities);
      }

      // Bước 3.5: nếu intent là bestseller (sách bán chạy, phổ biến)
      if (entities.intent === "bestseller") {
        return await this.handleBestsellerIntent(userMessage, entities);
      }

      // Bước 4: nếu RAG index có sẵn, dùng RAG để tìm context
      let ragText = "";
      if (this.queryEngine) {
        try {
          const ragResponse = await this.queryEngine.query({
            query: userMessage,
          });
          ragText =
            typeof ragResponse.response === "string"
              ? ragResponse.response
              : ragResponse.toString();

          // Thử lấy bookIds từ RAG response
          const sourceNodes = ragResponse.sourceNodes || [];
          const bookIds = [];
          for (const node of sourceNodes) {
            const meta = node.node?.metadata || node.metadata || {};
            if (meta.bookId) {
              bookIds.push(meta.bookId);
            }
          }

          // Nếu RAG tìm được books, merge với books từ database
          if (bookIds.length > 0) {
            const Book = require("../books/book.model");
            const ragBooks = await Book.find({
              _id: {
                $in: bookIds.map((id) => new mongoose.Types.ObjectId(id)),
              },
            })
              .populate("author")
              .populate("category")
              .lean();

            // Merge và deduplicate
            const existingIds = new Set(books.map((b) => b._id.toString()));
            const newBooks = ragBooks.filter(
              (b) => !existingIds.has(b._id.toString())
            );
            books = [...books, ...newBooks];
          }
        } catch (ragError) {
          console.warn("RAG query error, using fallback:", ragError.message);
        }
      }

      // Bước 5: Nếu không có books từ RAG, dùng MongoDB search
      if (books.length === 0) {
        books = await this.findBooksByQuery(entities);
      }

      // Bước 6: Tạo response text
      let responseText = ragText;
      if (!responseText || responseText.length < 20) {
        if (books.length > 0) {
          if (entities.intent === "recommendation") {
            responseText = this.buildRecommendationText(books, entities);
          } else {
            responseText = this.buildSearchResultText(books, entities);
          }
        } else {
          responseText =
            "Tôi chưa tìm được cuốn sách nào khớp với yêu cầu của bạn. Bạn có thể cho tôi biết rõ hơn về tên sách, tác giả hoặc thể loại được không?";
        }
      }

      // Bước 7: Đảm bảo books array match với response text
      // Extract book titles từ response text và filter books
      const matchedBooks = this.matchBooksWithResponse(responseText, books);

      return {
        text: responseText,
        books: matchedBooks.slice(0, 6), // Giới hạn 6 cuốn
        hasBooks: matchedBooks.length > 0,
      };
    } catch (error) {
      console.error("Error in RAGService.query:", error);
      return {
        text: "Xin lỗi, tôi gặp lỗi khi xử lý câu hỏi của bạn. Bạn có thể thử hỏi lại hoặc mô tả cụ thể hơn về cuốn sách / thể loại bạn quan tâm không?",
        books: [],
        hasBooks: false,
      };
    }
  }

  // Xử lý intent summary - tóm tắt nội dung sách
  async handleSummaryIntent(userMessage, entities) {
    const Book = require("../books/book.model");

    let books = await this.findBooksByQuery(entities);

    if (!books || books.length === 0) {
      return {
        text: "Tôi chưa tìm được cuốn sách nào khớp với mô tả của bạn. Bạn có thể cho tôi biết rõ hơn tên sách hoặc tác giả được không?",
        books: [],
        hasBooks: false,
      };
    }

    // Ưu tiên sách có rating cao hơn (nếu có)
    books = books.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    // Chọn cuốn tốt nhất để tóm tắt
    const mainBook = books[0];

    if (!this.openaiClient) {
      // Fallback: không dùng OpenAI để tóm tắt
      return {
        text: `Dưới đây là một số thông tin về cuốn "${mainBook.title}":\n\n${
          mainBook.description ||
          "Hiện chưa có mô tả chi tiết cho cuốn sách này."
        }`,
        books: [mainBook],
        hasBooks: true,
      };
    }

    try {
      const authorName =
        (mainBook.author && mainBook.author.name) ||
        (mainBook.author && mainBook.author.fullName) ||
        "Không rõ";

      let categoryNames = [];
      if (Array.isArray(mainBook.category)) {
        categoryNames = mainBook.category
          .map((c) => c && c.name)
          .filter(Boolean);
      } else if (mainBook.category && mainBook.category.name) {
        categoryNames = [mainBook.category.name];
      }

      const prompt = `
Tóm tắt nội dung cuốn sách sau cho người đọc, bằng tiếng Việt, giọng văn tự nhiên, dễ hiểu:

Tiêu đề: ${mainBook.title}
Tác giả: ${authorName}
Thể loại: ${categoryNames.join(", ")}
Mô tả: ${mainBook.description || "Không có mô tả chi tiết."}

Yêu cầu:
- Tóm tắt khoảng 2–4 đoạn ngắn.
- Làm rõ chủ đề chính, phong cách, đối tượng phù hợp.
- Không spoil toàn bộ nội dung nếu là truyện/tiểu thuyết (chỉ gợi mở).
`;

      const completion = await this.openaiClient.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 600,
      });

      const summary =
        completion.choices?.[0]?.message?.content?.trim() ||
        `Dưới đây là một số thông tin về cuốn "${mainBook.title}":\n\n${
          mainBook.description ||
          "Hiện chưa có mô tả chi tiết cho cuốn sách này."
        }`;

      return {
        text: summary,
        books: [mainBook],
        hasBooks: true,
      };
    } catch (error) {
      console.error("Error in handleSummaryIntent:", error);
      return {
        text: `Dưới đây là một số thông tin về cuốn "${mainBook.title}":\n\n${
          mainBook.description ||
          "Hiện chưa có mô tả chi tiết cho cuốn sách này."
        }`,
        books: [mainBook],
        hasBooks: true,
      };
    }
  }

  // Xử lý query bằng RAG index
  async handleRAGQuery(userMessage, entities) {
    try {
      const ragResponse = await this.queryEngine.query({
        query: userMessage,
      });

      const responseText =
        typeof ragResponse.response === "string"
          ? ragResponse.response
          : ragResponse.toString();

      // Thử lấy metadata sách từ sources (nếu LlamaIndex trả về)
      const sourceNodes = ragResponse.sourceNodes || [];
      const bookIds = [];

      for (const node of sourceNodes) {
        const meta = node.node?.metadata || node.metadata || {};
        if (meta.bookId) {
          bookIds.push(meta.bookId);
        }
      }

      let books = [];
      if (bookIds.length > 0) {
        const Book = require("../books/book.model");
        books = await Book.find({
          _id: { $in: bookIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .populate("author")
          .populate("category")
          .lean();
      } else {
        // Nếu không thu được bookId từ RAG, fallback sang MongoDB search
        books = await this.findBooksByQuery(entities);
      }

      return {
        text: responseText,
        books,
        hasBooks: books && books.length > 0,
      };
    } catch (error) {
      console.error("Error in handleRAGQuery:", error);
      // Fallback: sử dụng MongoDB search
      return await this.handleMongoFallback(userMessage, entities);
    }
  }

  // Fallback: xử lý query bằng MongoDB nếu không dùng được RAG
  async handleMongoFallback(userMessage, entities) {
    try {
      const books = await this.findBooksByQuery(entities);

      if (!books || books.length === 0) {
        return {
          text: "Tôi chưa tìm được cuốn sách nào khớp với mô tả của bạn. Bạn có thể cho tôi biết rõ hơn về thể loại, chủ đề hoặc tên sách được không?",
          books: [],
          hasBooks: false,
        };
      }

      // Với intent recommendation thì trả lời dạng gợi ý
      if (entities.intent === "recommendation") {
        const recommendationText = this.buildRecommendationText(
          books,
          entities
        );
        return {
          text: recommendationText,
          books,
          hasBooks: true,
        };
      }

      // Với intent search hoặc other thì trả lời dạng danh sách sách tìm được
      const resultText = this.buildSearchResultText(books, entities);
      return {
        text: resultText,
        books,
        hasBooks: true,
      };
    } catch (error) {
      console.error("Error in handleMongoFallback:", error);
      return {
        text: "Xin lỗi, tôi gặp lỗi khi tìm kiếm sách. Bạn có thể thử hỏi lại hoặc mô tả cụ thể hơn không?",
        books: [],
        hasBooks: false,
      };
    }
  }

  // Xử lý intent bestseller - sách bán chạy, phổ biến
  async handleBestsellerIntent(userMessage, entities) {
    const Book = require("../books/book.model");
    const Review = require("../reviews/review.model");

    // Tìm sách trending, rating cao, số lượng reviews nhiều
    const books = await Book.aggregate([
      {
        $lookup: {
          from: "reviews",
          localField: "_id",
          foreignField: "book",
          as: "reviews",
        },
      },
      {
        $addFields: {
          rating: { $avg: "$reviews.rating" },
          numReviews: { $size: "$reviews" },
        },
      },
      {
        $match: {
          $or: [
            { trending: true },
            { rating: { $gte: 4.0 } },
            { numReviews: { $gte: 5 } },
          ],
        },
      },
      {
        $lookup: {
          from: "authors",
          localField: "author",
          foreignField: "_id",
          as: "author",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $addFields: {
          author: { $arrayElemAt: ["$author", 0] },
          category: { $arrayElemAt: ["$category", 0] },
        },
      },
      {
        $sort: {
          trending: -1,
          rating: -1,
          numReviews: -1,
        },
      },
      {
        $limit: 10,
      },
    ]);

    if (books.length === 0) {
      return {
        text: "Hiện tại tôi chưa có thông tin về sách best seller. Bạn có muốn tôi gợi ý một số cuốn sách hay khác không?",
        books: [],
        hasBooks: false,
      };
    }

    const responseText = `Đây là những cuốn sách best seller, sách bán chạy và được yêu thích nhất hiện tại:\n\n${books
      .slice(0, 5)
      .map(
        (book, index) =>
          `${index + 1}. "${book.title}" - ${
            book.author?.name || "Không rõ"
          } (⭐ ${(book.rating || 0).toFixed(1)}/5, ${
            book.numReviews || 0
          } đánh giá)`
      )
      .join(
        "\n"
      )}\n\nNhững cuốn sách này đều có rating cao và được nhiều độc giả đánh giá tích cực!`;

    return {
      text: responseText,
      books: books.slice(0, 6),
      hasBooks: true,
    };
  }

  // Match books với response text - đảm bảo sách được đề cập trong text có trong books array
  matchBooksWithResponse(responseText, books) {
    if (!responseText || !books || books.length === 0) {
      return books;
    }

    // Extract book titles từ response text (tìm trong dấu ngoặc kép hoặc sau số thứ tự)
    const titlePattern = /[""]([^"""]+)[""]|(\d+\.\s*[""]?([^"""]+)[""]?)/g;
    const mentionedTitles = [];
    let match;
    while ((match = titlePattern.exec(responseText)) !== null) {
      const title = match[1] || match[3];
      if (title) {
        mentionedTitles.push(title.trim());
      }
    }

    // Nếu có titles được đề cập, ưu tiên những sách đó
    if (mentionedTitles.length > 0) {
      const matchedBooks = [];
      const unmatchedBooks = [];

      books.forEach((book) => {
        const bookTitle = book.title || "";
        const isMentioned = mentionedTitles.some((mentionedTitle) => {
          // So sánh không phân biệt hoa thường và loại bỏ dấu
          const normalize = (str) =>
            str
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/đ/g, "d")
              .replace(/Đ/g, "D");
          return (
            normalize(bookTitle).includes(normalize(mentionedTitle)) ||
            normalize(mentionedTitle).includes(normalize(bookTitle))
          );
        });

        if (isMentioned) {
          matchedBooks.push(book);
        } else {
          unmatchedBooks.push(book);
        }
      });

      // Trả về matched books trước, sau đó là unmatched
      return [...matchedBooks, ...unmatchedBooks];
    }

    // Nếu không có titles được đề cập, trả về books như cũ
    return books;
  }

  // Xây dựng text gợi ý sách
  buildRecommendationText(books, entities) {
    let intro = "Dựa trên yêu cầu của bạn, tôi gợi ý một số cuốn sách sau:\n\n";

    if (entities.categories && entities.categories.length > 0) {
      intro += `• Thể loại bạn quan tâm: ${entities.categories.join(", ")}\n`;
    }
    if (entities.keywords && entities.keywords.length > 0) {
      intro += `• Từ khóa: ${entities.keywords.join(", ")}\n`;
    }

    intro += "\nCác gợi ý:\n";

    const topBooks = books.slice(0, 5);
    const lines = topBooks.map((book, index) => {
      const authorName =
        (book.author && book.author.name) ||
        (book.author && book.author.fullName) ||
        "Không rõ";

      let categoryNames = [];
      if (Array.isArray(book.category)) {
        categoryNames = book.category.map((c) => c && c.name).filter(Boolean);
      } else if (book.category && book.category.name) {
        categoryNames = [book.category.name];
      }

      const rating = book.rating ? `${book.rating.toFixed(1)}/5` : "chưa có";

      const displayPrice = book.price?.newPrice ?? book.price?.oldPrice ?? null;

      return `${index + 1}. "${book.title}" - ${authorName}
   • Thể loại: ${categoryNames.join(", ") || "Không rõ"}
   • Đánh giá: ${rating}
   • Giá: ${displayPrice !== null ? displayPrice + "₫" : "Liên hệ"}
   • Mô tả: ${(book.description || "").slice(0, 180)}${
        (book.description || "").length > 180 ? "..." : ""
      }`;
    });

    return intro + lines.join("\n\n");
  }

  // Xây dựng text trả lời khi chỉ là tìm kiếm sách
  buildSearchResultText(books, entities) {
    const count = books.length;
    let intro = `Tôi đã tìm thấy ${count} cuốn sách phù hợp với yêu cầu của bạn.\n`;

    if (entities.bookTitle) {
      intro += `\n• Theo tiêu đề: "${entities.bookTitle}"`;
    }
    if (entities.author) {
      intro += `\n• Theo tác giả: "${entities.author}"`;
    }
    if (entities.categories && entities.categories.length > 0) {
      intro += `\n• Thể loại: ${entities.categories.join(", ")}`;
    }

    intro += "\n\nMột số cuốn tiêu biểu:\n";

    const topBooks = books.slice(0, 5);
    const lines = topBooks.map((book, index) => {
      const authorName =
        (book.author && book.author.name) ||
        (book.author && book.author.fullName) ||
        "Không rõ";

      let categoryNames = [];
      if (Array.isArray(book.category)) {
        categoryNames = book.category.map((c) => c && c.name).filter(Boolean);
      } else if (book.category && book.category.name) {
        categoryNames = [book.category.name];
      }

      const rating = book.rating ? `${book.rating.toFixed(1)}/5` : "chưa có";

      const displayPrice = book.price?.newPrice ?? book.price?.oldPrice ?? null;

      return `${index + 1}. "${book.title}" - ${authorName}
   • Thể loại: ${categoryNames.join(", ") || "Không rõ"}
   • Đánh giá: ${rating}
   • Giá: ${displayPrice !== null ? displayPrice + "₫" : "Liên hệ"}`;
    });

    return intro + lines.join("\n\n");
  }

  // Hàm rebuild index thủ công (nếu cần)
  async rebuildIndex() {
    try {
      console.log("🔄 Rebuilding RAG index...");
      this.isInitialized = false;
      await this.buildIndex();
      this.isInitialized = true;
      console.log("✅ RAG index rebuilt successfully");
    } catch (error) {
      console.error("❌ Error rebuilding index:", error);
      throw error;
    }
  }

  // === General chat cho các câu hỏi ngoài domain sách ===
  async generalChat(userMessage, userId = null) {
    // Nếu không có OpenAI client thì fallback nhẹ nhàng
    if (!this.openaiClient) {
      return {
        text: "Hiện tại tôi chỉ có thể hỗ trợ tốt nhất cho các câu hỏi liên quan đến sách và đọc sách. Bạn có thể mô tả loại sách bạn quan tâm không?",
        books: [],
        hasBooks: false,
      };
    }

    try {
      const systemPrompt = `
Bạn là trợ lý AI của một cửa hàng sách trực tuyến.
Bạn có thể:
- Trò chuyện thân thiện, giải thích khái niệm cơ bản, tư vấn phát triển bản thân, thói quen đọc sách,...
- Hỗ trợ các câu hỏi chung về mua sắm online, nhưng nếu thiếu dữ liệu cụ thể (giá ship, trạng thái đơn, thông tin tài khoản,...) hãy trả lời chung chung và khuyên người dùng liên hệ nhân viên.
- Nếu người dùng bắt đầu chuyển sang hỏi về sách, hãy nhẹ nhàng gợi ý họ nói rõ thể loại / chủ đề để bạn lựa chọn sách từ hệ thống.
Luôn trả lời bằng tiếng Việt, giọng tự nhiên, ngắn gọn, dễ hiểu.
`;

      const completion = await this.openaiClient.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.6,
        max_tokens: 400,
      });

      const answer =
        completion.choices?.[0]?.message?.content?.trim() ||
        "Xin lỗi, tôi chưa hiểu rõ câu hỏi của bạn. Bạn có thể nói rõ hơn không?";

      return {
        text: answer,
        books: [],
        hasBooks: false,
      };
    } catch (error) {
      console.error("Error in generalChat:", error);
      return {
        text: "Xin lỗi, tôi gặp lỗi khi xử lý câu hỏi này. Bạn có thể thử hỏi lại hoặc hỏi về sách bạn quan tâm không?",
        books: [],
        hasBooks: false,
      };
    }
  }
}

// Export singleton instance
const ragService = new RAGService();

// Auto-initialize khi module được load
ragService.initialize().catch((error) => {
  console.error("Failed to auto-initialize RAG service:", error);
});

module.exports = ragService;
