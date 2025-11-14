/**
 * Tiền xử lý văn bản cho recommendation system
 * Bao gồm: normalize, remove stopwords, tokenize
 */

const natural = require("natural");

// Stopwords tiếng Việt
const vietnameseStopwords = new Set([
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
  "cuốn",
  "quyển",
  "sách",
  "truyện",
  "tiểu thuyết",
  "tác phẩm",
]);

// Stopwords tiếng Anh
const englishStopwords = new Set([
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
  "book",
  "books",
  "novel",
  "story",
]);

// Hợp nhất stopwords
const allStopwords = new Set([...vietnameseStopwords, ...englishStopwords]);

/**
 * Chuẩn hóa text: lowercase, remove diacritics, remove special chars
 */
function normalizeText(text) {
  if (!text || typeof text !== "string") return "";

  let normalized = text.toLowerCase();

  // Loại bỏ dấu tiếng Việt
  normalized = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");

  // Loại bỏ ký tự đặc biệt, giữ lại chữ cái, số và khoảng trắng
  normalized = normalized.replace(/[^a-z0-9\s]/g, " ");

  // Xóa khoảng trắng dư
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

/**
 * Tokenize và loại bỏ stopwords
 */
function tokenize(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  // Tokenize bằng natural hoặc split đơn giản
  let tokens;
  try {
    const tokenizer = natural.WordTokenizer
      ? new natural.WordTokenizer()
      : null;
    if (tokenizer) {
      tokens = tokenizer.tokenize(normalized);
    } else {
      tokens = normalized.split(/\s+/);
    }
  } catch (error) {
    tokens = normalized.split(/\s+/);
  }

  // Loại bỏ stopwords và từ quá ngắn
  return tokens.filter(
    (token) => token.length >= 2 && !allStopwords.has(token)
  );
}

/**
 * Tạo feature vector từ text (TF-IDF ready)
 */
function createFeatureText(title, description, tags, category, author) {
  // Trọng số cho các features
  const titleWeight = 5; // Title quan trọng nhất
  const authorWeight = 4; // Author quan trọng
  const categoryWeight = 3; // Category quan trọng
  const tagsWeight = 2; // Tags quan trọng
  const descriptionWeight = 1; // Description ít quan trọng hơn

  const titleText = normalizeText(title || "");
  const authorText = normalizeText(author || "");
  const categoryText = normalizeText(category || "");
  const tagsText = Array.isArray(tags)
    ? tags.map((t) => normalizeText(t)).join(" ")
    : normalizeText(tags || "");
  const descText = normalizeText(description || "");

  // Lặp lại để tăng trọng số
  const features = [
    ...Array(titleWeight).fill(titleText),
    ...Array(authorWeight).fill(authorText),
    ...Array(categoryWeight).fill(categoryText),
    ...Array(tagsWeight).fill(tagsText),
    descText, // Description chỉ 1 lần
  ]
    .filter(Boolean)
    .join(" ");

  return features;
}

/**
 * Extract keywords từ text (loại bỏ stopwords)
 */
function extractKeywords(text) {
  return tokenize(text);
}

module.exports = {
  normalizeText,
  tokenize,
  createFeatureText,
  extractKeywords,
  allStopwords,
};
