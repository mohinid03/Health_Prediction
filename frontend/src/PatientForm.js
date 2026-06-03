/**
 * PatientForm.js
 * --------------
 * Add / Edit patient form with full client-side validation.
 *
 * KEY FIX: FormField is defined at MODULE scope (outside PatientForm).
 * Previously it was defined inside the render function, which caused React to
 * treat it as a brand-new component on every re-render, unmounting and
 * re-mounting the <input> after each keystroke — resulting in focus loss and
 * only a single character being accepted at a time.
 */

import React, { useState, useEffect, useCallback } from "react";
import { createPatient, updatePatient } from "./api";

/* ── Empty form state ───────────────────────────────────────────────────────── */
const EMPTY = {
  full_name:   "",
  dob:         "",
  email:       "",
  glucose:     "",
  haemoglobin: "",
  cholesterol: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TODAY    = new Date().toISOString().split("T")[0];

/* ── FormField – defined at MODULE level so its identity never changes ─────── */
function FormField({ label, name, type = "text", placeholder, hint, value, onChange, error }) {
  return (
    <div className={`field${error ? " field--error" : ""}`}>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder || ""}
        autoComplete="off"
        max={type === "date" ? TODAY : undefined}
        step={type === "number" ? "any" : undefined}
        onChange={(e) => onChange(name, e.target.value)}
      />
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error          && <span className="field-msg">{error}</span>}
    </div>
  );
}

/* ── PatientForm ────────────────────────────────────────────────────────────── */
export default function PatientForm({ initial, onSaved, onCancel, onError }) {
  const [form,   setForm]   = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy,   setBusy]   = useState(false);

  /* Sync form when switching between add-mode and edit-mode */
  useEffect(() => {
    setForm(
      initial
        ? {
            full_name:   initial.full_name,
            dob:         initial.dob,
            email:       initial.email,
            glucose:     String(initial.glucose),
            haemoglobin: String(initial.haemoglobin),
            cholesterol: String(initial.cholesterol),
          }
        : EMPTY
    );
    setErrors({});
  }, [initial]);

  /* Stable change handler — won't change identity on re-renders */
  const handleChange = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }, []);

  /* Client-side validation */
  const validate = () => {
    const e = {};
    if (!form.full_name.trim())
      e.full_name = "Full name is required.";
    else if (form.full_name.trim().length < 2)
      e.full_name = "Full name must be at least 2 characters.";

    if (!form.dob)
      e.dob = "Date of birth is required.";
    else if (new Date(form.dob) >= new Date())
      e.dob = "DOB cannot be today or a future date.";

    if (!form.email)
      e.email = "Email is required.";
    else if (!EMAIL_RE.test(form.email))
      e.email = "Enter a valid email address.";

    ["glucose", "haemoglobin", "cholesterol"].forEach((field) => {
      if (form[field] === "")
        e[field] = "This field is required.";
      else if (isNaN(Number(form[field])) || Number(form[field]) < 0)
        e[field] = "Must be a positive number.";
    });

    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const clientErrors = validate();
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      return;
    }

    setBusy(true);
    try {
      const payload = {
        full_name:   form.full_name.trim(),
        dob:         form.dob,
        email:       form.email.trim().toLowerCase(),
        glucose:     parseFloat(form.glucose),
        haemoglobin: parseFloat(form.haemoglobin),
        cholesterol: parseFloat(form.cholesterol),
      };

      if (initial) {
        await updatePatient(initial.id, payload);
      } else {
        await createPatient(payload);
        setForm(EMPTY); // reset only on create
      }
      onSaved();
    } catch (err) {
      const serverErrors = err?.errors;
      if (Array.isArray(serverErrors) && serverErrors.length) {
        onError(serverErrors.join(" "));
      } else {
        onError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="patient-form">

      <FormField
        label="Full Name"
        name="full_name"
        placeholder="e.g. Jane Smith"
        value={form.full_name}
        onChange={handleChange}
        error={errors.full_name}
      />

      <FormField
        label="Date of Birth"
        name="dob"
        type="date"
        value={form.dob}
        onChange={handleChange}
        error={errors.dob}
      />

      <FormField
        label="Email Address"
        name="email"
        type="email"
        placeholder="jane@example.com"
        value={form.email}
        onChange={handleChange}
        error={errors.email}
      />

      <div className="field-group">
        <FormField
          label="Glucose (mg/dL)"
          name="glucose"
          type="number"
          placeholder="70–300"
          hint="Normal: 70–100 mg/dL"
          value={form.glucose}
          onChange={handleChange}
          error={errors.glucose}
        />
        <FormField
          label="Haemoglobin (g/dL)"
          name="haemoglobin"
          type="number"
          placeholder="5–20"
          hint="Normal: 12–17 g/dL"
          value={form.haemoglobin}
          onChange={handleChange}
          error={errors.haemoglobin}
        />
        <FormField
          label="Cholesterol (mg/dL)"
          name="cholesterol"
          type="number"
          placeholder="100–350"
          hint="Normal: &lt;200 mg/dL"
          value={form.cholesterol}
          onChange={handleChange}
          error={errors.cholesterol}
        />
      </div>

      {/* Remarks field – read-only, populated by backend ML model */}
      {initial?.remarks && (
        <div className="field">
          <label>AI Health Prediction (Remarks)</label>
          <div className="remarks-display">{initial.remarks}</div>
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy
            ? <><span className="spinner" /> {initial ? "Updating…" : "Analysing…"}</>
            : (initial ? "Update Patient" : "Add & Predict")
          }
        </button>
        {initial && (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
