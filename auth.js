import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { jwt } from "better-auth/plugins";

export const createAuth = (db) => {
  return betterAuth({
    database: mongodbAdapter(db),
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",

    baseURL: process.env.BETTER_AUTH_URL,

    secret: process.env.BETTER_AUTH_SECRET,

    emailAndPassword: {
      enabled: true,
    },

    user: {
      modelName: "users",

      additionalFields: {
        role: {
          type: "string",
          required: true,
          input: true,
          defaultValue: "student",
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