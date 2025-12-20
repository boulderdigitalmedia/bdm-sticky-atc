import "@shopify/polaris/build/esm/styles.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { AppProvider } from "@shopify/polaris";
import { AppBridgeProvider } from "@shopify/app-bridge-react";
import enTranslations from "@shopify/polaris/locales/en.json";
import App from "./App";
import { BrowserRouter } from "react-router-dom";

const appBridgeConfig = {
  apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
  host: new URLSearchParams(window.location.search).get("host"),
  forceRedirect: true,
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <AppBridgeProvider config={appBridgeConfig}>
    <AppProvider i18n={enTranslations}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppProvider>
  </AppBridgeProvider>
);
