import express from "express";
import shopify from "@shopify/shopify-app-express";
import { PrismaClient } from "@prisma/client";
import stickyAnalytics from "./routes/stickyAnalytics.js";
import stickyMetrics from "./routes/stickyMetrics.js";

const prisma = new PrismaClient();

const app = express();

app.use(express.json());

const shopifyApp = shopify({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    apiVersion: "2024-10",
    scopes: ["read_products", "write_products"],
    hostName: process.env.HOST.replace(/https?:\/\//, "")
  },
  auth: {
    path: "/auth",
    callbackPath: "/auth/callback"
  },
  webhooks: {
    path: "/webhooks"
  }
});

app.get("/auth", shopifyApp.auth.begin());
app.get("/auth/callback", shopifyApp.auth.callback(), shopifyApp.redirectToShopify());

// Routes for extension tracking + dashboard:
app.use("/apps/bdm-sticky-atc", stickyAnalytics);
app.use("/api/sticky", stickyMetrics);

app.get("/", (req, res) => res.send("BDM Sticky ATC App Running"));

app.listen(process.env.PORT || 3000, () => {
  console.log("App running on port 3000");
});

