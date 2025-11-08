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

// Serve public files (like sticky-bar.js)
app.use("/public", express.static(path.join(__dirname, "public")));

// -----------------------------
// 1️⃣ Home route
// -----------------------------
app.get("/", (req, res) => {
  res.send("Sticky Add to Cart Bar Pro is running 🚀");
});

// -----------------------------
// 2️⃣ Auth start
// -----------------------------
app.get("/auth", async (req, res) => {
  const { shop, host } = req.query;

  if (!shop) {
    return res.status(400).send("Missing shop or host");
  }

  const redirectUri = `${process.env.HOST}/auth/callback`;
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${process.env.SCOPES}&redirect_uri=${redirectUri}`;

  res.redirect(installUrl);
});

// -----------------------------
// 3️⃣ Auth callback
// -----------------------------
app.get("/auth/callback", async (req, res) => {
  const { shop, code, hmac } = req.query;

  if (!shop || !code || !hmac) {
    return res.status(400).send("Missing required parameters");
  }

  // Verify HMAC (security check)
  const params = { ...req.query };
  delete params.signature;
  delete params.hmac;

  const message = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const generatedHmac = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(message)
    .digest("hex");

  if (generatedHmac !== hmac) {
    return res.status(400).send("HMAC validation failed");
  }

  // Exchange temporary code for permanent access token
  const accessTokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  });

  const accessTokenData = await accessTokenResponse.json();
  const accessToken = accessTokenData.access_token;

  if (!accessToken) {
    return res.status(400).send("Failed to get access token");
  }

  console.log(`✅ App installed on: ${shop}`);
  console.log(`🔑 Access token: ${accessToken.substring(0, 6)}...`);

  // Create a script tag in the merchant's store to load your sticky-bar.js
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

  // Redirect to success page
  res.redirect(`https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`);
});

// -----------------------------
// 4️⃣ Add-to-cart endpoint (for AJAX calls)
// -----------------------------
app.post("/add-to-cart", async (req, res) => {
  const { shop, variantId, quantity } = req.body;
  if (!shop || !variantId) return res.status(400).send("Missing variant info");

  try {
    const cartResponse = await fetch(`https://${shop}/cart/add.js`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: variantId, quantity }),
    });
    const result = await cartResponse.json();
    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Add-to-cart failed:", err);
    res.status(500).send("Error adding to cart");
  }
});

// -----------------------------
// 5️⃣ Start the server
// -----------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
