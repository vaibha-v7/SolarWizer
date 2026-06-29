const express = require("express");
const {
	createUserData,
	listUserData,
	getUserDataById,
	getSolarReportForUser,
	refreshSolarReportForUser,
	deleteUserData,
	updateUserData,
	getMonthlyProductionForUser
} = require("../controllers/userData.controller");

const router = express.Router();

router.post("/enter", createUserData);
router.get("/users", listUserData);
router.get("/users/:userId", getUserDataById);
router.get("/users/:userId/solar-report", getSolarReportForUser);
router.get("/:userId/solar-report", getSolarReportForUser);
router.post("/users/:userId/solar-report/refresh", refreshSolarReportForUser);
router.get("/users/:userId/monthly-production", getMonthlyProductionForUser);
router.put("/users/:userId", updateUserData);
router.delete("/users/:userId", deleteUserData);

module.exports = router;
