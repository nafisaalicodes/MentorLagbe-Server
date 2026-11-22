
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { hashPassword } from "better-auth/crypto";


dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });

if (!process.env.MONGODB_URI) {
  dotenv.config();
}

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "MentorLagbe";

const SEED_BATCH = "mentorlagbe-demo-v1";
const DEMO_PASSWORD = "Mentor@12345";

const TAG = { seeded: true, demoData: true, seedBatch: SEED_BATCH };

const TUTORS = [
  {
    name: "Nusrat Jahan",
    email: "nusrat.tutor@example.com",
    phone: "01712345678",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
    subscriptionPlan: "pro",
    bio: "M.Sc. in Chemistry from Dhaka University with 6 years of teaching experience. I help Class 9-12 students clear concepts with chapter-wise tests and board-style answer practice.",
  },
  {
    name: "Sadia Islam",
    email: "sadia.tutor@example.com",
    phone: "01811223344",
    image: "https://randomuser.me/api/portraits/women/68.jpg",
    subscriptionPlan: "free",
    bio: "English literature graduate and spoken English trainer. My classes focus on grammar, vocabulary, confident speaking and creative writing for school students.",
  },
  {
    name: "Tanvir Hasan",
    email: "tanvir.tutor@example.com",
    phone: "01911223344",
    image: "https://randomuser.me/api/portraits/men/32.jpg",
    subscriptionPlan: "free",
    bio: "Primary school specialist who makes all-subject home tuition fun with stories, visual aids and weekly assessments for Class 3 to 5 students.",
  },
  {
    name: "Mahmud Hasan",
    email: "mahmud.tutor@example.com",
    phone: "01611223344",
    image: "https://randomuser.me/api/portraits/men/75.jpg",
    subscriptionPlan: "pro",
    bio: "Software engineer who teaches programming fundamentals, Python and C for university students through project-based live online sessions.",
  },
  {
    name: "Farzana Akter",
    email: "farzana.tutor@example.com",
    phone: "01511223344",
    image: "https://randomuser.me/api/portraits/women/12.jpg",
    subscriptionPlan: "free",
    bio: "MBBS student offering biology coaching with neat diagram practice, chapter tests and HSC-focused revision plans.",
  },
  {
    name: "Arif Hossain",
    email: "arif.tutor@example.com",
    phone: "01311223344",
    image: "https://randomuser.me/api/portraits/men/23.jpg",
    subscriptionPlan: "pro",
    bio: "IELTS trainer with an overall band 8.5. I run structured preparation for Listening, Reading, Writing and Speaking with weekly mock tests.",
  },
  {
    name: "Mim Akter",
    email: "mim.tutor@example.com",
    phone: "01799887766",
    image: "https://randomuser.me/api/portraits/women/26.jpg",
    subscriptionPlan: "free",
    bio: "Primary years tutor combining mathematics and science through worksheets, games and friendly one-to-one attention at home.",
  },
  {
    name: "Rifat Chowdhury",
    email: "rifat.tutor@example.com",
    phone: "01677889900",
    image: "https://randomuser.me/api/portraits/men/46.jpg",
    subscriptionPlan: "free",
    bio: "ICT and computer science tutor for junior students. I teach the NCTB ICT syllabus, MS Office, internet safety and beginner Scratch projects.",
  },
  {
    name: "Shakil Ahmed",
    email: "shakil.tutor@example.com",
    phone: "01855667788",
    image: "https://randomuser.me/api/portraits/men/51.jpg",
    subscriptionPlan: "free",
    bio: "Bangla honours graduate teaching primary students proper spelling, reading fluency, handwriting and creative writing.",
  },
  {
    name: "Farhana Rahman",
    email: "farhana.tutor@example.com",
    phone: "01944556677",
    image: "https://randomuser.me/api/portraits/women/33.jpg",
    subscriptionPlan: "free",
    bio: "Mathematics tutor for Class 9-10 with a problem-solving-first approach, weekly timed exams and one-to-one doubt clearing.",
  },
  {
    name: "Imran Kabir",
    email: "imran.tutor@example.com",
    phone: "01633445566",
    image: "https://randomuser.me/api/portraits/men/18.jpg",
    subscriptionPlan: "free",
    bio: "HSC English teacher specialising in grammar, comprehension and writing skills with detailed correction of every assignment.",
  },
  {
    name: "Rumana Karim",
    email: "rumana.tutor@example.com",
    phone: "01722334455",
    image: "https://randomuser.me/api/portraits/women/56.jpg",
    subscriptionPlan: "free",
    bio: "Physics postgraduate supporting first and second year university students with numerical methods, mechanics and electromagnetism.",
  },
];

