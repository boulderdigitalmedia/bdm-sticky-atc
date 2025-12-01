import React from "react";
import { Page, Card, Text } from "@shopify/polaris";
import AppRouter from "./router.jsx";
import AppNavigation from "./navigation.jsx";

export default function App() {
  return (
    <Page>
      <AppNavigation />
      <Card sectioned>
        <AppRouter />
      </Card>
    </Page>
  );
}
