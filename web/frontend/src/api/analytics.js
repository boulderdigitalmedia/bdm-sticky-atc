import { createApp } from "@shopify/app-bridge";
import { getSessionToken } from "@shopify/app-bridge/utilities";

function getAppOrigin() {
  if (window.__APP_ORIGIN__) return window.__APP_ORIGIN__;
  return window.location.origin;
}

// Create App Bridge instance
const app = createApp({
  apiKey: window.__SHOPIFY_API_KEY__,
  host: window.__SHOPIFY_HOST__,
  forceRedirect: true,
});

export async function fetchAnalytics(days = 7) {
  const origin = getAppOrigin();

  // ⭐ Get Shopify session token
  const token = await getSessionToken(app);

  const res = await fetch(
    `${origin}/api/analytics/summary?days=${days}`,
    {
      credentials: "include",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
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

  // ⭐ Get Shopify session token
  const token = await getSessionToken(app);

  const res = await fetch(
    `${origin}/api/analytics/events?limit=${limit}`,
    {
      credentials: "include",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error("Failed to load events");
  }

  return res.json();
}