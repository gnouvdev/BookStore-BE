const Book = require("../books/book.model");
const specialEvents = require("../utils/specialEvents");
const moment = require("moment");

exports.getContextualRecommendations = async (req, res) => {
  try {
    const today = moment().format("DD/MM");
    const event = specialEvents.find((e) => e.date === today);

    if (!event) {
      return res.status(200).json({ data: [], message: "No special event today." });
    }

    const recommendedBooks = await Book.find({
      $or: [
        { title: { $in: event.keywords.map((kw) => new RegExp(kw, "i")) } },
        { description: { $in: event.keywords.map((kw) => new RegExp(kw, "i")) } },
        { tags: { $in: event.keywords.map((kw) => new RegExp(kw, "i")) } },
      ],
    })
      .limit(10)
      .populate("author", "name")
      .populate("category", "name");

    res.status(200).json({ data: recommendedBooks, message: event.message });
  } catch (error) {
    console.error("Error in getContextualRecommendations:", error);
    res.status(500).json({ message: "Server error" });
  }
};
