import { useMemo, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowUp, Database, Download, FileUp, RotateCcw, Search, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applyFilters, computeKpis, enrich, forecastRevenue, generateDemoData, groupBy, monthlySeries, parseSalesCsv, toCsv, type EnrichedRow, type SaleRow } from "@/lib/sales";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const C = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 } };

type Source = { kind: "demo" } | { kind: "upload"; name: string; dropped: number };

function Panel({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border bg-card p-5 shadow-card ${className}`}>
      <header className="mb-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </header>
      {children}
    </section>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="flex h-60 items-center justify-center rounded border border-dashed text-sm text-muted-foreground">{msg}</div>;
}

export function Dashboard() {
  const [raw, setRaw] = useState<SaleRow[]>(() => generateDemoData());
  const [source, setSource] = useState<Source>({ kind: "demo" });
  const [loading, setLoading] = useState(false);
  const [uploadIssues, setUploadIssues] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState("all");
  const [region, setRegion] = useState("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => enrich(raw), [raw]);
  const categories = useMemo(() => [...new Set(all.map((r) => r.category))].sort(), [all]);
  const regions = useMemo(() => [...new Set(all.map((r) => r.region))].sort(), [all]);
  const rows = useMemo(() => applyFilters(all, { from, to, category, region }), [all, from, to, category, region]);
  const kpis = useMemo(() => computeKpis(rows), [rows]);
  const monthly = useMemo(() => monthlySeries(rows), [rows]);
  const byCat = useMemo(() => groupBy(rows, "category"), [rows]);
  const byRegion = useMemo(() => groupBy(rows, "region"), [rows]);
  const fc = useMemo(() => forecastRevenue(monthly), [monthly]);
  const fcChart = useMemo(() => {
    if (!fc) return [];
    const hist = monthly.map((m) => ({ month: m.month, actual: m.revenue, forecast: null as number | null }));
    if (hist.length) hist[hist.length - 1].forecast = hist[hist.length - 1].actual;
    return [...hist, ...fc.points.map((p) => ({ month: p.month, actual: null, forecast: p.forecast }))];
  }, [fc, monthly]);

  const resetFilters = () => { setFrom(""); setTo(""); setCategory("all"); setRegion("all"); };

  async function onFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) { toast.error("Please choose a .csv file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("File is larger than 10 MB"); return; }
    setLoading(true);
    try {
      const res = parseSalesCsv(await file.text());
      setUploadIssues([...res.errors, ...res.warnings]);
      if (res.errors.length) { toast.error(res.errors[0]); return; }
      setRaw(res.rows);
      setSource({ kind: "upload", name: file.name, dropped: res.dropped });
      resetFilters();
      toast.success(`Loaded ${res.rows.length} rows${res.dropped ? `, dropped ${res.dropped} invalid` : ""}`);
    } catch {
      toast.error("Could not read that file");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function downloadSample() {
    const blob = new Blob([toCsv(generateDemoData())], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sample_sales.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="num text-xs uppercase tracking-widest text-muted-foreground">Portfolio project · Data analytics</p>
            <h1 className="text-xl font-bold sm:text-2xl">Sales Analytics Dashboard <span className="text-primary">with Predictive Insights</span></h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {source.kind === "demo" ? (
              <Badge className="gap-1 bg-accent text-accent-foreground hover:bg-accent"><Database className="h-3 w-3" />Demo mode · synthetic data</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><FileUp className="h-3 w-3" />{source.name}</Badge>
            )}
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={loading}><FileUp className="h-4 w-4" />{loading ? "Reading…" : "Upload CSV"}</Button>
            <Button size="sm" variant="outline" onClick={downloadSample}><Download className="h-4 w-4" />Sample CSV</Button>
            {source.kind === "upload" && (
              <Button size="sm" variant="ghost" onClick={() => { setRaw(generateDemoData()); setSource({ kind: "demo" }); setUploadIssues([]); resetFilters(); }}>
                <RotateCcw className="h-4 w-4" />Demo data
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {source.kind === "demo" && (
          <p className="rounded-md border border-dashed bg-muted px-4 py-3 text-sm text-muted-foreground">
            You're viewing a <strong className="text-foreground">seeded, synthetic demo dataset</strong> (24 months, 4 regions, 4 categories). It is not real business data. Upload your own CSV with columns{" "}
            <code className="num text-xs">order_id, order_date, region, category, product, quantity, unit_price, unit_cost</code>.
          </p>
        )}
        {uploadIssues.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-destructive"><AlertTriangle className="h-4 w-4" />Validation report</p>
            <ul className="num mt-2 max-h-32 list-inside list-disc overflow-auto text-xs text-muted-foreground">
              {uploadIssues.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-4 shadow-card md:grid-cols-5">
          <label className="text-xs text-muted-foreground">From<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" /></label>
          <label className="text-xs text-muted-foreground">To<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" /></label>
          <label className="text-xs text-muted-foreground">Category
            <Select value={category} onValueChange={setCategory}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          </label>
          <label className="text-xs text-muted-foreground">Region
            <Select value={region} onValueChange={setRegion}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All regions</SelectItem>{regions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          </label>
          <div className="col-span-2 flex items-end md:col-span-1"><Button variant="outline" className="w-full" onClick={resetFilters}>Reset filters</Button></div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            ["Revenue", money(kpis.revenue)],
            ["Profit", money(kpis.profit), `${(kpis.margin * 100).toFixed(1)}% margin`],
            ["Orders", kpis.orders.toLocaleString()],
            ["Avg order value", money(kpis.aov)],
          ].map(([label, value, note]) => (
            <div key={label} className="rounded-lg border bg-card p-5 shadow-card">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="num mt-2 text-2xl font-medium sm:text-3xl">{value}</p>
              {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
            </div>
          ))}
        </div>

        {rows.length === 0 ? (
          <Empty msg="No sales match these filters. Try widening the date range or resetting filters." />
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-3">
              <Panel title="Monthly revenue & profit" sub="Sum per calendar month" className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={monthly}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" tick={axis} /><YAxis tick={axis} tickFormatter={(v) => `$${v / 1000}k`} width={50} />
                    <Tooltip {...tip} formatter={(v: number) => money(v)} /><Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area dataKey="revenue" stroke={C[0]} fill={C[0]} fillOpacity={0.15} />
                    <Area dataKey="profit" stroke={C[1]} fill={C[1]} fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>
              <Panel title="Revenue by category">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={byCat} dataKey="revenue" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                      {byCat.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                    </Pie>
                    <Tooltip {...tip} formatter={(v: number) => money(v)} /><Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Panel>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Panel title="Revenue & profit by region">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byRegion}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={axis} /><YAxis tick={axis} tickFormatter={(v) => `$${v / 1000}k`} width={50} />
                    <Tooltip {...tip} formatter={(v: number) => money(v)} />
                    <Bar dataKey="revenue" fill={C[0]} radius={[3, 3, 0, 0]} /><Bar dataKey="profit" fill={C[1]} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
              <Panel title="Revenue forecast (next 3 months)" sub="In-browser linear trend — a simple preview, not the backend RandomForest model" className="lg:col-span-2">
                {!fc ? <Empty msg="Need at least 3 months of data to forecast." /> : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={fcChart}>
                        <CartesianGrid stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="month" tick={axis} /><YAxis tick={axis} tickFormatter={(v) => `$${v / 1000}k`} width={50} />
                        <Tooltip {...tip} formatter={(v: number) => money(v)} /><Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line dataKey="actual" stroke={C[0]} dot={false} strokeWidth={2} />
                        <Line dataKey="forecast" stroke={C[3]} strokeDasharray="5 4" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />Trend: <span className="num text-foreground">{money(fc.slope)}/month</span></span>
                      <span>Holdout MAE (last {fc.heldOut} months):{" "}
                        <span className="num text-foreground">{fc.mae === null ? "not measured — needs ≥ 9 months" : money(fc.mae)}</span></span>
                    </div>
                  </>
                )}
              </Panel>
            </div>

            <SalesTable rows={rows} />
          </>
        )}
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Frontend runs fully in the browser. Python FastAPI backend, SQL and model training live in <code className="num">/backend</code> — see README.
      </footer>
    </div>
  );
}

type SortKey = "order_date" | "product" | "category" | "region" | "quantity" | "revenue" | "profit";

function SalesTable({ rows }: { rows: EnrichedRow[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "order_date", dir: -1 });
  const [page, setPage] = useState(0);
  const per = 15;
  const view = useMemo(() => {
    const s = q.trim().toLowerCase();
    const f = s ? rows.filter((r) => `${r.order_id} ${r.product} ${r.category} ${r.region}`.toLowerCase().includes(s)) : rows;
    return [...f].sort((a, b) => (a[sort.key] < b[sort.key] ? -1 : a[sort.key] > b[sort.key] ? 1 : 0) * sort.dir);
  }, [rows, q, sort]);
  const pages = Math.max(1, Math.ceil(view.length / per));
  const p = Math.min(page, pages - 1);
  const cols: [SortKey, string, boolean][] = [["order_date", "Date", false], ["product", "Product", false], ["category", "Category", false], ["region", "Region", false], ["quantity", "Qty", true], ["revenue", "Revenue", true], ["profit", "Profit", true]];

  return (
    <Panel title="Sales records" sub={`${view.length.toLocaleString()} rows`}>
      <div className="relative mb-3 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search order, product, category, region…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="pl-9" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Order</th>
              {cols.map(([k, label, right]) => (
                <th key={k} className={`py-2 pr-3 font-medium ${right ? "text-right" : ""}`}>
                  <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))}>
                    {label}{sort.key === k && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.slice(p * per, p * per + per).map((r) => (
              <tr key={r.order_id} className="border-b last:border-0 hover:bg-muted/60">
                <td className="num py-2 pr-3 text-xs text-muted-foreground">{r.order_id}</td>
                <td className="num py-2 pr-3">{r.order_date}</td>
                <td className="py-2 pr-3">{r.product}</td>
                <td className="py-2 pr-3">{r.category}</td>
                <td className="py-2 pr-3">{r.region}</td>
                <td className="num py-2 pr-3 text-right">{r.quantity}</td>
                <td className="num py-2 pr-3 text-right">{money(r.revenue)}</td>
                <td className="num py-2 pr-3 text-right">{money(r.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {view.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No rows match "{q}".</p>}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span className="num">Page {p + 1} / {pages}</span>
        <Button size="sm" variant="outline" disabled={p === 0} onClick={() => setPage(p - 1)}>Prev</Button>
        <Button size="sm" variant="outline" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>Next</Button>
      </div>
    </Panel>
  );
}