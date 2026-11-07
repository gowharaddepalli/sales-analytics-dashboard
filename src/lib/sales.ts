// Core sales data logic: types, demo data generator, CSV validation, aggregations, forecast.
// Pure functions only — unit-tested in src/test/sales.test.ts.

export interface SaleRow {
  order_id: string;
  order_date: string; // YYYY-MM-DD
  region: string;
  category: string;
  product: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
}

export interface EnrichedRow extends SaleRow {
  revenue: number;
  profit: number;
  month: string; // YYYY-MM
}

export const REQUIRED_COLUMNS = [
  "order_id",
  "order_date",
  "region",
  "category",
  "product",
  "quantity",
  "unit_price",
  "unit_cost",
] as const;

/* ---------------- Demo data (seeded, reproducible) ---------------- */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATALOG: Record<string, { product: string; price: number; margin: number }[]> = {
  Electronics: [
    { product: "Wireless Headphones", price: 89, margin: 0.35 },
    { product: "USB-C Hub", price: 39, margin: 0.45 },
    { product: "27in Monitor", price: 249, margin: 0.22 },
  ],
  Furniture: [
    { product: "Ergonomic Chair", price: 179, margin: 0.3 },
    { product: "Standing Desk", price: 399, margin: 0.25 },
  ],
  "Office Supplies": [
    { product: "Notebook Pack", price: 12, margin: 0.55 },
    { product: "Gel Pens (12)", price: 9, margin: 0.6 },
    { product: "Desk Organizer", price: 24, margin: 0.5 },
  ],
  Apparel: [
    { product: "Hoodie", price: 45, margin: 0.5 },
    { product: "Running Shoes", price: 95, margin: 0.4 },
  ],
};
const REGIONS = ["North", "South", "East", "West"];

