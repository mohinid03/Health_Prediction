"""
app.py
======
MIRA – Medical Intelligence Robotic Automation
Flask REST API backend.

Endpoints:
  GET    /health              – liveness check
  GET    /patients            – list all patients
  POST   /patients            – create patient (runs ML prediction)
  GET    /patients/<id>       – get one patient
  PUT    /patients/<id>       – update patient (re-runs prediction)
  DELETE /patients/<id>       – delete patient

Prediction uses a trained Random Forest+GradientBoosting ensemble (model.pkl).
If the model file is not found it falls back to evidence-based clinical thresholds.

Run:
    python train_model.py   # once, to create model.pkl
    python app.py
"""

from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import date
import re
import os
import json
import joblib
import numpy as np

app = Flask(__name__)
CORS(app)

# ── Database ───────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.config["SQLALCHEMY_DATABASE_URI"]        = f"sqlite:///{os.path.join(BASE_DIR, 'mira.db')}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


# ── ORM Model ──────────────────────────────────────────────────────────────────
class Patient(db.Model):
    __tablename__ = "patients"

    id          = db.Column(db.Integer,      primary_key=True)
    full_name   = db.Column(db.String(120),  nullable=False)
    dob         = db.Column(db.String(20),   nullable=False)
    email       = db.Column(db.String(160),  nullable=False, unique=True)
    glucose     = db.Column(db.Float,        nullable=False)
    haemoglobin = db.Column(db.Float,        nullable=False)
    cholesterol = db.Column(db.Float,        nullable=False)
    remarks     = db.Column(db.Text,         nullable=True)

    def to_dict(self):
        return {
            "id":          self.id,
            "full_name":   self.full_name,
            "dob":         self.dob,
            "email":       self.email,
            "glucose":     self.glucose,
            "haemoglobin": self.haemoglobin,
            "cholesterol": self.cholesterol,
            "remarks":     self.remarks or "",
        }


# ── ML Prediction ──────────────────────────────────────────────────────────────
_MODEL        = None
_FEATURES     = None
_LABEL_MAP    = None

def _load_model():
    """Lazy-load the trained pipeline once."""
    global _MODEL, _FEATURES, _LABEL_MAP
    if _MODEL is not None:
        return _MODEL

    model_path    = os.path.join(BASE_DIR, "model.pkl")
    features_path = os.path.join(BASE_DIR, "features.json")

    if os.path.exists(model_path):
        _MODEL = joblib.load(model_path)
        if os.path.exists(features_path):
            with open(features_path) as f:
                meta = json.load(f)
            _FEATURES  = meta.get("features", [])
            _LABEL_MAP = {int(k): v for k, v in meta.get("labels", {}).items()}
        print("✅ ML model loaded successfully.")
        return _MODEL

    print("⚠️  model.pkl not found – using rule-based fallback. "
          "Run `python train_model.py` to enable the ML model.")
    return None


def _build_feature_vector(glucose: float, haemoglobin: float, cholesterol: float) -> np.ndarray:
    """Construct the same feature vector used during training."""
    g, hb, ch = glucose, haemoglobin, cholesterol
    ghr  = g  / (hb + 1e-6)
    chr_ = ch / (hb + 1e-6)
    gn   = (g  - 85)  / 30
    hbn  = (hb - 14.5) / 2.5
    chn  = (ch - 160)  / 40
    crs  = int(g > 140) + int(hb < 12) + int(ch > 200)
    return np.array([[g, hb, ch, ghr, chr_, gn, hbn, chn, crs]])


def _rule_based(glucose: float, haemoglobin: float, cholesterol: float) -> str:
    """Clinical threshold fallback – no model required."""
    issues = []
    if glucose > 140:
        issues.append("Diabetes Risk (Glucose > 140 mg/dL)")
    if haemoglobin < 12:
        issues.append("Anaemia Risk (Haemoglobin < 12 g/dL)")
    if cholesterol > 200:
        issues.append("Dyslipidaemia Risk (Cholesterol > 200 mg/dL)")
    if not issues:
        return "Healthy – all values within normal range."
    if len(issues) >= 2:
        return "High Composite Risk – " + "; ".join(issues) + "."
    return issues[0] + "."


def predict_health(glucose: float, haemoglobin: float, cholesterol: float) -> str:
    model = _load_model()
    if model is not None and _LABEL_MAP:
        try:
            X    = _build_feature_vector(glucose, haemoglobin, cholesterol)
            pred = int(model.predict(X)[0])
            prob = model.predict_proba(X)[0]
            confidence = round(float(prob[pred]) * 100, 1)
            label = _LABEL_MAP.get(pred, "Risk detected – please consult a physician.")
            return f"{label} (Confidence: {confidence}%)"
        except Exception as e:
            print(f"⚠️  Model prediction error: {e} – falling back to rules.")
    return _rule_based(glucose, haemoglobin, cholesterol)


