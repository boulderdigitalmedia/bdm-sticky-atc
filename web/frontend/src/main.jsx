import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AppProvider as PolarisProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import enTranslations from "@shopify/polaris/locales/en.json";

import { AppBridgeProvider } from "@shopify/app-bridge-react";

import App from "./App.jsx";

/**
 * Shopify injects these into the iframe URL
 * We must read them at runtime
 */
const urlParams = new URLSearchParams(window.location.search);
const host = urlParams.get("host");

const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY;

if (!host || !apiKey) {
  console.error("Missing host or API key", { host, apiKey });
}

const appBridgeConfig = {
  apiKey,
  host,
  forceRedirect: true,
};

ReactDOM.createRoot(document.getElementById("app")).render(
  <React.StrictMode>
    <PolarisProvider i18n={enTranslations}>
      <BrowserRouter>
        <AppBridgeProvider config={appBridgeConfig}>
          <App />
        </AppBridgeProvider>
      </BrowserRouter>
    </PolarisProvider>
  </React.StrictMode>
);
