import { createApp } from "@shopify/app-bridge";
import { getSessionToken } from "@shopify/app-bridge-utils";

const app = createApp({
  apiKey: window.__SHOPIFY_API_KEY__,
  host: window.__SHOPIFY_HOST__,
  forceRedirect: true,
});

export async function apiFetch(path) {
  const shop = window.Shopify?.shop;

  if (!shop) {
    console.warn("Shop missing from Shopify App Bridge");
  }

  const join = path.includes("?") ? "&" : "?";

  // ⭐ Get Shopify session token
  const token = await getSessionToken(app);

  return fetch(`${path}${join}shop=${shop}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
  });
}