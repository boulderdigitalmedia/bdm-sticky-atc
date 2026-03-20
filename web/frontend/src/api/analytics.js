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

// Decode JWT payload safely
function parseJwt(token) {
  try {
    const base64 = token.split(".")[1];
    const json = atob(base64);
    return JSON.parse(json);
  } catch (e) {
    console.error("Failed to parse JWT", e);
    return null;
  }
}

// Get token + shop in one call
async function getAuthContext() {
  const token = await getSessionToken(app);
  const payload = parseJwt(token);

  const shop = payload?.dest
    ? payload.dest.replace("https://", "")
    : null;

  return { token, shop };
}

export async function fetchAnalytics(days = 7) {
  const origin = getAppOrigin();
  const { token, shop } = await getAuthContext();

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
  const { token, shop } = await getAuthContext();

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