const STUDENTS = [
  {
    name: "Sumaiya Rahman",
    email: "sumaiya.student@example.com",
    phone: "01711002200",
    image: "https://randomuser.me/api/portraits/women/21.jpg",
    subscriptionPlan: "free",
    bio: "Class 9 student looking for regular tuition support in chemistry and mathematics to prepare for the board exams.",
  },
  {
    name: "Faisal Ahmed",
    email: "faisal.student@example.com",
    phone: "01811003300",
    image: "https://randomuser.me/api/portraits/men/60.jpg",
    subscriptionPlan: "pro",
    bio: "HSC first year student interested in ICT, English writing skills and building a strong base before university admission.",
  },
  {
    name: "Maliha Chowdhury",
    email: "maliha.student@example.com",
    phone: "01911004400",
    image: "https://randomuser.me/api/portraits/women/14.jpg",
    subscriptionPlan: "free",
    bio: "Guardian of a Class 4 student searching for a patient primary tutor, and preparing for IELTS alongside work.",
  },
];

const TUITIONS = [
  {
    seedKey: "ict-68-online",
    title: "ICT and Basic Coding for Class 6-8 Students",
    subject: "ICT",
    classLevel: "Class 6-8",
    mode: "Online",
    location: "Online",
    monthlyFee: 2600,
    daysPerWeek: 3,
    tutorEmail: "rifat.tutor@example.com",
    bannerImage:
      "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1200&q=80",
    description:
      "Live online ICT classes for Class 6 to 8 covering the NCTB ICT syllabus, computer fundamentals, MS Office, internet safety and beginner-friendly Scratch projects. Small batches with screen-share demonstrations and a short quiz at the end of every week.",
    createdAt: new Date("2026-11-20T09:15:00.000Z"),
  },
  {
    seedKey: "chem-910-bashundhara",
    title: "Class 9-10 Chemistry Concept Building and Model Test",
    subject: "Chemistry",
    classLevel: "Class 9-10",
    mode: "Offline",
    location: "Bashundhara R/A, Dhaka",
    monthlyFee: 3800,
    daysPerWeek: 4,
    tutorEmail: "nusrat.tutor@example.com",
    bannerImage:
      "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80",
    description:
      "Chapter-wise chemistry coaching for Class 9 and 10 students covering physical, organic and inorganic chemistry. Includes weekly model tests, practical question practice and board-style answer writing guidance. Guardians receive a short progress note after every test.",
    createdAt: new Date("2026-11-19T17:20:00.000Z"),
  },
  {
    seedKey: "math-910-online",
    title: "Mathematics Problem Solving Batch for Class 9-10",
    subject: "Mathematics",
    classLevel: "Class 9-10",
    mode: "Online",
    location: "Online",
    monthlyFee: 4200,
    daysPerWeek: 6,
    tutorEmail: "farhana.tutor@example.com",
    bannerImage:
      "https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1200&q=80",
    description:
      "Daily online mathematics classes for Class 9 and 10 focused on HSC-style problem solving, algebra, geometry and statistics. Includes previous year question practice, weekly timed exams and one-to-one doubt clearing sessions for weaker topics.",
    createdAt: new Date("2026-11-19T15:40:00.000Z"),
  },
  {
    seedKey: "eng-1112-gulshan",
    title: "English First Paper and Writing Skills for Class 11-12",
    subject: "English",
    classLevel: "Class 11-12",
    mode: "Offline",
    location: "Gulshan-2, Dhaka",
    monthlyFee: 4500,
    daysPerWeek: 4,
    tutorEmail: "imran.tutor@example.com",
    bannerImage:
      "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80",
    description:
      "HSC English coaching covering grammar, comprehension, paragraph and email writing, and literature questions. Students receive weekly writing assignments with detailed corrections plus speaking practice for viva preparation.",
    createdAt: new Date("2026-11-19T13:10:00.000Z"),
  },
  {
    seedKey: "bangla-35-agraabad",
    title: "Bangla Reading and Writing Support for Class 3-5",
    subject: "Bangla",
    classLevel: "Class 3-5",
    mode: "Offline",
    location: "Agrabad, Chattogram",
    monthlyFee: 2800,
    daysPerWeek: 5,
    tutorEmail: "shakil.tutor@example.com",
    bannerImage:
      "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=80",
    description:
      "Home tuition that builds a strong Bangla foundation for primary students — borna, bhashar boi, golpo pora and creative writing. Daily practice sheets, handwriting improvement and a monthly progress report for guardians.",
    createdAt: new Date("2026-11-19T11:35:00.000Z"),
  },
  {
    seedKey: "phys-uni-online",
    title: "University Physics Support for Engineering Students",
    subject: "Physics",
    classLevel: "University",
    mode: "Online",
    location: "Online",
    monthlyFee: 5500,
    daysPerWeek: 3,
    tutorEmail: "rumana.tutor@example.com",
    bannerImage:
      "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1200&q=80",
    description:
      "Online physics support for first and second year university students covering mechanics, waves, electromagnetism and numerical methods. Session notes, solved past papers and assignment guidance for CSE, EEE and BME cohorts.",
    createdAt: new Date("2026-11-19T08:45:00.000Z"),
  },
];

