"""Optional PostgreSQL persistence. Disabled unless DATABASE_URL is set."""
from __future__ import annotations

import logging
import os

import pandas as pd

log = logging.getLogger(__name__)


def save_to_postgres(df: pd.DataFrame) -> bool:
    url = os.getenv("DATABASE_URL")
    if not url:
        return False
    try:
        from sqlalchemy import create_engine, text

        engine = create_engine(url)
        cols = ["order_id", "order_date", "region", "category", "product",
                "quantity", "unit_price", "unit_cost"]
        with engine.begin() as conn:
            conn.execute(text("TRUNCATE sales"))
            df[cols].to_sql("sales", conn, if_exists="append", index=False)
        return True
    except Exception as e:  # keep API usable if DB is down
        log.warning("Postgres save failed: %s", e)
        return False