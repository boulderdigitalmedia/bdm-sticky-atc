import React from "react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import { AppBridgeProvider } from "@shopify/app-bridge-react";
import enTranslations from "@shopify/polaris/locales/en.json";
import { BrowserRouter } from "react-router-dom";

/**
 * Shopify injects ?host= into the iframe URL
 */
function getHost() {
  const params = new URLSearchParams(window.location.search);
  return params.get("host");
}

export default function Providers({ children }) {
  const host = getHost();

  const appBridgeConfig = {
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
    host,
    forceRedirect: true,
  };

  return (
    <PolarisProvider i18n={enTranslations}>
      <AppBridgeProvider config={appBridgeConfig}>
        <BrowserRouter>{children}</BrowserRouter>
      </AppBridgeProvider>
    </PolarisProvider>
  );
}
