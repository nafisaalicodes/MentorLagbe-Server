import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import Stripe from "stripe";
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


// -------------------------------------
// Middleware
// -------------------------------------


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
let stripe;


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
  // -------------------------------------
  // Root API
  // -------------------------------------


  app.get("/", (req, res) => {
    res.send("MentorLagbe Server is Running!");
  });


  // -------------------------------------
  // Health API
  // -------------------------------------


  app.get("/api/health", async (req, res) => {
    try {
      await db.command({ ping: 1 });


      return res.status(200).json({
        success: true,
        message: "Server and MongoDB are connected successfully!",
      });
    } catch (error) {
      console.error("Health Check Error:", error);


      return res.status(500).json({
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


      return res.status(200).json({
        success: true,
        count: tuitions.length,
        data: tuitions,
      });
    } catch (error) {
      console.error("Fetch Tuitions Error:", error);


      return res.status(500).json({
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
        const safeSearch = search
          .trim()
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


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


      return res.status(200).json({
        success: true,
        count: tuitions.length,
        data: tuitions,
      });
    } catch (error) {
      console.error("Browse Tuitions Error:", error);


      return res.status(500).json({
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


      const { tuitionsCollection, usersCollection } = getCollections();


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


      // Attach the tutor's plan so the UI can show the Pro "Verified" badge.
      let tutorPlan = "free";

      if (tuition.tutorEmail) {
        const tutor = await usersCollection.findOne(
          { email: tuition.tutorEmail },
          { projection: { subscriptionPlan: 1, plan: 1 } }
        );

        tutorPlan = String(
          tutor?.subscriptionPlan || tutor?.plan || "free"
        ).toLowerCase();
      }


      return res.status(200).json({
        success: true,
        data: { ...tuition, tutorPlan },
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


        if (
          typeof tuitionId !== "string" ||
          !ObjectId.isValid(tuitionId)
        ) {
          return res.status(400).json({
            success: false,
            message: "Valid tuition ID is required",
          });
        }


        const studentEmail = req.user.email
          ?.trim()
          .toLowerCase();


        if (!studentEmail) {
          return res.status(401).json({
            success: false,
            message: "Student email is missing from authentication",
          });
        }


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


        const tuitionObjectId = new ObjectId(tuitionId);


        const tuition = await tuitionsCollection.findOne({
          _id: tuitionObjectId,
          approvalStatus: "approved",
          isActive: true,
        });


        if (!tuition) {
          return res.status(404).json({
            success: false,
            message: "This tuition is no longer available",
          });
        }


        // Check both ObjectId and older string-format records.
        const existingApplication =
          await applicationsCollection.findOne({
            studentEmail,
            $or: [
              { tuitionId: tuitionObjectId },
              { tuitionId },
            ],
          });


        if (existingApplication) {
          return res.status(409).json({
            success: false,
            message: "You have already applied for this tuition",
          });
        }


        const student = await usersCollection.findOne({
          email: studentEmail,
        });


        const application = {
          tuitionId: tuitionObjectId,
          tuitionTitle: tuition.title || "",
          subject: tuition.subject || "",
          monthlyFee: Number(tuition.monthlyFee) || 0,
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


  // =====================================
  // STUDENT DASHBOARD ROUTES
  // =====================================


  // -------------------------------------
  // A. Student Dashboard: Overview Stats
  // -------------------------------------


  app.get(
    "/api/student/dashboard/stats",
    verifyToken,
    verifyStudent,
    async (req, res) => {
      try {
        const {
          applicationsCollection,
          usersCollection,
        } = getCollections();


        const email = req.user.email?.trim().toLowerCase();


        if (!email) {
          return res.status(401).json({
            success: false,
            message: "Student email is missing",
          });
        }


        const applications = await applicationsCollection
          .find({ studentEmail: email })
          .toArray();


        const totalApplied = applications.length;


        const accepted = applications.filter(
          (item) => item.status === "accepted"
        ).length;


        const pending = applications.filter(
          (item) => item.status === "pending"
        ).length;


        const rejected = applications.filter(
          (item) => item.status === "rejected"
        ).length;


        const user = await usersCollection.findOne({
          email,
        });


        const plan =
          user?.subscriptionPlan ||
          user?.plan ||
          "free";


        return res.status(200).json({
          success: true,
          data: {
            totalApplied,
            accepted,
            pending,
            rejected,
            currentPlan:
              String(plan).toLowerCase() === "pro"
                ? "Pro"
                : "Free",
          },
        });
      } catch (error) {
        console.error("Student Dashboard Stats Error:", error);


        return res.status(500).json({
          success: false,
          message: "Failed to load dashboard statistics",
        });
      }
    }
  );


  // -------------------------------------
  // B. Student Dashboard: My Applications
  // -------------------------------------


  app.get(
    "/api/student/applications",
    verifyToken,
    verifyStudent,
    async (req, res) => {
      try {
        const { applicationsCollection } = getCollections();


        const email = req.user.email?.trim().toLowerCase();


        if (!email) {
          return res.status(401).json({
            success: false,
            message: "Student email is missing",
          });
        }


        const applications = await applicationsCollection
          .aggregate([
            {
              $match: {
                studentEmail: email,
              },
            },
            {
              $lookup: {
                from: "tuitions",
                let: {
                  applicationTuitionId: "$tuitionId",
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: [
                          "$_id",
                          {
                            $convert: {
                              input: "$$applicationTuitionId",
                              to: "objectId",
                              onError: null,
                              onNull: null,
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
                as: "tuitionInfo",
              },
            },
            {
              $unwind: {
                path: "$tuitionInfo",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 1,
                tuitionId: 1,


                tuitionTitle: {
                  $ifNull: [
                    "$tuitionTitle",
                    "$tuitionInfo.title",
                  ],
                },


                subject: {
                  $ifNull: [
                    "$subject",
                    "$tuitionInfo.subject",
                  ],
                },


                tutorName: {
                  $ifNull: [
                    "$tuitionInfo.tutorName",
                    "MentorLagbe Tutor",
                  ],
                },


                tutorEmail: {
                  $ifNull: [
                    "$tutorEmail",
                    "$tuitionInfo.tutorEmail",
                  ],
                },


                monthlyFee: {
                  $ifNull: [
                    "$monthlyFee",
                    "$tuitionInfo.monthlyFee",
                  ],
                },


                status: 1,
                appliedAt: 1,
                studentEmail: 1,
              },
            },
            {
              $sort: {
                appliedAt: -1,
              },
            },
          ])
          .toArray();


        return res.status(200).json({
          success: true,
          count: applications.length,
          data: applications,
        });
      } catch (error) {
        console.error("My Applications Error:", error);


        return res.status(500).json({
          success: false,
          message: "Failed to load applications",
        });
      }
    }
  );


  // -------------------------------------
  // C. Student Dashboard: Cancel Application
  // -------------------------------------


  app.delete(
    "/api/student/applications/:id",
    verifyToken,
    verifyStudent,
    async (req, res) => {
      try {
        const { applicationsCollection } = getCollections();
        const { id } = req.params;


        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid application ID",
          });
        }


        const email = req.user.email?.trim().toLowerCase();


        if (!email) {
          return res.status(401).json({
            success: false,
            message: "Student email is missing",
          });
        }


        const result = await applicationsCollection.deleteOne({
          _id: new ObjectId(id),
          studentEmail: email,
          status: "pending",
        });


        if (result.deletedCount === 0) {
          return res.status(404).json({
            success: false,
            message:
              "Application not found or it can no longer be cancelled",
          });
        }


        return res.status(200).json({
          success: true,
          message: "Application cancelled successfully",
        });
      } catch (error) {
        console.error("Cancel Application Error:", error);


        return res.status(500).json({
          success: false,
          message: "Failed to cancel application",
        });
      }
    }
  );


  // =====================================
// TUTOR DASHBOARD ROUTES
// =====================================


// -------------------------------------
// A. Tutor Dashboard Overview Stats
// -------------------------------------


app.get(
  "/api/tutor/dashboard/stats",
  verifyToken,
  verifyTutor,
  async (req, res) => {
    try {
      const {
        usersCollection,
        tuitionsCollection,
        applicationsCollection,
      } = getCollections();


      const email = req.user.email?.trim().toLowerCase();


      if (!email) {
        return res.status(401).json({
          success: false,
          message: "Tutor email is missing",
        });
      }


      const user = await usersCollection.findOne({ email });


      const plan = String(
        user?.subscriptionPlan || user?.plan || "free"
      ).toLowerCase();


      const totalTuitions = await tuitionsCollection.countDocuments({
        tutorEmail: email,
      });


      const activeTuitions = await tuitionsCollection.countDocuments({
        tutorEmail: email,
        approvalStatus: "approved",
        isActive: true,
      });


      const ownedTuitions = await tuitionsCollection
        .find(
          { tutorEmail: email },
          { projection: { _id: 1 } }
        )
        .toArray();


      const tuitionIds = ownedTuitions.map((item) => item._id);
      const tuitionStringIds = tuitionIds.map((id) => id.toString());


      const totalApplicants =
        await applicationsCollection.countDocuments({
          $or: [
            { tutorEmail: email },
            { tuitionId: { $in: tuitionIds } },
            { tuitionId: { $in: tuitionStringIds } },
          ],
        });


      return res.status(200).json({
        success: true,
        data: {
          totalTuitions,
          activeTuitions,
          totalApplicants,
          plan: plan === "pro" ? "Pro" : "Free",
          postLimit: plan === "pro" ? null : 2,
          remainingPosts:
            plan === "pro"
              ? null
              : Math.max(0, 2 - totalTuitions),
        },
      });
    } catch (error) {
      console.error("Tutor Dashboard Stats Error:", error);


      return res.status(500).json({
        success: false,
        message: "Failed to load tutor dashboard statistics",
      });
    }
  }
);


// -------------------------------------
// B. Tutor: Create New Tuition
// -------------------------------------


app.post(
  "/api/tutor/tuitions",
  verifyToken,
  verifyTutor,
  async (req, res) => {
    try {
      const {
        usersCollection,
        tuitionsCollection,
      } = getCollections();


      const email = req.user.email?.trim().toLowerCase();


      if (!email) {
        return res.status(401).json({
          success: false,
          message: "Tutor email is missing",
        });
      }


      const {
        title,
        subject,
        classLevel,
        mode,
        location,
        monthlyFee,
        daysPerWeek,
        description,
        bannerUrl,
      } = req.body || {};


      if (
        typeof title !== "string" ||
        title.trim().length < 5 ||
        title.trim().length > 120
      ) {
        return res.status(400).json({
          success: false,
          message: "Title must be between 5 and 120 characters",
        });
      }


      if (typeof subject !== "string" || !subject.trim()) {
        return res.status(400).json({
          success: false,
          message: "Subject is required",
        });
      }


      if (typeof classLevel !== "string" || !classLevel.trim()) {
        return res.status(400).json({
          success: false,
          message: "Class level is required",
        });
      }


      if (!["Online", "Offline"].includes(mode)) {
        return res.status(400).json({
          success: false,
          message: "Mode must be Online or Offline",
        });
      }


      if (
        typeof location !== "string" ||
        !location.trim() ||
        location.trim().length > 150
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid location is required",
        });
      }


      const fee = Number(monthlyFee);
      const days = Number(daysPerWeek);


      if (
        !Number.isFinite(fee) ||
        fee < 1 ||
        fee > 1000000
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid monthly fee",
        });
      }


      if (!Number.isInteger(days) || days < 1 || days > 7) {
        return res.status(400).json({
          success: false,
          message: "Days per week must be between 1 and 7",
        });
      }


      if (
        typeof description !== "string" ||
        description.trim().length < 20 ||
        description.trim().length > 3000
      ) {
        return res.status(400).json({
          success: false,
          message: "Description must be between 20 and 3000 characters",
        });
      }


      if (
        typeof bannerUrl !== "string" ||
        !/^https:\/\/.+/i.test(bannerUrl.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: "A valid tuition banner image is required",
        });
      }


      const user = await usersCollection.findOne({ email });


      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Tutor account not found",
        });
      }


      const plan = String(
        user.subscriptionPlan || user.plan || "free"
      ).toLowerCase();


      const totalPosts = await tuitionsCollection.countDocuments({
        tutorEmail: email,
      });


      // Free Plan: Maximum 2 tuition posts


      if (plan !== "pro" && totalPosts >= 2) {
        return res.status(403).json({
          success: false,
          code: "FREE_PLAN_LIMIT",
          message:
            "Free Plan allows only 2 tuition posts. Upgrade to Pro for unlimited posts.",
        });
      }


      const tuition = {
        title: title.trim(),
        subject: subject.trim(),
        classLevel: classLevel.trim(),
        mode,
        location: location.trim(),
        monthlyFee: fee,
        daysPerWeek: days,
        description: description.trim(),
        bannerUrl: bannerUrl.trim(),
        bannerImage: bannerUrl.trim(),


        tutorId: req.user.id,
        tutorName: user.name || "Tutor",
        tutorEmail: email,


        approvalStatus: "pending",
        isActive: true,


        createdAt: new Date(),
        updatedAt: new Date(),
      };


      const result = await tuitionsCollection.insertOne(tuition);


      return res.status(201).json({
        success: true,
        message: "Tuition submitted successfully for admin approval",
        data: {
          ...tuition,
          _id: result.insertedId,
        },
      });
    } catch (error) {
      console.error("Create Tuition Error:", error);


      return res.status(500).json({
        success: false,
        message: "Failed to create tuition",
      });
    }
  }
);


// -------------------------------------
// C. Tutor: Get My Tuitions
// -------------------------------------

app.get(
  "/api/tutor/tuitions",
  verifyToken,
  verifyTutor,
  async (req, res) => {
    try {
      const { tuitionsCollection } = getCollections();

      const email = req.user.email?.trim().toLowerCase();

      if (!email) {
        return res.status(401).json({
          success: false,
          message: "Tutor email is missing",
        });
      }

      const tuitions = await tuitionsCollection
        .aggregate([
          {
            $match: {
              tutorEmail: email,
            },
          },
          {
            $lookup: {
              from: "applications",
              let: {
                tuitionObjectId: "$_id",
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: [
                        {
                          $convert: {
                            input: "$tuitionId",
                            to: "objectId",
                            onError: null,
                            onNull: null,
                          },
                        },
                        "$$tuitionObjectId",
                      ],
                    },
                  },
                },
              ],
              as: "applications",
            },
          },
          {
            $addFields: {
              applicantsCount: {
                $size: {
                  $ifNull: ["$applications", []],
                },
              },
            },
          },
          {
            $project: {
              applications: 0,
            },
          },
          {
            $sort: {
              createdAt: -1,
            },
          },
        ])
        .toArray();

      return res.status(200).json({
        success: true,
        count: tuitions.length,
        data: tuitions,
      });
    } catch (error) {
      console.error("Get My Tuitions Error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load your tuition posts",
      });
    }
  }
);



// -------------------------------------
// D. Tutor: Update Tuition
// -------------------------------------


app.patch(
  "/api/tutor/tuitions/:id",
  verifyToken,
  verifyTutor,
  async (req, res) => {
    try {
      const { tuitionsCollection } = getCollections();
      const { id } = req.params;


      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid tuition ID",
        });
      }


      const email = req.user.email?.trim().toLowerCase();


      const allowedFields = [
        "title",
        "subject",
        "classLevel",
        "mode",
        "location",
        "monthlyFee",
        "daysPerWeek",
        "description",
        "bannerUrl",
      ];


      const updateData = {};


      for (const field of allowedFields) {
        if (req.body?.[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }


      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid fields provided for update",
        });
      }


      if (
        updateData.title !== undefined &&
        (typeof updateData.title !== "string" ||
          updateData.title.trim().length < 5 ||
          updateData.title.trim().length > 120)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid tuition title",
        });
      }


      if (
        updateData.subject !== undefined &&
        (typeof updateData.subject !== "string" ||
          !updateData.subject.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid subject",
        });
      }


      if (
        updateData.classLevel !== undefined &&
        (typeof updateData.classLevel !== "string" ||
          !updateData.classLevel.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid class level",
        });
      }


      if (
        updateData.mode !== undefined &&
        !["Online", "Offline"].includes(updateData.mode)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid tuition mode",
        });
      }


      if (
        updateData.location !== undefined &&
        (typeof updateData.location !== "string" ||
          !updateData.location.trim() ||
          updateData.location.trim().length > 150)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid location",
        });
      }


      if (updateData.monthlyFee !== undefined) {
        const fee = Number(updateData.monthlyFee);


        if (!Number.isFinite(fee) || fee < 1 || fee > 1000000) {
          return res.status(400).json({
            success: false,
            message: "Invalid monthly fee",
          });
        }


        updateData.monthlyFee = fee;
      }


      if (updateData.daysPerWeek !== undefined) {
        const days = Number(updateData.daysPerWeek);


        if (!Number.isInteger(days) || days < 1 || days > 7) {
          return res.status(400).json({
            success: false,
            message: "Days per week must be between 1 and 7",
          });
        }


        updateData.daysPerWeek = days;
      }


      if (updateData.description !== undefined) {
        if (
          typeof updateData.description !== "string" ||
          updateData.description.trim().length < 20 ||
          updateData.description.trim().length > 3000
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid description",
          });
        }
      }


      if (updateData.bannerUrl !== undefined) {
        if (
          typeof updateData.bannerUrl !== "string" ||
          !/^https:\/\/.+/i.test(updateData.bannerUrl.trim())
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid banner URL",
          });
        }
      }


      for (const field of [
        "title",
        "subject",
        "classLevel",
        "location",
        "description",
        "bannerUrl",
      ]) {
        if (typeof updateData[field] === "string") {
          updateData[field] = updateData[field].trim();
        }
      }


      // Keep the legacy `bannerImage` field in sync with `bannerUrl`.
      if (typeof updateData.bannerUrl === "string") {
        updateData.bannerImage = updateData.bannerUrl;
      }


      updateData.updatedAt = new Date();


      const result = await tuitionsCollection.updateOne(
        {
          _id: new ObjectId(id),
          tutorEmail: email,
        },
        {
          $set: updateData,
        }
      );


      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Tuition not found or you do not own this tuition",
        });
      }


      return res.status(200).json({
        success: true,
        message: "Tuition updated successfully",
      });
    } catch (error) {
      console.error("Update Tuition Error:", error);


      return res.status(500).json({
        success: false,
        message: "Failed to update tuition",
      });
    }
  }
);