const APPLICATIONS = [
  {
    seedKey: "app-sumaiya-chem",
    tuition: { seedKey: "chem-910-bashundhara" },
    studentEmail: "sumaiya.student@example.com",
    preferredSchedule: "Sun-Thu, 4:00 PM - 6:00 PM",
    studentNote:
      "I need help with organic chemistry basics before the half-yearly test.",
    status: "pending",
    appliedAt: new Date("2026-11-20T10:05:00.000Z"),
  },
  {
    seedKey: "app-sumaiya-math",
    tuition: { seedKey: "math-910-online" },
    studentEmail: "sumaiya.student@example.com",
    preferredSchedule: "Saturday & Monday, 7:00 PM - 9:00 PM",
    studentNote: "Please send the class link 10 minutes before each session.",
    status: "accepted",
    appliedAt: new Date("2026-11-20T11:40:00.000Z"),
  },
  {
    seedKey: "app-faisal-ict",
    tuition: { seedKey: "ict-68-online" },
    studentEmail: "faisal.student@example.com",
    preferredSchedule: "Tue & Thu, 8:00 PM - 9:30 PM",
    studentNote: "I want to finish the ICT syllabus before the pre-test.",
    status: "pending",
    appliedAt: new Date("2026-11-20T12:15:00.000Z"),
  },
  {
    seedKey: "app-faisal-eng",
    tuition: { seedKey: "eng-1112-gulshan" },
    studentEmail: "faisal.student@example.com",
    preferredSchedule: "Sun, Tue & Thu, 5:00 PM - 6:30 PM",
    studentNote: "Looking for email and paragraph writing practice.",
    status: "accepted",
    appliedAt: new Date("2026-11-19T18:20:00.000Z"),
  },
  {
    seedKey: "app-maliha-bangla",
    tuition: { seedKey: "bangla-35-agraabad" },
    studentEmail: "maliha.student@example.com",
    preferredSchedule: "Sat-Wed, 10:00 AM - 11:30 AM",
    studentNote: "My daughter needs a patient tutor for reading practice.",
    status: "pending",
    appliedAt: new Date("2026-11-19T19:05:00.000Z"),
  },
  {
    seedKey: "app-maliha-ielts",
    tuition: {
      title: "IELTS Academic Preparation Course",
      tutorEmail: "arif.tutor@example.com",
    },
    studentEmail: "maliha.student@example.com",
    preferredSchedule: "Friday, 6:00 PM - 8:00 PM",
    studentNote: "I am targeting band 7 in a single attempt.",
    status: "rejected",
    appliedAt: new Date("2026-11-19T20:10:00.000Z"),
  },
];

