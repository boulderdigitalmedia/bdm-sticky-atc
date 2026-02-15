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

/* =========================================================
   CORS
========================================================= */
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Shopify-Shop-Domain"],
    credentials: true,
  })
);
app.options("*", cors());

/* =========================================================
   WEBHOOK — RAW BODY
========================================================= */
app.post(
  "/webhooks/orders/paid",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    console.log("🔥 orders/paid webhook HIT");
    return ordersCreate(req, res);
  }
);

/* =========================================================
   BODY PARSING
========================================================= */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* =========================================================
   ROUTES
========================================================= */
app.use("/api/settings", settingsRouter);
app.use("/api/track", trackRouter);
app.use("/apps/bdm-sticky-atc/track", trackRouter);
app.use("/apps/bdm-sticky-atc", stickyAnalyticsRouter);
app.use("/attribution", attributionRouter);

/* =========================================================
   SHOPIFY INIT
========================================================= */
const shopify = initShopify(app);

/* =========================================================
   STATIC
========================================================= */
app.use("/web", express.static(path.join(__dirname, "public")));
app.use(
  express.static(path.join(__dirname, "frontend", "dist"), {
    index: false,
  })
);

/* =========================================================
   DEBUG
========================================================= */
app.get("/__debug/conversions", async (req, res) => {
  const rows = await prisma.stickyConversion.findMany({
    orderBy: { occurredAt: "desc" },
    take: 5,
  });
  res.json(rows);
});

/* =========================================================
   ⭐ EMBEDDED APP LOADER (FINAL STABLE)
========================================================= */
app.get(/.*/, async (req, res) => {
  const p = req.path || "";

  // NEVER let SPA intercept these
  if (
    p.startsWith("/auth") ||
    p.startsWith("/webhooks") ||
    p.startsWith("/api") ||
    p.startsWith("/__debug")
  ) {
    return res.status(404).send("Not found");
  }

  const indexPath = path.join(__dirname, "frontend", "dist", "index.html");

  const apiKey = process.env.SHOPIFY_API_KEY || "";
  const shop = req.query.shop;

  /**
   * 🔐 SESSION CHECK
   *
   * CRITICAL FIX:
   * DO NOT use res.redirect() here.
   * Shopify blocks iframe redirects.
   * Must escape iframe with JS.
   */
  if (shop) {
    try {
      const sanitizedShop = shopify.utils.sanitizeShop(shop.toString());
      if (!sanitizedShop) {
        return res.status(400).send("Invalid shop");
      }

      const offlineId = shopify.session.getOfflineId(sanitizedShop);

      const session =
        await shopify.config.sessionStorage.loadSession(offlineId);

      if (!session || !session.accessToken) {
        console.log("🔑 No session — starting OAuth", sanitizedShop);

        return res.send(`
          <html>
            <body>
              <script>
                if (window.top === window.self) {
                  window.location.href = "/auth?shop=${sanitizedShop}";
                } else {
                  window.top.location.href = "/auth?shop=${sanitizedShop}";
                }
              </script>
            </body>
          </html>
        `);
      }
    } catch (err) {
      console.error("Session check failed, forcing OAuth:", err);

      return res.send(`
        <html>
          <body>
            <script>
              if (window.top === window.self) {
                window.location.href = "/auth?shop=${shop}";
              } else {
                window.top.location.href = "/auth?shop=${shop}";
              }
            </script>
          </body>
        </html>
      `);
    }
  }

  const html = fs
    .readFileSync(indexPath, "utf8")
    .replace(
      "</head>",
      `<script>window.__SHOPIFY_API_KEY__ = ${JSON.stringify(
        apiKey
      )};</script></head>`
    );

  res.send(html);
});

/* =========================================================
   START SERVER
========================================================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ App running on port ${PORT}`);
});
