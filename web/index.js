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
app.set("trust proxy", 1);

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Shopify-Shop-Domain"],
    credentials: true
  })
);
app.options("*", cors);

/**
 * 🔥 WEBHOOK — RAW BODY REQUIRED
 */
app.post(
  "/webhooks/orders/paid",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    console.log("🔥 orders/paid webhook HIT");
    return ordersCreate(req, res);
  }
);

/* JSON parsing AFTER webhook */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* API routes */
app.use("/api/settings", settingsRouter);
app.use("/api/track", trackRouter);
app.use("/apps/bdm-sticky-atc", trackRouter);
app.use("/apps/bdm-sticky-atc", stickyAnalyticsRouter);
app.use("/attribution", attributionRouter);

/* Shopify init */
initShopify(app);

/* Frontend */
app.use("/web", express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "frontend", "dist"), { index: false }));

/**
 * ⭐ AUTH GUARD + EMBEDDED APP LOADER
 */
app.get("*", async (req, res) => {
  const indexPath = path.join(__dirname, "frontend", "dist", "index.html");
  const apiKey = process.env.SHOPIFY_API_KEY || "";

  const shop = req.query.shop;
  const host = req.query.host;

  // 🧠 FORCE OAUTH IF SHOP EXISTS BUT NO SESSION
  if (shop) {
    try {
      const existingSession = await prisma.session.findFirst({
        where: { shop }
      });

      if (!existingSession) {
        console.log("🔑 No session found — forcing OAuth", shop);
        return res.redirect(`/auth?shop=${shop}`);
      }
    } catch (err) {
      console.error("Session check failed", err);
    }
  }

  // Prevent direct access to Render URL
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

/* 🧪 DEBUG ENDPOINT */
app.get("/__debug/conversions", async (req, res) => {
  const rows = await prisma.stickyConversion.findMany({
    orderBy: { occurredAt: "desc" },
    take: 5
  });
  res.json(rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ App running on port ${PORT}`);
});
