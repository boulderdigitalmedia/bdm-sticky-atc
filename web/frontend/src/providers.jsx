import React from "react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import { AppBridgeProvider } from "@shopify/app-bridge-react";
import enTranslations from "@shopify/polaris/locales/en.json";
import { BrowserRouter } from "react-router-dom";

export default function Providers({ children }) {
  const params = new URLSearchParams(window.location.search);
  const host = params.get("host");

  if (!host) {
    return <div>Missing Shopify host parameter</div>;
  }

  return (
    <PolarisProvider i18n={enTranslations}>
      <AppBridgeProvider
        config={{
          apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
          host,
          forceRedirect: true,
        }}
      >
        <BrowserRouter>{children}</BrowserRouter>
      </AppBridgeProvider>
    </PolarisProvider>
  );
}
