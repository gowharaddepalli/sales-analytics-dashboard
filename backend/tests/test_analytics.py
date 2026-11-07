import pandas as pd
import pytest

from app.analytics import ValidationError, apply_filters, breakdown, clean_sales, kpis, monthly
from app.forecast import forecast_revenue


def raw(rows):
    cols = ["order_id", "order_date", "region", "category", "product", "quantity", "unit_price", "unit_cost"]
    return pd.DataFrame(rows, columns=cols).astype(str)


def test_kpis_values():
    df, _ = clean_sales(raw([["1", "2024-01-05", "N", "A", "p", 2, 10, 6],
                             ["2", "2024-02-05", "S", "B", "q", 1, 30, 20]]))
    assert kpis(df) == {"revenue": 50.0, "profit": 18.0, "orders": 2, "aov": 25.0, "margin": 0.36}


def test_drops_invalid_and_duplicates():
    df, r = clean_sales(raw([["1", "2024-01-01", "N", "A", "p", 2, 10, 5],
                             ["1", "2024-01-02", "N", "A", "p", 1, 10, 5],
                             ["2", "bad", "N", "A", "p", 1, 10, 5],
                             ["3", "2024-01-03", "N", "A", "p", 0, 10, 5]]))
    assert len(df) == 1 and r.dropped == 3 and r.duplicates_removed == 1


def test_missing_columns():
    with pytest.raises(ValidationError, match="Missing required columns"):
        clean_sales(pd.DataFrame({"order_id": ["1"]}))


def test_filters_and_groups():
    df, _ = clean_sales(raw([["1", "2024-01-05", "N", "A", "p", 1, 10, 5],
                             ["2", "2024-02-05", "S", "B", "q", 1, 20, 5]]))
    assert len(apply_filters(df, region="S")) == 1
    assert len(apply_filters(df, start="2024-02-01")) == 1
    assert [m["month"] for m in monthly(df)] == ["2024-01", "2024-02"]
    assert breakdown(df, "category")[0]["name"] == "B"


def test_forecast_no_metrics_when_short():
    series = [{"month": f"2024-0{i}", "revenue": 100 * i} for i in range(1, 6)]
    f = forecast_revenue(series)
    assert f["metrics"] is None and len(f["points"]) == 3


def test_forecast_metrics_on_holdout_perfect_line():
    series = [{"month": str(pd.Period("2024-01", "M") + i), "revenue": 100 + 10 * i} for i in range(12)]
    f = forecast_revenue(series)
    assert f["metrics"]["mae"] == 0 and f["metrics"]["rmse"] == 0
    assert f["points"][0] == {"month": "2025-01", "forecast": 220.0}


def test_forecast_insufficient():
    assert forecast_revenue([{"month": "2024-01", "revenue": 1}])["status"] == "insufficient_data"