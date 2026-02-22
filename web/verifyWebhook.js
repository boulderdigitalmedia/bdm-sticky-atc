import crypto from "crypto";

export function verifyWebhook(req, res, next) {
  try {
    const hmacHeader = req.get("X-Shopify-Hmac-Sha256");

    if (!hmacHeader) {
      console.error("❌ Missing HMAC header");
      return res.status(401).send("Unauthorized");
    }

    const secret = process.env.SHOPIFY_API_SECRET;

    // IMPORTANT: req.body must be RAW BUFFER
    const generatedHash = crypto
      .createHmac("sha256", secret)
      .update(req.body)
      .digest("base64");

    const hashBuffer = Buffer.from(generatedHash, "utf8");
    const hmacBuffer = Buffer.from(hmacHeader, "utf8");

    // Prevent timing attacks (Shopify requires this)
    if (
      hashBuffer.length !== hmacBuffer.length ||
      !crypto.timingSafeEqual(hashBuffer, hmacBuffer)
    ) {
      console.error("❌ Invalid webhook signature");
      return res.status(401).send("Unauthorized");
    }

    next();
  } catch (err) {
    console.error("Webhook verification error:", err);
    res.status(500).send("Webhook error");
  }
}