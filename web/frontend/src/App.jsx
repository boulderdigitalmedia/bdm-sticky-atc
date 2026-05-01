import React, { useEffect, useState } from "react";
import { AppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import { Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard.jsx";
import Analytics from "./pages/Analytics.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import ReviewPrompt from "./components/ReviewPrompt.jsx";

function getShop() {
  return (
    window.__SHOPIFY_SHOP__ ||
    new URLSearchParams(window.location.search).get("shop") ||
    window.Shopify?.shop ||
    null
  );
}

function AppRoutes() {
  const [onboardingDone, setOnboardingDone] = useState(null);
  const [shop, setShop] = useState(null);

  useEffect(() => {
    const s = getShop();
    setShop(s);

    if (!s) {
      setOnboardingDone(true);
      return;
    }

    fetch(`/api/settings?shop=${encodeURIComponent(s)}`)
      .then((r) => r.json())
      .then((data) => setOnboardingDone(!!data?.onboardingComplete))
      .catch(() => setOnboardingDone(true));
  }, []);

  if (onboardingDone === null) return null;

  if (!onboardingDone) {
    return <Onboarding onComplete={() => setOnboardingDone(true)} />;
  }

  return (
    <>
      <ReviewPrompt shop={shop} />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AppProvider i18n={{}}>
      <AppRoutes />
    </AppProvider>
  );
}