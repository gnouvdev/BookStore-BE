const Category = require("./category.model");

const addCategory = async (req, res) => {
  try {
    const newCategory = await Category(req.body);
    await newCategory.save();
    res
      .status(200)
      .send({ message: "Category added successfully", Category: newCategory });
  } catch (error) {
    res.status(500).send({ message: "Failed to create category", error });
  }
};

const getAllCategory = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.status(200).send(categories);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch category!" });
  }
};

const getSingleCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id); // Sửa lỗi ở đây
    if (!category) {
      return res.status(404).send({ message: "Category not found!" });
    }
    res.status(200).send(category);
  } catch (error) {
    console.error("Error fetching category:", error.message);
    res.status(500).send({ message: "Failed to fetch category!" });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { ...req.body },
      { new: true }
    );
    if (!updatedCategory) { // Sửa lỗi ở đây
      return res.status(404).send({ message: "Category not found" });
    }
    res.status(200).send({ message: "Update category successful", category: updatedCategory });
  } catch (error) {
    console.error("Error updating category:", error.message);
    res.status(500).send({ message: "Failed to update category!" });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedCategory = await Category.findByIdAndDelete(id);
    if (!deletedCategory) { // Sửa lỗi ở đây
      return res.status(404).send({ message: "Category not found" });
    }
    res.status(200).send({ message: "Delete category successful" });
  } catch (error) {
    console.error("Error deleting category:", error.message);
    res.status(500).send({ message: "Failed to delete category" });
  }
};

module.exports = {
  addCategory,
  getAllCategory,
  getSingleCategory,
  updateCategory,
  deleteCategory,
};
