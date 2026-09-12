const express = require("express");
const prisma = require("../config/prisma");
const authenticate = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
    try {
        const { search, jurisdiction, from, to, sort } = req.query;

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(
            50,
            Math.max(1, parseInt(req.query.pageSize, 10) || 20)
        );

        const where = { userId: req.userId };

        if (jurisdiction && jurisdiction.trim()) {
            where.jurisdiction = {
                equals: jurisdiction.trim(),
                mode: "insensitive",
            };
        }

        if (search && search.trim()) {
            const term = search.trim();
            where.OR = [
                { question: { contains: term, mode: "insensitive" } },
                { answer: { contains: term, mode: "insensitive" } },
            ];
        }

        if (from || to) {
            where.createdAt = {};
            if (from && !isNaN(new Date(from).getTime())) {
                where.createdAt.gte = new Date(from);
            }
            if (to && !isNaN(new Date(to).getTime())) {
                where.createdAt.lte = new Date(to);
            }
        }

        const [items, total] = await Promise.all([
            prisma.question.findMany({
                where,
                orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.question.count({ where }),
        ]);

        res.json({
            items,
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get("/:id", authenticate, async (req, res) => {
    try {
        const item = await prisma.question.findFirst({
            where: { id: req.params.id, userId: req.userId },
        });
        if (!item) return res.status(404).json({ error: "Not found" });
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Edit the saved answer text and/or citations for a past question.
// Lets a user correct/tighten an AI answer before it goes into a draft.
// Body: { answer?: string, citations?: Array<{label, note}> }
router.put("/:id", authenticate, async (req, res) => {
    try {
        const existing = await prisma.question.findFirst({
            where: { id: req.params.id, userId: req.userId },
        });
        if (!existing) return res.status(404).json({ error: "Not found" });

        const { answer, citations } = req.body;
        const data = {};

        if (answer !== undefined) {
            if (!answer || !answer.trim()) {
                return res.status(400).json({ error: "Answer cannot be empty" });
            }
            data.answer = answer.trim();
        }

        if (citations !== undefined) {
            if (!Array.isArray(citations)) {
                return res.status(400).json({ error: "Citations must be an array" });
            }
            data.citations = citations
                .filter(
                    (c) =>
                        c &&
                        typeof c === "object" &&
                        typeof c.label === "string" &&
                        c.label.trim() &&
                        typeof c.note === "string" &&
                        c.note.trim()
                )
                .map((c) => ({ label: c.label.trim(), note: c.note.trim() }));
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ error: "Nothing to update" });
        }

        const updated = await prisma.question.update({
            where: { id: req.params.id },
            data,
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete("/:id", authenticate, async (req, res) => {
    try {
        const item = await prisma.question.findFirst({
            where: { id: req.params.id, userId: req.userId },
        });
        if (!item) return res.status(404).json({ error: "Not found" });

        await prisma.question.delete({ where: { id: req.params.id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;