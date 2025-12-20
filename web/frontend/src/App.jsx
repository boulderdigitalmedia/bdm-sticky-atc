import { Frame } from "@shopify/polaris";
import { Routes, Route } from "react-router-dom";

import AppNavigation from "./AppNavigation.jsx";
import Home from "./pages/Home.jsx";
import Analytics from "./pages/Analytics.jsx";

export default function App() {
  return (
    <Frame navigation={<AppNavigation />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </Frame>
  );
}
