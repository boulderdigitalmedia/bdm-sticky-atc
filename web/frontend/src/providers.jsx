// web/frontend/src/providers.jsx
import React from "react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";

import {
  Provider as AppBridgeProvider,
  useAppBridge,
} from "@shopify/app-bridge-react";

import { BrowserRouter } from "react-router-dom";

// Read host parameter from URL
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
    <AppBridgeProvider config={appBridgeConfig}>
      <PolarisProvider i18n={enTranslations}>
        <BrowserRouter>{children}</BrowserRouter>
      </PolarisProvider>
    </AppBridgeProvider>
  );
}
