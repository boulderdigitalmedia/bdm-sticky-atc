import { Frame, Page, Layout, Card, Text } from "@shopify/polaris";

export default function App() {
  return (
    <Frame>
      <Page title="Sticky Add To Cart Bar">
        <Layout>
          <Layout.Section>
            <Card>
              <Text variant="headingLg" as="h1">
                Sticky Add-to-Cart Bar
              </Text>

              <Text as="p" tone="subdued">
                App loaded successfully. Next step: analytics + dashboard.
              </Text>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