const BROWSE_SUBJECTS = [
  "Mathematics",
  "Higher Mathematics",
  "English",
  "Physics",
  "Chemistry",
  "Biology",
  "ICT",
  "Bangla",
  "All Subjects",
  "Programming",
  "IELTS",
];

const BROWSE_CLASS_LEVELS = [
  "Class 3-5",
  "Class 5",
  "Class 6-8",
  "Class 9-10",
  "Class 11-12",
  "University",
  "Adult",
];

const isDemoTuition = (tuition) =>
  String(tuition?.tutorEmail || "").toLowerCase().endsWith("@example.com");

async function connect() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is missing. Backend .env could not be read.");
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  const db = client.db(DB_NAME);
  await db.command({ ping: 1 });

  return {
    client,
    db,
    users: db.collection("users"),
    accounts: db.collection("account"),
    sessions: db.collection("session"),
    tuitions: db.collection("tuitions"),
    applications: db.collection("applications"),
    payments: db.collection("payments"),
  };
}

async function ensureUser(users, profile, role) {
  const email = profile.email.toLowerCase();
  const existing = await users.findOne({ email });

  if (existing) {
    return {
      user: existing,
      created: false,
      ours: existing.seedBatch === SEED_BATCH && existing.seeded === true,
    };
  }

  const now = new Date();
  const doc = {
    ...TAG,
    name: profile.name,
    email,
    emailVerified: true,
    role,
    subscriptionPlan: profile.subscriptionPlan || "free",
    phone: profile.phone,
    bio: profile.bio,
    image: profile.image,
    createdAt: now,
    updatedAt: now,
  };

  const result = await users.insertOne(doc);

  return { user: { ...doc, _id: result.insertedId }, created: true, ours: true };
}

async function ensureLogin(accounts, user) {
  const existingAccount = await accounts.findOne({ userId: user._id });

  if (existingAccount) {
    return { created: false, existing: true };
  }

  const now = new Date();
  await accounts.insertOne({
    ...TAG,
    accountId: String(user._id),
    providerId: "credential",
    userId: user._id,
    password: await hashPassword(DEMO_PASSWORD),
    createdAt: now,
    updatedAt: now,
  });

  return { created: true, existing: false };
}

async function resolveTuition(tuitions, reference) {
  if (reference.seedKey) {
    return tuitions.findOne({ seedKey: reference.seedKey });
  }

  return tuitions.findOne({
    title: reference.title,
    tutorEmail: reference.tutorEmail,
  });
}

