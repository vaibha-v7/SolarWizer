import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in webpack/vite builds
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
	iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
	iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
	shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const RegionalMap = ({ users }) => {
	const containerRef = useRef(null);
	const mapRef = useRef(null);
	const markersGroupRef = useRef(null);

	// Initialise map once
	useEffect(() => {
		if (mapRef.current) return;

		const map = L.map(containerRef.current, {
			center: [20, 77],
			zoom: 4,
			scrollWheelZoom: true,
		});

		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution: "© OpenStreetMap contributors",
			maxZoom: 19,
		}).addTo(map);

		markersGroupRef.current = L.featureGroup().addTo(map);
		mapRef.current = map;

		return () => {
			map.remove();
			mapRef.current = null;
			markersGroupRef.current = null;
		};
	}, []);

	// Sync markers whenever the users list changes
	useEffect(() => {
		const map = mapRef.current;
		const group = markersGroupRef.current;
		if (!map || !group) return;

		group.clearLayers();

		const validUsers = users.filter((u) => {
			const lat = Number(u.location?.latitude);
			const lng = Number(u.location?.longitude);
			return !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
		});

		validUsers.forEach((user) => {
			const lat = Number(user.location.latitude);
			const lng = Number(user.location.longitude);

			const marker = L.marker([lat, lng]);
			marker.bindPopup(
				`<div style="min-width:160px">
					<p style="font-weight:700;font-size:14px;margin:0 0 4px">${user.name ?? "Unknown"}</p>
					<p style="font-size:12px;margin:0 0 2px;color:#555">Capacity: <strong>${user.systemCapacity ?? "—"} kW</strong></p>
					<p style="font-size:11px;margin:0;color:#888">${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
				</div>`,
				{ maxWidth: 220 }
			);
			group.addLayer(marker);
		});

		if (validUsers.length > 0) {
			try {
				map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 10 });
			} catch {
				// getBounds can throw if group is empty due to a race condition
			}
		}
	}, [users]);

	return (
		<div
			ref={containerRef}
			style={{ height: "100%", minHeight: 240, position: "relative", zIndex: 0 }}
			className="w-full"
		/>
	);
};

export default RegionalMap;
