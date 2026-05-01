import { useEffect, useState, useCallback } from "react";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Badge,
  Box,
  Divider,
  Banner,
  CalloutCard,
} from "@shopify/polaris";

function getShop() {
  return (
    window.__SHOPIFY_SHOP__ ||
    new URLSearchParams(window.location.search).get("shop") ||
    window.Shopify?.shop ||
    null
  );
}

const SETUP_STEPS = [
  {
    number: 1,
    title: "Open Theme Editor",
    description:
      "Click the button below to open your Theme Editor. It will take you directly to the App Embeds section. Then click the circle to mark this step complete.",
    action: "Open Theme Editor →",
    isLink: true,
  },
  {
    number: 2,
    title: "Enable the App Embed",
    description:
      'In the Theme Editor, click the puzzle piece icon (⊞) labelled "App embeds" in the left sidebar. Find "Sticky Add To Cart Bar" and toggle it ON. Then click the circle ② to mark complete.',
  },
  {
    number: 3,
    title: "Save your theme",
    description:
      'Click "Save" in the top right of the Theme Editor. The sticky bar is now live on all your product pages. Then click the circle ③ to mark complete.',
  },
];

const CUSTOMIZE_STEPS = [
  {
    title: "Change bar colours",
    description:
      'In Theme Editor → App Embeds → Sticky Add To Cart Bar, use the "Bar background color" and "Text color" pickers to match your brand.',
  },
  {
    title: "Change the button text",
    description:
      'Edit the "Button text" field — e.g. "Buy Now", "Add to Bag", or "Shop Now".',
  },
  {
    title: "Show or hide on mobile / desktop",
    description:
      'Toggle "Show on desktop" and "Show on mobile" independently to control where the bar appears.',
  },
  {
    title: "Show only after scrolling",
    description:
      'Enable "Show only after scrolling" and set a scroll offset (px) so the bar appears once the native Add to Cart button scrolls out of view.',
  },
  {
    title: "Show product title & price",
    description:
      'Enable "Show product title" and "Show price" to display product info in the sticky bar alongside the button.',
  },
  {
    title: "Show quantity selector",
    description:
      'Enable "Show quantity selector" to let customers change quantity directly from the sticky bar.',
  },
];

