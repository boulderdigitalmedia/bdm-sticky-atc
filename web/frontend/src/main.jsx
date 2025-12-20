import React from "react";
import ReactDOM from "react-dom/client";

import { AppProvider as PolarisProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";

import { Provider } from "@shopify/app-bridge-react";

import App from "./App.jsx";

const params = new URLSearchParams(window.location.search);
const host = params.get("host");

ReactDOM.createRoot(document.getElementById("app")).render(
  <Provider
    config={{
      apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
      host,
      forceRedirect: true,
    }}
  >
    <PolarisProvider i18n={enTranslations}>
      <App />
    </PolarisProvider>
  </Provider>
);
