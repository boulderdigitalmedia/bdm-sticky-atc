import React, { useMemo } from "react";
import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";
import { AppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";

function getParam(name) {
  return new URL(window.location.href).searchParams.get(name);
}

export default function App() {
  const shop = getParam("shop");
  const host = getParam("host");

  // ❌ DO NOT redirect to /auth if host exists
  // ❌ DO NOT redirect repeatedly

  // Opened directly (not in Shopify)
  if (!shop) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Sticky Add To Cart Bar</h2>
        <p>This app must be opened from Shopify Admin.</p>
      </div>
    );
  }

  // First install ONLY (no host yet)
  if (!host) {
    window.location.replace(`/auth?shop=${encodeURIComponent(shop)}`);
    return null;
  }

  const appBridgeConfig = useMemo(
    () => ({
      apiKey: window.__SHOPIFY_API_KEY__,
      host,
      forceRedirect: true,
    }),
    [host]
  );

  return (
    <AppProvider i18n={{}}>
      <AppBridgeProvider config={appBridgeConfig}>
        <div style={{ padding: 24 }}>
          <h2>Sticky Add To Cart Bar</h2>
          <p>✅ Embedded app loaded correctly.</p>
        </div>
      </AppBridgeProvider>
    </AppProvider>
  );
}
