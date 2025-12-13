const Book = require("../books/book.model");

const MODEL_TTL = 1000 * 60 * 60 * 6; // rebuild every 6h

const VI_STOPWORDS = [
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

const EN_STOPWORDS = [
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

const STOPWORDS = new Set([...VI_STOPWORDS, ...EN_STOPWORDS]);

const modelState = {
  ready: false,
  lastBuilt: 0,
  docCount: 0,
  idf: {},
  entries: [],
  stats: {
    maxNumReviews: 1,
  },
};

const normalizeText = (text = "") =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (text) => {
  if (!text) return [];
  const normalized = normalizeText(text);
  return normalized
    .split(" ")
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
};

const computeNorm = (vector) => {
  let sum = 0;
  for (const weight of Object.values(vector)) {
    sum += weight * weight;
  }
  return Math.sqrt(sum) || 1;
};

const ensureModelFresh = async () => {
  const stale = Date.now() - modelState.lastBuilt > MODEL_TTL;
  if (modelState.ready && !stale) return;
  await buildModel();
};

const buildModel = async () => {
  console.log("[ContextualModel] rebuilding book embeddings...");
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
      $project: {
        _id: 1,
        title: 1,
        description: 1,
        coverImage: 1,
        price: 1,
        rating: { $ifNull: ["$rating", 0] },
        numReviews: { $ifNull: ["$numReviews", 0] },
        author: { _id: 1, name: 1 },
        category: { _id: 1, name: 1 },
        tags: 1,
        trending: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);

  const docFreq = {};
  const rawEntries = [];

  books.forEach((book) => {
    const textParts = [
      book.title,
      book.description,
      Array.isArray(book.tags) ? book.tags.join(" ") : "",
      book.category?.name,
      book.author?.name,
    ].filter(Boolean);
    const tokens = tokenize(textParts.join(" "));
    if (!tokens.length) return;

    const termFreq = {};
    tokens.forEach((token) => {
      termFreq[token] = (termFreq[token] || 0) + 1;
    });

    Object.keys(termFreq).forEach((token) => {
      docFreq[token] = (docFreq[token] || 0) + 1;
    });

    rawEntries.push({
      book,
      termFreq,
      tokenCount: tokens.length,
      meta: {
        rating: book.rating || 0,
        numReviews: book.numReviews || 0,
        trending: Boolean(book.trending),
        createdAt: book.createdAt,
      },
    });
  });

  modelState.docCount = rawEntries.length || 1;
  modelState.idf = {};
  Object.entries(docFreq).forEach(([token, df]) => {
    modelState.idf[token] = Math.log((1 + modelState.docCount) / (1 + df)) + 1;
  });

  const maxReviews = rawEntries.reduce(
    (acc, entry) => Math.max(acc, entry.meta.numReviews || 0),
    1
  );

  modelState.stats.maxNumReviews = Math.max(maxReviews, 1);

  modelState.entries = rawEntries.map((entry) => {
    const vector = {};
    Object.entries(entry.termFreq).forEach(([token, count]) => {
      if (!modelState.idf[token]) return;
      const tf = count / entry.tokenCount;
      vector[token] = tf * modelState.idf[token];
    });

    return {
      id: entry.book._id.toString(),
      vector,
      norm: computeNorm(vector),
      meta: entry.meta,
      book: entry.book,
    };
  });

  modelState.ready = true;
  modelState.lastBuilt = Date.now();
  console.log(
    `[ContextualModel] built ${
      modelState.entries.length
    } embeddings, vocab size ${Object.keys(modelState.idf).length}`
  );
};

const buildQueryVector = (holidayContext) => {
  if (!holidayContext) return null;
  const keywords = new Set(holidayContext.tags || []);
  if (holidayContext.holidayName) {
    holidayContext.holidayName
      .split(/[&,/]/)
      .map((name) => name.trim())
      .filter(Boolean)
      .forEach((name) => {
        tokenize(name).forEach((token) => keywords.add(token));
      });
  }

  if (!keywords.size) return null;

  const tokens = Array.from(keywords).flatMap((keyword) => tokenize(keyword));
  if (!tokens.length) return null;

  const tf = {};
  tokens.forEach((token) => {
    if (!modelState.idf[token]) return;
    tf[token] = (tf[token] || 0) + 1;
  });

  const vector = {};
  const timeBoost = holidayContext.isHoliday
    ? 1.2
    : holidayContext.isNearHoliday
    ? 1 + Math.max(0, 7 - (holidayContext.daysUntil || 0)) * 0.05
    : 0.8;

  Object.entries(tf).forEach(([token, count]) => {
    const tfNorm = count / tokens.length;
    vector[token] = tfNorm * modelState.idf[token] * timeBoost;
  });

  const norm = computeNorm(vector);
  return {
    vector,
    norm,
    tokens: Object.keys(vector),
  };
};

const cosineSimilarity = (bookVector, queryVector, bookNorm, queryNorm) => {
  let dot = 0;
  for (const [token, weight] of Object.entries(queryVector)) {
    if (bookVector[token]) {
      dot += bookVector[token] * weight;
    }
  }
  if (!dot) return 0;
  return dot / (bookNorm * queryNorm || 1);
};

const computePopularityScore = (meta, stats) => {
  const ratingComponent = (meta.rating || 0) / 5;
  const reviewComponent = Math.min(
    1,
    Math.log10((meta.numReviews || 0) + 1) / Math.log10(stats.maxNumReviews + 1)
  );
  const trendingBoost = meta.trending ? 0.15 : 0;
  return Math.min(
    1,
    ratingComponent * 0.6 + reviewComponent * 0.3 + trendingBoost
  );
};

const computeRecencyScore = (date) => {
  if (!date) return 0.5;
  const ageDays =
    (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= 90) return 1;
  if (ageDays <= 180) return 0.85;
  if (ageDays <= 365) return 0.7;
  return 0.5;
};

const rankBooksByContext = (query, limit) => {
  if (!query) {
    return modelState.entries
      .slice()
      .sort(
        (a, b) =>
          computePopularityScore(b.meta, modelState.stats) -
          computePopularityScore(a.meta, modelState.stats)
      )
      .slice(0, limit)
      .map((entry) => entry.book);
  }

  const scored = [];
  for (const entry of modelState.entries) {
    const similarity = cosineSimilarity(
      entry.vector,
      query.vector,
      entry.norm,
      query.norm
    );
    if (similarity <= 0) continue;
    const popularity = computePopularityScore(entry.meta, modelState.stats);
    const recency = computeRecencyScore(entry.meta.createdAt);
    const score = similarity * 0.6 + popularity * 0.3 + recency * 0.1;
    if (score > 0) {
      scored.push({ book: entry.book, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((item) => item.book);
};

const getContextualModelRecommendations = async ({
  holidayContext,
  limit = 12,
} = {}) => {
  await ensureModelFresh();
  const query = buildQueryVector(holidayContext);
  const books = rankBooksByContext(query, limit);
  return {
    books,
    debug: {
      tokens: query?.tokens || [],
      usedModel: true,
      vectorSize: query ? Object.keys(query.vector).length : 0,
    },
  };
};

module.exports = {
  getContextualModelRecommendations,
  rebuildContextualModel: () => buildModel(),
};
