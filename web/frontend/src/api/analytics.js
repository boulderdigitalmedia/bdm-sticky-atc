export async function fetchAnalytics() {
  const res = await fetch("/api/analytics/summary");

  if (!res.ok) {
    throw new Error("Failed to load analytics");
  }

  return res.json();
}
