
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";

dotenv.config();

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

// Environment Variables
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "mentorlagbe";

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

// Root API
app.get("/", (req, res) => {
  res.send("MentorLagbe Server is Running!");
});

// Health Check API
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

// Get Latest Approved Tuitions
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

// Start Server
const startServer = async () => {
  try {
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in .env file");
    }

    await connectDB();

    app.listen(PORT, () => {
      console.log(`MentorLagbe Server running on port ${PORT}`);
      console.log(`Local URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server Startup Failed:", error.message);
    process.exit(1);
  }
};

startServer();
