// web/frontend/src/providers.jsx
import React from "react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";
import enTranslations from "@shopify/polaris/locales/en.json";
import { BrowserRouter } from "react-router-dom";

function getHost() {
  const params = new URLSearchParams(window.location.search);
  return params.get("host");
}

export default function Providers({ children }) {
  const host = getHost();

  if (!host) {
    return <div>Missing host parameter</div>;
  }

  return (
    <AppBridgeProvider
      config={{
        apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
        host,
        forceRedirect: true,
      }}
    >
      <PolarisProvider i18n={enTranslations}>
        <BrowserRouter>{children}</BrowserRouter>
      </PolarisProvider>
    </AppBridgeProvider>
  );
}
