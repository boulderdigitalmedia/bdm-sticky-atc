// web/frontend/src/App.jsx
import React from "react";
import { Frame } from "@shopify/polaris";
import AppRouter from "./router.jsx";
import AppNavigation from "./AppNavigation.jsx";

export default function App() {
  return (
    <Frame>
      <AppNavigation />
      <AppRouter />
    </Frame>
  );
}
