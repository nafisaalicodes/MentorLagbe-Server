
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { jwt } from "better-auth/plugins";

export const createAuth = (db) => {
  return betterAuth({
    database: mongodbAdapter(db),

    baseURL:
      process.env.BETTER_AUTH_URL ||
      "http://localhost:5000",

    trustedOrigins: [
      process.env.CLIENT_URL ||
      "http://localhost:3000",
    ],

    secret: process.env.BETTER_AUTH_SECRET,

     advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },

    user: {
      modelName: "users",

      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "student",
          input: true,
        },

        subscriptionPlan: {
          type: "string",
          required: false,
          defaultValue: "free",
          input: false,
        },

        phone: {
          type: "string",
          required: false,
          input: false,
        },

        bio: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },

    plugins: [
      jwt({
        jwt: {
          definePayload: ({ user }) => ({
            id: user.id,
            email: user.email,
            role: user.role,
          }),
        },
      }),
    ],
  });
};
