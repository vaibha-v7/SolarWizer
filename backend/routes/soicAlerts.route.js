const express = require("express");
const {
getAlerts,
getUserAlerts,
getActiveAlerts,
getAlertsByPriority,
getHealthScores,
getUserHealthScore,
getFleetMetrics,
getSitePerformance,
getSiteTrends,
getWatchlist,
getDashboard,
acknowledgeAlert,
resolveAlert
} = require("../controllers/soicAlerts.controller");
const { initializeSOICScheduler } = require("../services/soicScheduler");

const router = express.Router();

initializeSOICScheduler();

router.get("/alerts", getAlerts);
router.get("/alerts/user/:userId", getUserAlerts);
router.get("/alerts/status/active", getActiveAlerts);
router.get("/alerts/priority/:priority", getAlertsByPriority);
router.get("/health-scores", getHealthScores);
router.get("/health-scores/user/:userId", getUserHealthScore);
router.get("/fleet-metrics", getFleetMetrics);
router.get("/performance/:userId", getSitePerformance);
router.get("/trends/:userId", getSiteTrends);
router.get("/watchlist", getWatchlist);
router.get("/dashboard", getDashboard);
router.patch("/alerts/:alertId/acknowledge", acknowledgeAlert);
router.patch("/alerts/:alertId/resolve", resolveAlert);

module.exports = router;
