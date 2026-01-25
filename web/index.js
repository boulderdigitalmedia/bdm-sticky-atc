import express from "express";
import cors from "cors";
import fs from "fs";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

import { initShopify } from "./shopify.js";
import settingsRouter from "./routes/settings.js";
import trackRouter from "./routes/track.js";
import stickyAnalyticsRouter from "./routes/stickyAnalytics.js";
import attributionRouter from "./routes/attribution.js";
import { ordersCreate } from "./routes/webhooks.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ REQUIRED on Render for embedded cookies + redirects
app.set("trust proxy", 1);

// CORS
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Shopify-Shop-Domain"],
    credentials: true,
  })
);
app.options("*", cors());

// ✅ WEBHOOKS MUST BE RAW BODY
app.post("/webhooks/orders/create", express.raw({ type: "*/*" }), ordersCreate);

// JSON parsing for everything else
app.use(bodyParser.json());

// -----------------------------
// ✅ TOP-LEVEL REDIRECT HELPER
// -----------------------------
// This is the key fix for "browser cookies" errors.
// Shopify embedded apps must be able to break out of the iframe to set cookies.
app.get("/exitiframe", (req, res) => {
  const shop = req.query.shop;
  const host = req.query.host;

  if (!shop) return res.status(400).send("Missing shop");

  // If host is missing, still allow OAuth start
  const redirect = host
    ? `/auth?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`
    : `/auth?shop=${encodeURIComponent(shop)}`;

  // This HTML forces a top-level navigation (not inside the iframe)
  return res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8" /></head>
      <body>
        <script>
          if (window.top === window.self) {
            window.location.href = ${JSON.stringify(redirect)};
          } else {
            window.top.location.href = ${JSON.stringify(redirect)};
          }
        </script>
      </body>
    </html>
  `);
});

// -----------------------------
// ROUTES
// -----------------------------
app.use("/api/settings", settingsRouter);
app.use("/api/track", trackRouter);
app.use("/apps/bdm-sticky-atc", stickyAnalyticsRouter);
app.use("/attribution", attributionRouter);

// Shopify auth + webhook registration
initShopify(app);

// Frontend
app.use("/web", express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "frontend", "dist"), { index: false }));

app.get("*", (_req, res) => {
  const indexPath = path.join(__dirname, "frontend", "dist", "index.html");
  const apiKey = process.env.SHOPIFY_API_KEY || "";

  const html = fs
    .readFileSync(indexPath, "utf8")
    .replace(
      "</head>",
      `<script>window.__SHOPIFY_API_KEY__ = ${JSON.stringify(apiKey)};</script></head>`
    );

  res.send(html);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ App running on port ${PORT}`);
});