/** Synthetic demo dataset: 24 months, seeded so every load is identical. */
export function generateDemoData(seed = 42, months = 24, start = "2024-01"): SaleRow[] {
  const rand = mulberry32(seed);
  const [sy, sm] = start.split("-").map(Number);
  const rows: SaleRow[] = [];
  const cats = Object.keys(CATALOG);
  let id = 1;
  for (let m = 0; m < months; m++) {
    const d = new Date(Date.UTC(sy, sm - 1 + m, 1));
    const y = d.getUTCFullYear();
    const mo = d.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    // upward trend + Q4 seasonality
    const seasonal = 1 + 0.35 * Math.max(0, Math.sin(((mo - 8) / 12) * Math.PI * 2));
    const count = Math.round((45 + m * 1.6) * seasonal + rand() * 10);
    for (let i = 0; i < count; i++) {
      const category = cats[Math.floor(rand() * cats.length)];
      const item = CATALOG[category][Math.floor(rand() * CATALOG[category].length)];
      const price = +(item.price * (0.9 + rand() * 0.2)).toFixed(2);
      const day = 1 + Math.floor(rand() * daysInMonth);
      rows.push({
        order_id: `DEMO-${String(id++).padStart(5, "0")}`,
        order_date: `${y}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        region: REGIONS[Math.floor(rand() * REGIONS.length)],
        category,
        product: item.product,
        quantity: 1 + Math.floor(rand() * 4),
        unit_price: price,
        unit_cost: +(price * (1 - item.margin)).toFixed(2),
      });
    }
  }
  return rows;
}

/* ---------------- CSV parsing & validation ---------------- */

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export interface CsvResult {
  rows: SaleRow[];
  errors: string[]; // fatal problems (missing columns, no rows)
  warnings: string[]; // per-row issues; those rows are dropped
  dropped: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseSalesCsv(text: string): CsvResult {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { rows: [], errors: ["File is empty."], warnings: [], dropped: 0 };
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) {
    return { rows: [], errors: [`Missing required columns: ${missing.join(", ")}`], warnings: [], dropped: 0 };
  }
  const idx = Object.fromEntries(REQUIRED_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<string, number>;
  const rows: SaleRow[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const get = (c: string) => cells[idx[c]] ?? "";
    const problems: string[] = [];
    const order_id = get("order_id");
    const order_date = get("order_date");
    const quantity = Number(get("quantity"));
    const unit_price = Number(get("unit_price"));
    const unit_cost = Number(get("unit_cost"));
    if (!order_id) problems.push("missing order_id");
    else if (seen.has(order_id)) problems.push("duplicate order_id");
    if (!DATE_RE.test(order_date) || isNaN(Date.parse(order_date))) problems.push("invalid order_date (use YYYY-MM-DD)");
    if (!Number.isFinite(quantity) || quantity <= 0) problems.push("quantity must be > 0");
    if (!Number.isFinite(unit_price) || unit_price < 0) problems.push("invalid unit_price");
    if (!Number.isFinite(unit_cost) || unit_cost < 0) problems.push("invalid unit_cost");
    for (const c of ["region", "category", "product"]) if (!get(c)) problems.push(`missing ${c}`);
    if (problems.length) {
      dropped++;
      if (warnings.length < 20) warnings.push(`Row ${i + 1}: ${problems.join("; ")}`);
      continue;
    }
    seen.add(order_id);
    rows.push({ order_id, order_date, region: get("region"), category: get("category"), product: get("product"), quantity, unit_price, unit_cost });
  }
  const errors = rows.length === 0 ? ["No valid rows found after validation."] : [];
  return { rows, errors, warnings, dropped };
}

export function toCsv(rows: SaleRow[]): string {
  const esc = (v: string | number) => (/[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [REQUIRED_COLUMNS.join(","), ...rows.map((r) => REQUIRED_COLUMNS.map((c) => esc(r[c])).join(","))].join("\n");
}

/* ---------------- Aggregations ---------------- */

const round2 = (n: number) => Math.round(n * 100) / 100;

export function enrich(rows: SaleRow[]): EnrichedRow[] {
  return rows.map((r) => ({
    ...r,
    revenue: round2(r.quantity * r.unit_price),
    profit: round2(r.quantity * (r.unit_price - r.unit_cost)),
    month: r.order_date.slice(0, 7),
  }));
}

export interface Filters {
  from?: string;
  to?: string;
  category?: string; // "all" or value
  region?: string;
}

export function applyFilters(rows: EnrichedRow[], f: Filters): EnrichedRow[] {
  return rows.filter(
    (r) =>
      (!f.from || r.order_date >= f.from) &&
      (!f.to || r.order_date <= f.to) &&
      (!f.category || f.category === "all" || r.category === f.category) &&
      (!f.region || f.region === "all" || r.region === f.region),
  );
}

export function computeKpis(rows: EnrichedRow[]) {
  const revenue = round2(rows.reduce((s, r) => s + r.revenue, 0));
  const profit = round2(rows.reduce((s, r) => s + r.profit, 0));
  const orders = rows.length;
  return { revenue, profit, orders, aov: orders ? round2(revenue / orders) : 0, margin: revenue ? profit / revenue : 0 };
}

export function monthlySeries(rows: EnrichedRow[]) {
  const map = new Map<string, { month: string; revenue: number; profit: number; orders: number }>();
  for (const r of rows) {
    const m = map.get(r.month) ?? { month: r.month, revenue: 0, profit: 0, orders: 0 };
    m.revenue += r.revenue;
    m.profit += r.profit;
    m.orders++;
    map.set(r.month, m);
  }
  return [...map.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ ...m, revenue: round2(m.revenue), profit: round2(m.profit) }));
}

export function groupBy(rows: EnrichedRow[], key: "category" | "region") {
  const map = new Map<string, { name: string; revenue: number; profit: number; orders: number }>();
  for (const r of rows) {
    const g = map.get(r[key]) ?? { name: r[key], revenue: 0, profit: 0, orders: 0 };
    g.revenue += r.revenue;
    g.profit += r.profit;
    g.orders++;
    map.set(r[key], g);
  }
  return [...map.values()].map((g) => ({ ...g, revenue: round2(g.revenue), profit: round2(g.profit) })).sort((a, b) => b.revenue - a.revenue);
}

/* ---------------- Forecast (client-side linear trend) ---------------- */

export function linearFit(y: number[]) {
  const n = y.length;
  const xm = (n - 1) / 2;
  const ym = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  y.forEach((v, i) => { num += (i - xm) * (v - ym); den += (i - xm) ** 2; });
  const slope = den ? num / den : 0;
  return { slope, intercept: ym - slope * xm };
}

export function addMonths(month: string, k: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + k, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Fits a linear trend on monthly revenue. If there are >= 9 months, the last 3
 * are held out (time-based split) and MAE is MEASURED on them; otherwise mae is null.
 */
export function forecastRevenue(series: { month: string; revenue: number }[], horizon = 3) {
  if (series.length < 3) return null;
  const y = series.map((s) => s.revenue);
  let mae: number | null = null;
  if (y.length >= 9) {
    const train = y.slice(0, -3);
    const { slope, intercept } = linearFit(train);
    const errs = y.slice(-3).map((v, i) => Math.abs(v - (intercept + slope * (train.length + i))));
    mae = round2(errs.reduce((a, b) => a + b, 0) / errs.length);
  }
  const { slope, intercept } = linearFit(y);
  const last = series[series.length - 1].month;
  const points = Array.from({ length: horizon }, (_, i) => ({
    month: addMonths(last, i + 1),
    forecast: round2(Math.max(0, intercept + slope * (y.length + i))),
  }));
  return { points, mae, slope: round2(slope), heldOut: mae === null ? 0 : 3 };
}