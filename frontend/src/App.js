/**
 * App.js
 * ------
 * Root component for MIRA Health Prediction Platform.
 *
 * Fixes applied vs original:
 *  1. key prop on <PatientForm> forces clean remount when switching edit ↔ new.
 *  2. formRef scrolls the form into view when editing starts.
 *  3. Clears editing state when the deleted patient was being edited.
 *  4. Toast distinguishes "success" / "error" visually.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import PatientForm from "./PatientForm";
import PatientList from "./PatientList";
import { fetchPatients, deletePatient } from "./api";

export default function App() {
  const [patients, setPatients] = useState([]);
  const [editing,  setEditing]  = useState(null);   // patient being edited, or null
  const [toast,    setToast]    = useState(null);   // { type: "success"|"error", msg }
  const [loading,  setLoading]  = useState(false);
  const formRef = useRef(null);

  /* ── Toast helper ─────────────────────────────────────────────────────────── */
  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  /* ── Load patients from backend ───────────────────────────────────────────── */
  const loadPatients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPatients();
      setPatients(data);
    } catch {
      showToast("error", "Could not load patients. Is the backend running on port 5000?");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  /* ── CRUD callbacks ───────────────────────────────────────────────────────── */
  const handleSaved = useCallback(() => {
    const wasEditing = editing;
    setEditing(null);
    loadPatients();
    showToast("success", wasEditing ? "Patient updated successfully." : "Patient added successfully.");
  }, [editing, loadPatients, showToast]);

  const handleEdit = useCallback((patient) => {
    setEditing(patient);
    // Scroll the form panel into view on smaller screens
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, []);

  const handleDelete = useCallback(async (patient) => {
    if (!window.confirm(`Delete record for "${patient.full_name}"?\nThis action cannot be undone.`)) return;
    try {
      await deletePatient(patient.id);
      showToast("success", `${patient.full_name}'s record deleted.`);
      // If we were editing this patient, clear the form
      if (editing?.id === patient.id) setEditing(null);
      loadPatients();
    } catch {
      showToast("error", "Failed to delete patient. Please try again.");
    }
  }, [editing, loadPatients, showToast]);

  /* ── Render ───────────────────────────────────────────────────────────────── */
  return (
    <div className="app-shell">

      {/* Header */}
      <header className="site-header">
        <div className="header-inner">
          <div className="logo-block">
            <span className="logo-icon">⚕</span>
            <div>
              <h1 className="logo-title">MIRA</h1>
              <p className="logo-sub">Medical Intelligence &amp; Risk Assessment</p>
            </div>
          </div>
          <nav className="header-pills">
            <span className="pill">Patient Records</span>
            <span className="pill pill--accent">{patients.length} Records</span>
          </nav>
        </div>
      </header>

      {/* Toast notification */}
      {toast && (
        <div className={`toast toast--${toast.type}`} role="status" aria-live="polite">
          <span className="toast-icon">{toast.type === "success" ? "✓" : "✕"}</span>
          {toast.msg}
        </div>
      )}

      {/* Main two-column layout */}
      <main className="main-grid">

        {/* Left: Form panel */}
        <section className="panel panel--form" ref={formRef}>
          <h2 className="panel-title">
            {editing ? "✎ Edit Patient" : "+ New Patient"}
          </h2>
          {/*
            key prop is critical: forces PatientForm to fully unmount/remount
            when switching between "new" mode and "edit mode" for a specific patient.
            Without this, stale state from the previous patient leaks into the form.
          */}
          <PatientForm
            key={editing ? `edit-${editing.id}` : "new"}
            initial={editing}
            onSaved={handleSaved}
            onCancel={() => setEditing(null)}
            onError={(msg) => showToast("error", msg)}
          />
        </section>

        {/* Right: Records panel */}
        <section className="panel panel--list">
          <h2 className="panel-title">Patient Records</h2>
          {loading ? (
            <div className="loader">
              <span className="loader-dot" />
              <span className="loader-dot" />
              <span className="loader-dot" />
              Loading records…
            </div>
          ) : (
            <PatientList
              patients={patients}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </section>

      </main>

      <footer className="site-footer">
        MIRA &copy; {new Date().getFullYear()} &mdash; Health Prediction Platform &mdash;
        Predictions are generated by a local ML model and are for reference only.
        Always consult a qualified physician.
      </footer>

    </div>
  );
}
