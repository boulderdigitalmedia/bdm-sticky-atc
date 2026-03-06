import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import prisma from "./prisma.js";
import * as shopifyModule from "./shopify.js";

import settingsRouter from "./routes/settings.js";
import trackRouter from "./routes/track.js";
import stickyAnalyticsRouter from "./routes/stickyAnalytics.js";
import attributionRouter from "./routes/attribution.js";

console.log("🚀 INDEX FILE LOADED");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", true);

app.use((req, res, next) => {
  console.log("🌍 Incoming:", req.method, req.originalUrl);
  next();
});

app.post(
  "/webhooks/*",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    try {
      await shopifyModule.shopify.webhooks.process({
        rawBody: req.body.toString("utf8"),
        rawRequest: req,
        rawResponse: res,
      });
    } catch (error) {
      console.error("❌ Universal webhook failed:", error);
      return res.status(401).send("Webhook Error");
    }
  }
);

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
   BODY PARSING
========================================================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


/* =========================================================
   SHOPIFY INIT
========================================================= */
shopifyModule.initShopify(app);

(async () => {
  const shopify = shopifyModule.shopify;
  const sessions = await shopify.config.sessionStorage.findSessionsByShop();

  for (const session of sessions || []) {
    if (!session.isOnline) {
      try {
        await shopify.webhooks.register({ session });
        console.log("📡 Re-registered webhooks for", session.shop);
      } catch (e) {
        console.error("⚠️ Failed to register webhooks for", session.shop, e);
      }
    }
  }
})();

/* =========================================================
   ROUTES
========================================================= */
app.use("/api/settings", settingsRouter);
app.use("/api/track", trackRouter);
app.use("/apps/bdm-sticky-atc/track", trackRouter);
app.use("/apps/bdm-sticky-atc", stickyAnalyticsRouter);
app.use("/attribution", attributionRouter);

/* =========================================================
   STATIC FILES
========================================================= */
app.use("/web", express.static(path.join(__dirname, "public")));
app.use(
  express.static(path.join(__dirname, "frontend", "dist"), {
    index: false,
  })
);

/* =========================================================
   DEBUG ROUTE
========================================================= */
app.get("/__debug/conversions", async (req, res) => {
  const rows = await prisma.stickyConversion.findMany({
    orderBy: { occurredAt: "desc" },
    take: 5,
  });
  res.json(rows);
});

/* =========================================================
   ⭐ EMBEDDED APP LOADER
========================================================= */
app.use("/*", async (req, res, next) => {
  if (req.method !== "GET") return next();

  // ⭐ Shopify iframe stabilization guard
if (!req.query.host && req.query.embedded) {
  console.log("⏳ Waiting for host param from Shopify...");
  return res.status(200).send("Loading...");
}

  const p = req.path || "";

  if (
    p.startsWith("/auth") ||
    p.startsWith("/billing") ||
    p.startsWith("/webhooks") ||
    p.startsWith("/api") ||
    p.startsWith("/__debug")
  ) {
    return next();
  }

  console.log("📥 Loader hit:", req.originalUrl);

  if (!req.query.shop) {
    console.log("⚠️ No shop param — ignoring non-Shopify request");
    return res.status(200).send("OK");
  }

  const shopify = shopifyModule.shopify;

  if (!shopify) {
    console.error("❌ Shopify not initialized");
    return res.status(500).send("Shopify not ready");
  }

  let shop = shopify.utils.sanitizeShop(String(req.query.shop));
  if (!shop) return res.status(400).send("Invalid shop");

  console.log("🔎 Checking offline session for:", shop);

  let session = null;

  try {
    const sessions =
      await shopify.config.sessionStorage.findSessionsByShop(shop);

    session = Array.isArray(sessions)
      ? sessions.find((s) => !s.isOnline)
      : null;
  } catch (e) {
    console.error("❌ Session lookup failed:", e);
  }

  if (!session) {
    console.log("🔑 No session — escaping iframe to OAuth");

    const host = String(req.query.host || "");

return res.status(200).send(`
  <html>
    <body>
      <script>
        window.top.location.href =
          "/auth?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}&embedded=1";
      </script>
    </body>
  </html>
`);
  }

  /* =========================================================
     💳 MANAGED PRICING CHECK
  ========================================================= */
  try {
    const client = new shopify.clients.Graphql({ session });

    const billingCheck = await client.request(`
      query {
        currentAppInstallation {
          activeSubscriptions {
            id
            status
          }
        }
      }
    `);

    const subs =
      billingCheck?.data?.currentAppInstallation?.activeSubscriptions || [];

    const isShopifyVerification =
      Boolean(req.headers["x-shopify-topic"]) ||
      req.get("User-Agent")?.includes("Shopify");

    const isInstallValidation =
  Boolean(req.query.hmac) &&
  Boolean(req.query.id_token);

  const isValidator =
  isShopifyVerification ||
  req.query.id_token ||
  req.query.charge_id;

  const isShopifyValidator =
  Boolean(req.headers["x-shopify-topic"]) ||
  req.get("User-Agent")?.includes("Shopify") ||
  req.query.hmac;

if (isShopifyValidator) {
  console.log("🧪 Shopify validation detected — responding 200");
  return res.status(200).send("OK");
}

if (!subs.length && !isValidator) {
      console.log("💳 No active subscription — redirecting to Managed Pricing");

      const storeHandle = String(shop).replace(".myshopify.com", "");
      const appHandle = process.env.SHOPIFY_APP_HANDLE;

      if (!appHandle) {
        console.error("❌ Missing SHOPIFY_APP_HANDLE env var");
        return res.status(500).send("Missing SHOPIFY_APP_HANDLE");
      }

      const pricingUrl =
        `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;

      return res.status(200).send(`
        <!doctype html>
        <html>
          <body>
            <script>
              window.top.location.href = ${JSON.stringify(pricingUrl)};
            </script>
          </body>
        </html>
      `);
    }
  } catch (e) {
    console.error("❌ Billing check failed:", e);

    const isUnauthorized =
      e?.response?.code === 401 ||
      e?.message?.includes("Unauthorized");

    if (isUnauthorized) {
      console.log("🔑 Access token invalid — forcing OAuth refresh");

      const host = String(req.query.host || "");

return res.status(200).send(`
  <html>
    <body>
      <script>
        window.top.location.href =
          "/auth?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}&embedded=1";
      </script>
    </body>
  </html>
`);
    }
  }

  console.log("✅ Session found — loading SPA");

  const indexPath = path.join(
    __dirname,
    "frontend",
    "dist",
    "index.html"
  );

  const apiKey = process.env.SHOPIFY_API_KEY || "";

  const html = fs
    .readFileSync(indexPath, "utf8")
    .replace(
      "</head>",
      `<script>window.__SHOPIFY_API_KEY__ = ${JSON.stringify(apiKey)};</script></head>`
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