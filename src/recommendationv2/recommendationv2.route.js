const express = require("express");
const router = express.Router();
const { getCollaborativeRecommendations } = require("./recommendationv2.controller");
const { getContextualRecommendations } = require("./contextual.controller");
const verifyToken = require("../middleware/verifyToken");

router.get("/collaborative", verifyToken, getCollaborativeRecommendations);
router.get("/contextual", getContextualRecommendations);

module.exports = router;