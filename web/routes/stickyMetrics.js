import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

router.get("/metrics", async (req, res) => {
  const events = await prisma.stickyEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 50
  });

  res.json(events);
});

export default router;
