const express = require("express");
  const router = express.Router();
  const verifyToken = require("../middleware/verifyToken");
  const viewHistoryController = require("../viewHistory/viewHistory.controller");

  router.post("/", verifyToken, viewHistoryController.addView);

  module.exports = router;