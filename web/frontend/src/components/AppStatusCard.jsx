import { Card, Text, Button, InlineStack, BlockStack } from "@shopify/polaris";
import { useNavigate } from "react-router-dom";

export default function AppStatusCard() {
  const navigate = useNavigate();

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          App Status
        </Text>

        <Text as="p" variant="bodyMd">
          Your Sticky Add to Cart Bar is installed and actively running on your
          storefront.
        </Text>

        <InlineStack gap="200">
          <Button
            variant="primary"
            onClick={() => navigate("/analytics")}
          >
            View Analytics
          </Button>

          <Button variant="secondary" disabled>
            Customize Bar (Coming Soon)
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
