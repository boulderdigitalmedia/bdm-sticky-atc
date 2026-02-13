import express from "express";
import cors from "cors";
import fs from "fs";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

import prisma from "./prisma.js";
import { initShopify } from "./shopify.js";
import settingsRouter from "./routes/settings.js";
import trackRouter from "./routes/track.js";
import stickyAnalyticsRouter from "./routes/stickyAnalytics.js";
import attributionRouter from "./routes/attribution.js";
import { ordersCreate } from "./routes/webhooks.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", true);

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Shopify-Shop-Domain"],
    credentials: true,
  })
);
app.options("*", cors());

app.post(
  "/webhooks/orders/paid",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    console.log("🔥 orders/paid webhook HIT");
    return ordersCreate(req, res);
  }
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/api/settings", settingsRouter);
app.use("/api/track", trackRouter);
app.use("/apps/bdm-sticky-atc/track", trackRouter);
app.use("/apps/bdm-sticky-atc", stickyAnalyticsRouter);
app.use("/attribution", attributionRouter);

const shopify = initShopify(app);

app.use("/web", express.static(path.join(__dirname, "public")));
app.use(
  express.static(path.join(__dirname, "frontend", "dist"), {
    index: false,
  })
);

/**
 * ⭐ EMBEDDED APP LOADER
 * SERVER REDIRECT ONLY — NO IFRAME JS
 */
app.get("*", async (req, res) => {
  const indexPath = path.join(__dirname, "frontend", "dist", "index.html");

  const apiKey = process.env.SHOPIFY_API_KEY || "";
  const shop = (req.query.shop || "").toString();
  const host = (req.query.host || "").toString();

  // Prevent direct Render URL access (no Shopify params)
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

  /**
   * 🔐 SESSION-BASED AUTH CHECK
   * If offline session missing → redirect to Shopify Admin app entrypoint.
   * This forces auth to happen in the correct top-level context (prevents CookieNotFound).
   */
  if (shop) {
    try {
      const sanitizedShop = shopify.utils.sanitizeShop(shop);
      if (!sanitizedShop) return res.status(400).send("Invalid shop");

      const offlineId = shopify.session.getOfflineId(sanitizedShop);
      const session =
        await shopify.config.sessionStorage.loadSession(offlineId);

      if (!session || !session.accessToken) {
        console.log("🔑 No offline session — sending to Shopify Admin app entry", sanitizedShop);
        return res.redirect(
  `${appBaseUrl}/auth?shop=${encodeURIComponent(sanitizedShop)}`
);
      }
    } catch (err) {
      console.error("❌ Session check failed, sending to Shopify Admin app entry:", err);
      return res.redirect(`https://${shop}/admin/apps/${apiKey}`);
    }
  }

  // Serve embedded frontend
  const html = fs
    .readFileSync(indexPath, "utf8")
    .replace(
      "</head>",
      `<script>window.__SHOPIFY_API_KEY__ = ${JSON.stringify(apiKey)};</script></head>`
    );

  res.send(html);
});

app.get("/__debug/conversions", async (req, res) => {
  const rows = await prisma.stickyConversion.findMany({
    orderBy: { occurredAt: "desc" },
    take: 5,
  });
  res.json(rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ App running on port ${PORT}`);
});
