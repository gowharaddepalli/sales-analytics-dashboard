"""FastAPI app: upload/clean CSV, analytics endpoints, forecast."""
from __future__ import annotations

import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import analytics as A
from .db import save_to_postgres
from .forecast import forecast_revenue

load_dotenv()

SAMPLE = Path(__file__).resolve().parent.parent / "data" / "sample_sales.csv"
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "10")) * 1024 * 1024

app = FastAPI(title="Sales Analytics API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:8080").split(",")],
    allow_methods=["*"], allow_headers=["*"],
)

# In-memory dataset (single-user demo). Postgres persistence is optional via DATABASE_URL.
_state: dict[str, pd.DataFrame | str] = {}


def load_sample() -> None:
    df, _ = A.clean_sales(pd.read_csv(SAMPLE, dtype=str))
    _state["df"], _state["source"] = df, "sample"


def current() -> pd.DataFrame:
    if "df" not in _state:
        load_sample()
    return _state["df"]  # type: ignore[return-value]


def filtered(start, end, category, region) -> pd.DataFrame:
    try:
        return A.apply_filters(current(), start, end, category, region)
    except ValueError as e:
        raise HTTPException(422, f"Invalid filter: {e}") from e


@app.get("/api/health")
def health():
    return {"status": "ok", "source": _state.get("source", "sample"), "rows": len(current())}


@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(400, "Only .csv files are accepted.")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large.")
    try:
        df, report = A.clean_sales(A.read_csv_bytes(data))
    except A.ValidationError as e:
        raise HTTPException(422, str(e)) from e
    _state["df"], _state["source"] = df, file.filename or "upload"
    persisted = save_to_postgres(df)
    return {"rows_in": report.rows_in, "rows_out": report.rows_out, "dropped": report.dropped,
            "duplicates_removed": report.duplicates_removed, "issues": report.issues,
            "persisted": persisted}


@app.post("/api/reset")
def reset():
    load_sample()
    return {"source": "sample", "rows": len(current())}


@app.get("/api/kpis")
def get_kpis(start: str | None = None, end: str | None = None,
             category: str | None = None, region: str | None = None):
    return A.kpis(filtered(start, end, category, region))


@app.get("/api/monthly")
def get_monthly(start: str | None = None, end: str | None = None,
                category: str | None = None, region: str | None = None):
    return A.monthly(filtered(start, end, category, region))


@app.get("/api/breakdown/{key}")
def get_breakdown(key: str, start: str | None = None, end: str | None = None,
                  category: str | None = None, region: str | None = None):
    try:
        return A.breakdown(filtered(start, end, category, region), key)
    except A.ValidationError as e:
        raise HTTPException(400, str(e)) from e


@app.get("/api/sales")
def get_sales(start: str | None = None, end: str | None = None, category: str | None = None,
              region: str | None = None, q: str | None = None,
              sort: str = "order_date", order: str = Query("desc", pattern="^(asc|desc)$"),
              page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200)):
    df = filtered(start, end, category, region)
    if q:
        ql = q.lower()
        df = df[df["order_id"].str.lower().str.contains(ql, regex=False)
                | df["product"].str.lower().str.contains(ql, regex=False)]
    if sort not in df.columns:
        raise HTTPException(400, f"Cannot sort by '{sort}'.")
    df = df.sort_values(sort, ascending=order == "asc")
    total = len(df)
    chunk = df.iloc[(page - 1) * page_size: page * page_size].copy()
    chunk["order_date"] = chunk["order_date"].dt.strftime("%Y-%m-%d")
    return {"total": total, "page": page, "page_size": page_size,
            "items": chunk.astype(object).to_dict(orient="records")}


@app.get("/api/forecast")
def get_forecast(horizon: int = Query(3, ge=1, le=12), category: str | None = None,
                 region: str | None = None):
    return forecast_revenue(A.monthly(filtered(None, None, category, region)), horizon)