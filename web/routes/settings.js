import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

// GET settings (used by theme extension)
router.get("/", async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: "Missing shop" });

  let settings = await prisma.shopSettings.findUnique({ where: { shop } });

  if (!settings) {
    settings = await prisma.shopSettings.create({
      data: { shop }
    });
  }

  res.json(settings);
});

// POST settings (used by Polaris UI)
router.post("/", async (req, res) => {
  const { shop } = req.query;
  const data = req.body;

  const settings = await prisma.shopSettings.upsert({
    where: { shop },
    update: data,
    create: { shop, ...data }
  });

  res.json(settings);
});

export default router;
