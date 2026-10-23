import "dotenv/config";
import crypto from "crypto";
import cors from "cors";
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

import { bigThink } from "./ai.js";
import redis from "./redis.js";

// const LOCK_KEY = "bigThink:lock";
const JOB_PREFIX = "job:";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Multer setup (memory only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

app.get("/api/get-response", async (req, res) => {
  const inProgress = await redis.get(`bigThinkInMotion`);
  if(inProgress) res.json({ loading: true, response: "still thinking, bro, come back lateh..." });
  else {
    const cached = await redis.get(`ai_response`);
    res.json({ loading: false, response: cached });
  }
});

app.get("/api/job/:id", async (req, res) => {
  try {
    const jobId = req.params.id;

    const data = await redis.get(`${JOB_PREFIX}${jobId}`);

    if (!data) {
      return res.status(404).json({
        error: "Job not found"
      });
    }

    res.json({ response: JSON.parse(data) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.send("OK.");
});

// Chat endpoint
// Sends user's AGENTS.md & message to AI backend without files.
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, agentsmd } = req.body;
    if (!messages) { return res.status(400).json({ error: "Message is required" }); }
    // create job id
    const jobId = crypto.randomUUID();
    // store initial job state
    await redis.setEx(`${JOB_PREFIX}${jobId}`, 60 * 60, JSON.stringify({ status: "processing" }));
    res.json({ error: null, jobId });
    // background work
    (async () => {
      try {
        const aiResponse = await bigThink(messages, agentsmd);
        if (aiResponse.err) {
          await redis.setEx(`${JOB_PREFIX}${jobId}`, 60 * 60, JSON.stringify({ status: "error", error: aiResponse.error_message || "AI failed" }));
        } else {
          await redis.setEx(`${JOB_PREFIX}${jobId}`, 60 * 60, JSON.stringify({ status: "done", response: aiResponse }));
        }
      } catch (err) {
        await redis.setEx(`${JOB_PREFIX}${jobId}`, 60 * 60, JSON.stringify({ status: "error", error: "AI failed" }));
        console.error(err);
      } finally {
        // await redis.del(LOCK_KEY);
      }
    })();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI request failed" });
  }
});

// Serve single page app
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});