
import { createRemoteJWKSet, jwtVerify } from "jose";

const authBaseURL =
  process.env.BETTER_AUTH_URL || "http://localhost:5000";

const jwksURL = `${authBaseURL.replace(/\/+$/, "")}/api/auth/jwks`;

console.log("JWKS URL:", jwksURL);

const JWKS = createRemoteJWKSet(
  new URL(jwksURL)
);

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access token is required",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization header",
      });
    }

    const { payload } = await jwtVerify(token, JWKS);

    const userId = payload.id || payload.sub;

    if (
      typeof userId !== "string" ||
      typeof payload.role !== "string"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    req.user = {
      id: userId,
      email:
        typeof payload.email === "string"
          ? payload.email
          : "",
      role: payload.role,
    };

    next();
  } catch (error) {
  console.error("JWT Verification Failed:", {
    name: error.name,
    code: error.code,
    message: error.message,
    cause: error.cause?.message,
  });

  return res.status(401).json({
    success: false,
    message: "Invalid or expired token",
  });
}
};

// Student only
export const verifyStudent = (req, res, next) => {
  if (req.user?.role !== "student") {
    return res.status(403).json({
      success: false,
      message: "Student access only",
    });
  }

  next();
};

// Tutor only
export const verifyTutor = (req, res, next) => {
  if (req.user?.role !== "tutor") {
    return res.status(403).json({
      success: false,
      message: "Tutor access only",
    });
  }

  next();
};

// Admin only
export const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access only",
    });
  }

  next();
};
