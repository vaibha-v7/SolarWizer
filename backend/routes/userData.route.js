const express = require("express");
const {
	createUserData,
	listUserData,
	getUserDataById,
	generateSolarReportForUser
} = require("../controllers/userData.controller");

const router = express.Router();

router.post("/enter", createUserData);
router.get("/users", listUserData);
router.get("/users/:userId", getUserDataById);
router.get("/users/:userId/solar-report", generateSolarReportForUser);
router.get("/:userId/solar-report", generateSolarReportForUser);

module.exports = router;
