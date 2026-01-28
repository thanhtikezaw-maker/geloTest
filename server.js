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

function geoMatches(whitelist, incoming) {
  const EPSILON = 0.0001;
  return Math.abs(whitelist - incoming) <= EPSILON;
}

async function authRequired(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const ltd = parseGeo(req.headers["x-geo-ltd"]);
    const lgt = parseGeo(req.headers["x-geo-lgt"]);
    if (ltd === null || lgt === null) {
      return res
        .status(400)
        .json({ error: "Geolocation (ltd, lgt) is required" });
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, ltd: true, lgt: true },
    });
    if (!user) {
      return res.status(401).json({ error: "Invalid token user" });
    }
    if (user.ltd === null || user.lgt === null) {
      return res.status(403).json({ error: "Geolocation not set for user" });
    }
    if (!geoMatches(user.ltd, ltd) || !geoMatches(user.lgt, lgt)) {
      return res
        .status(403)
        .json({ error: "Geolocation not allowed for user" });
    }
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
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
  const { username, email, password, ltd, lgt } = req.body || {};

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: "Username, email, and password are required" });
  }
  const ltdValue = parseGeo(ltd);
  const lgtValue = parseGeo(lgt);
  if (ltdValue === null || lgtValue === null) {
    return res
      .status(400)
      .json({ error: "Geolocation (ltd, lgt) is required" });
  }
  try {
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
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, email, passwordHash, ltd: ltdValue, lgt: lgtValue },
    });
    const token = signToken(user);
    console.log(user);
    return res.status(201).json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password, ltd, lgt } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const ltdValue = parseGeo(ltd);
  const lgtValue = parseGeo(lgt);
  if (ltdValue === null || lgtValue === null) {
    return res
      .status(400)
      .json({ error: "Geolocation (ltd, lgt) is required" });
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
    if (user.ltd === null || user.lgt === null) {
      await prisma.user.update({
        where: { id: user.id },
        data: { ltd: ltdValue, lgt: lgtValue },
      });
    } else if (!geoMatches(user.ltd, ltdValue) || !geoMatches(user.lgt, lgtValue)) {
      return res
        .status(403)
        .json({ error: "Geolocation not allowed for user" });
    }
    const token = signToken(user);
    return res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/me", authRequired, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, username: true, email: true, createdAt: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

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
