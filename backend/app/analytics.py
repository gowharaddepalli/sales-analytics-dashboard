"""Pandas cleaning + aggregation logic. Pure functions so they are easy to test."""
from __future__ import annotations

import io
from dataclasses import dataclass, field

import pandas as pd

REQUIRED_COLUMNS = [
    "order_id", "order_date", "region", "category",
    "product", "quantity", "unit_price", "unit_cost",
]


@dataclass
class CleanReport:
    rows_in: int = 0
    rows_out: int = 0
    dropped: int = 0
    duplicates_removed: int = 0
    issues: list[str] = field(default_factory=list)


class ValidationError(ValueError):
    pass


def clean_sales(df: pd.DataFrame) -> tuple[pd.DataFrame, CleanReport]:
    """Normalise headers, coerce types, drop invalid/duplicate rows, add derived columns."""
    report = CleanReport(rows_in=len(df))
    df = df.copy()
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValidationError(f"Missing required columns: {', '.join(missing)}")
    df = df[REQUIRED_COLUMNS]

    for c in ["order_id", "region", "category", "product"]:
        df[c] = df[c].astype("string").str.strip()
    df["order_date"] = pd.to_datetime(df["order_date"], format="%Y-%m-%d", errors="coerce")
    for c in ["quantity", "unit_price", "unit_cost"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    bad = (
        df[["order_id", "region", "category", "product", "order_date"]].isna().any(axis=1)
        | (df["order_id"] == "")
        | ~(df["quantity"] > 0)
        | ~(df["unit_price"] >= 0)
        | ~(df["unit_cost"] >= 0)
    )
    if bad.any():
        report.issues.append(f"{int(bad.sum())} rows had missing/invalid values")
    df = df[~bad]

    before = len(df)
    df = df.drop_duplicates(subset="order_id", keep="first")
    report.duplicates_removed = before - len(df)
    if report.duplicates_removed:
        report.issues.append(f"{report.duplicates_removed} duplicate order_id rows removed")

    df = df.assign(
        revenue=(df["quantity"] * df["unit_price"]).round(2),
        profit=(df["quantity"] * (df["unit_price"] - df["unit_cost"])).round(2),
        month=df["order_date"].dt.strftime("%Y-%m"),
    ).reset_index(drop=True)

    report.rows_out = len(df)
    report.dropped = report.rows_in - report.rows_out
    if df.empty:
        raise ValidationError("No valid rows found after validation.")
    return df, report


def read_csv_bytes(data: bytes) -> pd.DataFrame:
    try:
        return pd.read_csv(io.BytesIO(data), dtype=str, keep_default_na=False, na_values=[""])
    except Exception as e:  # pragma: no cover - pandas error types vary
        raise ValidationError(f"Could not parse CSV: {e}") from e


def apply_filters(df: pd.DataFrame, start: str | None = None, end: str | None = None,
                  category: str | None = None, region: str | None = None) -> pd.DataFrame:
    m = pd.Series(True, index=df.index)
    if start:
        m &= df["order_date"] >= pd.Timestamp(start)
    if end:
        m &= df["order_date"] <= pd.Timestamp(end)
    if category and category != "all":
        m &= df["category"] == category
    if region and region != "all":
        m &= df["region"] == region
    return df[m]


def kpis(df: pd.DataFrame) -> dict:
    revenue = round(float(df["revenue"].sum()), 2)
    profit = round(float(df["profit"].sum()), 2)
    orders = int(len(df))
    return {
        "revenue": revenue,
        "profit": profit,
        "orders": orders,
        "aov": round(revenue / orders, 2) if orders else 0.0,
        "margin": round(profit / revenue, 4) if revenue else 0.0,
    }


def monthly(df: pd.DataFrame) -> list[dict]:
    g = (df.groupby("month").agg(revenue=("revenue", "sum"), profit=("profit", "sum"),
                                  orders=("order_id", "count")).reset_index().sort_values("month"))
    g[["revenue", "profit"]] = g[["revenue", "profit"]].round(2)
    return g.to_dict(orient="records")


def breakdown(df: pd.DataFrame, key: str) -> list[dict]:
    if key not in ("category", "region"):
        raise ValidationError("key must be 'category' or 'region'")
    g = (df.groupby(key).agg(revenue=("revenue", "sum"), profit=("profit", "sum"),
                              orders=("order_id", "count")).reset_index()
         .rename(columns={key: "name"}).sort_values("revenue", ascending=False))
    g[["revenue", "profit"]] = g[["revenue", "profit"]].round(2)
    return g.to_dict(orient="records")