import { Frame, Page, Layout, Card } from "@shopify/polaris";

export default function App() {
  return (
    <Frame>
      <Page title="Sticky Add To Cart">
        <Layout>
          <Layout.Section>
            <Card>
              App loaded successfully
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
