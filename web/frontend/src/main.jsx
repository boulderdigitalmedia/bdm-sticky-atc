import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AppProvider as PolarisProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import enTranslations from "@shopify/polaris/locales/en.json";

import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";

import App from "./App.jsx";

const urlParams = new URLSearchParams(window.location.search);
const host = urlParams.get("host");

const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY;

const config = {
  apiKey,
  host,
  forceRedirect: true,
};

ReactDOM.createRoot(document.getElementById("app")).render(
  <React.StrictMode>
    <PolarisProvider i18n={enTranslations}>
      <BrowserRouter>
        <AppBridgeProvider config={config}>
          <App />
        </AppBridgeProvider>
      </BrowserRouter>
    </PolarisProvider>
  </React.StrictMode>
);
