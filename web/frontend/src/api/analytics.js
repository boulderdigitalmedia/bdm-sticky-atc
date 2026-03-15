import { createApp } from "@shopify/app-bridge";
import { getSessionToken } from "@shopify/app-bridge/utilities";

function getAppOrigin() {
  if (window.__APP_ORIGIN__) return window.__APP_ORIGIN__;
  return window.location.origin;
}

const app = createApp({
  apiKey: window.__SHOPIFY_API_KEY__,
  host: window.__SHOPIFY_HOST__,
  forceRedirect: true,
});

function getShop() {
  const params = new URLSearchParams(window.location.search);
  return params.get("shop");
}

export async function fetchAnalytics(days = 7) {
  const origin = getAppOrigin();
  const shop = getShop();

  const token = await getSessionToken(app);

  const res = await fetch(
    `${origin}/api/analytics/summary?days=${days}&shop=${shop}`,
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
  const shop = getShop();

  const token = await getSessionToken(app);

  const res = await fetch(
    `${origin}/api/analytics/events?limit=${limit}&shop=${shop}`,
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