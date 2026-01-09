import {
  Page,
  Card,
  FormLayout,
  TextField,
  Checkbox,
  Select,
  Button
} from "@shopify/polaris";
import { useEffect, useState } from "react";

export default function Settings({ shop }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetch(`/api/settings?shop=${shop}`)
      .then(r => r.json())
      .then(setSettings);
  }, [shop]);

  if (!settings) return null;

  const save = async () => {
    await fetch(`/api/settings?shop=${shop}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
  };

  return (
    <Page title="Sticky Add To Cart Bar">
      <Card>
        <FormLayout>
          <Checkbox
            label="Enable sticky add to cart"
            checked={settings.enabled}
            onChange={v => setSettings({ ...settings, enabled: v })}
          />

          <TextField
            label="Show after scroll (px)"
            type="number"
            value={String(settings.showAfterScroll)}
            onChange={v =>
              setSettings({ ...settings, showAfterScroll: Number(v) })
            }
          />

          <TextField
            label="Button text"
            value={settings.buttonText}
            onChange={v => setSettings({ ...settings, buttonText: v })}
          />

          <TextField
            label="Background color"
            value={settings.bgColor}
            onChange={v => setSettings({ ...settings, bgColor: v })}
          />

          <TextField
            label="Text color"
            value={settings.textColor}
            onChange={v => setSettings({ ...settings, textColor: v })}
          />

          <Select
            label="Position"
            options={[
              { label: "Bottom", value: "bottom" },
              { label: "Top", value: "top" }
            ]}
            value={settings.position}
            onChange={v => setSettings({ ...settings, position: v })}
          />

          <Button primary onClick={save}>
            Save settings
          </Button>
        </FormLayout>
      </Card>
    </Page>
  );
}
