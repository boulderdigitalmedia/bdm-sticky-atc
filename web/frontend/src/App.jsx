import React from "react";
import { AppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";

function getParam(name) {
  return new URL(window.location.href).searchParams.get(name);
}

export default function App({ children }) {
  const shop = getParam("shop");
  const host = getParam("host");

  // Opened directly (not in Shopify)
  if (!shop) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Sticky Add To Cart Bar</h2>
        <p>This app must be opened from Shopify Admin.</p>
      </div>
    );
  }

  // First install ONLY (no host yet)
  if (!host) {
    window.location.replace(`/auth?shop=${encodeURIComponent(shop)}`);
    return null;
  }

  return (
    <AppProvider i18n={{}}>
      {children}
    </AppProvider>
  );
}