async function seed() {
  const db = await connect();

  console.log("\n==============================================");
  console.log(" MentorLagbe demo seed");
  console.log(` Database: ${DB_NAME}`);
  console.log("==============================================\n");

  try {
    let createdUsers = 0;
    let skippedUsers = 0;
    let createdLogins = 0;

    const tutorDocs = [];
    const studentDocs = [];

    for (const tutor of TUTORS) {
      const { user, created, ours } = await ensureUser(db.users, tutor, "tutor");

      if (created) createdUsers += 1;
      else skippedUsers += 1;

      if (!ours) {
        console.log(
          ` ! ${tutor.email} already existed — left completely untouched.`
        );
      } else {
        const login = await ensureLogin(db.accounts, user);
        if (login.created) createdLogins += 1;
      }

      tutorDocs.push(user);
    }

    for (const student of STUDENTS) {
      const { user, created, ours } = await ensureUser(
        db.users,
        student,
        "student"
      );

      if (created) createdUsers += 1;
      else skippedUsers += 1;

      if (!ours) {
        console.log(
          ` ! ${student.email} already existed — left completely untouched.`
        );
      } else {
        const login = await ensureLogin(db.accounts, user);
        if (login.created) createdLogins += 1;
      }

      studentDocs.push(user);
    }

    console.log(
      `Users: ${createdUsers} created, ${skippedUsers} already existed, ` +
        `${createdLogins} login(s) created (password: ${DEMO_PASSWORD})`
    );

    const tutorByEmail = new Map(
      tutorDocs.map((user) => [String(user.email).toLowerCase(), user])
    );
    const studentByEmail = new Map(
      studentDocs.map((user) => [String(user.email).toLowerCase(), user])
    );

    let createdTuitions = 0;
    let existingTuitions = 0;

    for (const tuition of TUITIONS) {
      const found = await db.tuitions.findOne({ seedKey: tuition.seedKey });

      if (found) {
        existingTuitions += 1;
        continue;
      }

      const tutor = tutorByEmail.get(tuition.tutorEmail.toLowerCase());

      if (!tutor) {
        throw new Error(`Tutor account missing for ${tuition.tutorEmail}`);
      }

      const now = new Date();

      await db.tuitions.insertOne({
        ...TAG,
        seedKey: tuition.seedKey,
        title: tuition.title,
        subject: tuition.subject,
        classLevel: tuition.classLevel,
        mode: tuition.mode,
        location: tuition.location,
        monthlyFee: tuition.monthlyFee,
        daysPerWeek: tuition.daysPerWeek,
        description: tuition.description,
        bannerImage: tuition.bannerImage,
        bannerUrl: tuition.bannerImage,
        tutorId: tutor._id,
        tutorName: tutor.name,
        tutorEmail: tutor.email,
        approvalStatus: "approved",
        isActive: true,
        createdAt: tuition.createdAt,
        updatedAt: now,
      });

      createdTuitions += 1;
    }

    let linkedListings = 0;

    const existingListings = await db.tuitions.find({}).toArray();

    for (const listing of existingListings) {
      if (!isDemoTuition(listing)) continue;

      const updates = {};

      if (!listing.bannerUrl && listing.bannerImage) {
        updates.bannerUrl = listing.bannerImage;
      }

      if (!listing.tutorId) {
        const email = String(listing.tutorEmail || "").toLowerCase();
        let tutor = tutorByEmail.get(email);

        if (!tutor && email) {
          tutor = await db.users.findOne({ email });
        }

        if (tutor) updates.tutorId = tutor._id;
      }

      if (!listing.updatedAt) {
        updates.updatedAt = listing.createdAt || new Date();
      }

      if (listing.demoData === undefined) {
        updates.demoData = true;
      }

      if (Object.keys(updates).length === 0) continue;

      await db.tuitions.updateOne(
        { _id: listing._id },
        { $set: updates }
      );

      linkedListings += 1;
    }

    console.log(
      `Tuitions: ${createdTuitions} created, ${existingTuitions} already existed, ` +
        `${linkedListings} existing demo listing(s) linked/updated`
    );

    let createdApplications = 0;
    let existingApplications = 0;

    for (const application of APPLICATIONS) {
      const found = await db.applications.findOne({
        seedKey: application.seedKey,
      });

      if (found) {
        existingApplications += 1;
        continue;
      }

      const tuition = await resolveTuition(db.tuitions, application.tuition);
      const student = studentByEmail.get(application.studentEmail.toLowerCase());

      if (!tuition) {
        throw new Error(
          `Tuition not found for application ${application.seedKey}`
        );
      }

      if (!student) {
        throw new Error(
          `Student account missing for ${application.studentEmail}`
        );
      }

      await db.applications.insertOne({
        ...TAG,
        seedKey: application.seedKey,
        tuitionId: tuition._id,
        tuitionTitle: tuition.title || "",
        subject: tuition.subject || "",
        monthlyFee: Number(tuition.monthlyFee) || 0,
        tutorEmail: tuition.tutorEmail || "",
        studentName: student.name || "",
        studentEmail: String(student.email).toLowerCase(),
        studentPhone: student.phone || "",
        preferredSchedule: application.preferredSchedule,
        studentNote: application.studentNote,
        status: application.status,
        appliedAt: application.appliedAt,
      });

      createdApplications += 1;
    }

    console.log(
      `Applications: ${createdApplications} created, ${existingApplications} already existed`
    );

    console.log("\n----------------------------------------------");
    console.log(" Demo logins (Better Auth / email + password)");
    console.log("----------------------------------------------");
    console.log(` Password for every demo account: ${DEMO_PASSWORD}`);
    console.log(" Tutors:");
    TUTORS.forEach((tutor) => console.log(`   - ${tutor.email}`));
    console.log(" Students:");
    STUDENTS.forEach((student) => console.log(`   - ${student.email}`));
    console.log("----------------------------------------------\n");

    console.log("Seed complete. Run `node seed.js --verify` for a report.\n");
  } finally {
    await db.client.close();
  }
}


