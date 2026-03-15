import { createApp } from "@shopify/app-bridge";
import { getSessionToken } from "@shopify/app-bridge/utilities";

function getAppOrigin() {
  return window.__APP_ORIGIN__ || window.location.origin;
}

const app = createApp({
  apiKey: window.__SHOPIFY_API_KEY__,
  host: window.__SHOPIFY_HOST__,
  forceRedirect: true,
});

// Decode JWT payload
function parseJwt(token) {
  const base64 = token.split(".")[1];
  const json = atob(base64);
  return JSON.parse(json);
}

async function getShopFromToken() {
  const token = await getSessionToken(app);
  const payload = parseJwt(token);
  return payload.dest.replace("https://", "");
}

export async function fetchAnalytics(days = 7) {
  const origin = getAppOrigin();
  const token = await getSessionToken(app);
  const shop = await getShopFromToken();

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
  const token = await getSessionToken(app);
  const shop = await getShopFromToken();

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