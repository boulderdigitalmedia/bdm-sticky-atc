import { prisma } from "./prisma.js";

/**
 * Minimal Prisma-backed session storage compatible with shopifyApi({ sessionStorage }).
 * Shopify expects methods: storeSession, loadSession, deleteSession, deleteSessions, findSessionsByShop
 */
export function prismaSessionStorage() {
  return {
    async storeSession(session) {
      // session is a Shopify Session object
      await prisma.shopifySession.upsert({
        where: { id: session.id },
        update: {
          shop: session.shop,
          state: session.state,
          isOnline: session.isOnline,
          scope: session.scope,
          expires: session.expires ?? null,
          accessToken: session.accessToken ?? null,
          userId: session.onlineAccessInfo?.associated_user?.id
            ? BigInt(session.onlineAccessInfo.associated_user.id)
            : session.userId ?? null,
          firstName: session.onlineAccessInfo?.associated_user?.first_name ?? session.firstName ?? null,
          lastName: session.onlineAccessInfo?.associated_user?.last_name ?? session.lastName ?? null,
          email: session.onlineAccessInfo?.associated_user?.email ?? session.email ?? null,
          accountOwner: session.onlineAccessInfo?.associated_user?.account_owner ?? session.accountOwner ?? null,
          locale: session.onlineAccessInfo?.associated_user?.locale ?? session.locale ?? null,
          collaborator: session.onlineAccessInfo?.associated_user?.collaborator ?? session.collaborator ?? null,
          emailVerified: session.onlineAccessInfo?.associated_user?.email_verified ?? session.emailVerified ?? null
        },
        create: {
          id: session.id,
          shop: session.shop,
          state: session.state ?? null,
          isOnline: session.isOnline,
          scope: session.scope ?? null,
          expires: session.expires ?? null,
          accessToken: session.accessToken ?? null,
          userId: session.onlineAccessInfo?.associated_user?.id
            ? BigInt(session.onlineAccessInfo.associated_user.id)
            : session.userId ?? null,
          firstName: session.onlineAccessInfo?.associated_user?.first_name ?? session.firstName ?? null,
          lastName: session.onlineAccessInfo?.associated_user?.last_name ?? session.lastName ?? null,
          email: session.onlineAccessInfo?.associated_user?.email ?? session.email ?? null,
          accountOwner: session.onlineAccessInfo?.associated_user?.account_owner ?? session.accountOwner ?? null,
          locale: session.onlineAccessInfo?.associated_user?.locale ?? session.locale ?? null,
          collaborator: session.onlineAccessInfo?.associated_user?.collaborator ?? session.collaborator ?? null,
          emailVerified: session.onlineAccessInfo?.associated_user?.email_verified ?? session.emailVerified ?? null
        }
      });

      return true;
    },

    async loadSession(id) {
      const row = await prisma.shopifySession.findUnique({ where: { id } });
      if (!row) return undefined;

      // Reconstruct shape Shopify expects (plain object is okay for shopify-api)
      return {
        id: row.id,
        shop: row.shop,
        state: row.state ?? undefined,
        isOnline: row.isOnline,
        scope: row.scope ?? undefined,
        expires: row.expires ?? undefined,
        accessToken: row.accessToken ?? undefined,
        userId: row.userId ?? undefined,
        firstName: row.firstName ?? undefined,
        lastName: row.lastName ?? undefined,
        email: row.email ?? undefined,
        accountOwner: row.accountOwner ?? undefined,
        locale: row.locale ?? undefined,
        collaborator: row.collaborator ?? undefined,
        emailVerified: row.emailVerified ?? undefined
      };
    },

    async deleteSession(id) {
      await prisma.shopifySession.deleteMany({ where: { id } });
      return true;
    },

    async deleteSessions(ids) {
      if (!ids?.length) return true;
      await prisma.shopifySession.deleteMany({ where: { id: { in: ids } } });
      return true;
    },

    async findSessionsByShop(shop) {
      const rows = await prisma.shopifySession.findMany({ where: { shop } });
      return rows.map((row) => ({
        id: row.id,
        shop: row.shop,
        state: row.state ?? undefined,
        isOnline: row.isOnline,
        scope: row.scope ?? undefined,
        expires: row.expires ?? undefined,
        accessToken: row.accessToken ?? undefined,
        userId: row.userId ?? undefined
      }));
    }
  };
}
