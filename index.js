
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import {
  MongoClient,
  ServerApiVersion,
  ObjectId,
} from "mongodb";


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

// -------------------------------------
// Multer Image Upload Configuration
// -------------------------------------

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const imageUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only JPG, PNG and WEBP images are allowed.")
      );
    }

    callback(null, true);
  },
});

// -------------------------------------
// Upload Image to ImgBB
// -------------------------------------

const uploadToImgBB = async (file) => {
  if (!process.env.IMGBB_API_KEY) {
    throw new Error("IMGBB_API_KEY is missing in backend .env");
  }

  if (!file) {
    throw new Error("Please select an image.");
  }

  const formData = new FormData();

  formData.append(
    "image",
    file.buffer.toString("base64")
  );

  const response = await fetch(
    `https://api.imgbb.com/1/upload?key=${encodeURIComponent(
      process.env.IMGBB_API_KEY
    )}`,
    {
      method: "POST",
      body: formData,
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success || !result.data?.url) {
    console.error("ImgBB Upload Error:", result);

    throw new Error(
      result.error?.message || "Image upload failed."
    );
  }

  return result.data.url;
};

// -------------------------------------
// API Routes
// -------------------------------------

const registerApiRoutes = () => {
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
      console.error("Health Check Error:", error);

      res.status(500).json({
        success: false,
        message: "Database connection error",
      });
    }
  });

  // -------------------------------------
  // Public: Latest approved tuitions
  // -------------------------------------

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

  // -------------------------------------
  // Public: Browse tuitions
  // -------------------------------------

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

  // -------------------------------------
// Public: Get tuition details by ID
// -------------------------------------

app.get("/api/tuitions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tuition ID",
      });
    }

    const { tuitionsCollection } = getCollections();

    const tuition = await tuitionsCollection.findOne({
      _id: new ObjectId(id),
      approvalStatus: "approved",
      isActive: true,
    });

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: "Tuition not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: tuition,
    });
  } catch (error) {
    console.error("Get Tuition Details Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tuition details",
    });
  }
});
// -------------------------------------
// Student: Apply for a tuition
// -------------------------------------

