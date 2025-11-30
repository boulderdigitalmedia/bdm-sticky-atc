// web/frontend/src/App.jsx
import React from "react";
import { Page, Card, Text } from "@shopify/polaris";

export default function App() {
  return (
    <Page title="Sticky Add-to-Cart Bar Pro">
      <Card>
        <Card.Section>
          <Text as="h2" variant="headingLg">
            It works! 🎉
          </Text>
          <Text as="p">
            Your Shopify embedded app UI is loading correctly. From here, we can
            wire up navigation, routing, and analytics.
          </Text>
        </Card.Section>
      </Card>
    </Page>
  );
}
