const express = require("express");
const { legacyRouter } = require("./legacy");
const { authRouter } = require("./auth");

const router = express.Router();

router.use("/auth", authRouter);

// Keep existing routes for the current frontend
router.use("/", legacyRouter);

// Also expose a versioned API for future evolution
router.use("/api/v1", legacyRouter);

module.exports = { apiRouter: router };



