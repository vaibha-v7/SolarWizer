const UserListTable = ({ users, onSelectUser }) => {
	if (!users.length) {
		return (
			<div className="p-6 text-center text-sm font-semibold text-slate-600">
				<p>No user data available yet. Add users from backend first.</p>
			</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="min-w-[900px] w-full border-collapse text-left text-sm text-slate-700">
				<thead>
					<tr className="bg-slate-50/60">
						<th className="border-b border-slate-200 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Name</th>
						<th className="border-b border-slate-200 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Email</th>
						<th className="border-b border-slate-200 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Phone</th>
						<th className="border-b border-slate-200 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Capacity</th>
						<th className="border-b border-slate-200 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Location</th>
						<th className="border-b border-slate-200 px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Action</th>
					</tr>
				</thead>
				<tbody>
					{users.map((user) => (
						<tr key={user._id} className="group hover:bg-slate-50/80">
							<td className="border-b border-slate-100 px-5 py-4 whitespace-nowrap">
								<div className="flex items-center gap-3">
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold uppercase text-blue-700">
										{String(user.name ?? "U").charAt(0)}
									</div>
									<span className="font-semibold text-slate-800">{user.name}</span>
								</div>
							</td>
							<td className="border-b border-slate-100 px-5 py-4 whitespace-nowrap text-slate-600">{user.email}</td>
							<td className="border-b border-slate-100 px-5 py-4 whitespace-nowrap text-slate-600">{user.phoneNumber}</td>
							<td className="border-b border-slate-100 px-5 py-4 whitespace-nowrap">
								<span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">{user.systemCapacity} kW</span>
							</td>
							<td className="border-b border-slate-100 px-5 py-4 whitespace-nowrap text-slate-600">{user.location.latitude}, {user.location.longitude}</td>
							<td className="border-b border-slate-100 px-5 py-4 text-right whitespace-nowrap">
								<button
									type="button"
									className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white px-4 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
									onClick={() => onSelectUser(user._id)}
								>
									Open report
									<span aria-hidden="true">→</span>
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

export default UserListTable;
