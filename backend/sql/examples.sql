-- Example analytics queries (match the API endpoints)

-- KPIs
SELECT SUM(revenue) AS revenue, SUM(profit) AS profit, COUNT(*) AS orders,
       ROUND(SUM(revenue) / NULLIF(COUNT(*), 0), 2) AS aov,
       ROUND(SUM(profit) / NULLIF(SUM(revenue), 0), 4) AS margin
FROM sales
WHERE order_date BETWEEN '2024-01-01' AND '2025-12-31';

-- Monthly revenue & profit
SELECT TO_CHAR(DATE_TRUNC('month', order_date), 'YYYY-MM') AS month,
       SUM(revenue) AS revenue, SUM(profit) AS profit, COUNT(*) AS orders
FROM sales GROUP BY 1 ORDER BY 1;

-- Category breakdown
SELECT category, SUM(revenue) AS revenue, SUM(profit) AS profit
FROM sales GROUP BY category ORDER BY revenue DESC;

-- Region share of revenue
SELECT region, SUM(revenue) AS revenue,
       ROUND(100 * SUM(revenue) / SUM(SUM(revenue)) OVER (), 1) AS pct
FROM sales GROUP BY region ORDER BY revenue DESC;

-- Top 5 products by profit
SELECT product, SUM(profit) AS profit FROM sales
GROUP BY product ORDER BY profit DESC LIMIT 5;

-- Month-over-month revenue growth
WITH m AS (
  SELECT DATE_TRUNC('month', order_date) AS month, SUM(revenue) AS revenue
  FROM sales GROUP BY 1
)
SELECT TO_CHAR(month, 'YYYY-MM') AS month, revenue,
       ROUND(100 * (revenue / NULLIF(LAG(revenue) OVER (ORDER BY month), 0) - 1), 1) AS mom_pct
FROM m ORDER BY month;