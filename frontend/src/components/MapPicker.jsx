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

const DEFAULT_CENTER = [20, 77]; // India center
const DEFAULT_ZOOM = 4;

const MapPicker = ({ latitude, longitude, onLocationSelect }) => {
	const containerRef = useRef(null);
	const mapRef = useRef(null);
	const markerRef = useRef(null);
	// Keep a ref to the callback so the map click handler is never stale
	const onLocationSelectRef = useRef(onLocationSelect);
	useEffect(() => {
		onLocationSelectRef.current = onLocationSelect;
	}, [onLocationSelect]);

	// Initialise map once
	useEffect(() => {
		if (mapRef.current) return;

		const map = L.map(containerRef.current, {
			center: DEFAULT_CENTER,
			zoom: DEFAULT_ZOOM,
		});

		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution: "© OpenStreetMap contributors",
			maxZoom: 19,
		}).addTo(map);

		map.on("click", (e) => {
			const { lat, lng } = e.latlng;
			onLocationSelectRef.current(
				parseFloat(lat.toFixed(4)),
				parseFloat(lng.toFixed(4)),
			);
		});

		mapRef.current = map;

		return () => {
			map.remove();
			mapRef.current = null;
			markerRef.current = null;
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Keep marker in sync with lat/lon fields
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		const lat = parseFloat(latitude);
		const lng = parseFloat(longitude);

		if (!isNaN(lat) && !isNaN(lng)) {
			if (markerRef.current) {
				markerRef.current.setLatLng([lat, lng]);
			} else {
				markerRef.current = L.marker([lat, lng]).addTo(map);
			}
			map.setView([lat, lng], Math.max(map.getZoom(), 8));
		} else if (markerRef.current) {
			markerRef.current.remove();
			markerRef.current = null;
		}
	}, [latitude, longitude]);

	return (
		<div className="md:col-span-2" style={{ isolation: "isolate" }}>
			<p className="mb-1 text-xs font-semibold text-slate-600">
				Click on the map to set location, or enter coordinates above
			</p>
			<div
				ref={containerRef}
				style={{ height: 260 }}
				className="w-full overflow-hidden rounded-xl border border-slate-300 shadow-sm"
			/>
		</div>
	);
};

export default MapPicker;
