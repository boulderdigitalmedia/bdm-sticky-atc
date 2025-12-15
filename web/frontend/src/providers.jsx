// web/frontend/src/providers.jsx
import React from "react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { BrowserRouter } from "react-router-dom";

export default function Providers({ children }) {
  return (
    <PolarisProvider
      i18n={enTranslations}
      features={{ newDesignLanguage: true }}
    >
      <BrowserRouter>{children}</BrowserRouter>
    </PolarisProvider>
  );
}
