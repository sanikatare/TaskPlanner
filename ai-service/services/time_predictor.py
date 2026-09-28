"""
Time Prediction Service
-----------------------
Uses a Ridge Regression model trained on historical task completion data to
predict how many hours a given task will actually take.

Features used:
  - difficulty (1–5)
  - estimated_hours (student's own estimate)
  - category_encoded (one-hot: math, science, programming, theory, lab, project, other)

The model is persisted to disk with joblib so predictions survive restarts.
If no trained model exists yet, it bootstraps from synthetic seed data.
"""

import os
import numpy as np
import joblib
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent.parent / "models" / "time_predictor.pkl"

CATEGORIES = ["math", "science", "programming", "theory", "lab", "project", "other"]

# ─── Feature Engineering ──────────────────────────────────────────────────────

def encode_features(category: str, difficulty: int, estimated_hours: float) -> np.ndarray:
    """Convert raw inputs into the feature vector the model expects."""
    cat_ohe = [1 if c == category else 0 for c in CATEGORIES]
    return np.array([difficulty, estimated_hours] + cat_ohe, dtype=float).reshape(1, -1)


# ─── Seed Data ────────────────────────────────────────────────────────────────

def _generate_seed_data():
    """
    Synthetic seed dataset representing common engineering-student tasks.
    Actual hours = estimated * difficulty_factor + noise.
    Replace/augment with real MongoDB data in production.
    """
    rng = np.random.RandomState(42)
    records = []
    for _ in range(400):
        cat_idx    = rng.randint(0, len(CATEGORIES))
        difficulty = rng.randint(1, 6)
        est_hours  = rng.uniform(0.5, 12)
        # A harder task takes longer relative to estimate
        factor = 0.7 + 0.1 * difficulty + rng.normal(0, 0.15)
        actual = max(0.25, est_hours * factor)
        records.append((CATEGORIES[cat_idx], difficulty, est_hours, actual))
    return records


# ─── Model Training ───────────────────────────────────────────────────────────

def train_model(training_data: list | None = None) -> Pipeline:
    """
    Train (or retrain) the Ridge regression pipeline.
    training_data: list of (category, difficulty, estimated_hours, actual_hours)
    """
    if training_data is None or len(training_data) < 10:
        training_data = _generate_seed_data()

    X = np.array([
        encode_features(cat, diff, est).flatten()
        for cat, diff, est, _ in training_data
    ])
    y = np.array([actual for *_, actual in training_data])

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("ridge",  Ridge(alpha=1.0)),
    ])
    pipeline.fit(X, y)
    logger.info("Time prediction model trained on %d samples", len(training_data))
    return pipeline


# ─── Model I/O ────────────────────────────────────────────────────────────────

def load_or_create_model() -> Pipeline:
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.exists():
        return joblib.load(MODEL_PATH)
    model = train_model()
    joblib.dump(model, MODEL_PATH)
    return model


def save_model(model: Pipeline) -> None:
    joblib.dump(model, MODEL_PATH)


# ─── Incremental Learning Buffer ──────────────────────────────────────────────
# In production, persist this buffer to MongoDB instead of in-memory.

_new_samples: list = []
RETRAIN_THRESHOLD = 20   # retrain after collecting this many new data points

_model: Pipeline = load_or_create_model()


def predict(category: str, difficulty: int, estimated_hours: float) -> dict:
    """Run inference and return prediction with confidence estimate."""
    features = encode_features(category, difficulty, estimated_hours)
    predicted = float(_model.predict(features)[0])
    predicted = max(0.25, round(predicted * 4) / 4)  # round to nearest 15 min

    # Confidence: simple heuristic based on model error from seed data
    confidence = max(0.5, min(0.95, 1.0 - abs(predicted - estimated_hours) / max(estimated_hours, 1) * 0.5))

    factors = []
    if difficulty >= 4:
        factors.append("High difficulty increases expected time")
    if predicted > estimated_hours * 1.2:
        factors.append("Students typically underestimate this category")
    if difficulty <= 2:
        factors.append("Low difficulty — estimate is likely accurate")

    return {
        "predicted_hours": predicted,
        "confidence":      round(confidence, 2),
        "factors":         factors or ["Based on historical performance data"],
    }


def add_sample(category: str, difficulty: int, estimated_hours: float, actual_hours: float) -> None:
    """Accept a new ground-truth sample and retrain if threshold is reached."""
    global _model, _new_samples
    _new_samples.append((category, difficulty, estimated_hours, actual_hours))
    logger.info("New sample added (%d / %d)", len(_new_samples), RETRAIN_THRESHOLD)

    if len(_new_samples) >= RETRAIN_THRESHOLD:
        seed = _generate_seed_data()
        combined = seed + _new_samples
        _model = train_model(combined)
        save_model(_model)
        _new_samples = []
        logger.info("Model retrained with %d samples", len(combined))
