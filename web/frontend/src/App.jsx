// web/frontend/src/App.jsx
import React from "react";
import { Frame, Page } from "@shopify/polaris";
import AppRouter from "./router.jsx";
import Navigation from "./navigation.jsx";

export default function App() {
  return (
    <Frame navigation={<Navigation />}>
      <Page>
        <AppRouter />
      </Page>
    </Frame>
  );
}
