
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";

import { toNodeHandler } from "better-auth/node";
import { createAuth } from "./auth.js";

import {
  verifyToken,
  verifyStudent,
  verifyTutor,
  verifyAdmin,
} from "./authMiddleware.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "MentorLagbe";

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const client = new MongoClient(MONGODB_URI || "", {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

const connectDB = async () => {
  await client.connect();

  db = client.db(DB_NAME);

  await db.command({ ping: 1 });

  console.log("MongoDB Connected Successfully!");
  console.log(`Database: ${DB_NAME}`);
};

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

// Health API
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

// Public: Latest approved tuitions
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

// Public: Browse tuitions
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

    if (typeof search === "string" && search.trim()) {
      const safeSearch = search.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      query.$or = [
        { title: { $regex: safeSearch, $options: "i" } },
        { subject: { $regex: safeSearch, $options: "i" } },
      ];
    }

    if (typeof subject === "string" && subject.trim()) {
      query.subject = subject.trim();
    }

    if (typeof classLevel === "string" && classLevel.trim()) {
      query.classLevel = classLevel.trim();
    }

    if (
      typeof mode === "string" &&
      ["Online", "Offline"].includes(mode)
    ) {
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

// Protected: Any logged-in user
app.get("/api/protected", verifyToken, (req, res) => {
  res.json({
    success: true,
    message: "Authenticated successfully",
    user: req.user,
  });
});

// Protected: Student only
app.get(
  "/api/student/dashboard",
  verifyToken,
  verifyStudent,
  (req, res) => {
    res.json({
      success: true,
      message: "Welcome to Student Dashboard",
      user: req.user,
    });
  }
);

// Protected: Tutor only
app.get(
  "/api/tutor/dashboard",
  verifyToken,
  verifyTutor,
  (req, res) => {
    res.json({
      success: true,
      message: "Welcome to Tutor Dashboard",
      user: req.user,
    });
  }
);

// Protected: Admin only
app.get(
  "/api/admin/dashboard",
  verifyToken,
  verifyAdmin,
  (req, res) => {
    res.json({
      success: true,
      message: "Welcome to Admin Dashboard",
      user: req.user,
    });
  }
);

// Get logged-in user's profile
app.get("/api/profile", verifyToken, async (req, res) => {
  try {
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({
      $or: [
        { id: req.user.id },
        { _id: req.user.id },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: req.user.id,
        name: user.name || "",
        email: user.email || "",
        role: user.role || "",
        phone: user.phone || "",
        bio: user.bio || "",
        image: user.image || "",
      },
    });
  } catch (error) {
    console.error("Get Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load profile",
    });
  }
});


// Update logged-in user's profile
app.patch("/api/profile", verifyToken, async (req, res) => {
  try {
    const { name, phone, bio, image } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (
      typeof phone !== "string" ||
      typeof bio !== "string" ||
      typeof image !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid profile data",
      });
    }

    if (name.trim().length > 100 || phone.length > 20 || bio.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Profile information is too long",
      });
    }

    if (
      image.trim() &&
      !/^https?:\/\/.+/i.test(image.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid image URL",
      });
    }

    const usersCollection = db.collection("users");

    const userFilter = {
      $or: [
        { id: req.user.id },
        { _id: req.user.id },
      ],
    };

    const result = await usersCollection.updateOne(
      userFilter,
      {
        $set: {
          name: name.trim(),
          phone: phone.trim(),
          bio: bio.trim(),
          image: image.trim(),
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
});

const startServer = async () => {
  try {
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in .env");
    }

    if (!process.env.BETTER_AUTH_SECRET) {
      throw new Error("BETTER_AUTH_SECRET is missing in .env");
    }

    await connectDB();

    const auth = createAuth(db);

    // Express 5: mount Better Auth before express.json()
    app.all("/api/auth/*splat", toNodeHandler(auth));

    // Body parser comes after Better Auth
    app.use(express.json());

    app.listen(PORT, () => {
      console.log(`MentorLagbe Server running on port ${PORT}`);
      console.log(`Local URL: http://localhost:${PORT}`);
      console.log(
        `BetterAuth URL: ${process.env.BETTER_AUTH_URL}/api/auth`
      );
    });
  } catch (error) {
    console.error("Server Startup Failed:", error);
    process.exit(1);
  }
};

startServer();
