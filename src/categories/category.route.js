const express = require("express");
const {
  addCategory,
  getAllCategory,
  getSingleCategory,
  updateCategory,
  deleteCategory,
  searchCategories,
} = require("./category.controller");
const verifyAdminToken = require("../middleware/verifyAdminToken");
const router = express.Router();

//tao category moi
router.post("/create", addCategory);

//xem tat ca category
router.get("/", getAllCategory);

//tim kiem category
router.get("/search", searchCategories);

//xem 1 category
router.get("/:id", getSingleCategory);

//cap nhat category
router.put("/edit/:id", updateCategory);

//xoa category
router.delete("/:id", deleteCategory);

module.exports = router;