app.post(
  "/api/applications",
  verifyToken,
  verifyStudent,
  async (req, res) => {
    try {
      const {
        tuitionId,
        studentPhone,
        preferredSchedule,
        studentNote = "",
      } = req.body || {};

      // Validate tuition ID
      if (
        typeof tuitionId !== "string" ||
        !ObjectId.isValid(tuitionId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid tuition ID is required",
        });
      }

      // Validate authenticated student email
      const studentEmail = req.user.email
        ?.trim()
        .toLowerCase();

      if (!studentEmail) {
        return res.status(401).json({
          success: false,
          message: "Student email is missing from authentication",
        });
      }

      // Validate application fields
      if (
        typeof studentPhone !== "string" ||
        studentPhone.trim().length < 6 ||
        studentPhone.trim().length > 20
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid phone number",
        });
      }

      if (
        typeof preferredSchedule !== "string" ||
        preferredSchedule.trim().length < 2 ||
        preferredSchedule.trim().length > 120
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide your preferred schedule",
        });
      }

      if (
        typeof studentNote !== "string" ||
        studentNote.trim().length > 1000
      ) {
        return res.status(400).json({
          success: false,
          message: "Learning note must be within 1000 characters",
        });
      }

      const {
        usersCollection,
        tuitionsCollection,
        applicationsCollection,
      } = getCollections();

      // Find approved tuition
      const tuition = await tuitionsCollection.findOne({
        _id: new ObjectId(tuitionId),
        approvalStatus: "approved",
        isActive: true,
      });

      if (!tuition) {
        return res.status(404).json({
          success: false,
          message: "This tuition is no longer available",
        });
      }

      // Prevent duplicate application
      const existingApplication =
        await applicationsCollection.findOne({
          tuitionId,
          studentEmail,
        });

      if (existingApplication) {
        return res.status(409).json({
          success: false,
          message: "You have already applied for this tuition",
        });
      }

      // Get student profile
      const student = await usersCollection.findOne({
        email: studentEmail,
      });

      const application = {
        tuitionId,
        tuitionTitle: tuition.title,
        subject: tuition.subject,
        monthlyFee: tuition.monthlyFee,
        tutorEmail: tuition.tutorEmail || "",

        studentName: student?.name || "",
        studentEmail,
        studentPhone: studentPhone.trim(),

        preferredSchedule: preferredSchedule.trim(),
        studentNote: studentNote.trim(),

        status: "pending",
        appliedAt: new Date(),
      };

      const result = await applicationsCollection.insertOne(
        application
      );

      return res.status(201).json({
        success: true,
        message: "Your application has been submitted successfully",
        applicationId: result.insertedId,
      });
    } catch (error) {
      console.error("Submit Application Error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to submit application",
      });
    }
  }
);
  // -------------------------------------
  // Protected: Upload profile picture
  // -------------------------------------

  app.post(
    "/api/profile/upload-image",
    verifyToken,
    imageUpload.single("image"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "Please select a profile image.",
          });
        }

        const imageUrl = await uploadToImgBB(req.file);

        return res.status(200).json({
          success: true,
          message: "Profile image uploaded successfully.",
          imageUrl,
        });
      } catch (error) {
        console.error("Profile Image Upload Error:", error);

        return res.status(500).json({
          success: false,
          message: error.message || "Profile image upload failed.",
        });
      }
    }
  );

  // -------------------------------------
  // Protected: Upload tuition banner
  // -------------------------------------

  app.post(
    "/api/tuitions/upload-banner",
    verifyToken,
    imageUpload.fields([
      { name: "banner", maxCount: 1 },
      { name: "image", maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const uploadedFiles = req.files || {};

        const bannerFile =
          uploadedFiles.banner?.[0] ||
          uploadedFiles.image?.[0];

        if (!bannerFile) {
          return res.status(400).json({
            success: false,
            message: "Please select a tuition banner image.",
          });
        }

        const bannerUrl = await uploadToImgBB(bannerFile);

        return res.status(200).json({
          success: true,
          message: "Tuition banner uploaded successfully.",
          bannerUrl,
        });
      } catch (error) {
        console.error("Tuition Banner Upload Error:", error);

        return res.status(500).json({
          success: false,
          message: error.message || "Tuition banner upload failed.",
        });
      }
    }
  );

  // -------------------------------------
  // Protected: Any logged-in user
  // -------------------------------------

  app.get("/api/protected", verifyToken, (req, res) => {
    res.json({
      success: true,
      message: "Authenticated successfully",
      user: req.user,
    });
  });

  // Student dashboard
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

  // Tutor dashboard
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

  // Admin dashboard
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

  // -------------------------------------
  // Get logged-in user's profile
  // -------------------------------------

  app.get("/api/profile", verifyToken, async (req, res) => {
    try {
      const { usersCollection } = getCollections();

     const user = await usersCollection.findOne({
  email: req.user.email,
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

  // -------------------------------------
  // Update logged-in user's profile
  // -------------------------------------

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

      if (
        name.trim().length > 100 ||
        phone.length > 20 ||
        bio.length > 500
      ) {
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

      const { usersCollection } = getCollections();

      const userFilter = {
  email: req.user.email,
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
};

// -------------------------------------
// Error Handler
// -------------------------------------

app.use((error, req, res, next) => {
  console.error("API Error:", error);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Image size cannot exceed 5 MB.",
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (
    error.message?.includes("Only JPG, PNG and WEBP")
  ) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: "Something went wrong on the server.",
  });
});

// -------------------------------------
// Start Server
// -------------------------------------

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

    // Better Auth must be mounted before express.json()
    app.all("/api/auth/*splat", toNodeHandler(auth));

    // JSON parser for API routes
    app.use(express.json());

    // Register application routes after middleware
    registerApiRoutes();

    app.listen(PORT, () => {
      console.log(`MentorLagbe Server running on port ${PORT}`);
      console.log(`Local URL: http://localhost:${PORT}`);
      console.log(
        `BetterAuth URL: ${
          process.env.BETTER_AUTH_URL || `http://localhost:${PORT}`
        }/api/auth`
      );
    });
  } catch (error) {
    console.error("Server Startup Failed:", error);
    process.exit(1);
  }
};

startServer();
