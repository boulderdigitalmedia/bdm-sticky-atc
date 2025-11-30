import React from "react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import { BrowserRouter } from "react-router-dom";

export default function Providers({ children }) {
  return (
    <PolarisProvider>
      <BrowserRouter>{children}</BrowserRouter>
    </PolarisProvider>
  );
}
