const express = require("express");
const { getDashboard, acknowledgeAlert, resolveAlert, getResolvedAlerts, getSiteAlertHistory, generateReportPDF, generateReportExcel, getValidSites } = require("../controllers/soicAlerts.controller");
const { initializeSOICScheduler } = require("../services/soicScheduler");
const { initializeSOICAlertScheduler } = require("../services/soicAlertScheduler");

const router = express.Router();

initializeSOICScheduler();
initializeSOICAlertScheduler();

router.get("/dashboard", getDashboard);
router.get("/alerts/resolved", getResolvedAlerts);

router.get("/alerts/sites", getValidSites);
router.get("/alerts/history", getSiteAlertHistory);
router.get("/alerts/history/report/pdf", generateReportPDF);
router.get("/alerts/history/report/excel", generateReportExcel);

router.patch("/alerts/:id/acknowledge", acknowledgeAlert);
router.patch("/alerts/:id/resolve", resolveAlert);

module.exports = router;
