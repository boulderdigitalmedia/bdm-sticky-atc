export async function fetchAnalytics() {
  const params = new URLSearchParams(window.location.search);
  const shop = params.get("shop");
  const url = shop
    ? `/apps/bdm-sticky-atc/summary?shop=${encodeURIComponent(shop)}`
    : "/apps/bdm-sticky-atc/summary";
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("Failed to load analytics");
  }

  const data = await res.json();
  return {
    clicks: data.addToCart ?? data.clicks ?? 0,
    atcRate: data.atcRate ?? null,
    revenue: data.revenue ?? null
  };
}

