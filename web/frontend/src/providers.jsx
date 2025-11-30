import React from "react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import AppBridgeProvider from "@shopify/app-bridge-react";
import { BrowserRouter } from "react-router-dom";

export default function Providers({ children }) {
  const searchParams = new URLSearchParams(window.location.search);
  const host = searchParams.get("host");

  const appBridgeConfig = {
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
    host,
    forceRedirect: true,
  };

  return (
    <AppBridgeProvider config={appBridgeConfig}>
      <PolarisProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </PolarisProvider>
    </AppBridgeProvider>
  );
}
