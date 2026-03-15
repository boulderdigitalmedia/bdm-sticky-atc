import { createApp } from "@shopify/app-bridge";
import { getSessionToken } from "@shopify/app-bridge/utilities";

function getAppOrigin() {
  if (window.__APP_ORIGIN__) return window.__APP_ORIGIN__;
  return window.location.origin;
}

// Create a single App Bridge instance
let app;

function getApp() {
  if (!app) {
    app = createApp({
      apiKey: window.__SHOPIFY_API_KEY__,
      host: window.__SHOPIFY_HOST__,
      forceRedirect: true,
    });
  }
  return app;
}

async function authenticatedFetch(url) {
  const token = await getSessionToken(getApp());

  const res = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Request failed");
  }

  return res.json();
}

export async function fetchAnalytics(days = 7) {
  const origin = getAppOrigin();
  return authenticatedFetch(
    `${origin}/api/sticky-add-to-cart/summary?days=${days}`
  );
}

export async function fetchAnalyticsEvents(limit = 50) {
  const origin = getAppOrigin();
  return authenticatedFetch(
    `${origin}/api/sticky-add-to-cart/events?limit=${limit}`
  );
}