async function verify() {
  const db = await connect();

  try {
    const problems = [];
    const ok = (label, condition, detail = "") => {
      console.log(
        `${condition ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`
      );
      if (!condition) problems.push(label);
    };

    const [
      users,
      tuitions,
      applications,
      accounts,
    ] = await Promise.all([
      db.users.find({}).toArray(),
      db.tuitions.find({}).toArray(),
      db.applications.find({}).toArray(),
      db.accounts.find({}).toArray(),
    ]);

    const approved = tuitions.filter(
      (t) => t.approvalStatus === "approved" && t.isActive === true
    );
    const tutors = users.filter((u) => u.role === "tutor");
    const students = users.filter((u) => u.role === "student");
    const admins = users.filter((u) => u.role === "admin");

    console.log("\n==============================================");
    console.log(" Verification report");
    console.log(` Database: ${DB_NAME}`);
    console.log("==============================================\n");

    console.log("1) Public listings (home page + browse page)");
    ok(
      "At least 12 approved & active tuitions",
      approved.length >= 12,
      `${approved.length} found`
    );

    const subjects = [...new Set(approved.map((t) => t.subject))];
    const classLevels = [...new Set(approved.map((t) => t.classLevel))];

    BROWSE_SUBJECTS.forEach((subject) =>
      ok(
        `Subject filter "${subject}" returns results`,
        subjects.includes(subject)
      )
    );

    BROWSE_CLASS_LEVELS.forEach((level) =>
      ok(`Class filter "${level}" returns results`, classLevels.includes(level))
    );

    ok(
      "Both Online and Offline modes present",
      approved.some((t) => t.mode === "Online") &&
        approved.some((t) => t.mode === "Offline")
    );

    ok(
      "Every listing has bannerImage + bannerUrl",
      approved.every((t) => t.bannerImage && t.bannerUrl),
      `${approved.filter((t) => t.bannerImage && t.bannerUrl).length}/${approved.length}`
    );

    ok(
      "Every listing has tutorId + tutorName + tutorEmail",
      approved.every((t) => t.tutorId && t.tutorName && t.tutorEmail)
    );

    console.log("\n2) Relationships (tutors, students, tuitions, applications)");

    const emails = new Set(users.map((u) => String(u.email).toLowerCase()));

    const orphanTuitions = approved.filter(
      (t) => !emails.has(String(t.tutorEmail || "").toLowerCase())
    );
    ok(
      "Every approved tuition belongs to an existing user",
      orphanTuitions.length === 0,
      orphanTuitions.length
        ? `missing: ${orphanTuitions
            .map((t) => t.tutorEmail)
            .join(", ")}`
        : `${approved.length}/${approved.length} connected`
    );

    const tuitionIds = new Set(tuitions.map((t) => String(t._id)));
    const orphanApplications = applications.filter(
      (a) => !tuitionIds.has(String(a.tuitionId))
    );
    ok(
      "Every application points at a real tuition",
      orphanApplications.length === 0,
      `${applications.length - orphanApplications.length}/${applications.length}`
    );

    const studentEmails = new Set(
      students.map((s) => String(s.email).toLowerCase())
    );
    const applicationsWithoutStudent = applications.filter(
      (a) => !studentEmails.has(String(a.studentEmail || "").toLowerCase())
    );
    ok(
      "Every application belongs to an existing student",
      applicationsWithoutStudent.length === 0,
      `${applications.length - applicationsWithoutStudent.length}/${applications.length}`
    );

    const seededUsers = users.filter((u) => u.seedBatch === SEED_BATCH);
    const accountUserIds = new Set(accounts.map((a) => String(a.userId)));
    const seededWithoutLogin = seededUsers.filter(
      (u) => !accountUserIds.has(String(u._id))
    );
    ok(
      "Every seeded user can log in (credential account exists)",
      seededWithoutLogin.length === 0,
      `${seededUsers.length - seededWithoutLogin.length}/${seededUsers.length}`
    );

    const PRE_EXISTING_USERS = [
      { email: "nafis@gmail.com", role: "student", plan: "free" },
      { email: "rahim.tutor@example.com", role: "student", plan: "free" },
      { email: "rahim@example.com", role: "admin", plan: "free" },
      { email: "nafisaali@example.com", role: "admin", plan: "free" },
      { email: "tasnia@gmail.com", role: "student", plan: "pro" },
    ];

    const untouched = PRE_EXISTING_USERS.every((expected) => {
      const user = users.find(
        (u) => String(u.email).toLowerCase() === expected.email
      );

      if (!user) return false;
      if (user.seeded || user.seedBatch) return false;

      return (
        user.role === expected.role &&
        String(user.subscriptionPlan || "free") === expected.plan
      );
    });

    ok(
      "Every pre-existing user is untouched (email, role, plan)",
      untouched,
      `${PRE_EXISTING_USERS.length} account(s) checked`
    );

    console.log("\n3) Tutor dashboard math (/api/tutor/dashboard/stats)");
    for (const tutor of tutors) {
      const email = String(tutor.email).toLowerCase();
      const owned = tuitions.filter(
        (t) => String(t.tutorEmail || "").toLowerCase() === email
      );
      const active = owned.filter(
        (t) => t.approvalStatus === "approved" && t.isActive === true
      );
      const tuitionIdsOwned = new Set(owned.map((t) => String(t._id)));
      const applicants = applications.filter(
        (a) =>
          String(a.tutorEmail || "").toLowerCase() === email ||
          tuitionIdsOwned.has(String(a.tuitionId))
      );

      console.log(
        `  ${tutor.name.padEnd(18)} plan=${String(
          tutor.subscriptionPlan || "free"
        ).padEnd(5)} tuitions=${owned.length} active=${active.length} applicants=${applicants.length}`
      );
    }

    console.log("\n4) Student dashboard math (/api/student/dashboard/stats)");
    for (const student of students) {
      const email = String(student.email).toLowerCase();
      const mine = applications.filter(
        (a) => String(a.studentEmail || "").toLowerCase() === email
      );

      console.log(
        `  ${student.name.padEnd(18)} plan=${String(
          student.subscriptionPlan || "free"
        ).padEnd(5)} applied=${mine.length} accepted=${mine.filter(
          (a) => a.status === "accepted"
        ).length} pending=${mine.filter((a) => a.status === "pending").length} rejected=${mine.filter(
          (a) => a.status === "rejected"
        ).length}`
      );
    }

    const paymentsList = await db.payments.find({}).toArray();

    const settled = paymentsList.filter((payment) => {
      const status = String(payment.paymentStatus || "paid").toLowerCase();
      return !["failed", "refunded", "canceled", "pending"].includes(status);
    });
    const revenue = Math.round(
      settled.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) * 100
    ) / 100;

    console.log("\n5) Admin dashboard math (/api/admin/stats)");
    console.log(
      [
        `  totalUsers=${users.length}`,
        `totalTutors=${tutors.length}`,
        `totalStudents=${students.length}`,
        `totalAdmins=${admins.length}`,
      ].join("  ")
    );
    console.log(
      [
        `  totalTuitions=${tuitions.length}`,
        `pending=${
          tuitions.filter((t) => t.approvalStatus === "pending").length
        }`,
        `approved=${
          tuitions.filter((t) => t.approvalStatus === "approved").length
        }`,
        `rejected=${
          tuitions.filter((t) => t.approvalStatus === "rejected").length
        }`,
        `totalApplications=${applications.length}`,
      ].join("  ")
    );
    console.log(
      `  totalPayments=${settled.length}  totalRevenue=$${revenue}`
    );

    console.log(
      `\n==============================================\n${
        problems.length === 0
          ? " All checks passed."
          : ` ${problems.length} check(s) FAILED:\n   - ${problems.join("\n   - ")}`
      }\n==============================================\n`
    );

    return problems.length === 0;
  } finally {
    await db.client.close();
  }
}


