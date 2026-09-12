require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./src/routes/auth.routes");
const askRoutes = require("./src/routes/ask.routes");
const historyRoutes = require("./src/routes/history.routes");
const draftRoutes = require("./src/routes/draft.routes");
const caseRoutes = require("./src/routes/case.routes");
const { startReminderScheduler } = require("./src/utils/reminderScheduler");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
    res.send("Precedent API is running");
});

app.use("/auth", authRoutes);
app.use("/ask", askRoutes);
app.use("/history", historyRoutes);
app.use("/drafts", draftRoutes);
app.use("/cases", caseRoutes);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startReminderScheduler();
});