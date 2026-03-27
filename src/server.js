const express = require("express");
const { fillPassportForm } = require("./form-filler");

const app = express();
app.use(express.json({ limit: "50mb" }));

// Auth middleware — set API_SECRET env var on Railway
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const authHeader = req.headers["authorization"];
  const expected = process.env.API_SECRET;
  if (!expected) return next(); // no secret configured, skip auth
  if (!authHeader || authHeader !== `Bearer ${expected}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/generate", async (req, res) => {
  const startTime = Date.now();
  try {
    const data = req.body;
    if (!data || !data.lastName || !data.firstName) {
      return res.status(400).json({ error: "Missing required applicant data (lastName, firstName)" });
    }

    console.log(`[${new Date().toISOString()}] Starting form fill for ${data.firstName} ${data.lastName}`);

    const pdfBase64 = await fillPassportForm(data);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${new Date().toISOString()}] Completed in ${elapsed}s`);

    res.json({
      success: true,
      pdf: pdfBase64,
      generatedAt: new Date().toISOString(),
      elapsedSeconds: parseFloat(elapsed),
    });
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[${new Date().toISOString()}] Error after ${elapsed}s:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message || "Form fill failed",
      elapsedSeconds: parseFloat(elapsed),
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`pptform-automator listening on port ${PORT}`);
});
