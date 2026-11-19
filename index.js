
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";
import { toNodeHandler } from "better-auth/node";
import { createAuth } from "./auth.js";

dotenv.config();

const app = express();

// Environment Variables
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "MentorLagbe";

// CORS Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

// MongoDB Client
const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

// Database Connection
const connectDB = async () => {
  try {
    await client.connect();

    db = client.db(DB_NAME);

    await db.command({ ping: 1 });

    console.log("MongoDB Connected Successfully!");
    console.log(`Database: ${DB_NAME}`);

  } catch (error) {
    console.error("MongoDB Connection Failed:", error);
    throw error;
  }
};

// Collection References
const getCollections = () => {
  if (!db) {
    throw new Error("Database is not connected");
  }

  return {
    usersCollection: db.collection("users"),
    tuitionsCollection: db.collection("tuitions"),
    applicationsCollection: db.collection("applications"),
    paymentsCollection: db.collection("payments"),
  };
};

// Start Server
const startServer = async () => {
  try {
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in .env file");
    }

    // 1. Connect MongoDB
    await connectDB();

    // 2. Initialize BetterAuth
    const auth = createAuth(db);

    // 3. BetterAuth Handler
    // IMPORTANT: Must be before express.json()
    app.all("/api/auth/*splat", toNodeHandler(auth));

    // 4. Express JSON Middleware
    app.use(express.json());

    // =====================================
    // ROOT API
    // =====================================

    app.get("/", (req, res) => {
      res.send("MentorLagbe Server is Running!");
    });

    // =====================================
    // HEALTH CHECK API
    // =====================================

    app.get("/api/health", async (req, res) => {
      try {
        await db.command({ ping: 1 });

        res.status(200).json({
          success: true,
          message: "Server and MongoDB are connected successfully!",
        });

      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Database connection error",
        });
      }
    });

    // =====================================
    // GET LATEST APPROVED TUITIONS
    // =====================================

    app.get("/api/tuitions", async (req, res) => {
      try {
        const { tuitionsCollection } = getCollections();

        const tuitions = await tuitionsCollection
          .find({
            approvalStatus: "approved",
            isActive: true,
          })
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();

        res.status(200).json({
          success: true,
          count: tuitions.length,
          data: tuitions,
        });

      } catch (error) {
        console.error("Fetch Tuitions Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to fetch tuitions",
        });
      }
    });

    // =====================================
    // BROWSE TUITIONS - SEARCH & FILTER
    // =====================================

    app.get("/api/tuitions/browse", async (req, res) => {
      try {
        const { tuitionsCollection } = getCollections();

        const {
          search = "",
          subject = "",
          classLevel = "",
          mode = "",
        } = req.query;

        const query = {
          approvalStatus: "approved",
          isActive: true,
        };

        // Search by Title or Subject
        if (typeof search === "string" && search.trim()) {
          const safeSearch = search
            .trim()
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

          query.$or = [
            {
              title: {
                $regex: safeSearch,
                $options: "i",
              },
            },
            {
              subject: {
                $regex: safeSearch,
                $options: "i",
              },
            },
          ];
        }

        // Subject Filter
        if (typeof subject === "string" && subject.trim()) {
          query.subject = subject.trim();
        }

        // Class Level Filter
        if (typeof classLevel === "string" && classLevel.trim()) {
          query.classLevel = classLevel.trim();
        }

        // Mode Filter
        if (["Online", "Offline"].includes(mode)) {
          query.mode = mode;
        }

        const tuitions = await tuitionsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();

        res.status(200).json({
          success: true,
          count: tuitions.length,
          data: tuitions,
        });

      } catch (error) {
        console.error("Browse Tuitions Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to fetch tuition listings",
        });
      }
    });

    // =====================================
    // START LISTENING
    // =====================================

    app.listen(PORT, () => {
      console.log(`MentorLagbe Server running on port ${PORT}`);
      console.log(`Local URL: http://localhost:${PORT}`);
      console.log(`BetterAuth URL: http://localhost:${PORT}/api/auth`);
    });

  } catch (error) {
    console.error("Server Startup Failed:", error.message);
    process.exit(1);
  }
};

startServer();
