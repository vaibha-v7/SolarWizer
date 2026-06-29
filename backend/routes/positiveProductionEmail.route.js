const express = require("express");
const {
	triggerPositiveProductionEmails,
	listPositiveProductionEmailLogs,
	verifyPositiveProductionEmailConfig
} = require("../controllers/positiveProductionEmail.controller");

const router = express.Router();

router.post("/positive-production/trigger", triggerPositiveProductionEmails);
router.post("/users/:userId/positive-production/trigger", triggerPositiveProductionEmails);
router.get("/positive-production/logs", listPositiveProductionEmailLogs);
router.get("/users/:userId/positive-production/logs", listPositiveProductionEmailLogs);
router.get("/positive-production/verify", verifyPositiveProductionEmailConfig);

module.exports = router;
