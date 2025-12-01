import { Card, Text } from "@shopify/polaris";
import React from "react";

export default function Home() {
  return (
    <page title="Dashboard">
    <Card>
      <Card.Section>
        <Text as="h2" variant="headingLg">
          Sticky Add-to-Cart Bar Pro
        </Text>
        <Text as="p">
          Welcome to your app dashboard. Use the sidebar to explore analytics &
          settings.
        </Text>
      </Card.Section>
    </Card>
      </page>
  );
}
