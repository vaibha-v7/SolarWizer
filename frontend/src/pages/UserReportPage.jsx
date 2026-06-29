import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DailyPredictionTable from "../components/DailyPredictionTable";
import MonthlyLineChartWithTable from "../components/MonthlyLineChartWithTable";
import StatsStrip from "../components/StatsStrip";
import UserProfileCard from "../components/UserProfileCard";
import PreviewAlertModal from "../components/PreviewAlertModal";
import {
	fetchDailyPredictionsByUserId,
	fetchMonthlyProductionByUserId,
	fetchSolarReportByUserId,
	refreshSolarReportByUserId,
	fetchUserById,
	triggerDailyPredictionByUserId
} from "../services/api";
import { fetchSOICPreviewAlert } from "../services/soicApi";
import { exportReportToExcel } from "../utils/exportToExcel";

const UserReportPage = () => {
	const { userId } = useParams();
	const navigate = useNavigate();
	const [user, setUser] = useState(null);
	const [report, setReport] = useState(null);
	const [dailyPredictions, setDailyPredictions] = useState([]);
	const [monthlyProduction, setMonthlyProduction] = useState([]);
	const [reportSource, setReportSource] = useState("pvgis");
	const [activeReportTab, setActiveReportTab] = useState("daily");
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState("");
	const [dailyPredictionError, setDailyPredictionError] = useState("");
	const [fetchingDailyPrediction, setFetchingDailyPrediction] = useState(false);
	const [refreshMetadata, setRefreshMetadata] = useState(null);
	const [previewingAlert, setPreviewingAlert] = useState(false);
	const [previewModalOpen, setPreviewModalOpen] = useState(false);
	const [previewData, setPreviewData] = useState(null);

	const readPageData = useCallback(async () => {
		const [userResult, reportResult, dailyPredictionResult, monthlyProductionResult] = await Promise.allSettled([
			fetchUserById(userId),
			fetchSolarReportByUserId(userId),
			fetchDailyPredictionsByUserId(userId),
			fetchMonthlyProductionByUserId(userId)
		]);

		if (userResult.status === "rejected") {
			throw userResult.reason;
		}

		if (reportResult.status === "rejected") {
			throw reportResult.reason;
		}

		return {
			userData: userResult.value,
			reportData: reportResult.value,
			dailyPredictionData: dailyPredictionResult.status === "fulfilled" && Array.isArray(dailyPredictionResult.value)
				? dailyPredictionResult.value
				: [],
			dailyPredictionErrorMessage: dailyPredictionResult.status === "rejected"
				? dailyPredictionResult.reason?.message || "Daily prediction history is unavailable."
				: "",
			monthlyProductionData: monthlyProductionResult.status === "fulfilled" && Array.isArray(monthlyProductionResult.value)
				? monthlyProductionResult.value
				: []
		};
	}, [userId]);

	const applyPageData = useCallback((pageData) => {
		setUser(pageData.userData);
		setReport(pageData.reportData);
		setDailyPredictions(pageData.dailyPredictionData);
		setDailyPredictionError(pageData.dailyPredictionErrorMessage);
		setMonthlyProduction(pageData.monthlyProductionData);
	}, []);

	const loadPageData = useCallback(async () => {
		setLoading(true);
		setError("");
		setDailyPredictionError("");

		try {
			const pageData = await readPageData();
			applyPageData(pageData);
		} catch (err) {
			setError(err.message || "Failed to load report");
			setDailyPredictions([]);
			setMonthlyProduction([]);
		} finally {
			setLoading(false);
		}
	}, [applyPageData, readPageData]);

	const handleRefreshReport = useCallback(async () => {
		setRefreshing(true);
		setError("");
		setRefreshMetadata(null);

		try {
			const refreshedData = await refreshSolarReportByUserId(userId);
			// Also fetch the updated monthly production to reflect new comparisons
			const monthlyProdResult = await fetchMonthlyProductionByUserId(userId);
			
			setReport(refreshedData.report);
			if (refreshedData.metadata) {
				setRefreshMetadata(refreshedData.metadata);
			}
			setMonthlyProduction(Array.isArray(monthlyProdResult) ? monthlyProdResult : []);
		} catch (err) {
			setError(err.message || "Failed to refresh report");
		} finally {
			setRefreshing(false);
		}
	}, [userId]);

	const handleFetchDailyPredictionNow = useCallback(async () => {
		setFetchingDailyPrediction(true);
		setDailyPredictionError("");

		try {
			await triggerDailyPredictionByUserId(userId);
			const [predictionData, monthlyData] = await Promise.all([
				fetchDailyPredictionsByUserId(userId),
				fetchMonthlyProductionByUserId(userId)
			]);
			setDailyPredictions(Array.isArray(predictionData) ? predictionData : []);
			setMonthlyProduction(Array.isArray(monthlyData) ? monthlyData : []);
		} catch (err) {
			setDailyPredictionError(err.message || "Failed to fetch daily prediction now.");
		} finally {
			setFetchingDailyPrediction(false);
		}
	}, [userId]);

	const handlePreviewAlert = useCallback(async () => {
		setPreviewingAlert(true);
		try {
			const latestDate = dailyPredictions[0]?.date || new Date().toISOString().split("T")[0];
			const result = await fetchSOICPreviewAlert(userId, latestDate);
			if (result) {
				setPreviewData(result);
				setPreviewModalOpen(true);
			} else {
				alert("No preview payload returned. This usually means the system is healthy.");
			}
		} catch (err) {
			alert(`Preview Failed: ${err.message}`);
		} finally {
			setPreviewingAlert(false);
		}
	}, [userId, dailyPredictions]);

	useEffect(() => {
		if (!userId) {
			navigate("/", { replace: true });
			return;
		}

		let isActive = true;

		const loadInitialPageData = async () => {
			await Promise.resolve();

			if (!isActive) return;

			setLoading(true);
			setError("");
			setDailyPredictionError("");

			try {
				const pageData = await readPageData();

				if (!isActive) return;

				applyPageData(pageData);
			} catch (err) {
				if (!isActive) return;

				setError(err.message || "Failed to load report");
				setDailyPredictions([]);
			} finally {
				if (isActive) {
					setLoading(false);
					setRefreshing(false);
				}
			}
		};

		loadInitialPageData();

		return () => {
			isActive = false;
		};
	}, [userId, navigate, readPageData, applyPageData]);

	const selectedReportData = report?.[reportSource] ?? report ?? null;

	return (
		<div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-4 sm:py-6">
			<div className="mx-auto max-w-7xl">
				<div className="mb-5">
					<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Solar Report</p>
					<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">User Report Overview</h1>
				</div>

				{loading && (
					<div className="flex flex-col items-center justify-center py-20 text-blue-600">
						<svg className="h-10 w-10 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
							<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						<p className="mt-4 text-sm font-semibold text-slate-600">Loading analytical report...</p>
					</div>
				)}

				{!loading && error && (
					<div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-5 shadow-sm text-center">
						<p className="text-sm font-semibold text-rose-700">{error}</p>
						<button 
							type="button" 
							onClick={() => navigate("/")}
							className="mt-4 rounded-xl border border-slate-400/60 bg-white px-6 py-2 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:shadow-md"
						>
							Back to Dashboard
						</button>
					</div>
				)}

				{!loading && !error && (
					<>
						<div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 lg:gap-3">
							<button 
								type="button" 
								onClick={() => navigate("/")}
								className="w-full rounded-xl border border-slate-400/60 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:shadow-md"
							>
								Back to Dashboard
							</button>
							<button 
								type="button" 
								onClick={handleRefreshReport}
								disabled={refreshing}
								className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
							>
								{refreshing ? "Refreshing..." : "Refresh report"}
							</button>
							{report && (
								<button 
									type="button" 
									onClick={() => exportReportToExcel(selectedReportData, user, {
										dailyPredictions,
										source: reportSource
									})}
									className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg"
								>
									Download Report
								</button>
							)}
						</div>

						{refreshMetadata && (
							<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
								<p className="text-sm font-semibold text-emerald-800">Report refreshed successfully</p>
								<div className="mt-1 flex flex-wrap gap-4 text-xs text-emerald-700">
									<span>Last refreshed: {new Date(refreshMetadata.refreshed_at).toLocaleString()}</span>
									<span>Model: {refreshMetadata.prediction_model}</span>
									<span>Months Updated: {refreshMetadata.months_updated}</span>
									<span>Unchanged: {refreshMetadata.months_unchanged}</span>
								</div>
							</div>
						)}

						<div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
						<UserProfileCard user={user} />
						<div className="space-y-4">
							<div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between">
								<div className="inline-flex w-full items-center gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto">
									<button
										type="button"
										className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
											activeReportTab === "monthly"
												? "bg-slate-900 text-white shadow"
												: "text-slate-600 hover:bg-white hover:text-slate-900"
										}`}
										onClick={() => setActiveReportTab("monthly")}
									>
										Monthly Report
									</button>
									<button
										type="button"
										className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
											activeReportTab === "daily"
												? "bg-slate-900 text-white shadow"
												: "text-slate-600 hover:bg-white hover:text-slate-900"
										}`}
										onClick={() => setActiveReportTab("daily")}
									>
										Daily Predictions
									</button>
								</div>

								{activeReportTab === "monthly" && (
									<div className="inline-flex w-full items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-auto">
										<button
											type="button"
											className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
												reportSource === "pvgis"
													? "bg-emerald-600 text-white shadow"
													: "text-slate-600 hover:bg-white hover:text-slate-900"
											}`}
											onClick={() => setReportSource("pvgis")}
										>
											PVGIS
										</button>
										<button
											type="button"
											className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
												reportSource === "pvwatts"
													? "bg-blue-600 text-white shadow"
													: "text-slate-600 hover:bg-white hover:text-slate-900"
											}`}
											onClick={() => setReportSource("pvwatts")}
										>
											PVWATTS
										</button>
									</div>
								)}
							</div>

							{activeReportTab === "monthly" ? (
								<>
									<StatsStrip report={selectedReportData} source={reportSource} />
									<MonthlyLineChartWithTable 
										predictions={selectedReportData?.monthly_energy_kwh} 
										actuals={monthlyProduction} 
									/>
								</>
							) : (
								<DailyPredictionTable
									predictions={dailyPredictions}
									loading={loading}
									error={dailyPredictionError}
									fetching={fetchingDailyPrediction}
									onFetchNow={handleFetchDailyPredictionNow}
									onPreviewAlert={handlePreviewAlert}
									previewing={previewingAlert}
								/>
							)}
						</div>
					</div>
					</>
				)}
			</div>

			<PreviewAlertModal
				isOpen={previewModalOpen}
				onClose={() => setPreviewModalOpen(false)}
				previewData={previewData}
				siteName={user?.name || "Unknown Site"}
				businessDate={dailyPredictions[0]?.date || new Date().toISOString().split("T")[0]}
				isRefreshing={previewingAlert}
				onRefresh={handlePreviewAlert}
			/>
		</div>
	);
};

export default UserReportPage;
