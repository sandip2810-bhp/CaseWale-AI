const express = require("express");
const fs = require("fs");
const path = require("path");
const prisma = require("../config/prisma");
const authenticate = require("../middleware/auth");
const { upload, UPLOAD_DIR } = require("../config/upload");

const router = express.Router();

const CASE_STATUSES = ["OPEN", "PENDING", "CLOSED"];
const EVENT_TYPES = ["HEARING", "DEADLINE", "MEETING", "OTHER"];

// ============================================================
// CASES
// ============================================================

// Create a case
router.post("/", authenticate, async (req, res) => {
    try {
        const {
            title,
            caseNumber,
            court,
            clientName,
            opposingParty,
            jurisdiction,
            status,
            description,
            filedDate,
            nextHearing,
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: "Case title is required" });
        }

        const data = {
            userId: req.userId,
            title: title.trim(),
            caseNumber: caseNumber?.trim() || null,
            court: court?.trim() || null,
            clientName: clientName?.trim() || null,
            opposingParty: opposingParty?.trim() || null,
            jurisdiction: jurisdiction?.trim() || null,
            description: description?.trim() || null,
            filedDate: filedDate ? new Date(filedDate) : null,
            nextHearing: nextHearing ? new Date(nextHearing) : null,
        };

        if (status && CASE_STATUSES.includes(status.toUpperCase())) {
            data.status = status.toUpperCase();
        }

        const created = await prisma.case.create({ data });
        return res.status(201).json(created);
    } catch (error) {
        console.error("Create case error:", error);
        return res.status(500).json({ error: "Couldn't create the case" });
    }
});