// -------------------------------------
// E. Tutor: Delete Tuition
// -------------------------------------


app.delete(
  "/api/tutor/tuitions/:id",
  verifyToken,
  verifyTutor,
  async (req, res) => {
    try {
      const {
        tuitionsCollection,
        applicationsCollection,
      } = getCollections();


      const { id } = req.params;


      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid tuition ID",
        });
      }


      const email = req.user.email?.trim().toLowerCase();
      const tuitionObjectId = new ObjectId(id);


      const tuition = await tuitionsCollection.findOne({
        _id: tuitionObjectId,
        tutorEmail: email,
      });


      if (!tuition) {
        return res.status(404).json({
          success: false,
          message: "Tuition not found",
        });
      }


      // Delete related applications first.
      // This version also works with standalone local MongoDB.


      await applicationsCollection.deleteMany({
        $or: [
          { tuitionId: tuitionObjectId },
          { tuitionId: id },
        ],
      });


      await tuitionsCollection.deleteOne({
        _id: tuitionObjectId,
        tutorEmail: email,
      });


      return res.status(200).json({
        success: true,
        message: "Tuition and its applications deleted successfully",
      });
    } catch (error) {
      console.error("Delete Tuition Error:", error);


      return res.status(500).json({
        success: false,
        message: "Failed to delete tuition",
      });
    }
  }
);


