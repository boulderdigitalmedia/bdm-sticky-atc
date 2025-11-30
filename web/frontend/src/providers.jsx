import React from "react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import { AppBridgeProvider } from "@shopify/app-bridge-react";
import { BrowserRouter } from "react-router-dom";

export default function Providers({ children }) {
  const host = new URLSearchParams(location.search).get("host");

  const config = {
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
    host,
    forceRedirect: true,
  };

  return (
    <AppBridgeProvider config={config}>
      <PolarisProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </PolarisProvider>
    </AppBridgeProvider>
  );
}
