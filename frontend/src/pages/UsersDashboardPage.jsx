import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserListTable from "../components/UserListTable";
import MapPicker from "../components/MapPicker";
import RegionalMap from "../components/RegionalMap";
import { createUser, fetchUsers, deleteUser, updateUser } from "../services/api";

const DEFAULT_FORM = {
	name: "",
	email: "",
	phoneNumber: "",
	latitude: "",
	longitude: "",
	systemCapacity: "",
	tiltDeg: "",
	azimuthDeg: "",
	shadingFactor: "0.9",
	soilingLossPercent: "2",
	inverterLossPercent: "3",
	wiringLossPercent: "2",
	miscLossPercent: "1"
};

const UsersDashboardPage = () => {
	const navigate = useNavigate();
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState("");
	const [formData, setFormData] = useState(DEFAULT_FORM);
	const [searchText, setSearchText] = useState("");
	const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, userId: null, userName: "" });
	const [isDeleting, setIsDeleting] = useState(false);
	const [editingUserId, setEditingUserId] = useState(null);

	const loadUsers = useCallback(async () => {
		setLoading(true);
		setError("");

		try {
			const userData = await fetchUsers();
			setUsers(Array.isArray(userData) ? userData : []);
		} catch (err) {
			setError(err.message || "Could not load users");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadUsers();
	}, [loadUsers]);

	const handleFormFieldChange = (event) => {
		const { name, value } = event.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleDeleteClick = (userId, userName) => {
		setDeleteConfirm({
			isOpen: true,
			userId: userId,
			userName: userName
		});
	};

	const handleConfirmDelete = async () => {
		setIsDeleting(true);

		try {
			await deleteUser(deleteConfirm.userId);
			setDeleteConfirm({ isOpen: false, userId: null, userName: "" });
			await loadUsers();
		} catch (err) {
			console.error("Failed to delete user:", err);
			setDeleteConfirm({ isOpen: false, userId: null, userName: "" });
		} finally {
			setIsDeleting(false);
		}
	};

	const handleCancelDelete = () => {
		setDeleteConfirm({ isOpen: false, userId: null, userName: "" });
	};

	const handleEditUser = (user) => {
		setEditingUserId(user._id);
		setFormData({
			name: user.name,
			email: user.email,
			phoneNumber: user.phoneNumber,
			latitude: String(user.location?.latitude ?? ""),
			longitude: String(user.location?.longitude ?? ""),
			systemCapacity: String(user.systemCapacity),
			tiltDeg: String(user.tiltDeg),
			azimuthDeg: String(user.azimuthDeg),
			shadingFactor: String(user.shadingFactor),
			soilingLossPercent: String(user.soilingLossPercent),
			inverterLossPercent: String(user.inverterLossPercent),
			wiringLossPercent: String(user.wiringLossPercent),
			miscLossPercent: String(user.miscLossPercent)
		});
		setIsFormOpen(true);
		setSubmitError("");
	};

	const handleSubmitForm = async (event) => {
		event.preventDefault();
		setSubmitError("");
		setIsSubmitting(true);

		try {
			const payload = {
				name: formData.name.trim(),
				email: formData.email.trim(),
				phoneNumber: formData.phoneNumber.trim(),
				location: {
					latitude: Number(formData.latitude),
					longitude: Number(formData.longitude)
				},
				systemCapacity: Number(formData.systemCapacity),
				tiltDeg: Number(formData.tiltDeg),
				azimuthDeg: Number(formData.azimuthDeg),
				shadingFactor: Number(formData.shadingFactor),
				soilingLossPercent: Number(formData.soilingLossPercent),
				inverterLossPercent: Number(formData.inverterLossPercent),
				wiringLossPercent: Number(formData.wiringLossPercent),
				miscLossPercent: Number(formData.miscLossPercent)
			};

			if (editingUserId) {
				await updateUser(editingUserId, payload);
			} else {
				await createUser(payload);
			}

			setIsFormOpen(false);
			setEditingUserId(null);
			setFormData(DEFAULT_FORM);
			await loadUsers();
		} catch (err) {
			setSubmitError(err.message || (editingUserId ? "Could not update user" : "Could not create user"));
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleCloseForm = () => {
		setIsFormOpen(false);
		setEditingUserId(null);
		setFormData(DEFAULT_FORM);
		setSubmitError("");
	};

	const filteredUsers = useMemo(() => {
		const query = searchText.trim().toLowerCase();
		if (!query) return users;

		return users.filter((user) => {
			const location = `${user.location?.latitude ?? ""}, ${user.location?.longitude ?? ""}`;
			return [user.name, user.email, user.phoneNumber, String(user.systemCapacity), location]
				.some((value) => String(value ?? "").toLowerCase().includes(query));
		});
	}, [searchText, users]);

	const totalCapacity = useMemo(
		() => users.reduce((sum, user) => sum + Number(user.systemCapacity ?? 0), 0),
		[users]
	);

	const regionCount = useMemo(() => {
		const keys = new Set(
			users.map((user) => `${Number(user.location?.latitude ?? 0).toFixed(2)},${Number(user.location?.longitude ?? 0).toFixed(2)}`)
		);
		return keys.size;
	}, [users]);

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_12%_16%,#d7f8e7_0,transparent_42%),radial-gradient(circle_at_88%_20%,#d8e9ff_0,transparent_44%),linear-gradient(135deg,#eff4fb_0%,#edf8f4_55%,#f8fbff_100%)]">
			<aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200/80 bg-white/88 px-5 pb-6 pt-8 shadow-lg backdrop-blur-md lg:flex lg:flex-col">
				<div className="mb-8 flex items-center gap-3">
					{/* <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-200 to-blue-200 text-lg text-slate-900 shadow">
						S
					</div> */}
					<div className="px-4">
						<p className="text-lg font-black leading-none text-slate-900">SolarWizer</p>
						<p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">Energy Management</p>
					</div>
				</div>

				<nav className="space-y-2">
					<p className="rounded-xl border-l-4 border-emerald-500 bg-gradient-to-r from-emerald-100/80 to-transparent px-3 py-2 text-sm font-semibold text-emerald-800">
						Users Dashboard
					</p>
					<button
						type="button"
						className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
						onClick={() => {
							setSubmitError("");
							setIsFormOpen(true);
						}}
					>
						Add New User
					</button>
				</nav>

				<div className="mt-auto space-y-2">
					<button
						type="button"
						className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 hover:shadow-lg"
						onClick={() => {
							setSubmitError("");
							setIsFormOpen(true);
						}}
					>
						New Installation
					</button>
					{/* <p className="rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Support</p> */}
				</div>
			</aside>

			<header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 px-3 py-3 backdrop-blur-xl sm:px-4 lg:pl-[17.5rem] lg:pr-8">
				<div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
					<div>
						<div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">Dashboard Console</div>
						<p className="text-sm font-bold text-slate-800 lg:hidden">SolarWizer Users</p>
					</div>
					<div className="flex w-full items-center justify-end gap-3 sm:w-auto">
						<div className="w-full rounded-full border-2 border-emerald-300/90 bg-white shadow-[0_0_0_4px_rgba(16,185,129,0.12)] transition focus-within:border-emerald-500 focus-within:shadow-[0_0_0_5px_rgba(16,185,129,0.2)] sm:w-80">
							<input
								type="text"
								value={searchText}
								onChange={(event) => setSearchText(event.target.value)}
								placeholder="Search users, email, location..."
								className="w-full rounded-full bg-emerald-50/35 px-4 py-2 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-500"
							/>
						</div>
						{/* <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-600">VW</div> */}
					</div>
				</div>
			</header>

			<div className="px-3 pt-3 sm:px-4 lg:hidden">
				<div className="mx-auto grid max-w-7xl grid-cols-1 gap-2 sm:grid-cols-2">
					<button
						type="button"
						className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
						onClick={() => {
							setSubmitError("");
							setIsFormOpen(true);
						}}
					>
						Add New User
					</button>
					<button
						type="button"
						className="rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 hover:shadow-lg"
						onClick={() => {
							setSubmitError("");
							setIsFormOpen(true);
						}}
					>
						New Installation
					</button>
				</div>
			</div>

			<main className="px-3 py-5 sm:px-4 sm:py-6 lg:pl-[17.5rem] lg:pr-8">
				<div className="mx-auto max-w-7xl space-y-5">
					<section className="space-y-2">
						<p className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-800">SolarWizer Dashboard</p>
						<h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">User Data Overview</h1>
						<p className="max-w-3xl text-sm text-slate-600 sm:text-base">Choose any user to generate and view their monthly solar report from the AIML pipeline. Monitor pipeline health and user installation trends.</p>
					</section>

					<section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
						<div className="rounded-2xl border border-slate-200/80 bg-white/88 p-4 shadow-sm">
							<p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Capacity</p>
							<p className="mt-2 text-2xl font-bold text-slate-900">{totalCapacity.toFixed(1)} kW</p>
							<p className="mt-1 text-xs text-emerald-700">Installed across all users</p>
						</div>
						<div className="rounded-2xl border border-slate-200/80 bg-white/88 p-4 shadow-sm">
							<p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Users</p>
							<p className="mt-2 text-2xl font-bold text-slate-900">{users.length}</p>
							<p className="mt-1 text-xs text-slate-500">Registered profiles</p>
						</div>
						<div className="rounded-2xl border border-slate-200/80 bg-white/88 p-4 shadow-sm md:col-span-2 xl:col-span-2">
							<p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pipeline Status</p>
							<div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
								<div>
									<p className="text-xl font-bold text-slate-900 sm:text-2xl">System Optimal</p>
									<p className="mt-1 text-xs text-slate-500">{regionCount} active coordinate regions monitored</p>
								</div>
								<div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Live</div>
							</div>
						</div>
					</section>

					<section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg">
						<div className="flex flex-col gap-1 border-b border-slate-200/70 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
							<h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">User Repositories</h3>
							<p className="text-xs text-slate-500">Showing {filteredUsers.length} of {users.length} users</p>
						</div>

						{loading && <p className="px-5 py-4 text-sm font-semibold text-blue-700">Loading users...</p>}
						{error && <p className="px-5 py-4 text-sm font-semibold text-rose-700">{error}</p>}
						{!loading && !error && (
							<UserListTable
								users={filteredUsers}
								onSelectUser={(userId) => navigate(`/users/${userId}/report`)}									onEditUser={handleEditUser}								onDeleteUser={(userId) => {
									const user = users.find(u => u._id === userId);
									handleDeleteClick(userId, user?.name || "User");
								}}
							/>
						)}
					</section>

					<section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
						<div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-[linear-gradient(120deg,#dbeafe_0%,#e2f5ee_48%,#f4f8ff_100%)] shadow-md lg:col-span-2">
							<div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(16,185,129,0.12),transparent_45%)] pointer-events-none" />
							<div className="relative p-4 pb-2">
								<p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Regional Coverage</p>
								<h4 className="mt-1 text-xl font-bold text-slate-900">Installation Coordinate Map</h4>
								<p className="mt-1 text-xs text-slate-600">Live view of registered installation coordinates and location clusters used by the reporting pipeline.</p>
								<div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
									<span className="h-2 w-2 rounded-full bg-emerald-500" />
									Live Monitor
								</div>
							</div>
							<div className="h-56 w-full overflow-hidden rounded-b-2xl sm:h-72">
								<RegionalMap users={users} />
							</div>
						</div>

						<div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white/88 p-5 shadow-md">
							<div>
								<p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Automation</p>
								<h4 className="mt-2 text-2xl font-bold leading-tight text-slate-900">Generate Bulk Reports</h4>
								<p className="mt-2 text-sm text-slate-600">Trigger reporting for all current user profiles for fast review and billing preparation.</p>
							</div>
							<button
								type="button"
								className="mt-5 rounded-xl border-2 border-emerald-400 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
								onClick={loadUsers}
							>
								Refresh Pipeline Now
							</button>
						</div>
					</section>
				</div>
			</main>

			{isFormOpen && (
				<div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 p-3 pt-6 sm:items-center sm:p-4" role="dialog" aria-modal="true">
					<div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-300/60 bg-white p-4 shadow-2xl sm:p-5">
						<div className="mb-4 flex items-center justify-between gap-3">
							<div>
								<h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
									{editingUserId ? "Edit User" : "Add New User"}
								</h3>
								<p className="mt-1 text-sm text-slate-600">
									{editingUserId ? "Update user information and settings." : "Fill in all required fields to create a user profile."}
								</p>
							</div>
							<button
								type="button"
								className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
								onClick={handleCloseForm}
							>
								Close
							</button>
						</div>

						<form className="grid gap-2.5 md:grid-cols-2 md:gap-3" onSubmit={handleSubmitForm}>
							<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="name" value={formData.name} onChange={handleFormFieldChange} placeholder="Full name" required />
							<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="email" type="email" value={formData.email} onChange={handleFormFieldChange} placeholder="Email" required />
							<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="phoneNumber" value={formData.phoneNumber} onChange={handleFormFieldChange} placeholder="Phone number" required />
							<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="systemCapacity" type="number" step="0.01" value={formData.systemCapacity} onChange={handleFormFieldChange} placeholder="System capacity (kW)" required />
							<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="latitude" type="number" step="0.0001" value={formData.latitude} onChange={handleFormFieldChange} placeholder="Latitude" required />
							<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="longitude" type="number" step="0.0001" value={formData.longitude} onChange={handleFormFieldChange} placeholder="Longitude" required />
							<MapPicker
								latitude={formData.latitude}
								longitude={formData.longitude}
								onLocationSelect={(lat, lng) =>
									setFormData((prev) => ({ ...prev, latitude: String(lat), longitude: String(lng) }))
								}
							/>
							<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="tiltDeg" type="number" step="0.1" value={formData.tiltDeg} onChange={handleFormFieldChange} placeholder="Tilt (deg)" required />
							<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="azimuthDeg" type="number" step="0.1" value={formData.azimuthDeg} onChange={handleFormFieldChange} placeholder="Azimuth (deg)" required />
							<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="shadingFactor" type="number" step="0.01" value={formData.shadingFactor} onChange={handleFormFieldChange} placeholder="Shading factor" required />
							<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="soilingLossPercent" type="number" step="0.1" value={formData.soilingLossPercent} onChange={handleFormFieldChange} placeholder="Soiling loss (%)" required />
							<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="inverterLossPercent" type="number" step="0.1" value={formData.inverterLossPercent} onChange={handleFormFieldChange} placeholder="Inverter loss (%)" required />
							<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="wiringLossPercent" type="number" step="0.1" value={formData.wiringLossPercent} onChange={handleFormFieldChange} placeholder="Wiring loss (%)" required />
							<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" name="miscLossPercent" type="number" step="0.1" value={formData.miscLossPercent} onChange={handleFormFieldChange} placeholder="Misc loss (%)" required />

							{submitError && <p className="md:col-span-2 text-sm font-semibold text-rose-700">{submitError}</p>}

							<div className="mt-1 flex flex-wrap justify-end gap-2 md:col-span-2">
								<button
									type="button"
									className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
									onClick={handleCloseForm}
								>
									Cancel
								</button>
								<button
									type="submit"
									className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
									disabled={isSubmitting}
								>
										{isSubmitting ? "Saving..." : editingUserId ? "Update User" : "Create User"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{deleteConfirm.isOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3" role="dialog" aria-modal="true">
					<div className="w-full max-w-sm rounded-2xl border border-slate-300/60 bg-white p-6 shadow-2xl">
						<div className="mb-4">
							<h3 className="text-xl font-bold tracking-tight text-slate-900">Delete User</h3>
							<p className="mt-2 text-sm text-slate-600">
								Are you sure you want to delete <span className="font-semibold text-slate-900">{deleteConfirm.userName}</span>? This action cannot be undone and will remove all associated data.
							</p>
						</div>

						<div className="flex flex-wrap justify-end gap-2">
							<button
								type="button"
								className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
								onClick={handleCancelDelete}
								disabled={isDeleting}
							>
								Cancel
							</button>
							<button
								type="button"
								className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
								onClick={handleConfirmDelete}
								disabled={isDeleting}
							>
								{isDeleting ? "Deleting..." : "Delete User"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default UsersDashboardPage;
