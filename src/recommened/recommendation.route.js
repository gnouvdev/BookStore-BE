const express = require("express");
const router = express.Router();
const { getRecommendations } = require("./recommendation.controller");
const mongoose = require("mongoose");

router.get("/:id", getRecommendations);

module.exports = router;
