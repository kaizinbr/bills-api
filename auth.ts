import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: { enabled: true },

    advanced: {
        database: {
            generateId: "uuid", // or "cuid", "ulid", ...etc
        },
    },

    session: {
        modelName: "Session",
    },
    logger: {
        level: "debug", // vai logar cada passo da autenticação
    },
    trustedOrigins: [
        "billsapp://",

        // Development mode - Expo's exp:// scheme with local IP ranges
        ...(process.env.NODE_ENV === "development"
            ? [
                  "exp://", // Trust any host of the exp:// scheme
                  "exp://**", // Trust all Expo URLs (wildcard matching)
                  "exp://192.168.*.*:*/**", // Trust 192.168.x.x IP range with any port and path
                  "192.168.18.*:*"
              ]
            : []),
    ],
    // trustedOrigins vai precisar do scheme do seu app Expo quando for conectar o mobile,
    // ex: ["myapp://"] — a gente ajusta isso quando for integrar o client
});
