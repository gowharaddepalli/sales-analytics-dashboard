import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sales Analytics Dashboard with Predictive Insights" },
      { name: "description", content: "Interactive sales KPIs, breakdowns, CSV upload and revenue forecasting — a full stack data analytics portfolio project." },
      { property: "og:title", content: "Sales Analytics Dashboard with Predictive Insights" },
      { property: "og:description", content: "Interactive sales KPIs, breakdowns, CSV upload and revenue forecasting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});