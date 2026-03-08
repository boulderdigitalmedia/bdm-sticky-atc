function getShop() {
  const params = new URLSearchParams(window.location.search);
  return params.get("shop");
}

export async function fetchAnalytics(days = 7) {
  const shop = getShop();

  const res = await fetch(
    `/api/analytics/summary?days=${days}&shop=${shop}`,
    {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    throw new Error("Failed to load analytics");
  }

  return res.json();
}

export async function fetchAnalyticsEvents(limit = 50) {
  const shop = getShop();

  const res = await fetch(
    `/api/analytics/events?limit=${limit}&shop=${shop}`,
    {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    throw new Error("Failed to load events");
  }

  return res.json();
}