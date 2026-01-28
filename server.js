require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const winston = require("winston");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

const prisma = new PrismaClient();

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - startedAt;
    const meta = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: ms,
    };
    if (res.statusCode >= 500) {
      logger.error("request", meta);
    } else {
      logger.info("request", meta);
    }
  });
  next();
});

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function parseGeo(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function resolveGeoFromBody(body) {
  return {
    ltd: parseGeo(body?.ltd ?? body?.lat ?? body?.latitude),
    lgt: parseGeo(
      body?.lgt ?? body?.lng ?? body?.lon ?? body?.longitude ?? body?.long,
    ),
  };
}

function resolveGeoFromHeaders(headers) {
  return {
    ltd: parseGeo(
      headers["x-geo-ltd"] ??
        headers["x-geo-lat"] ??
        headers["x-geo-latitude"],
    ),
    lgt: parseGeo(
      headers["x-geo-lgt"] ??
        headers["x-geo-lng"] ??
        headers["x-geo-lon"] ??
        headers["x-geo-longitude"],
    ),
  };
}

const EARTH_RADIUS_METERS = 6371000;
const GEO_BYPASS_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function distanceMeters(a, b) {
  const lat1 = toRadians(a.ltd);
  const lat2 = toRadians(b.ltd);
  const deltaLat = toRadians(b.ltd - a.ltd);
  const deltaLng = toRadians(b.lgt - a.lgt);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const value =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function geoWithinRadius(known, incoming, radiusMeters) {
  return distanceMeters(known, incoming) <= radiusMeters;
}

async function getAllowedArea() {
  return prisma.allowedArea.findFirst({ orderBy: { updatedAt: "desc" } });
}

function hasGeoBypass(user) {
  return user?.role && GEO_BYPASS_ROLES.has(user.role);
}

async function validateGeofence(incoming) {
  const allowedArea = await getAllowedArea();
  if (!allowedArea) {
    return { ok: false, status: 403, error: "Allowed area not configured" };
  }
  if (!geoWithinRadius(
    { ltd: allowedArea.ltd, lgt: allowedArea.lgt },
    incoming,
    allowedArea.radiusMeters,
  )) {
    return { ok: false, status: 403, error: "Geolocation outside allowed area" };
  }
  return { ok: true, area: allowedArea };
}

async function authRequired(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, ltd: true, lgt: true },
    });
    if (!user) {
      return res.status(401).json({ error: "Invalid token user" });
    }
    if (!hasGeoBypass(user)) {
      const { ltd, lgt } = resolveGeoFromHeaders(req.headers);
      if (ltd === null || lgt === null) {
        return res
          .status(400)
          .json({ error: "Geolocation (ltd, lgt) is required" });
      }
      const incoming = { ltd, lgt };
      const validation = await validateGeofence(incoming);
      if (!validation.ok) {
        return res.status(validation.status).json({ error: validation.error });
      }
    }
    req.user = { ...payload, role: user.role, email: user.email };
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function superAdminRequired(req, res, next) {
  if (!req.user || req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Super Admin access required" });
  }
  return next();
}

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1 as ok`;
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get("/time", async (req, res) => {
  try {
    const result = await prisma.$queryRaw`SELECT NOW() as now`;
    res.json({ now: result[0].now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/auth/register", async (req, res) => {
  console.log(req.body);
  const { username, email, password } = req.body || {};

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: "Username, email, and password are required" });
  }
  const { ltd: ltdValue, lgt: lgtValue } = resolveGeoFromBody(req.body);
  if (ltdValue === null || lgtValue === null) {
    return res
      .status(400)
      .json({ error: "Geolocation (ltd, lgt) is required" });
  }
  try {
    const existingCount = await prisma.user.count();
    const [emailExisting, usernameExisting] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { username } }),
    ]);
    if (emailExisting) {
      return res.status(409).json({ error: "Email already in use" });
    }
    if (usernameExisting) {
      return res.status(409).json({ error: "Username already in use" });
    }
    if (existingCount > 0) {
      const validation = await validateGeofence({ ltd: ltdValue, lgt: lgtValue });
      if (!validation.ok) {
        return res.status(validation.status).json({ error: validation.error });
      }
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        ltd: ltdValue,
        lgt: lgtValue,
        role: existingCount === 0 ? "SUPER_ADMIN" : "USER",
      },
    });
    const token = signToken(user);
    console.log(user);
    return res.status(201).json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (!hasGeoBypass(user)) {
      const { ltd: ltdValue, lgt: lgtValue } = resolveGeoFromBody(req.body);
      if (ltdValue === null || lgtValue === null) {
        return res
          .status(400)
          .json({ error: "Geolocation (ltd, lgt) is required" });
      }
      const incoming = { ltd: ltdValue, lgt: lgtValue };
      const validation = await validateGeofence(incoming);
      if (!validation.ok) {
        return res.status(validation.status).json({ error: validation.error });
      }
    }
    const token = signToken(user);
    return res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/me", authRequired, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, username: true, email: true, role: true, createdAt: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.patch("/me/geolocation", authRequired, async (req, res) => {
  const { ltd: ltdValue, lgt: lgtValue } = resolveGeoFromBody(req.body);
  if (ltdValue === null || lgtValue === null) {
    return res
      .status(400)
      .json({ error: "Geolocation (ltd, lgt) is required" });
  }
  try {
    await prisma.user.update({
      where: { id: req.user.sub },
      data: { ltd: ltdValue, lgt: lgtValue },
    });
    return res.json({
      geolocation: { ltd: ltdValue, lgt: lgtValue },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/geofence", authRequired, async (req, res) => {
  try {
    const allowedArea = await getAllowedArea();
    if (!allowedArea) {
      return res.status(404).json({ error: "Allowed area not configured" });
    }
    return res.json({
      area: {
        ltd: allowedArea.ltd,
        lgt: allowedArea.lgt,
        radiusMeters: allowedArea.radiusMeters,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put("/admin/geofence", authRequired, superAdminRequired, async (req, res) => {
  const { ltd: ltdValue, lgt: lgtValue } = resolveGeoFromBody(req.body);
  const radiusMeters = parseGeo(req.body?.radiusMeters);
  if (ltdValue === null || lgtValue === null || radiusMeters === null) {
    return res.status(400).json({
      error: "Geolocation (ltd, lgt) and radiusMeters are required",
    });
  }
  if (radiusMeters <= 0) {
    return res.status(400).json({ error: "radiusMeters must be positive" });
  }
  try {
    const existing = await getAllowedArea();
    const area = existing
      ? await prisma.allowedArea.update({
          where: { id: existing.id },
          data: {
            ltd: ltdValue,
            lgt: lgtValue,
            radiusMeters,
            updatedById: req.user.sub,
          },
        })
      : await prisma.allowedArea.create({
          data: {
            ltd: ltdValue,
            lgt: lgtValue,
            radiusMeters,
            updatedById: req.user.sub,
          },
        });
    return res.json({
      area: { ltd: area.ltd, lgt: area.lgt, radiusMeters: area.radiusMeters },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.patch(
  "/admin/users/:id/role",
  authRequired,
  superAdminRequired,
  async (req, res) => {
    const role = req.body?.role;
    if (!role || !["SUPER_ADMIN", "ADMIN", "USER"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    try {
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { role },
        select: { id: true, username: true, email: true, role: true },
      });
      return res.json({ user });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
);

app.use((err, req, res, next) => {
  logger.error("Unhandled error", err);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  logger.info("server_started", { port: PORT });
});
