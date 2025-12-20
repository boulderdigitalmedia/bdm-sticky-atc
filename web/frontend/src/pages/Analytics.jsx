import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
} from "@shopify/polaris";

export default function Analytics() {
  return (
    <Page title="Analytics">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Conversion Analytics
              </Text>
              <Text tone="subdued">
                These metrics show how your Sticky Add to Cart bar contributes
                to conversions after page view.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text variant="headingSm">Events Tracked</Text>
              <Text as="p">
                • Sticky bar viewed  
                • Variant changed  
                • Sticky Add to Cart clicked  
                • Order completed (attributed)
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
