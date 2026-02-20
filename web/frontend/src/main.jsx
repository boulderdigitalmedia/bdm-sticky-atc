import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";

import { AppProvider as PolarisProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import enTranslations from "@shopify/polaris/locales/en.json";

import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";

import App from "./App.jsx";

// --- Shopify embedded app setup ---
const urlParams = new URLSearchParams(window.location.search);
const host = urlParams.get("host");

const apiKey =
  import.meta.env.VITE_SHOPIFY_API_KEY ||
  window.__SHOPIFY_API_KEY__;

if (!apiKey) {
  document.body.innerHTML =
    "<h1>Missing Shopify API key</h1><p>Check frontend env vars or server config.</p>";
  throw new Error("Missing Shopify API key");
}

if (!host) {
  document.body.innerHTML =
    "<h1>Missing host param</h1><p>Open the app from Shopify Admin.</p>";
  throw new Error("Missing host param");
}

const config = {
  apiKey,
  host,
  forceRedirect: true,
};

ReactDOM.createRoot(document.getElementById("app")).render(
  <React.StrictMode>
    <AppBridgeProvider config={config}>
      <PolarisProvider i18n={enTranslations}>
        <HashRouter>
          <App />
        </HashRouter>
      </PolarisProvider>
    </AppBridgeProvider>
  </React.StrictMode>
);
