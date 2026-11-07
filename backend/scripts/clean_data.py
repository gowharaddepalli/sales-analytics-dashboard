"""Clean a raw sales CSV and print a data-quality report.

python -m scripts.clean_data data/sample_sales.csv --out data/clean_sales.csv   (run from backend/)
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pandas as pd  # noqa: E402

from app.analytics import ValidationError, clean_sales  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("--out")
    a = ap.parse_args()
    try:
        df, r = clean_sales(pd.read_csv(a.csv, dtype=str))
    except ValidationError as e:
        print(f"ERROR: {e}")
        return 1
    print(f"rows in: {r.rows_in}  rows out: {r.rows_out}  dropped: {r.dropped}  duplicates: {r.duplicates_removed}")
    for i in r.issues:
        print(" -", i)
    if a.out:
        df.to_csv(a.out, index=False, date_format="%Y-%m-%d")
        print("saved", a.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())