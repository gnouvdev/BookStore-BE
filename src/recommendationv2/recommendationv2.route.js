const express = require("express");
const router = express.Router();
const {
  getCollaborativeRecommendations,
  getContextualRecommendations,
} = require("./recommendationv2.controller");
const verifyToken = require("../middleware/verifyToken");

router.get("/collaborative", verifyToken, getCollaborativeRecommendations);
router.get("/contextual", verifyToken, getContextualRecommendations);

module.exports = router;
