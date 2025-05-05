const express = require("express");
const router = express.Router();
const { loginWithFirebase, googleLogin } = require("./auth.controller");

router.post("/login", loginWithFirebase);
router.post("/google", googleLogin);

module.exports = router;