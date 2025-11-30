import React from "react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import { AppBridgeProvider } from "@shopify/app-bridge-react";
import { BrowserRouter } from "@shopify/react-router";

export default function Providers({ children }) {
  const host = new URLSearchParams(location.search).get("host");
  const shop = new URLSearchParams(location.search).get("shop");

  const appBridgeConfig = {
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
    host,
    forceRedirect: true,
  };

  return (
    <AppBridgeProvider config={appBridgeConfig}>
      <PolarisProvider>{children}</PolarisProvider>
    </AppBridgeProvider>
  );
}
