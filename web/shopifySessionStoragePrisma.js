import prisma from "./prisma.js";
import { Session } from "@shopify/shopify-api";

export function prismaSessionStorage() {
  return {
    async storeSession(session) {
      try {
        if (!session || !session.id) {
          console.error("❌ storeSession invalid session");
          return false;
        }

        const data = {
          id: session.id,
          shop: session.shop || null,
          state: session.state || null,
          isOnline: session.isOnline ?? false,
          scope: session.scope || null,
          expires: session.expires ?? null,
          accessToken: session.accessToken || null,

          userId: session.onlineAccessInfo?.associated_user?.id
            ? BigInt(session.onlineAccessInfo.associated_user.id)
            : null,
          firstName: session.onlineAccessInfo?.associated_user?.first_name || null,
          lastName: session.onlineAccessInfo?.associated_user?.last_name || null,
          email: session.onlineAccessInfo?.associated_user?.email || null,
          accountOwner: session.onlineAccessInfo?.associated_user?.account_owner ?? null,
          locale: session.onlineAccessInfo?.associated_user?.locale || null,
          collaborator: session.onlineAccessInfo?.associated_user?.collaborator ?? null,
          emailVerified: session.onlineAccessInfo?.associated_user?.email_verified ?? null,
        };

        await prisma.shopifySession.upsert({
          where: { id: session.id },
          update: data,
          create: data,
        });

        console.log("💾 Session stored:", session.id);

        return true;
      } catch (err) {
        console.error("❌ storeSession Prisma error:", err);
        return false;
      }
    },

    async loadSession(id) {
      try {
        if (!id) return undefined;

        const record = await prisma.shopifySession.findUnique({
          where: { id },
        });

        if (!record) return undefined;

        /* ⭐ CRITICAL FIX:
           Rebuild REAL Shopify Session instance
        */
        const session = new Session({
          id: record.id,
          shop: record.shop,
          state: record.state,
          isOnline: record.isOnline,
        });

        session.scope = record.scope;
        session.expires = record.expires;
        session.accessToken = record.accessToken;

        if (record.userId) {
          session.onlineAccessInfo = {
            associated_user: {
              id: record.userId.toString(),
              first_name: record.firstName,
              last_name: record.lastName,
              email: record.email,
              account_owner: record.accountOwner,
              locale: record.locale,
              collaborator: record.collaborator,
              email_verified: record.emailVerified,
            },
          };
        }

        return session;
      } catch (err) {
        console.error("❌ loadSession Prisma error:", err);
        return undefined;
      }
    },

    async deleteSession(id) {
      try {
        if (!id) return true;

        await prisma.shopifySession.deleteMany({
          where: { id },
        });

        return true;
      } catch {
        return true;
      }
    },

    async deleteSessions(ids) {
      try {
        if (!Array.isArray(ids) || ids.length === 0) return true;

        await prisma.shopifySession.deleteMany({
          where: { id: { in: ids } },
        });

        return true;
      } catch (err) {
        console.error("❌ deleteSessions Prisma error:", err);
        return false;
      }
    },

    async findSessionsByShop(shop) {
      try {
        if (!shop) return [];

        const records = await prisma.shopifySession.findMany({
          where: { shop },
        });

        return records.map((r) => {
          const session = new Session({
            id: r.id,
            shop: r.shop,
            state: r.state,
            isOnline: r.isOnline,
          });

          session.scope = r.scope;
          session.expires = r.expires;
          session.accessToken = r.accessToken;

          return session;
        });
      } catch (err) {
        console.error("❌ findSessionsByShop Prisma error:", err);
        return [];
      }
    },
  };
}
