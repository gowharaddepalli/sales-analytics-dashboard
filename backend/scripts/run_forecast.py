"""Reproducible forecast run. Prints holdout metrics only if they were actually measured.

python scripts/run_forecast.py data/sample_sales.csv --horizon 3   (run from backend/)
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pandas as pd  # noqa: E402

from app.analytics import clean_sales, monthly  # noqa: E402
from app.forecast import forecast_revenue  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("csv", nargs="?", default="data/sample_sales.csv")
ap.add_argument("--horizon", type=int, default=3)
a = ap.parse_args()
df, _ = clean_sales(pd.read_csv(a.csv, dtype=str))
print(json.dumps(forecast_revenue(monthly(df), a.horizon), indent=2))