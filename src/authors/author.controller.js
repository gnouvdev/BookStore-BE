const Author = require("./author.model");

// Thêm tác giả
const addAuthor = async (req, res) => {
  try {
    const newAuthor = await Author(req.body);
    await newAuthor.save();
    res
      .status(200)
      .send({ message: "Author added successfully", author: newAuthor });
  } catch (error) {
    console.error("Error creating author", error);
    res.status(500).send({ message: "Failed to create author", error });
  }
};

// Lấy tất cả tác giả
const getAllAuthors = async (req, res) => {
  try {
    const authors = await Author.find().sort({ createdAt: -1 });
    res.status(200).send(authors);
  } catch (error) {
    console.log("Error fetching authors", error);
    res.status(500).send({ message: "Failed to fetch authors" });
  }
};

// Lấy 1 tác giả
const getSingleAuthor = async (req, res) => {
  try {
    const { id } = req.params;
    const author = await Author.findById(id);
    if (!author) {
      return res.status(404).send({ message: "Author not found" });
    }
    res.status(200).send(author);
  } catch (error) {
    console.error("Error fetching author:", error);
    res.status(500).send({ message: "Failed to fetch author" });
  }
};

// Cập nhật tác giả
const updateAuthor = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Author.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).send({ message: "Author not found" });
    res.status(200).send({ message: "Author updated", author: updated });
  } catch (error) {
    console.log("Error updating author", error);
    res.status(500).send({ message: "Failed to update author" });
  }
};

//search tác giả
const searchAuthors = async (req, res) => {
  const { name } = req.query; // Lấy tham số từ query string

  if (!name) {
    return res.status(400).json({ error: "Name query parameter is required." });
  }

  try {
    // Tìm kiếm tác giả theo tên (dùng regex để tìm kiếm không phân biệt hoa thường)
    const authors = await Author.find({
      name: { $regex: name, $options: "i" }, // 'i' là không phân biệt chữ hoa, chữ thường
    });

    if (authors.length === 0) {
      return res.status(404).json({ message: "No authors found" });
    }

    console.log("✅ Found authors:", authors); // Log kết quả tìm thấy

    res.json(authors); // Trả về kết quả
  } catch (error) {
    console.error("❌ Error searching authors:", error);
    res.status(500).json({ error: "Search failed" });
  }
};

// Xóa tác giả
const deleteAuthor = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Author.findByIdAndDelete(id);
    if (!deleted) return res.status(404).send({ message: "Author not found" });
    res.status(200).send({ message: "Author deleted", author: deleted });
  } catch (error) {
    console.log("Error deleting author", error);
    res.status(500).send({ message: "Failed to delete author" });
  }
};

module.exports = {
  addAuthor,
  getAllAuthors,
  getSingleAuthor,
  updateAuthor,
  deleteAuthor,
  searchAuthors,
};
