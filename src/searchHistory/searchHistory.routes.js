const express = require("express");
const router = express.Router();
const searchHistoryController = require("./searchHistory.controller");
const  verifyToken  = require("../middleware/verifyToken");

router.post("/", verifyToken, searchHistoryController.addSearch);
router.get("/", verifyToken, searchHistoryController.getSearchHistory);
router.delete("/:id", verifyToken, searchHistoryController.deleteSearchHistory);

module.exports = router;
