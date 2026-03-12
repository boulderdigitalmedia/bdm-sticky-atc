import {
  Page,
  Layout,
  Card,
  Text,
  InlineGrid,
  BlockStack
} from "@shopify/polaris";
import { useEffect, useState } from "react";
import AppStatusCard from "../components/AppStatusCard";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
  const load = async () => {
    try {
      const res = await fetch(
        `${window.location.origin}/api/sticky-add-to-cart/summary`
      );

      const data = await res.json();

      console.log("Analytics response:", data);

      setSummary(data);
    } catch (err) {
      console.error("Analytics failed:", err);
    }
  };

  load();
}, []);

  const clicks = summary?.clicks ?? "—";
  const atcRate = summary?.atcRate != null ? `${summary.atcRate}%` : "—";
  const revenue =
    summary?.revenue != null ? `$${summary.revenue.toFixed(2)}` : "—";

  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <AppStatusCard />
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd">Performance Overview</Text>

              <InlineGrid columns={3} gap="400">

                <BlockStack>
                  <Text variant="headingXs">Sticky ATC Clicks</Text>
                  <Text variant="heading2xl">{clicks}</Text>
                </BlockStack>

                <BlockStack>
                  <Text variant="headingXs">Add-to-Cart Rate</Text>
                  <Text variant="heading2xl">{atcRate}</Text>
                </BlockStack>

                <BlockStack>
                  <Text variant="headingXs">Revenue Influenced</Text>
                  <Text variant="heading2xl">{revenue}</Text>
                </BlockStack>

              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}