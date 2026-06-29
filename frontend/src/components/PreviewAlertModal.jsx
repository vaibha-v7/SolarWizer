import React, { useEffect, useState } from "react";

const getSeverityBadgeClasses = (severity) => {
	switch (severity) {
		case "HEALTHY":
			return "bg-emerald-100 text-emerald-800";
		case "YELLOW":
		case "WARNING":
			return "bg-yellow-100 text-yellow-800";
		case "ORANGE":
		case "MAJOR":
			return "bg-orange-100 text-orange-800";
		case "RED":
		case "CRITICAL":
			return "bg-red-100 text-red-800";
		case "OFFLINE":
			return "bg-slate-800 text-slate-100";
		default:
			return "bg-slate-100 text-slate-700";
	}
};

const getActionBadgeClasses = (action) => {
	switch (action) {
		case "NO_ACTION":
			return "bg-slate-100 text-slate-700";
		case "CREATE_ALERT":
			return "bg-rose-100 text-rose-800";
		case "UPGRADE_ALERT":
			return "bg-orange-100 text-orange-800";
		case "RESOLVE_ALERT":
			return "bg-emerald-100 text-emerald-800";
		case "UPDATE_ALERT":
			return "bg-blue-100 text-blue-800";
		default:
			return "bg-slate-100 text-slate-700";
	}
};

const PreviewAlertModal = ({ isOpen, onClose, previewData, siteName, businessDate, isRefreshing, onRefresh }) => {
	const [show, setShow] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setShow(true);
		} else {
			const timer = setTimeout(() => setShow(false), 200);
			return () => clearTimeout(timer);
		}
	}, [isOpen]);

	if (!show && !isOpen) return null;

	return (
		<div className="relative z-50">
			<div 
				className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`} 
				onClick={onClose} 
			/>

			<div className="fixed inset-0 overflow-y-auto">
				<div className="flex min-h-full items-center justify-center p-4 text-center">
					<div 
						className={`w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all duration-300 ${isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}
					>
						<h3 className="text-xl font-bold leading-6 text-slate-900 flex justify-between items-center mb-4">
							Preview Alert Evaluation
							<span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
								Dry Run
							</span>
						</h3>

						{previewData && (
							<>
								<div className="text-sm text-slate-500 mb-6 border-b pb-4">
									<p><strong>Site:</strong> {siteName}</p>
									<p><strong>Date:</strong> {businessDate}</p>
								</div>

								<div className="grid grid-cols-2 gap-4 mb-6">
									<div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
										<p className="text-xs font-semibold text-slate-500 uppercase">Prediction</p>
										<p className="text-lg font-bold text-slate-900">{previewData.predicted_kwh?.toFixed(2) || "0.00"} kWh</p>
									</div>
									<div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
										<p className="text-xs font-semibold text-slate-500 uppercase">Actual Generation</p>
										<p className="text-lg font-bold text-slate-900">{previewData.actual_kwh?.toFixed(2) || "0.00"} kWh</p>
									</div>
									<div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
										<p className="text-xs font-semibold text-slate-500 uppercase">Performance</p>
										<p className={`text-lg font-bold ${previewData.expected_performance === null ? "text-slate-500" : previewData.expected_performance >= 90 ? "text-emerald-600" : "text-rose-600"}`}>
											{previewData.expected_performance === null ? "N/A" : `${previewData.expected_performance}%`}
										</p>
									</div>
									<div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
										<p className="text-xs font-semibold text-slate-500 uppercase">Difference</p>
										<p className={`text-lg font-bold ${previewData.difference_kwh >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
											{previewData.difference_kwh > 0 ? "+" : ""}{previewData.difference_kwh} kWh
										</p>
									</div>
								</div>

								<div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6">
									<h4 className="text-sm font-bold text-slate-900 mb-3 border-b pb-2">Engine State Preview</h4>
									<div className="space-y-3">
										<div className="flex justify-between items-center">
											<span className="text-sm text-slate-600 font-medium">Current Alert State</span>
											<span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getSeverityBadgeClasses(previewData.current_severity)}`}>
												{previewData.current_severity}
											</span>
										</div>
										<div className="flex justify-between items-center">
											<span className="text-sm text-slate-600 font-medium">Expected Action</span>
											<span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getActionBadgeClasses(previewData.expected_action)}`}>
												{previewData.expected_action.replace("_", " ")}
											</span>
										</div>
										<div className="flex justify-between items-center">
											<span className="text-sm text-slate-600 font-medium">Expected Severity</span>
											<span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getSeverityBadgeClasses(previewData.expected_severity)}`}>
												{previewData.expected_severity}
											</span>
										</div>
										<div className="flex justify-between items-center">
											<span className="text-sm text-slate-600 font-medium">Consecutive Days</span>
											<span className="text-sm font-bold text-slate-900 bg-white px-2 py-1 rounded border border-slate-300 shadow-sm">
												{previewData.consecutive_days} {previewData.consecutive_days === 1 ? 'Day' : 'Days'}
											</span>
										</div>
									</div>
								</div>
							</>
						)}

						{!previewData && (
							<div className="py-8 text-center text-slate-500">
								Loading preview data...
							</div>
						)}

						<div className="mt-4 rounded-md bg-blue-50 p-4 border border-blue-100 mb-6">
							<div className="flex">
								<div className="ml-3">
									<h3 className="text-sm font-medium text-blue-800">Preview Mode Active</h3>
									<div className="mt-2 text-sm text-blue-700">
										<p>
											Preview mode simulates the Alert Engine using the current data. No database records, notifications, scheduler state, or monitoring history have been modified.
										</p>
									</div>
								</div>
							</div>
						</div>

						<div className="mt-4 flex justify-end gap-3">
							<button
								type="button"
								className="inline-flex justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 transition"
								onClick={onClose}
							>
								Close
							</button>
							<button
								type="button"
								className="inline-flex justify-center rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 transition disabled:opacity-50"
								onClick={onRefresh}
								disabled={isRefreshing}
							>
								{isRefreshing ? "Refreshing..." : "Refresh Preview"}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default PreviewAlertModal;
