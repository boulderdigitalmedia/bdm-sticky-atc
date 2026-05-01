import React, { useEffect, useState } from "react";
import { AppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import { Routes, Route, useNavigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard.jsx";
import Analytics from "./pages/Analytics.jsx";
import Onboarding from "./pages/Onboarding.jsx";

function AppRoutes() {
  const [onboardingDone, setOnboardingDone] = useState(null); // null = loading
  const navigate = useNavigate();

  useEffect(() => {
    const shop =
      window.__SHOPIFY_SHOP__ ||
      new URLSearchParams(window.location.search).get("shop") ||
      window.Shopify?.shop;

    if (!shop) {
      setOnboardingDone(true); // can't check, skip
      return;
    }

    fetch(`/api/settings?shop=${encodeURIComponent(shop)}`)
      .then((r) => r.json())
      .then((data) => {
        setOnboardingDone(!!data?.onboardingComplete);
      })
      .catch(() => setOnboardingDone(true)); // on error, skip onboarding
  }, []);

  if (onboardingDone === null) {
    // Loading state — Polaris SkeletonPage would be ideal but keep it simple
    return null;
  }

  if (!onboardingDone) {
    return (
      <Onboarding onComplete={() => setOnboardingDone(true)} />
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/analytics" element={<Analytics />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider i18n={{}}>
      <AppRoutes />
    </AppProvider>
  );
}