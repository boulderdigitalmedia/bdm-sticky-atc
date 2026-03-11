import React from "react";
import { AppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";

export default function App({ children }) {
  return (
    <AppProvider i18n={{}}>
      {children}
    </AppProvider>
  );
}