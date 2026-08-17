const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, { method = "GET", body, apiKey } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error || (data.errors && data.errors.join("; ")) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  BASE_URL,

  listSources: (type) => request(`/api/sources${type ? `?type=${type}` : ""}`),
  nearbySources: ({ lat, lng, radiusKm, type }) =>
    request(`/api/sources/nearby?lat=${lat}&lng=${lng}${radiusKm ? `&radiusKm=${radiusKm}` : ""}${type ? `&type=${type}` : ""}`),
  getInventory: (sourceId) => request(`/api/sources/${sourceId}/inventory`),
  updateInventory: (sourceId, item, apiKey) =>
    request(`/api/sources/${sourceId}/inventory`, { method: "PATCH", body: item, apiKey }),

  createRequest: (payload) => request("/api/requests", { method: "POST", body: payload }),
  getRequest: (id) => request(`/api/requests/${id}`),
  listRequests: (filter = {}) => {
    const params = new URLSearchParams(filter).toString();
    return request(`/api/requests${params ? `?${params}` : ""}`);
  },
  patchRequestStatus: (id, body, apiKey) =>
    request(`/api/requests/${id}/status`, { method: "PATCH", body, apiKey }),

  previewMatch: (payload) => request("/api/match", { method: "POST", body: payload }),
};

export default api;
