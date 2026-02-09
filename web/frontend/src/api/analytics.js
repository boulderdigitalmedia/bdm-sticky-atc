function getAppOrigin() {
  // Provided by your index.html injection
  if (window.__APP_ORIGIN__) return window.__APP_ORIGIN__;

  // Fallback (same-origin when served by app)
  return window.location.origin;
}

function getShop() {
  const params = new URLSearchParams(window.location.search);
  return params.get("shop");
}

export async function fetchAnalytics(days = 7) {
  const origin = getAppOrigin();
  const shop = getShop();

  const res = await fetch(
    `${origin}/apps/bdm-sticky-atc/summary?days=${days}&shop=${shop}`,
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
  const origin = getAppOrigin();
  const shop = getShop();

  const res = await fetch(
    `${origin}/apps/bdm-sticky-atc/events?limit=${limit}&shop=${shop}`,
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
