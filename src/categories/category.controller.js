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
    const category = await Category.findById(id);
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
    if (!updatedCategory) {
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
    if (!deletedCategory) {
      return res.status(404).send({ message: "Category not found" });
    }
    res.status(200).send({ message: "Delete category successful" });
  } catch (error) {
    console.error("Error deleting category:", error.message);
    res.status(500).send({ message: "Failed to delete category" });
  }
};

const searchCategories = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).send({ message: "Search query is required" });
    }

    const categories = await Category.find({
      name: { $regex: name, $options: "i" }
    }).sort({ createdAt: -1 });

    if (categories.length === 0) {
      return res.status(404).send({ message: "No categories found" });
    }

    res.status(200).send(categories);
  } catch (error) {
    console.error("Error searching categories:", error.message);
    res.status(500).send({ message: "Failed to search categories" });
  }
};

module.exports = {
  addCategory,
  getAllCategory,
  getSingleCategory,
  updateCategory,
  deleteCategory,
  searchCategories,
};
