import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Forecast7DayTable from "../components/Forecast7DayTable";
import MonthlyLineChart from "../components/MonthlyLineChart";
import StatsStrip from "../components/StatsStrip";
import UserProfileCard from "../components/UserProfileCard";
import { fetchSolarReportByUserId, fetchUserById } from "../services/api";
import { exportReportToExcel } from "../utils/exportToExcel";

const UserReportPage = () => {
	const { userId } = useParams();
	const navigate = useNavigate();
	const [user, setUser] = useState(null);
	const [report, setReport] = useState(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState("");

	const loadPageData = async (isRefresh = false) => {
		if (isRefresh) {
			setRefreshing(true);
		} else {
			setLoading(true);
		}

		setError("");

		try {
			const [userData, reportData] = await Promise.all([
				fetchUserById(userId),
				fetchSolarReportByUserId(userId)
			]);

			setUser(userData);
			setReport(reportData);
		} catch (err) {
			setError(err.message || "Failed to load report");
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	useEffect(() => {
		if (!userId) {
			navigate("/", { replace: true });
			return;
		}

		loadPageData(false);
	}, [userId, navigate]);

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_12%_16%,#d7f8e7_0,transparent_42%),radial-gradient(circle_at_88%_20%,#d8e9ff_0,transparent_44%),linear-gradient(135deg,#eff4fb_0%,#edf8f4_55%,#f6f2fe_100%)] px-4 py-8">
			<div className="mx-auto max-w-7xl">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
					<button type="button" className="min-w-32 rounded-xl border border-slate-400/60 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:shadow-md" onClick={() => navigate("/")}>Back to all users</button>
					<button type="button" className="min-w-32 rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70" onClick={() => loadPageData(true)} disabled={refreshing}>
					{refreshing ? "Refreshing..." : "Refresh report"}
				</button>
				{!loading && !error && report && (
					<button type="button" className="min-w-32 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg" onClick={() => exportReportToExcel(user, report)}>
						Download Report
					</button>
				)}
			</div>

			{loading && <p className="px-1 py-3 text-sm font-semibold text-blue-700">Generating report from AIML...</p>}
			{error && <p className="px-1 py-3 text-sm font-semibold text-rose-700">{error}</p>}

			{!loading && !error && (
				<div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
					<UserProfileCard user={user} />
					<div className="space-y-4">
						<StatsStrip report={report} />
						<MonthlyLineChart monthlyData={report?.monthly_energy_kwh} />
						<Forecast7DayTable forecast={report?.forecast_7_days} />
					</div>
				</div>
			)}
			</div>
		</div>
	);
};

export default UserReportPage;
