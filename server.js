import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));

// -----------------------------
// 1️⃣ Root route — auto-redirect to /auth if missing params
// -----------------------------
app.get("/", (req, res) => {
  const { shop, host } = req.query;

  if (!shop) {
    return res.status(400).send(`
      <h2>⚙️ Missing "shop" parameter</h2>
      <p>Try installing via this URL:</p>
      <code>${process.env.HOST}/auth?shop=YOUR_SHOP_NAME.myshopify.com</code>
    `);
  }

  const redirectUrl = `/auth?shop=${shop}${host ? `&host=${host}` : ""}`;
  res.redirect(redirectUrl);
});

// -----------------------------
// 2️⃣ Start OAuth
// -----------------------------
app.get("/auth", (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).send(`
      <h2>❌ Missing shop parameter.</h2>
      <p>Try visiting this URL:</p>
      <code>${process.env.HOST}/auth?shop=YOUR_SHOP_NAME.myshopify.com</code>
    `);
  }

  const redirectUri = `${process.env.HOST}/auth/callback`;
  const scopes = process.env.SCOPES || "write_script_tags,read_products";

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${redirectUri}&state=${shop}`;

  console.log(`🧭 Redirecting to: ${installUrl}`);
  res.redirect(installUrl);
});

// -----------------------------
// 3️⃣ OAuth Callback
// -----------------------------
app.get("/auth/callback", async (req, res) => {
  const { shop, code, hmac } = req.query;

  if (!shop || !code || !hmac) {
    return res.status(400).send("Missing required parameters");
  }

  // HMAC validation
  const map = { ...req.query };
  delete map.signature;
  delete map.hmac;

  const message = Object.keys(map)
    .sort()
    .map((key) => `${key}=${map[key]}`)
    .join("&");

  const generatedHash = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(message)
    .digest("hex");

  if (generatedHash !== hmac) {
    return res.status(400).send("HMAC validation failed");
  }

  // Exchange code for permanent access token
  const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  });

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    console.error("❌ Failed to retrieve access token:", tokenData);
    return res.status(400).send("Error fetching access token");
  }

  console.log(`✅ Installed on ${shop}`);

  // Inject the script tag
  await fetch(`https://${shop}/admin/api/2024-10/script_tags.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({
      script_tag: {
        event: "onload",
        src: `${process.env.HOST}/public/sticky-bar.js`,
      },
    }),
  });

  // Redirect to app page
  res.redirect(`https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`);
});

// -----------------------------
// 4️⃣ Public health check
// -----------------------------
app.get("/health", (req, res) => res.status(200).send("OK"));

// -----------------------------
// 5️⃣ Start Server
// -----------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running at ${process.env.HOST}`);
});
