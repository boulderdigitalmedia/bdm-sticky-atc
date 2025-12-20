import {
  Page,
  Layout,
  Card,
  Text,
} from "@shopify/polaris";

export default function Dashboard() {
  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <Card>
            <Text variant="headingMd" as="h2">
              Performance Overview
            </Text>
            <Text as="p" tone="subdued">
              Track how your Sticky Add to Cart bar influences customer behavior and revenue.
            </Text>
          </Card>
        </Layout.Section>

        <Layout.Section oneThird>
          <Card>
            <Text variant="headingSm">Sticky ATC Clicks</Text>
            <Text variant="headingLg">—</Text>
          </Card>
        </Layout.Section>

        <Layout.Section oneThird>
          <Card>
            <Text variant="headingSm">Add-to-Cart Rate</Text>
            <Text variant="headingLg">—</Text>
          </Card>
        </Layout.Section>

        <Layout.Section oneThird>
          <Card>
            <Text variant="headingSm">Revenue Influenced</Text>
            <Text variant="headingLg">—</Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
