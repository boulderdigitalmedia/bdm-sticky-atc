// web/frontend/src/App.jsx
import React from "react";
import { Frame } from "@shopify/polaris";
import AppRouter from "./router.jsx";
import Navigation from "./navigation.jsx";

export default function App() {
  return (
    <Frame navigation={<Navigation />}>
      <AppRouter />
    </Frame>
  );
}
