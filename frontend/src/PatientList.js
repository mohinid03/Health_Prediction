/**
 * PatientList.js
 * --------------
 * Searchable, sortable patient records table.
 * Shows all fields including AI-generated Remarks column.
 */

import React, { useState, useMemo } from "react";

/* ── Risk colour mapper ─────────────────────────────────────────────────────── */
function riskColour(remarks) {
  if (!remarks) return "#94a3b8";
  const r = remarks.toLowerCase();
  if (r.includes("healthy"))          return "#16a34a";
  if (r.includes("high composite") ||
      r.includes("multiple"))         return "#dc2626";
  if (r.includes("diabetes"))         return "#d97706";
  if (r.includes("anaemia"))          return "#3b82f6";
  if (r.includes("dyslipidaemia") ||
      r.includes("cholesterol"))      return "#9333ea";
  return "#2563eb";
}

/* ── PatientList ────────────────────────────────────────────────────────────── */
export default function PatientList({ patients, onEdit, onDelete }) {
  const [search,  setSearch]  = useState("");
  const [sortKey, setSortKey] = useState("id");
  const [sortDir, setSortDir] = useState("desc");

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return patients
      .filter((p) =>
        p.full_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)     ||
        (p.remarks || "").toLowerCase().includes(q)
      )
      .sort((a, b) => {
        let va = a[sortKey], vb = b[sortKey];
        if (typeof va === "string") va = va.toLowerCase();
        if (typeof vb === "string") vb = vb.toLowerCase();
        if (va < vb) return sortDir === "asc" ? -1 :  1;
        if (va > vb) return sortDir === "asc" ?  1 : -1;
        return 0;
      });
  }, [patients, search, sortKey, sortDir]);

  const Th = ({ col, label, className }) => (
    <th
      className={`sortable${className ? " " + className : ""}${sortKey === col ? " sorted" : ""}`}
      onClick={() => handleSort(col)}
    >
      {label}
      <span className="sort-arrow">
        {sortKey === col ? (sortDir === "asc" ? " ▲" : " ▼") : " ⇅"}
      </span>
    </th>
  );

  if (!patients.length) {
    return (
      <div className="empty-state">
        <span className="empty-icon">🩺</span>
        <p>No patient records yet.<br />Add your first patient using the form on the left.</p>
      </div>
    );
  }

  return (
    <div className="list-wrapper">
      {/* Search bar */}
      <div className="search-bar">
        <input
          type="search"
          placeholder="Search by name, email or prediction…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <span className="search-count">{filtered.length} / {patients.length}</span>
      </div>

      {/* Table */}
      <div className="table-scroll">
        <table className="patient-table">
          <thead>
            <tr>
              <th>#</th>
              <Th col="full_name"   label="Full Name" />
              <Th col="dob"         label="Date of Birth" />
              <Th col="email"       label="Email" />
              <Th col="glucose"     label="Glucose"     className="num-col" />
              <Th col="haemoglobin" label="Hb"          className="num-col" />
              <Th col="cholesterol" label="Cholesterol" className="num-col" />
              <Th col="remarks"     label="AI Health Prediction" />
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id} className="patient-row">
                <td className="row-num">{i + 1}</td>
                <td className="name-cell"><strong>{p.full_name}</strong></td>
                <td>{p.dob}</td>
                <td className="email-cell">{p.email}</td>
                <td className="num-col">{p.glucose}</td>
                <td className="num-col">{p.haemoglobin}</td>
                <td className="num-col">{p.cholesterol}</td>
                <td>
                  <span
                    className="risk-badge"
                    title={p.remarks || "No prediction"}
                    style={{
                      borderColor: riskColour(p.remarks),
                      color:       riskColour(p.remarks),
                    }}
                  >
                    {p.remarks || "—"}
                  </span>
                </td>
                <td className="action-cell">
                  <button
                    className="icon-btn icon-btn--edit"
                    onClick={() => onEdit(p)}
                    title="Edit patient"
                  >
                    ✎
                  </button>
                  <button
                    className="icon-btn icon-btn--delete"
                    onClick={() => onDelete(p)}
                    title="Delete patient"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && search && (
        <p className="no-results">No patients match "<em>{search}</em>".</p>
      )}
    </div>
  );
}
