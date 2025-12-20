import {
  Page,
  Layout,
  Card,
  Text,
  InlineStack,
  BlockStack,
} from "@shopify/polaris";

export default function Dashboard() {
  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Performance Overview
              </Text>
              <Text as="p" tone="subdued">
                Track how your Sticky Add to Cart bar influences customer
                behavior and revenue.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <InlineStack gap="400">
            <Card>
              <BlockStack gap="100">
                <Text variant="headingSm">Sticky ATC Clicks</Text>
                <Text variant="headingLg">—</Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="100">
                <Text variant="headingSm">Add-to-Cart Rate</Text>
                <Text variant="headingLg">—</Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="100">
                <Text variant="headingSm">Revenue Influenced</Text>
                <Text variant="headingLg">—</Text>
              </BlockStack>
            </Card>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
