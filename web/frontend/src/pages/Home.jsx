import { Page, Card, Text, BlockStack } from "@shopify/polaris";

export default function Home() {
  return (
    <Page title="Sticky Add to Cart Bar">
      <BlockStack gap="400">
        <Card>
          <Text as="h2" variant="headingMd">
            App Status
          </Text>
          <Text as="p">
            Your Sticky Add to Cart Bar is installed and running.
          </Text>
        </Card>

        <Card>
          <Text as="h2" variant="headingMd">
            What this app does
          </Text>
          <Text as="p">
            Displays a persistent Add to Cart bar to increase conversion rate.
          </Text>
        </Card>
      </BlockStack>
    </Page>
  );
}
