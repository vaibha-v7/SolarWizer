const express = require("express");
const { getDashboard } = require("../controllers/soicAlerts.controller");
const { initializeSOICScheduler } = require("../services/soicScheduler");

const router = express.Router();

initializeSOICScheduler();

router.get("/dashboard", getDashboard);

module.exports = router;
