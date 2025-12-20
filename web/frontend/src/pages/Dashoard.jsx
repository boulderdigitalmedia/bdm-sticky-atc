import { Page, Layout, Card, Text } from "@shopify/polaris";

export default function Dashboard() {
  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section oneThird>
          <Card>
            <Text variant="headingMd">Sticky ATC Clicks</Text>
            <Text variant="headingXl">—</Text>
          </Card>
        </Layout.Section>

        <Layout.Section oneThird>
          <Card>
            <Text variant="headingMd">Add-to-Cart Rate</Text>
            <Text variant="headingXl">—</Text>
          </Card>
        </Layout.Section>

        <Layout.Section oneThird>
          <Card>
            <Text variant="headingMd">Revenue Influenced</Text>
            <Text variant="headingXl">—</Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
