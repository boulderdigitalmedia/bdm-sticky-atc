import { Page, Card, Text, BlockStack } from "@shopify/polaris";

export default function Analytics() {
  return (
    <Page title="Analytics">
      <BlockStack gap="400">
        <Card>
          <Text as="h2" variant="headingMd">
            Conversion Impact
          </Text>
          <Text as="p">
            Analytics coming next: Add-to-cart lifts, sessions with sticky bar,
            and conversion influence.
          </Text>
        </Card>
      </BlockStack>
    </Page>
  );
}

