const express = require("express");
const {
	createUserData,
	generateSolarReportForUser
} = require("../controllers/userData.controller");

const router = express.Router();

router.post("/enter", createUserData);
router.get("/:userId/solar-report", generateSolarReportForUser);

module.exports = router;