async function rollback() {
  const db = await connect();

  try {
    console.log("\n==============================================");
    console.log(" Rollback (demo records created by this script)");
    console.log(` Database: ${DB_NAME}`);
    console.log("==============================================\n");

    const seededUsers = await db.users
      .find({ seeded: true, seedBatch: SEED_BATCH })
      .toArray();
    const userIds = seededUsers.map((user) => user._id);

    const applications = await db.applications
      .find({ seeded: true, seedBatch: SEED_BATCH })
      .toArray();
    const tuitions = await db.tuitions
      .find({ seeded: true, seedBatch: SEED_BATCH })
      .toArray();

    console.log("Records marked for removal:");
    console.log(`  applications : ${applications.length}`);
    console.log(`  tuitions     : ${tuitions.length}`);
    console.log(`  users        : ${seededUsers.length}`);
    console.log(`  logins       : ${userIds.length}`);
    console.log(`  sessions     : ${userIds.length} (only seeded users)`);
    console.log(
      "  pre-existing demo listings / real user records : NOT touched\n"
    );

    if (userIds.length > 0) {
      const sessions = await db.sessions.countDocuments({
        userId: { $in: userIds },
      });
      console.log(`  sessions found for seeded users: ${sessions}`);
    }

    const appResult = await db.applications.deleteMany({
      seeded: true,
      seedBatch: SEED_BATCH,
    });
    const tuitionResult = await db.tuitions.deleteMany({
      seeded: true,
      seedBatch: SEED_BATCH,
    });

    let sessionResult = { deletedCount: 0 };
    let accountResult = { deletedCount: 0 };
    let userResult = { deletedCount: 0 };

    if (userIds.length > 0) {
      sessionResult = await db.sessions.deleteMany({
        userId: { $in: userIds },
      });
      accountResult = await db.accounts.deleteMany({
        userId: { $in: userIds },
      });
      userResult = await db.users.deleteMany({
        seeded: true,
        seedBatch: SEED_BATCH,
      });
    }

    console.log("\nRemoved:");
    console.log(`  applications : ${appResult.deletedCount}`);
    console.log(`  tuitions     : ${tuitionResult.deletedCount}`);
    console.log(`  sessions     : ${sessionResult.deletedCount}`);
    console.log(`  logins       : ${accountResult.deletedCount}`);
    console.log(`  users        : ${userResult.deletedCount}`);

    console.log(
      "\nNote: demo listings that existed BEFORE this script were left in place."
    );
    console.log(
      "To remove those as well, review them first and then delete manually:"
    );
    console.log(
      '  db.tuitions.deleteMany({ tutorEmail: /@example\\.com$/ })\n'
    );
  } finally {
    await db.client.close();
  }
}

const mode = process.argv[2];

if (mode === "--verify") {
  const passed = await verify();
  process.exit(passed ? 0 : 1);
} else if (mode === "--rollback") {
  await rollback();
} else if (!mode) {
  await seed();
} else {
  console.error(`Unknown option: ${mode}`);
  console.error("Usage: node seed.js [--verify | --rollback]");
  process.exit(1);
}
