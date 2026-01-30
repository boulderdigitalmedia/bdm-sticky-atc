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

// ✅ 1) Create app FIRST
const app = express();
app.set("trust proxy", 1);

// ✅ 2) CORS
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Shopify-Shop-Domain"],
    credentials: true,
  })
);
app.options("*", cors());

// ✅ 3) Webhook route must be RAW before json parsing
app.post("/webhooks/orders/paid", express.raw({ type: "*/*" }), ordersCreate);

// ✅ 4) JSON parsing for everything else
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ 5) API routes
app.use("/api/settings", settingsRouter);
app.use("/api/track", trackRouter);
app.use("/", stickyAnalyticsRouter);

app.use("/attribution", attributionRouter);

// ✅ 6) Shopify auth + webhook subscription registration
initShopify(app);

// ✅ 7) Frontend static assets
app.use("/web", express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "frontend", "dist"), { index: false }));

// ✅ 8) Catch-all (NO redirect loop)
app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, "frontend", "dist", "index.html");
  const apiKey = process.env.SHOPIFY_API_KEY || "";

  const shop = req.query.shop;
  const host = req.query.host;

  // If someone opens the Render URL directly, don't infinite redirect
  if (!shop && !host) {
    return res.status(200).send(`
      <html>
        <head><title>Sticky Add To Cart Bar</title></head>
        <body style="font-family: sans-serif; padding: 24px;">
          <h2>Sticky Add To Cart Bar</h2>
          <p>This app must be opened from inside Shopify Admin.</p>
        </body>
      </html>
    `);
  }

  const html = fs
    .readFileSync(indexPath, "utf8")
    .replace(
      "</head>",
      `<script>window.__SHOPIFY_API_KEY__ = ${JSON.stringify(apiKey)};</script></head>`
    );

  res.send(html);
});

// ✅ 9) Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ App running on port ${PORT}`);
});