// -------------------------------------
// F. Tutor: Toggle Tuition Active Status
// -------------------------------------


app.patch(
  "/api/tutor/tuitions/:id/status",
  verifyToken,
  verifyTutor,
  async (req, res) => {
    try {
      const { tuitionsCollection } = getCollections();


      const { id } = req.params;
      const { isActive } = req.body || {};


      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid tuition ID",
        });
      }


      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isActive must be true or false",
        });
      }


      const email = req.user.email?.trim().toLowerCase();


      const result = await tuitionsCollection.updateOne(
        {
          _id: new ObjectId(id),
          tutorEmail: email,
        },
        {
          $set: {
            isActive,
            updatedAt: new Date(),
          },
        }
      );


      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Tuition not found",
        });
      }


      return res.status(200).json({
        success: true,
        message: `Tuition ${isActive ? "activated" : "closed"} successfully`,
      });
    } catch (error) {
      console.error("Toggle Tuition Status Error:", error);


      return res.status(500).json({
        success: false,
        message: "Failed to update tuition status",
      });
    }
  }
);


// -------------------------------------
// G. Tutor: Get All Applicants
// -------------------------------------


app.get(
  "/api/tutor/applicants",
  verifyToken,
  verifyTutor,
  async (req, res) => {
    try {
      const {
        tuitionsCollection,
        applicationsCollection,
      } = getCollections();


      const email = req.user.email?.trim().toLowerCase();


      if (!email) {
        return res.status(401).json({
          success: false,
          message: "Tutor email is missing",
        });
      }


      const myTuitions = await tuitionsCollection
        .find(
          { tutorEmail: email },
          {
            projection: {
              _id: 1,
              title: 1,
            },
          }
        )
        .toArray();


      const tuitionIds = myTuitions.map((item) => item._id);
      const tuitionStringIds = tuitionIds.map((id) => id.toString());


      const applicants = await applicationsCollection
        .aggregate([
          {
            $match: {
              $or: [
                { tutorEmail: email },
                { tuitionId: { $in: tuitionIds } },
                { tuitionId: { $in: tuitionStringIds } },
              ],
            },
          },
          {
            $lookup: {
              from: "tuitions",
              let: {
                applicationTuitionId: "$tuitionId",
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: [
                        "$_id",
                        {
                          $convert: {
                            input: "$$applicationTuitionId",
                            to: "objectId",
                            onError: null,
                            onNull: null,
                          },
                        },
                      ],
                    },
                  },
                },
              ],
              as: "tuitionInfo",
            },
          },
          {
            $unwind: {
              path: "$tuitionInfo",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $match: {
              "tuitionInfo.tutorEmail": email,
            },
          },
          {
            $project: {
              _id: 1,
              tuitionId: 1,


              tuitionTitle: {
                $ifNull: [
                  "$tuitionTitle",
                  "$tuitionInfo.title",
                ],
              },


              studentName: 1,
              studentEmail: 1,
              studentPhone: 1,
              preferredSchedule: 1,
              studentNote: 1,
              status: 1,
              appliedAt: 1,
            },
          },
          {
            $sort: {
              appliedAt: -1,
            },
          },
        ])
        .toArray();


      return res.status(200).json({
        success: true,
        count: applicants.length,
        data: applicants,
      });
    } catch (error) {
      console.error("Tutor Applicants Error:", error);


      return res.status(500).json({
        success: false,
        message: "Failed to load applicants",
      });
    }
  }
);


