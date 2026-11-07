"""Quick exploratory data analysis printed to the console.

python scripts/eda.py data/sample_sales.csv   (run from backend/)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pandas as pd  # noqa: E402

from app.analytics import breakdown, clean_sales, kpis, monthly  # noqa: E402

path = sys.argv[1] if len(sys.argv) > 1 else "data/sample_sales.csv"
df, _ = clean_sales(pd.read_csv(path, dtype=str))
print("== Shape ==", df.shape)
print("\n== Date range ==", df["order_date"].min().date(), "->", df["order_date"].max().date())
print("\n== KPIs ==", kpis(df))
print("\n== Numeric summary ==\n", df[["quantity", "unit_price", "revenue", "profit"]].describe().round(2))
print("\n== By category ==\n", pd.DataFrame(breakdown(df, "category")))
print("\n== By region ==\n", pd.DataFrame(breakdown(df, "region")))
m = pd.DataFrame(monthly(df))
m["mom_pct"] = (m["revenue"].pct_change() * 100).round(1)
print("\n== Monthly ==\n", m.to_string(index=False))