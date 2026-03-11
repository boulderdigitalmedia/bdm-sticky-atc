import React from "react";
import { AppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import { Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard.jsx";

export default function App() {
  return (
    <AppProvider i18n={{}}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </AppProvider>
  );
}