// -------------------------------------
// H. Tutor: Accept / Reject Applicant
// -------------------------------------


app.patch(
  "/api/tutor/applicants/:id/status",
  verifyToken,
  verifyTutor,
  async (req, res) => {
    try {
      const {
        applicationsCollection,
        tuitionsCollection,
      } = getCollections();


      const { id } = req.params;
      const { status } = req.body || {};


      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid application ID",
        });
      }


      if (!["accepted", "rejected"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be accepted or rejected",
        });
      }


      const email = req.user.email?.trim().toLowerCase();


      const application = await applicationsCollection.findOne({
        _id: new ObjectId(id),
      });


      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Application not found",
        });
      }


      const tuitionId = application.tuitionId;


      const tuition = await tuitionsCollection.findOne({
        _id: ObjectId.isValid(String(tuitionId))
          ? new ObjectId(String(tuitionId))
          : null,
        tutorEmail: email,
      });


      if (!tuition) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to manage this application",
        });
      }


      const result = await applicationsCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            status,
            updatedAt: new Date(),
          },
        }
      );


      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Application not found",
        });
      }


      return res.status(200).json({
        success: true,
        message: `Application ${status} successfully`,
      });
    } catch (error) {
      console.error("Update Applicant Status Error:", error);


      return res.status(500).json({
        success: false,
        message: "Failed to update applicant status",
      });
    }
  }
);


  // =====================================
  // PROFILE & IMAGE ROUTES
  // =====================================


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
    return res.json({
      success: true,
      message: "Authenticated successfully",
      user: req.user,
    });
  });


  // -------------------------------------
  // Student dashboard health route
  // -------------------------------------


  app.get(
    "/api/student/dashboard",
    verifyToken,
    verifyStudent,
    (req, res) => {
      return res.json({
        success: true,
        message: "Welcome to Student Dashboard",
        user: req.user,
      });
    }
  );


  // -------------------------------------
  // Tutor dashboard
  // -------------------------------------


  app.get(
    "/api/tutor/dashboard",
    verifyToken,
    verifyTutor,
    (req, res) => {
      return res.json({
        success: true,
        message: "Welcome to Tutor Dashboard",
        user: req.user,
      });
    }
  );


  // -------------------------------------
  // Admin dashboard
  // -------------------------------------


  app.get(
    "/api/admin/dashboard",
    verifyToken,
    verifyAdmin,
    (req, res) => {
      return res.json({
        success: true,
        message: "Welcome to Admin Dashboard",
        user: req.user,
      });
    }
  );


  // -------------------------------------
  // Admin: helpers
  // -------------------------------------


  // BetterAuth may store _id as string or ObjectId depending on
  // the adapter, so every id lookup matches both shapes.
  const buildIdFilter = (rawId) => {
    const id = String(rawId || "");


    const conditions = [{ _id: id }];


    if (ObjectId.isValid(id)) {
      conditions.push({ _id: new ObjectId(id) });
    }


    return { $or: conditions };
  };


  const escapeRegex = (value) =>
    String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


  const isValidRole = (role) =>
    ["student", "tutor", "admin"].includes(String(role));


  // -------------------------------------
  // Admin: Platform statistics
  // -------------------------------------


  app.get(
    "/api/admin/stats",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
      try {
        const {
          usersCollection,
          tuitionsCollection,
          applicationsCollection,
          paymentsCollection,
        } = getCollections();


        const [
          totalUsers,
          totalTutors,
          totalStudents,
          totalAdmins,
          totalTuitions,
          pendingTuitions,
          approvedTuitions,
          rejectedTuitions,
          totalApplications,
        ] = await Promise.all([
          usersCollection.countDocuments(),
          usersCollection.countDocuments({ role: "tutor" }),
          usersCollection.countDocuments({ role: "student" }),
          usersCollection.countDocuments({ role: "admin" }),
          tuitionsCollection.countDocuments(),
          tuitionsCollection.countDocuments({
            approvalStatus: "pending",
          }),
          tuitionsCollection.countDocuments({
            approvalStatus: "approved",
          }),
          tuitionsCollection.countDocuments({
            approvalStatus: "rejected",
          }),
          applicationsCollection.countDocuments(),
        ]);


        const payments = await paymentsCollection
          .find({})
          .toArray();


        // Everything that is not explicitly failed/refunded counts
        // as settled revenue (Stripe webhook stores "paid").
        const settledPayments = payments.filter((payment) => {
          const status = String(
            payment.paymentStatus || "paid"
          ).toLowerCase();


          return !["failed", "refunded", "canceled", "pending"].includes(
            status
          );
        });


        const totalRevenue = settledPayments.reduce(
          (sum, payment) => sum + (Number(payment.amount) || 0),
          0
        );


        return res.status(200).json({
          success: true,
          data: {
            totalUsers,
            totalTutors,
            totalStudents,
            totalAdmins,
            totalTuitions,
            pendingTuitions,
            approvedTuitions,
            rejectedTuitions,
            totalApplications,
            totalPayments: settledPayments.length,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
          },
        });
      } catch (error) {
        console.error("Admin Stats Error:", error);


        return res.status(500).json({
          success: false,
          message: "Failed to load admin statistics",
        });
      }
    }
  );


  // -------------------------------------
  // Admin: All registered users
  // -------------------------------------


  app.get(
    "/api/admin/users",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
      try {
        const { usersCollection } = getCollections();


        const { search = "", role = "" } = req.query;


        const query = {};


        if (isValidRole(role)) {
          query.role = String(role);
        }


        const trimmed = String(search).trim();


        if (trimmed) {
          const pattern = new RegExp(escapeRegex(trimmed), "i");


          query.$or = [{ name: pattern }, { email: pattern }];
        }


        const users = await usersCollection
          .find(query, {
            projection: {
              name: 1,
              email: 1,
              image: 1,
              role: 1,
              phone: 1,
              bio: 1,
              subscriptionPlan: 1,
              plan: 1,
              createdAt: 1,
            },
          })
          .sort({ createdAt: -1 })
          .limit(500)
          .toArray();


        return res.status(200).json({
          success: true,
          count: users.length,
          data: users,
        });
      } catch (error) {
        console.error("Admin Users Error:", error);


        return res.status(500).json({
          success: false,
          message: "Failed to load users",
        });
      }
    }
  );


  // -------------------------------------
  // Admin: Update a user's role
  // -------------------------------------


  app.patch(
    "/api/admin/users/:id/role",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
      try {
        const { usersCollection } = getCollections();


        const { id } = req.params;
        const { role } = req.body || {};


        if (!isValidRole(role)) {
          return res.status(400).json({
            success: false,
            message: "Role must be student, tutor or admin",
          });
        }


        if (String(id) === String(req.user.id)) {
          return res.status(400).json({
            success: false,
            message: "You cannot change your own role",
          });
        }


        const filter = buildIdFilter(id);


        const user = await usersCollection.findOne(filter);


        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }


        await usersCollection.updateOne(filter, {
          $set: {
            role: String(role),
            updatedAt: new Date(),
          },
        });


        return res.status(200).json({
          success: true,
          message: `Role updated to ${role}`,
          data: {
            ...user,
            role: String(role),
          },
        });
      } catch (error) {
        console.error("Admin Role Update Error:", error);


        return res.status(500).json({
          success: false,
          message: "Failed to update user role",
        });
      }
    }
  );


  // -------------------------------------
  // Admin: All tuition posts (moderation)
  // -------------------------------------


  app.get(
    "/api/admin/tuitions",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
      try {
        const { tuitionsCollection } = getCollections();


        const { status = "", search = "" } = req.query;


        const query = {};


        if (["pending", "approved", "rejected"].includes(String(status))) {
          query.approvalStatus = String(status);
        }


        const trimmed = String(search).trim();


        if (trimmed) {
          const pattern = new RegExp(escapeRegex(trimmed), "i");


          query.$or = [
            { title: pattern },
            { subject: pattern },
            { tutorName: pattern },
            { tutorEmail: pattern },
          ];
        }


        const tuitions = await tuitionsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .limit(500)
          .toArray();


        return res.status(200).json({
          success: true,
          count: tuitions.length,
          data: tuitions,
        });
      } catch (error) {
        console.error("Admin Tuitions Error:", error);


        return res.status(500).json({
          success: false,
          message: "Failed to load tuitions",
        });
      }
    }
  );


  // -------------------------------------
  // Admin: Approve / Reject a tuition
  // -------------------------------------


  app.patch(
    "/api/admin/tuitions/:id/approval",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
      try {
        const { tuitionsCollection } = getCollections();


        const { id } = req.params;
        const { approvalStatus } = req.body || {};


        if (!["approved", "rejected"].includes(String(approvalStatus))) {
          return res.status(400).json({
            success: false,
            message: "Approval status must be approved or rejected",
          });
        }


        const filter = buildIdFilter(id);


        const tuition = await tuitionsCollection.findOne(filter);


        if (!tuition) {
          return res.status(404).json({
            success: false,
            message: "Tuition not found",
          });
        }


        await tuitionsCollection.updateOne(filter, {
          $set: {
            approvalStatus: String(approvalStatus),
            updatedAt: new Date(),
            reviewedAt: new Date(),
            reviewedBy: req.user.email,
          },
        });


        return res.status(200).json({
          success: true,
          message:
            approvalStatus === "approved"
              ? "Tuition approved successfully"
              : "Tuition rejected",
          data: {
            ...tuition,
            approvalStatus: String(approvalStatus),
          },
        });
      } catch (error) {
        console.error("Admin Tuition Approval Error:", error);


        return res.status(500).json({
          success: false,
          message: "Failed to update tuition approval status",
        });
      }
    }
  );
  // =====================================