// List cases (search, filter by status, paginated)
router.get("/", authenticate, async (req, res) => {
    try {
        const { search, status, sort } = req.query;

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(
            50,
            Math.max(1, parseInt(req.query.pageSize, 10) || 20)
        );

        const where = { userId: req.userId };

        if (status && CASE_STATUSES.includes(status.toUpperCase())) {
            where.status = status.toUpperCase();
        }

        if (search && search.trim()) {
            const term = search.trim();
            where.OR = [
                { title: { contains: term, mode: "insensitive" } },
                { caseNumber: { contains: term, mode: "insensitive" } },
                { clientName: { contains: term, mode: "insensitive" } },
                { opposingParty: { contains: term, mode: "insensitive" } },
                { description: { contains: term, mode: "insensitive" } },
            ];
        }

        const [items, total] = await Promise.all([
            prisma.case.findMany({
                where,
                orderBy: { updatedAt: sort === "oldest" ? "asc" : "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    _count: { select: { documents: true, events: true } },
                },
            }),
            prisma.case.count({ where }),
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

// Aggregate calendar: every event across every case for this user,
// optionally scoped to a date range (?from=&to=). Placed before "/:id"
// so "/calendar" isn't swallowed by the :id param route.
router.get("/calendar", authenticate, async (req, res) => {
    try {
        const { from, to } = req.query;
        const where = { userId: req.userId };

        if (from || to) {
            where.eventDate = {};
            if (from && !isNaN(new Date(from).getTime())) {
                where.eventDate.gte = new Date(from);
            }
            if (to && !isNaN(new Date(to).getTime())) {
                where.eventDate.lte = new Date(to);
            }
        }

        const events = await prisma.caseEvent.findMany({
            where,
            orderBy: { eventDate: "asc" },
            include: { case: { select: { id: true, title: true, status: true } } },
        });

        res.json({ items: events });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get one case with its documents + events
router.get("/:id", authenticate, async (req, res) => {
    try {
        const item = await prisma.case.findFirst({
            where: { id: req.params.id, userId: req.userId },
            include: {
                documents: { orderBy: { uploadedAt: "desc" } },
                events: { orderBy: { eventDate: "asc" } },
            },
        });
        if (!item) return res.status(404).json({ error: "Case not found" });
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a case
router.put("/:id", authenticate, async (req, res) => {
    try {
        const existing = await prisma.case.findFirst({
            where: { id: req.params.id, userId: req.userId },
        });
        if (!existing) return res.status(404).json({ error: "Case not found" });

        const {
            title,
            caseNumber,
            court,
            clientName,
            opposingParty,
            jurisdiction,
            status,
            description,
            filedDate,
            nextHearing,
        } = req.body;

        const data = {};

        if (title !== undefined) {
            if (!title.trim()) {
                return res.status(400).json({ error: "Case title cannot be empty" });
            }
            data.title = title.trim();
        }
        if (caseNumber !== undefined) data.caseNumber = caseNumber?.trim() || null;
        if (court !== undefined) data.court = court?.trim() || null;
        if (clientName !== undefined) data.clientName = clientName?.trim() || null;
        if (opposingParty !== undefined) data.opposingParty = opposingParty?.trim() || null;
        if (jurisdiction !== undefined) data.jurisdiction = jurisdiction?.trim() || null;
        if (description !== undefined) data.description = description?.trim() || null;
        if (filedDate !== undefined) data.filedDate = filedDate ? new Date(filedDate) : null;
        if (nextHearing !== undefined) data.nextHearing = nextHearing ? new Date(nextHearing) : null;
        if (status !== undefined && CASE_STATUSES.includes(status.toUpperCase())) {
            data.status = status.toUpperCase();
        }

        const updated = await prisma.case.update({
            where: { id: req.params.id },
            data,
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a case (cascades to its documents + events)
router.delete("/:id", authenticate, async (req, res) => {
    try {
        const existing = await prisma.case.findFirst({
            where: { id: req.params.id, userId: req.userId },
            include: { documents: true },
        });
        if (!existing) return res.status(404).json({ error: "Case not found" });

        await prisma.case.delete({ where: { id: req.params.id } });

        // Best-effort cleanup of uploaded files on disk.
        for (const doc of existing.documents) {
            const filePath = path.join(UPLOAD_DIR, path.basename(doc.fileUrl));
            fs.unlink(filePath, () => {});
        }

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// DOCUMENTS
// ============================================================

// Upload a document to a case
router.post(
    "/:id/documents",
    authenticate,
    (req, res, next) => {
        upload.single("file")(req, res, (err) => {
            if (err) return res.status(400).json({ error: err.message });
            next();
        });
    },
    async (req, res) => {
        try {
            const caseItem = await prisma.case.findFirst({
                where: { id: req.params.id, userId: req.userId },
            });
            if (!caseItem) {
                if (req.file) fs.unlink(req.file.path, () => {});
                return res.status(404).json({ error: "Case not found" });
            }

            if (!req.file) {
                return res.status(400).json({ error: "No file uploaded" });
            }

            const doc = await prisma.caseDocument.create({
                data: {
                    caseId: caseItem.id,
                    userId: req.userId,
                    fileName: req.file.originalname,
                    fileUrl: `/uploads/cases/${req.file.filename}`,
                    fileType: req.file.mimetype,
                    fileSize: req.file.size,
                },
            });

            res.status(201).json(doc);
        } catch (error) {
            console.error("Upload document error:", error);
            res.status(500).json({ error: "Couldn't upload the document" });
        }
    }
);

// Delete a document
router.delete("/:id/documents/:docId", authenticate, async (req, res) => {
    try {
        const doc = await prisma.caseDocument.findFirst({
            where: {
                id: req.params.docId,
                caseId: req.params.id,
                userId: req.userId,
            },
        });
        if (!doc) return res.status(404).json({ error: "Document not found" });

        await prisma.caseDocument.delete({ where: { id: doc.id } });

        const filePath = path.join(UPLOAD_DIR, path.basename(doc.fileUrl));
        fs.unlink(filePath, () => {});

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// CALENDAR / EVENTS (per case)
// ============================================================

// Create an event on a case
router.post("/:id/events", authenticate, async (req, res) => {
    try {
        const caseItem = await prisma.case.findFirst({
            where: { id: req.params.id, userId: req.userId },
        });
        if (!caseItem) return res.status(404).json({ error: "Case not found" });

        const { title, eventDate, eventType, notes } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: "Event title is required" });
        }
        if (!eventDate || isNaN(new Date(eventDate).getTime())) {
            return res.status(400).json({ error: "A valid eventDate is required" });
        }

        const data = {
            caseId: caseItem.id,
            userId: req.userId,
            title: title.trim(),
            eventDate: new Date(eventDate),
            notes: notes?.trim() || null,
        };

        if (eventType && EVENT_TYPES.includes(eventType.toUpperCase())) {
            data.eventType = eventType.toUpperCase();
        }

        const event = await prisma.caseEvent.create({ data });

        // Keep the case's "nextHearing" convenience field roughly in sync
        // when a HEARING is added in the future.
        if (
            data.eventType === "HEARING" &&
            data.eventDate > new Date() &&
            (!caseItem.nextHearing || data.eventDate < caseItem.nextHearing)
        ) {
            await prisma.case.update({
                where: { id: caseItem.id },
                data: { nextHearing: data.eventDate },
            });
        }

        res.status(201).json(event);
    } catch (error) {
        console.error("Create event error:", error);
        res.status(500).json({ error: "Couldn't create the event" });
    }
});

// Update an event
router.put("/:id/events/:eventId", authenticate, async (req, res) => {
    try {
        const existing = await prisma.caseEvent.findFirst({
            where: {
                id: req.params.eventId,
                caseId: req.params.id,
                userId: req.userId,
            },
        });
        if (!existing) return res.status(404).json({ error: "Event not found" });

        const { title, eventDate, eventType, notes } = req.body;
        const data = {};

        if (title !== undefined) {
            if (!title.trim()) {
                return res.status(400).json({ error: "Event title cannot be empty" });
            }
            data.title = title.trim();
        }
        if (eventDate !== undefined) {
            if (isNaN(new Date(eventDate).getTime())) {
                return res.status(400).json({ error: "Invalid eventDate" });
            }
            data.eventDate = new Date(eventDate);
        }
        if (notes !== undefined) data.notes = notes?.trim() || null;
        if (eventType !== undefined && EVENT_TYPES.includes(eventType.toUpperCase())) {
            data.eventType = eventType.toUpperCase();
        }

        const updated = await prisma.caseEvent.update({
            where: { id: existing.id },
            data,
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete an event
router.delete("/:id/events/:eventId", authenticate, async (req, res) => {
    try {
        const existing = await prisma.caseEvent.findFirst({
            where: {
                id: req.params.eventId,
                caseId: req.params.id,
                userId: req.userId,
            },
        });
        if (!existing) return res.status(404).json({ error: "Event not found" });

        await prisma.caseEvent.delete({ where: { id: existing.id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
