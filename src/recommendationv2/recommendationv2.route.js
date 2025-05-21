const express = require("express");
const router = express.Router();
const { getCollaborativeRecommendations } = require("./recommendationv2.controller");
const verifyToken = require("../middleware/verifyToken");

router.get("/collaborative", verifyToken, getCollaborativeRecommendations);

module.exports = router;