# ── Validation ─────────────────────────────────────────────────────────────────
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def validate_patient(data: dict, partial: bool = False) -> list:
    errors = []
    required = ["full_name", "dob", "email", "glucose", "haemoglobin", "cholesterol"]

    if not partial:
        for field in required:
            if field not in data or str(data.get(field, "")).strip() == "":
                errors.append(f"'{field}' is required.")

    if "full_name" in data and data["full_name"]:
        if len(str(data["full_name"]).strip()) < 2:
            errors.append("Full name must be at least 2 characters.")

    if "email" in data and data["email"]:
        if not EMAIL_RE.match(str(data["email"])):
            errors.append("Invalid email address format.")

    if "dob" in data and data["dob"]:
        try:
            dob_date = date.fromisoformat(str(data["dob"]))
            if dob_date >= date.today():
                errors.append("Date of birth cannot be today or a future date.")
        except ValueError:
            errors.append("Date of birth must be in YYYY-MM-DD format.")

    for field in ["glucose", "haemoglobin", "cholesterol"]:
        if field in data and data[field] != "" and data[field] is not None:
            try:
                val = float(data[field])
                if val < 0:
                    errors.append(f"'{field}' must be a positive number.")
            except (TypeError, ValueError):
                errors.append(f"'{field}' must be a numeric value.")

    return errors


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health_check():
    model_loaded = os.path.exists(os.path.join(BASE_DIR, "model.pkl"))
    return jsonify({
        "status":       "ok",
        "message":      "MIRA API is running.",
        "model_loaded": model_loaded,
    })


@app.route("/patients", methods=["GET"])
def get_patients():
    patients = Patient.query.order_by(Patient.id.desc()).all()
    return jsonify([p.to_dict() for p in patients])


@app.route("/patients/<int:pid>", methods=["GET"])
def get_patient(pid):
    patient = Patient.query.get_or_404(pid)
    return jsonify(patient.to_dict())


@app.route("/patients", methods=["POST"])
def create_patient():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"errors": ["Request body must be JSON."]}), 400

    errors = validate_patient(data)
    if errors:
        return jsonify({"errors": errors}), 422

    email = data["email"].strip().lower()
    if Patient.query.filter_by(email=email).first():
        return jsonify({"errors": ["A patient with this email already exists."]}), 409

    remarks = predict_health(
        float(data["glucose"]),
        float(data["haemoglobin"]),
        float(data["cholesterol"]),
    )

    patient = Patient(
        full_name   = data["full_name"].strip(),
        dob         = data["dob"],
        email       = email,
        glucose     = float(data["glucose"]),
        haemoglobin = float(data["haemoglobin"]),
        cholesterol = float(data["cholesterol"]),
        remarks     = remarks,
    )
    db.session.add(patient)
    db.session.commit()
    return jsonify(patient.to_dict()), 201


@app.route("/patients/<int:pid>", methods=["PUT"])
def update_patient(pid):
    patient = Patient.query.get_or_404(pid)
    data    = request.get_json(silent=True)
    if not data:
        return jsonify({"errors": ["Request body must be JSON."]}), 400

    errors = validate_patient(data, partial=True)
    if errors:
        return jsonify({"errors": errors}), 422

    if "email" in data:
        new_email = data["email"].strip().lower()
        existing  = Patient.query.filter_by(email=new_email).first()
        if existing and existing.id != pid:
            return jsonify({"errors": ["Another patient already uses this email."]}), 409
        patient.email = new_email

    if "full_name"   in data: patient.full_name   = data["full_name"].strip()
    if "dob"         in data: patient.dob         = data["dob"]
    if "glucose"     in data: patient.glucose     = float(data["glucose"])
    if "haemoglobin" in data: patient.haemoglobin = float(data["haemoglobin"])
    if "cholesterol" in data: patient.cholesterol = float(data["cholesterol"])

    # Re-run prediction whenever values may have changed
    patient.remarks = predict_health(patient.glucose, patient.haemoglobin, patient.cholesterol)

    db.session.commit()
    return jsonify(patient.to_dict())


@app.route("/patients/<int:pid>", methods=["DELETE"])
def delete_patient(pid):
    patient = Patient.query.get_or_404(pid)
    name    = patient.full_name
    db.session.delete(patient)
    db.session.commit()
    return jsonify({"message": f"Patient '{name}' deleted successfully."})


# ── Startup ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        print("✅ Database initialised (mira.db).")
    _load_model()
    print("🚀 MIRA backend running at http://localhost:5000")
    app.run(debug=True, port=5000)
