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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
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
app.options("*", cors);

// ✅ Shopify auth + webhook processing MUST be registered BEFORE json parsing
initShopify(app);

// ✅ JSON parsing ONLY for non-webhook routes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Your existing routes
app.use("/api/settings", settingsRouter);
app.use("/api/track", trackRouter);
app.use("/apps/bdm-sticky-atc", stickyAnalyticsRouter);
app.use("/attribution", attributionRouter);

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ App running on port ${PORT}`);
});
