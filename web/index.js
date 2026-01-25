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

// ✅ 1) CREATE APP
const app = express();

// ✅ 2) REQUIRED FOR RENDER / EMBEDDED COOKIE + HTTPS BEHAVIOR
app.set("trust proxy", 1);

// ✅ 3) CORS
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Shopify-Shop-Domain"],
    credentials: true,
  })
);
app.options("*", cors());

// ✅ 4) WEBHOOK ROUTES MUST BE RAW BODY (BEFORE JSON PARSING)
// Shopify webhook verification requires the exact raw body.
app.post("/webhooks/orders/create", express.raw({ type: "*/*" }), ordersCreate);

// ✅ 5) JSON PARSING FOR EVERYTHING ELSE
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ 6) ROUTES
app.use("/api/settings", settingsRouter);
app.use("/api/track", trackRouter);
app.use("/apps/bdm-sticky-atc", stickyAnalyticsRouter);
app.use("/attribution", attributionRouter);

// ✅ 7) SHOPIFY ROUTES (auth + webhook registration + webhook process route)
initShopify(app);

// ✅ 8) FRONTEND (serve built admin UI)
app.use("/web", express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "frontend", "dist"), { index: false }));

// Serve SPA + inject Shopify API key for App Bridge (if you use it)
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

// ✅ 9) START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ App running on port ${PORT}`);
});
