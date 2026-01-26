import React, { useMemo } from "react";
import { AppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";

import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";

function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

export default function App() {
  const shop = getParam("shop");
  const host = getParam("host");

  // If opened directly (not in Shopify Admin)
  if (!shop) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Sticky Add To Cart Bar</h2>
        <p>Please open this app from inside Shopify Admin.</p>
      </div>
    );
  }

  // If Shopify loads app without host, bounce to auth once
  if (!host) {
    window.location.href = `/auth?shop=${encodeURIComponent(shop)}`;
    return null;
  }

  const appBridgeConfig = useMemo(() => {
    return {
      apiKey: window.__SHOPIFY_API_KEY__,
      host,
      forceRedirect: true,
    };
  }, [host]);

  return (
    <AppProvider i18n={{}}>
      <AppBridgeProvider config={appBridgeConfig}>
        <div style={{ padding: 24 }}>
          <h2>Sticky Add To Cart Bar</h2>
          <p>✅ Embedded app loaded successfully.</p>
        </div>
      </AppBridgeProvider>
    </AppProvider>
  );
}
