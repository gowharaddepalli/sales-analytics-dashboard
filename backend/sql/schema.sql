-- PostgreSQL schema for the Sales Analytics Dashboard
-- psql "$DATABASE_URL" -f backend/sql/schema.sql

CREATE TABLE IF NOT EXISTS sales (
    order_id    TEXT PRIMARY KEY,
    order_date  DATE           NOT NULL,
    region      TEXT           NOT NULL,
    category    TEXT           NOT NULL,
    product     TEXT           NOT NULL,
    quantity    INTEGER        NOT NULL CHECK (quantity > 0),
    unit_price  NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    unit_cost   NUMERIC(12, 2) NOT NULL CHECK (unit_cost >= 0),
    revenue     NUMERIC(14, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    profit      NUMERIC(14, 2) GENERATED ALWAYS AS (quantity * (unit_price - unit_cost)) STORED
);

CREATE INDEX IF NOT EXISTS idx_sales_date     ON sales (order_date);
CREATE INDEX IF NOT EXISTS idx_sales_category ON sales (category);
CREATE INDEX IF NOT EXISTS idx_sales_region   ON sales (region);