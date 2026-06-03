/**
 * api.js
 * ------
 * All REST calls to the MIRA Flask backend.
 * Base URL: uses CRA proxy (http://localhost:5000) in development.
 * In production set REACT_APP_API_URL env variable.
 */

const BASE = process.env.REACT_APP_API_URL || "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw json;
  return json;
}

export const fetchPatients  = ()         => request("/patients");
export const fetchPatient   = (id)       => request(`/patients/${id}`);
export const createPatient  = (body)     => request("/patients",      { method: "POST",   body: JSON.stringify(body) });
export const updatePatient  = (id, body) => request(`/patients/${id}`, { method: "PUT",    body: JSON.stringify(body) });
export const deletePatient  = (id)       => request(`/patients/${id}`, { method: "DELETE" });
