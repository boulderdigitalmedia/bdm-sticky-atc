import { Page, Card, Text, InlineStack } from "@shopify/polaris";
import { useEffect, useState } from "react";

export default function Analytics() {
  const [data, setData] = useState({ orders: 0, revenue: 0 });

  useEffect(() => {
    fetch("/api/analytics/summary?shop=bdm-sandbox.myshopify.com")
      .then(res => res.json())
      .then(setData);
  }, []);

  return (
    <Page title="Sticky ATC Analytics">
      <InlineStack gap="400">
        <Card>
          <Text variant="headingLg">{data.orders}</Text>
          <Text>Orders influenced</Text>
        </Card>

        <Card>
          <Text variant="headingLg">
            ${data.revenue.toFixed(2)}
          </Text>
          <Text>Revenue influenced</Text>
        </Card>
      </InlineStack>
    </Page>
  );
}
