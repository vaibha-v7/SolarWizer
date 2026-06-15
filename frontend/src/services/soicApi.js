const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const request = async (path, options = {}, fallbackMessage = "SOIC request failed") => {
const response = await fetch(`${API_BASE_URL}${path}`, options);
let payload = null;
try {
payload = await response.json();
} catch {
payload = null;
}
if (!response.ok) {
throw new Error(payload?.message || fallbackMessage);
}
return payload?.data;
};

export const fetchSOICAlerts = () => request("/soic/alerts", {}, "Failed to fetch alerts");
export const fetchSOICActiveAlerts = () => request("/soic/alerts/status/active", {}, "Failed to fetch active alerts");
export const fetchSOICUserAlerts = (userId) => request(`/soic/alerts/user/${userId}`, {}, "Failed to fetch user alerts");
export const fetchSOICAlertsByPriority = (priority) => request(`/soic/alerts/priority/${priority}`, {}, "Failed to fetch alerts by priority");
export const fetchSOICHealthScores = () => request("/soic/health-scores", {}, "Failed to fetch health scores");
export const fetchSOICUserHealthScore = (userId) => request(`/soic/health-scores/user/${userId}`, {}, "Failed to fetch user health score");
export const fetchSOICFleetMetrics = () => request("/soic/fleet-metrics", {}, "Failed to fetch fleet metrics");
export const fetchSOICDashboard = (refresh = false) => request(`/soic/dashboard${refresh ? "?refresh=true" : ""}`, {}, "Failed to fetch SOIC dashboard");
export const fetchSOICPerformance = (userId) => request(`/soic/performance/${userId}`, {}, "Failed to fetch performance history");
export const fetchSOICTrends = (userId) => request(`/soic/trends/${userId}`, {}, "Failed to fetch trends");
export const fetchSOICWatchlist = () => request("/soic/watchlist", {}, "Failed to fetch watchlist");
export const acknowledgeSOICAlert = (alertId) => request(`/soic/alerts/${alertId}/acknowledge`, { method: "PATCH", headers: { "Content-Type": "application/json" } }, "Failed to acknowledge alert");
export const resolveSOICAlert = (alertId, payload) => request(`/soic/alerts/${alertId}/resolve`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload || {}) }, "Failed to resolve alert");
export const fetchSOICResolvedAlerts = () => request("/soic/alerts/resolved", {}, "Failed to fetch resolved alerts");

export const fetchSOICSiteHistory = (siteName, startDate, endDate) => {
	const params = new URLSearchParams({ siteName });
	if (startDate) params.append("startDate", startDate);
	if (endDate) params.append("endDate", endDate);
	return request(`/soic/alerts/history?${params.toString()}`, {}, "Failed to fetch site history");
};

export const fetchSOICSites = () => request("/soic/alerts/sites", {}, "Failed to fetch valid sites");
