"""Reproducible monthly revenue forecast (ordinary least squares on a time index).

Honesty rules:
- Metrics (MAE, RMSE, R2) are computed ONLY on a held-out, time-ordered test window.
- If history is too short to hold out data, metrics are returned as None — never invented.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

MIN_MONTHS = 3
MIN_MONTHS_FOR_EVAL = 9
HOLDOUT = 3


def _fit(y: np.ndarray) -> tuple[float, float]:
    x = np.arange(len(y), dtype=float)
    slope, intercept = np.polyfit(x, y, 1)
    return float(slope), float(intercept)


def _metrics(actual: np.ndarray, pred: np.ndarray) -> dict:
    err = actual - pred
    mae = float(np.mean(np.abs(err)))
    rmse = float(np.sqrt(np.mean(err ** 2)))
    ss_tot = float(np.sum((actual - actual.mean()) ** 2))
    r2 = None if ss_tot == 0 else float(1 - np.sum(err ** 2) / ss_tot)
    return {"mae": round(mae, 2), "rmse": round(rmse, 2), "r2": None if r2 is None else round(r2, 4)}


def forecast_revenue(monthly: list[dict], horizon: int = 3) -> dict:
    if len(monthly) < MIN_MONTHS:
        return {"status": "insufficient_data", "points": [], "metrics": None,
                "message": f"Need at least {MIN_MONTHS} months of data."}
    months = [m["month"] for m in monthly]
    y = np.array([m["revenue"] for m in monthly], dtype=float)

    metrics = None
    evaluation = None
    if len(y) >= MIN_MONTHS_FOR_EVAL:
        train, test = y[:-HOLDOUT], y[-HOLDOUT:]
        s, b = _fit(train)
        pred = b + s * np.arange(len(train), len(y))
        metrics = _metrics(test, pred)
        evaluation = {"method": "time-based holdout", "train_months": len(train),
                      "test_months": HOLDOUT, "test_period": [months[-HOLDOUT], months[-1]]}

    s, b = _fit(y)
    last = pd.Period(months[-1], freq="M")
    points = [{"month": str(last + i + 1),
               "forecast": round(max(0.0, b + s * (len(y) + i)), 2)} for i in range(horizon)]
    return {"status": "ok", "model": "linear_trend", "slope_per_month": round(s, 2),
            "points": points, "metrics": metrics, "evaluation": evaluation,
            "message": None if metrics else "Too little history for a holdout test; metrics not reported."}