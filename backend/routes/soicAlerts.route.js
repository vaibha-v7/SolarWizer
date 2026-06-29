const express = require("express");
const { getDashboard, acknowledgeAlert, resolveAlert, getResolvedAlerts, getSiteAlertHistory, generateReportPDF, generateReportExcel, getValidSites, getOperationalHealth, previewAlertEvaluation, runManualEvaluation } = require("../controllers/soicAlerts.controller");

const router = express.Router();

router.get("/dashboard", getDashboard);
router.get("/health", getOperationalHealth);
router.get("/alerts/resolved", getResolvedAlerts);

router.get("/alerts/sites", getValidSites);
router.get("/alerts/history", getSiteAlertHistory);
router.get("/alerts/history/report/pdf", generateReportPDF);
router.get("/alerts/history/report/excel", generateReportExcel);

router.get("/alerts/preview/:userId", previewAlertEvaluation);
router.post("/alerts/manual-evaluation", runManualEvaluation);

router.patch("/alerts/:id/acknowledge", acknowledgeAlert);
router.patch("/alerts/:id/resolve", resolveAlert);

module.exports = router;
