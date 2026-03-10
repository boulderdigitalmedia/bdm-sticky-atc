function getAppOrigin() {
  if (window.__APP_ORIGIN__) return window.__APP_ORIGIN__;
  return window.location.origin;
}

export async function fetchAnalytics(days = 7) {
  const origin = getAppOrigin();

  const res = await fetch(
    `${origin}/api/sticky-add-to-cart/summary?days=${days}`,
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

  const res = await fetch(
    `${origin}/api/sticky-add-to-cart/events?limit=${limit}`,
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