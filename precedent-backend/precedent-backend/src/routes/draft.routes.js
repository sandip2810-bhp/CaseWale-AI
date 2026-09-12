const express = require("express");
const prisma = require("../config/prisma");
const authenticate = require("../middleware/auth");
const { sendDraftContentEmail } = require("../utils/email");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Create a new draft
router.post("/", authenticate, async (req, res) => {
    try {
        const { title, content, remindAt, recipientEmail } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({
                error: "Draft content is required",
            });
        }

        const trimmedRecipient =
            typeof recipientEmail === "string" ? recipientEmail.trim() : "";

        if (trimmedRecipient && !EMAIL_RE.test(trimmedRecipient)) {
            return res.status(400).json({
                error: "That doesn't look like a valid email address",
            });
        }

        const draft = await prisma.draft.create({
            data: {
                userId: req.userId,
                title: title && title.trim() ? title.trim() : null,
                content: content.trim(),
                remindAt: remindAt ? new Date(remindAt) : null,
            },
        });

        if (!trimmedRecipient) {
            return res.status(201).json(draft);
        }

        // Email was requested — send it, then mark the draft SENT so it
        // stops showing up as a pending reminder. The draft is already
        // saved either way; email failure is reported but non-fatal.
        try {
            const sender = await prisma.user.findUnique({
                where: { id: req.userId },
                select: { name: true, email: true },
            });

            await sendDraftContentEmail(trimmedRecipient, draft, sender);

            const sent = await prisma.draft.update({
                where: { id: draft.id },
                data: { status: "SENT", remindAt: null },
            });

            return res.status(201).json({ ...sent, emailedTo: trimmedRecipient });
        } catch (emailError) {
            console.error("Send draft email error:", emailError);
            return res.status(201).json({
                ...draft,
                emailError:
                    "Draft was saved, but the email couldn't be sent. Check RESEND_API_KEY / RESEND_FROM_EMAIL.",
            });
        }
    } catch (error) {
        console.error("Create draft error:", error);
        return res.status(500).json({ error: "Couldn't save the draft" });
    }
});


// List all drafts for the logged-in user (newest edited first, with filters)
router.get("/", authenticate, async (req, res) => {
    try {
        const { search, status, from, to, sort } = req.query;

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(
            50,
            Math.max(1, parseInt(req.query.pageSize, 10) || 20)
        );

        const where = { userId: req.userId };

        if (status && ["PENDING", "SENT"].includes(status.toUpperCase())) {
            where.status = status.toUpperCase();
        }

        if (search && search.trim()) {
            const term = search.trim();
            where.OR = [
                { title: { contains: term, mode: "insensitive" } },
                { content: { contains: term, mode: "insensitive" } },
            ];
        }

        if (from || to) {
            where.updatedAt = {};
            if (from && !isNaN(new Date(from).getTime())) {
                where.updatedAt.gte = new Date(from);
            }
            if (to && !isNaN(new Date(to).getTime())) {
                where.updatedAt.lte = new Date(to);
            }
        }

        const [drafts, total] = await Promise.all([
            prisma.draft.findMany({
                where,
                orderBy: { updatedAt: sort === "oldest" ? "asc" : "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.draft.count({ where }),
        ]);

        const now = new Date();
        const withReminderFlag = drafts.map((d) => ({
            ...d,
            reminderDue:
                d.status === "PENDING" &&
                d.remindAt !== null &&
                d.remindAt <= now,
        }));

        res.json({
            items: withReminderFlag,
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List drafts whose reminder is due (pending notices)
router.get("/reminders", authenticate, async (req, res) => {
    try {
        const now = new Date();
        const due = await prisma.draft.findMany({
            where: {
                userId: req.userId,
                status: "PENDING",
                remindAt: { lte: now },
            },
            orderBy: { remindAt: "asc" },
        });
        res.json(due);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get a single draft
router.get("/:id", authenticate, async (req, res) => {
    try {
        const draft = await prisma.draft.findFirst({
            where: { id: req.params.id, userId: req.userId },
        });
        if (!draft) return res.status(404).json({ error: "Draft not found" });
        res.json(draft);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a draft (title, content, remindAt)
router.put("/:id", authenticate, async (req, res) => {
    try {
        const existing = await prisma.draft.findFirst({
            where: { id: req.params.id, userId: req.userId },
        });
        if (!existing) return res.status(404).json({ error: "Draft not found" });

        const { title, content, remindAt, recipientEmail } = req.body;

        const trimmedRecipient =
            typeof recipientEmail === "string" ? recipientEmail.trim() : "";

        if (trimmedRecipient && !EMAIL_RE.test(trimmedRecipient)) {
            return res.status(400).json({
                error: "That doesn't look like a valid email address",
            });
        }

        const updated = await prisma.draft.update({
            where: { id: req.params.id },
            data: {
                title: title !== undefined ? (title ? title.trim() : null) : existing.title,
                content: content !== undefined && content.trim() ? content.trim() : existing.content,
                remindAt: remindAt !== undefined ? (remindAt ? new Date(remindAt) : null) : existing.remindAt,
            },
        });

        if (!trimmedRecipient) {
            return res.json(updated);
        }

        try {
            const sender = await prisma.user.findUnique({
                where: { id: req.userId },
                select: { name: true, email: true },
            });

            await sendDraftContentEmail(trimmedRecipient, updated, sender);

            const sent = await prisma.draft.update({
                where: { id: updated.id },
                data: { status: "SENT", remindAt: null },
            });

            return res.json({ ...sent, emailedTo: trimmedRecipient });
        } catch (emailError) {
            console.error("Send draft email error:", emailError);
            return res.json({
                ...updated,
                emailError:
                    "Draft was saved, but the email couldn't be sent. Check RESEND_API_KEY / RESEND_FROM_EMAIL.",
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mark a draft's reminder as acknowledged (pushes remindAt away / clears it)
router.post("/:id/remind", authenticate, async (req, res) => {
    try {
        const existing = await prisma.draft.findFirst({
            where: { id: req.params.id, userId: req.userId },
        });
        if (!existing) return res.status(404).json({ error: "Draft not found" });

        const { snoozeUntil } = req.body;

        const updated = await prisma.draft.update({
            where: { id: req.params.id },
            data: {
                lastReminderAt: new Date(),
                remindAt: snoozeUntil ? new Date(snoozeUntil) : null,
            },
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mark a draft as sent
router.post("/:id/send", authenticate, async (req, res) => {
    try {
        const existing = await prisma.draft.findFirst({
            where: { id: req.params.id, userId: req.userId },
        });
        if (!existing) return res.status(404).json({ error: "Draft not found" });

        const updated = await prisma.draft.update({
            where: { id: req.params.id },
            data: { status: "SENT", remindAt: null },
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a draft
router.delete("/:id", authenticate, async (req, res) => {
    try {
        const existing = await prisma.draft.findFirst({
            where: { id: req.params.id, userId: req.userId },
        });
        if (!existing) return res.status(404).json({ error: "Draft not found" });

        await prisma.draft.delete({ where: { id: req.params.id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;