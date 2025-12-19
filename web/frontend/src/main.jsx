import React from "react";
import ReactDOM from "react-dom/client";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";

import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("app")).render(
  <AppProvider i18n={enTranslations}>
    <App />
  </AppProvider>
);
