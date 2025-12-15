// web/frontend/src/AppNavigation.jsx
import React from "react";
import { Navigation } from "@shopify/polaris";

export default function AppNavigation() {
  return (
    <Navigation location="/">
      <Navigation.Section
        items={[
          { label: "Dashboard", url: "/" },
          { label: "Analytics", url: "/analytics" },
        ]}
      />
    </Navigation>
  );
}