// Stripe: Create Checkout Session
// =====================================


app.post(
  "/api/payments/create-checkout-session",
  verifyToken,
  async (req, res) => {
    try {
      const { usersCollection } = getCollections();


      const email = req.user.email?.trim().toLowerCase();


      if (!email) {
        return res.status(401).json({
          success: false,
          message: "User email not found",
        });
      }


      // Always get current user data from MongoDB
      const user = await usersCollection.findOne({
        email,
      });


      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }


      // Only Student and Tutor can purchase Pro
      if (!["student", "tutor"].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "Only students and tutors can purchase Pro",
        });
      }


      const currentPlan =
        user.subscriptionPlan || user.plan || "free";


      if (currentPlan === "pro") {
        return res.status(400).json({
          success: false,
          message: "You already have a Pro subscription",
        });
      }


      // Select price using database role
      const priceId =
        user.role === "tutor"
          ? process.env.STRIPE_TUTOR_PRICE_ID
          : process.env.STRIPE_STUDENT_PRICE_ID;


      if (!priceId) {
        return res.status(500).json({
          success: false,
          message: "Stripe Price ID is missing",
        });
      }


      const metadata = {
        userId: String(user._id),
        userEmail: user.email,
        userName: user.name || "",
        userRole: user.role,
        planName: "pro",
      };


      const session = await stripe.checkout.sessions.create({
        mode: "subscription",


        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],


        customer_email: user.email,


        client_reference_id: String(user._id),


        metadata,


        subscription_data: {
          metadata,
        },


        success_url:
          `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,


        cancel_url:
          `${process.env.CLIENT_URL}/payment/cancel`,
      });


      return res.status(200).json({
        success: true,
        url: session.url,
      });
    } catch (error) {
      console.error("Stripe Checkout Error:", error);


      return res.status(500).json({
        success: false,
        message: "Failed to create checkout session",
      });
    }
  }
);


  // -------------------------------------
  // Admin: Stripe payment records
  // -------------------------------------


  app.get(
    "/api/admin/payments",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
      try {
        const { paymentsCollection } = getCollections();


        const { search = "" } = req.query;


        const query = {};


        const trimmed = String(search).trim();


        if (trimmed) {
          const pattern = new RegExp(escapeRegex(trimmed), "i");


          query.$or = [
            { userName: pattern },
            { userEmail: pattern },
            { transactionId: pattern },
            { planName: pattern },
          ];
        }


        const payments = await paymentsCollection
          .find(query)
          .sort({ paidAt: -1, createdAt: -1 })
          .limit(1000)
          .toArray();


        return res.status(200).json({
          success: true,
          count: payments.length,
          data: payments,
        });
      } catch (error) {
        console.error("Admin Payments Error:", error);


        return res.status(500).json({
          success: false,
          message: "Failed to load payments",
        });
      }
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
          plan: String(
            user.subscriptionPlan || user.plan || "free"
          ).toLowerCase(),
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
      const { name, phone, bio, image } = req.body || {};


      if (typeof name !== "string" || !name.trim()) {
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


      const result = await usersCollection.updateOne(
        {
          email: req.user.email,
        },
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


// Error handler must be registered AFTER API routes.
const registerErrorHandler = () => {
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
};


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


    // Stripe payment idempotency indexes (prevent duplicate records)
    await db.collection("payments").createIndex(
      { stripeSessionId: 1 },
      {
        unique: true,
        partialFilterExpression: {
          stripeSessionId: { $type: "string" },
        },
      }
    );

    await db.collection("payments").createIndex(
      { stripeInvoiceId: 1 },
      {
        unique: true,
        partialFilterExpression: {
          stripeInvoiceId: { $type: "string" },
        },
      }
    );


    // Initialize Stripe on the backend only
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is missing");
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("STRIPE_WEBHOOK_SECRET is missing");
    }

    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


    const auth = createAuth(db);


    // Better Auth must be mounted before express.json()
    app.all("/api/auth/*splat", toNodeHandler(auth));


    // =====================================
    // Stripe Webhook
    // MUST BE BEFORE express.json()
    // =====================================
    app.post(
      "/api/payments/webhook",
      express.raw({ type: "application/json" }),
      async (req, res) => {
        const signature = req.headers["stripe-signature"];
        let event;

        try {
          event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
          );
        } catch (error) {
          console.error("Stripe Signature Error:", error.message);
          return res.status(400).send(`Webhook Error: ${error.message}`);
        }

        try {
          const { usersCollection, paymentsCollection } = getCollections();

          // Initial successful Checkout subscription
          if (
            event.type === "checkout.session.completed" ||
            event.type === "checkout.session.async_payment_succeeded"
          ) {
            const session = event.data.object;

            if (session.mode !== "subscription" || session.payment_status !== "paid") {
              return res.json({ received: true });
            }

            const metadata = session.metadata || {};
            const email = String(metadata.userEmail || "").trim().toLowerCase();
            if (!email) throw new Error("User email missing from Stripe metadata");

            const user = await usersCollection.findOne({ email });
            if (!user || user.role !== metadata.userRole) {
              throw new Error("Matching user or role not found");
            }

            const paidAt = new Date((session.created || Date.now() / 1000) * 1000);
            const transactionId =
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : (typeof session.subscription === "string" ? session.subscription : session.id);

            const paymentRecord = {
              userEmail: user.email,
              userName: user.name || "",
              userRole: user.role,
              planName: "pro",
              amount: (session.amount_total || 0) / 100,
              currency: session.currency || "usd",
              transactionId,
              stripeSessionId: session.id,
              stripeSubscriptionId: session.subscription,
              paymentStatus: "paid",
              paidAt,
              createdAt: new Date(),
            };

            await paymentsCollection.updateOne(
              { stripeSessionId: session.id },
              { $setOnInsert: paymentRecord },
              { upsert: true }
            );

            await usersCollection.updateOne(
              { _id: user._id },
              {
                $set: {
                  subscriptionPlan: "pro",
                  plan: "pro",
                  stripeCustomerId: session.customer,
                  stripeSubscriptionId: session.subscription,
                  subscriptionStatus: "active",
                  updatedAt: new Date(),
                },
              }
            );
            console.log("Pro subscription activated:", user.email);
          }

          // Recurring subscription renewal payment
          if (event.type === "invoice.paid") {
            const invoice = event.data.object;
            const subscriptionId =
              typeof invoice.subscription === "string"
                ? invoice.subscription
                : invoice.parent?.subscription_details?.subscription;

            if (invoice.billing_reason !== "subscription_create" && subscriptionId) {
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              const email = String(subscription.metadata?.userEmail || "").trim().toLowerCase();
              if (email) {
                const user = await usersCollection.findOne({ email });
                if (user && user.role === subscription.metadata?.userRole) {
                  const renewalRecord = {
                    userEmail: user.email,
                    userName: user.name || "",
                    userRole: user.role,
                    planName: "pro",
                    amount: (invoice.amount_paid || 0) / 100,
                    currency: invoice.currency || "usd",
                    transactionId:
                      typeof invoice.payment_intent === "string"
                        ? invoice.payment_intent
                        : invoice.id,
                    stripeInvoiceId: invoice.id,
                    stripeSubscriptionId: subscriptionId,
                    paymentStatus: "paid",
                    paidAt: new Date((invoice.created || Date.now() / 1000) * 1000),
                    createdAt: new Date(),
                  };

                  await paymentsCollection.updateOne(
                    { stripeInvoiceId: invoice.id },
                    { $setOnInsert: renewalRecord },
                    { upsert: true }
                  );

                  await usersCollection.updateOne(
                    { _id: user._id },
                    { $set: { subscriptionPlan: "pro", plan: "pro", subscriptionStatus: "active", updatedAt: new Date() } }
                  );
                }
              }
            }
          }

          // Failed renewal payment: keep Pro access but mark past_due
          if (event.type === "invoice.payment_failed") {
            const invoice = event.data.object;
            const subscriptionId =
              typeof invoice.subscription === "string"
                ? invoice.subscription
                : invoice.parent?.subscription_details?.subscription;

            if (subscriptionId) {
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              const email = String(subscription.metadata?.userEmail || "").trim().toLowerCase();
              if (email) {
                await usersCollection.updateOne(
                  { email, stripeSubscriptionId: subscriptionId },
                  { $set: { subscriptionStatus: "past_due", updatedAt: new Date() } }
                );
              }
            }
          }

          // Subscription cancelled: only change the matching current subscription
          if (event.type === "customer.subscription.deleted") {
            const subscription = event.data.object;
            const email = String(subscription.metadata?.userEmail || "").trim().toLowerCase();
            if (email) {
              await usersCollection.updateOne(
                { email, stripeSubscriptionId: subscription.id },
                {
                  $set: {
                    subscriptionPlan: "free",
                    plan: "free",
                    subscriptionStatus: "canceled",
                    updatedAt: new Date(),
                  },
                }
              );
              console.log("Subscription cancellation processed:", email);
            }
          }

          return res.json({ received: true });
        } catch (error) {
          console.error("Stripe Webhook Processing Error:", error);
          return res.status(500).json({ success: false, message: "Webhook processing failed" });
        }
      }
    );


    // JSON parser for API routes
    app.use(express.json());


    // Register all application routes
    registerApiRoutes();


    // Register error handler after routes
    registerErrorHandler();


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