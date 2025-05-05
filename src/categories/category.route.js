const express = require("express");
const {
  addCategory,
  getAllCategory,
  getSingleCategory,
  updateCategory,
  deleteCategory,
} = require("./category.controller");
const verifyAdminToken = require("../middleware/verifyAdminToken");
const router = express.Router();
//tao category moi
router.post("/create", addCategory);

//xem tat ca category
router.get("/", getAllCategory);

//xem 1 category
router.get("/:id", getSingleCategory);

//cap nhat category
router.put("/edit/:id", updateCategory);

//xoa category
router.delete("/:id", deleteCategory);

module.exports = router;
