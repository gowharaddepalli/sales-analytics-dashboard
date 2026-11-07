from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
HEADER = "order_id,order_date,region,category,product,quantity,unit_price,unit_cost\n"


def setup_function():
    client.post("/api/reset")


def test_health_and_kpis():
    assert client.get("/api/health").json()["status"] == "ok"
    k = client.get("/api/kpis").json()
    assert k["orders"] > 0 and k["revenue"] > 0


def test_sales_paging_and_sort():
    r = client.get("/api/sales", params={"page_size": 5, "sort": "revenue", "order": "desc"}).json()
    assert len(r["items"]) == 5
    assert r["items"][0]["revenue"] >= r["items"][-1]["revenue"]


def test_upload_valid_and_invalid():
    csv = HEADER + "A1,2024-01-01,North,X,p,2,10,5\nA1,2024-01-02,North,X,p,1,10,5\n"
    r = client.post("/api/upload", files={"file": ("s.csv", csv, "text/csv")})
    assert r.status_code == 200 and r.json()["rows_out"] == 1
    assert client.get("/api/kpis").json()["revenue"] == 20.0
    bad = client.post("/api/upload", files={"file": ("s.csv", "a,b\n1,2", "text/csv")})
    assert bad.status_code == 422


def test_forecast_endpoint_reports_metrics_on_sample():
    f = client.get("/api/forecast").json()
    assert f["status"] == "ok" and f["metrics"]["mae"] >= 0


def test_bad_breakdown_key():
    assert client.get("/api/breakdown/foo").status_code == 400