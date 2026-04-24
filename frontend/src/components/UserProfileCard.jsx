const UserProfileCard = ({ user }) => {
	if (!user) return null;

	return (
		<div className="rounded-2xl border border-slate-300/60 bg-white/90 p-4 shadow-lg backdrop-blur-sm">
			<h2 className="break-words text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{user.name}</h2>
			<div className="mt-3 grid gap-2 text-sm text-slate-700">
				<p className="break-all rounded-lg bg-blue-50/60 px-3 py-2"><span className="font-semibold text-slate-900">Email:</span> {user.email}</p>
				<p className="rounded-lg bg-blue-50/60 px-3 py-2"><span className="font-semibold text-slate-900">Phone:</span> {user.phoneNumber}</p>
				<p className="rounded-lg bg-blue-50/60 px-3 py-2"><span className="font-semibold text-slate-900">Capacity:</span> {user.systemCapacity} kW</p>
				<p className="rounded-lg bg-blue-50/60 px-3 py-2"><span className="font-semibold text-slate-900">Tilt:</span> {user.tiltDeg} deg</p>
				<p className="rounded-lg bg-blue-50/60 px-3 py-2"><span className="font-semibold text-slate-900">Azimuth:</span> {user.azimuthDeg} deg</p>
				<p className="rounded-lg bg-blue-50/60 px-3 py-2"><span className="font-semibold text-slate-900">Shading:</span> {user.shadingFactor}</p>
				<p className="rounded-lg bg-blue-50/60 px-3 py-2"><span className="font-semibold text-slate-900">Latitude:</span> {user.location.latitude}</p>
				<p className="rounded-lg bg-blue-50/60 px-3 py-2"><span className="font-semibold text-slate-900">Longitude:</span> {user.location.longitude}</p>
			</div>
		</div>
	);
};

export default UserProfileCard;
