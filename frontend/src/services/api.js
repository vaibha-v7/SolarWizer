const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const parseResponse = async (response, fallbackMessage) => {
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

export const fetchUsers = async () => {
	const response = await fetch(`${API_BASE_URL}/users`);
	return parseResponse(response, "Failed to fetch users");
};

export const fetchUserById = async (userId) => {
	const response = await fetch(`${API_BASE_URL}/users/${userId}`);
	return parseResponse(response, "Failed to fetch user");
};

export const fetchSolarReportByUserId = async (userId) => {
	const response = await fetch(`${API_BASE_URL}/users/${userId}/solar-report`);
	return parseResponse(response, "Failed to generate solar report");
};

export const createUser = async (payload) => {
	const response = await fetch(`${API_BASE_URL}/enter`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify(payload)
	});

	return parseResponse(response, "Failed to create user");
};
