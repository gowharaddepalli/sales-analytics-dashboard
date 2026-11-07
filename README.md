# Sales Analytics Dashboard with Predictive Insights

A full-stack sales analytics project that combines an interactive React dashboard with a Python analytics API and forecasting utilities.

## Features
- Sales KPIs, charts, filtering, and searchable/sortable sales data.
- CSV-based sales data workflow and sample dataset.
- FastAPI backend with Pandas/NumPy analytics endpoints.
- Data-cleaning, exploratory analysis, and forecasting scripts.
- PostgreSQL schema and example SQL queries.
- Automated frontend and backend test suites.

## Tech stack
React, TypeScript, Vite, Python, FastAPI, Pandas, NumPy, SQLAlchemy, PostgreSQL.

## Project structure
- `src/` — dashboard frontend and UI components.
- `backend/app/` — API, analytics, database, and forecasting modules.
- `backend/data/` — sample sales dataset.
- `backend/scripts/` — data cleaning, EDA, sample generation, and forecast scripts.
- `backend/sql/` — database schema and query examples.
- `backend/tests/` — backend tests.

## Getting started
### Frontend
Install dependencies using the package manager indicated by the lockfile (Bun):
```bash
bun install
bun run dev
```

### Backend
```bash
cd backend
python -m venv .venv
# Activate the virtual environment, then:
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Copy `backend/.env.example` to `backend/.env` and configure database settings if you are connecting PostgreSQL. Review the SQL files before applying the schema.

## Tests
Frontend:
```bash
bunx vitest run
```
Backend:
```bash
cd backend
pytest
```

## Notes
Configure environment variables locally; never commit real credentials or production data. Forecast outputs depend on the quality and quantity of the input sales history.

## License
MIT. See [LICENSE](LICENSE).
