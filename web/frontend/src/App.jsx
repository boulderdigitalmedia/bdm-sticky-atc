// frontend/src/App.jsx
import React from "react";
import { Frame, Page } from "@shopify/polaris";

import AppNavigation from "./navigation.jsx";
import AppRouter from "./router.jsx";

export default function App() {
  return (
    <Frame navigation={<AppNavigation />}>
      <Page fullWidth>
        <AppRouter />
      </Page>
    </Frame>
  );
}