export default function Onboarding({ onComplete, isSetupPage = false }) {
  const [completedSteps, setCompletedSteps] = useState({});
  const [shop, setShop] = useState(null);
  const [saving, setSaving] = useState(false);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    setShop(getShop());
  }, []);

  const themeEditorUrl = shop
    ? `https://admin.shopify.com/store/${shop
        .replace(".myshopify.com", "")
        .replace(/^https?:\/\//, "")}/themes/current/editor?context=apps`
    : "https://admin.shopify.com";

  const toggleStep = useCallback((num) => {
    setCompletedSteps((prev) => ({ ...prev, [num]: !prev[num] }));
  }, []);

  const allStepsComplete =
    completedSteps[1] && completedSteps[2] && completedSteps[3];

  const handleFinish = useCallback(async () => {
    if (!shop) return;
    setSaving(true);
    try {
      await fetch(`/api/settings?shop=${encodeURIComponent(shop)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingComplete: true }),
      });
      setAllDone(true);
      setTimeout(() => onComplete?.(), 1200);
    } catch {
      setSaving(false);
    }
  }, [shop, onComplete]);

  if (allDone) {
    return (
      <Page narrowWidth>
        <Box paddingBlockStart="1600">
          <Card>
            <BlockStack gap="400" inlineAlign="center">
              <Text variant="heading2xl" as="h1" alignment="center">
                🎉 You're all set!
              </Text>
              <Text variant="bodyLg" tone="subdued" alignment="center">
                Your sticky bar is live. Heading to your dashboard...
              </Text>
            </BlockStack>
          </Card>
        </Box>
      </Page>
    );
  }

  return (
    <Page
      title={isSetupPage ? "Setup Guide" : undefined}
      subtitle={isSetupPage ? "Installation steps and customization options for your sticky bar" : undefined}
      narrowWidth
    >
      <BlockStack gap="600">

        {/* Header — only on first install flow */}
        {!isSetupPage && (
          <BlockStack gap="200">
            <Text variant="heading2xl" as="h1">
              Welcome to Sticky Add To Cart Bar 👋
            </Text>
            <Text variant="bodyLg" tone="subdued">
              You're 3 steps away from showing a sticky bar on every product
              page. Takes about 60 seconds.
            </Text>
          </BlockStack>
        )}

        {/* ── INSTALLATION ── */}
        <BlockStack gap="300">
          <Text variant="headingLg" as="h2">Installation</Text>
          <Banner tone="warning">
            <Text variant="bodyMd">
              <strong>👆 Click each numbered circle</strong> after completing the step to mark it done and unlock the "Go to Dashboard" button.
            </Text>
          </Banner>
          <Card>
            <BlockStack gap="0">
              {SETUP_STEPS.map((step, i) => {
                const done = !!completedSteps[step.number];
                return (
                  <div key={step.number}>
                    {i > 0 && <Divider />}
                    <Box padding="500">
                      <InlineStack gap="400" align="start" blockAlign="start" wrap={false}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: done ? "#008060" : "#e3f1ec",
                            color: done ? "#fff" : "#008060",
                            fontWeight: 700,
                            fontSize: 15,
                            cursor: "pointer",
                            border: done ? "2px solid #008060" : "2px dashed #008060",
                            transition: "all 0.2s",
                          }}
                          onClick={() => toggleStep(step.number)}
                          title="Click to mark complete"
                        >
                          {done ? "✓" : step.number}
                        </div>

                        <BlockStack gap="200">
                          <InlineStack align="space-between" blockAlign="center">
                            <Text
                              variant="headingMd"
                              tone={done ? "subdued" : undefined}
                              textDecorationLine={done ? "line-through" : undefined}
                            >
                              {step.title}
                            </Text>
                            {done && <Badge tone="success">Done</Badge>}
                          </InlineStack>

                          <Text variant="bodyMd" tone="subdued">
                            {step.description}
                          </Text>

                          {step.isLink && (
                            <Box paddingBlockStart="200">
                              <Button
                                variant="primary"
                                url={themeEditorUrl}
                                target="_blank"
                                onClick={() => toggleStep(step.number)}
                              >
                                {step.action}
                              </Button>
                            </Box>
                          )}
                        </BlockStack>
                      </InlineStack>
                    </Box>
                  </div>
                );
              })}
            </BlockStack>
          </Card>
        </BlockStack>

        {/* Help banner */}
        <Banner tone="info">
          <Text variant="bodyMd">
            <strong>Can't find App Embeds?</strong> In Theme Editor, look for
            the puzzle piece icon (⊞) in the left sidebar — it's below
            "Sections". If you're on a custom theme and don't see it, your
            theme may need to be updated to support app embeds.
          </Text>
        </Banner>

        {/* ── CUSTOMIZATION ── */}
        <BlockStack gap="300">
          <Text variant="headingLg" as="h2">Customization</Text>
          <Text variant="bodyMd" tone="subdued">
            All settings live in Theme Editor → App Embeds → Sticky Add To Cart Bar.
            Open Theme Editor, enable the embed, then click the bar name to expand its settings.
          </Text>
          <Card>
            <BlockStack gap="0">
              {CUSTOMIZE_STEPS.map((item, i) => (
                <div key={i}>
                  {i > 0 && <Divider />}
                  <Box padding="500">
                    <BlockStack gap="100">
                      <Text variant="headingMd">{item.title}</Text>
                      <Text variant="bodyMd" tone="subdued">{item.description}</Text>
                    </BlockStack>
                  </Box>
                </div>
              ))}
            </BlockStack>
          </Card>
        </BlockStack>

        {/* Open theme editor CTA */}
        <CalloutCard
          title="Make changes to your bar"
          illustration="https://cdn.shopify.com/s/assets/admin/checkout/settings-customizecart-705f57c725ac05be2a489c6b5b7b89a0.svg"
          primaryAction={{
            content: "Open Theme Editor",
            url: themeEditorUrl,
            target: "_blank",
          }}
        >
          <Text variant="bodyMd">
            All visual settings are managed directly in your Theme Editor.
            Click below to open it.
          </Text>
        </CalloutCard>

        {/* Finish button — only on first install flow */}
        {!isSetupPage && (
          <Box paddingBlockEnd="800">
            <InlineStack align="end">
              <Button
                variant="primary"
                size="large"
                disabled={!allStepsComplete}
                loading={saving}
                onClick={handleFinish}
              >
                Go to Dashboard
              </Button>
            </InlineStack>
            {!allStepsComplete && (
              <Box paddingBlockStart="200">
                <Text variant="bodySm" tone="subdued" alignment="right">
                  Mark all 3 steps complete to continue
                </Text>
              </Box>
            )}
          </Box>
        )}

      </BlockStack>
    </Page>
  );
}