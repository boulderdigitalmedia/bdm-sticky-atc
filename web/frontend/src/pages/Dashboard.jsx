import {
  Page,
  Layout,
  Card,
  Text,
  InlineGrid,
  BlockStack,
  InlineStack,
  ButtonGroup,
  Button,
} from "@shopify/polaris";
import { useEffect, useState } from "react";
import AppStatusCard from "../components/AppStatusCard";
import { fetchAnalytics } from "../api/analytics";

const DAY_OPTIONS = [7, 30, 90];

export default function Dashboard() {
  const [summary, setSummary] = useState({});
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchAnalytics(days)
      .then((data) => {
        console.log("Analytics response:", data);
        setSummary(data);
      })
      .catch((err) => {
        console.error("Analytics failed:", err);
      })
      .finally(() => setLoading(false));
  }, [days]);

  const clicks = summary?.clicks ?? "—";
  const atcRate = summary?.atcRate != null ? `${summary.atcRate}%` : "—";
  const revenue =
    summary?.revenue != null ? `$${summary.revenue.toFixed(2)}` : "—";

  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text variant="headingMd">Performance Overview</Text>
                <ButtonGroup variant="segmented">
                  {DAY_OPTIONS.map((d) => (
                    <Button
                      key={d}
                      pressed={days === d}
                      onClick={() => setDays(d)}
                    >
                      {d}d
                    </Button>
                  ))}
                </ButtonGroup>
              </InlineStack>

              <InlineGrid columns={3} gap="400">

                <BlockStack>
                  <Text variant="headingXs">Sticky ATC Clicks</Text>
                  <Text variant="heading2xl">
                    {loading ? "..." : clicks}
                  </Text>
                </BlockStack>

                <BlockStack>
                  <Text variant="headingXs">Add-to-Cart Rate</Text>
                  <Text variant="heading2xl">
                    {loading ? "..." : atcRate}
                  </Text>
                </BlockStack>

                <BlockStack>
                  <Text variant="headingXs">Revenue Influenced</Text>
                  <Text variant="heading2xl">
                    {loading ? "..." : revenue}
                  </Text>
                </BlockStack>

              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}