const express = require("express");
const prisma = require("../config/prisma");
const authenticate = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const { askLegalAI } = require("../utils/ai");

const router = express.Router();

// Each call hits the Gemini API, so keep this modest: 15 questions per
// 10 minutes per logged-in user.
const askRateLimit = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 15,
    message:
        "You've hit the question limit for now. Please wait a few minutes and try again.",
});

router.post("/", authenticate, askRateLimit, async (req, res) => {
    try {
        const { question, jurisdiction, history } = req.body;

        if (!question || !question.trim()) {
            return res.status(400).json({
                error: "A question is required",
            });
        }

        // India is the default jurisdiction.
        const selectedJurisdiction =
            jurisdiction && jurisdiction.trim()
                ? jurisdiction.trim()
                : "India";

        const result = await askLegalAI(
            question.trim(),
            selectedJurisdiction,
            history
        );

        const saved = await prisma.question.create({
            data: {
                userId: req.userId,
                question: question.trim(),
                answer: result.answer,
                citations: result.citations || [],
                jurisdiction: selectedJurisdiction,
            },
        });

        return res.status(201).json({
            id: saved.id,
            question: saved.question,
            answer: saved.answer,
            citations: saved.citations,
            jurisdiction: saved.jurisdiction,
            disclaimer: result.disclaimer,
            createdAt: saved.createdAt,
        });
    } catch (error) {
        console.error("Ask route error:", error);

        if (
            error.message &&
            error.message.includes("GEMINI_API_KEY")
        ) {
            return res.status(503).json({
                error:
                    "AI is not configured yet — add GEMINI_API_KEY to .env",
            });
        }

        return res.status(500).json({
            error:
                "Couldn't generate an answer right now. Please try again.",
        });
    }
});

module.exports = router;