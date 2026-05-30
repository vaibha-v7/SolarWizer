const mongoose = require("mongoose");

const fleetPerformanceMetricsSchema = new mongoose.Schema(
{
snapshot_date: { type: String, required: true, unique: true, index: true },
fleet_avg_performance_ratio: { type: Number, default: 0 },
fleet_median_performance_ratio: { type: Number, default: 0 },
fleet_std_dev: { type: Number, default: 0 },
p10_performance: { type: Number, default: 0 },
p25_performance: { type: Number, default: 0 },
p50_performance: { type: Number, default: 0 },
p75_performance: { type: Number, default: 0 },
p90_performance: { type: Number, default: 0 },
total_sites: { type: Number, default: 0 },
healthy_sites: { type: Number, default: 0 },
warning_sites: { type: Number, default: 0 },
critical_sites: { type: Number, default: 0 },
offline_sites: { type: Number, default: 0 },
by_inverter_type: { type: Object, default: {} },
by_age_cohort: { type: Object, default: {} },
by_capacity: { type: Object, default: {} },
top_5_best_performers: { type: [Object], default: [] },
top_5_worst_performers: { type: [Object], default: [] },
calculated_at: { type: Date, default: Date.now }
},
{
collection: "fleet_performance_metrics",
timestamps: { createdAt: false, updatedAt: "updated_at" }
}
);

module.exports = mongoose.model("FleetPerformanceMetrics", fleetPerformanceMetricsSchema);
