const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("../config/prisma");
const authenticate = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const { sendPasswordResetEmail } = require("../utils/email");

const router = express.Router();

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

// Keep this generous but not open — resetting a password is cheap to
// abuse for spamming someone's inbox otherwise.
const forgotPasswordRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many reset requests. Please try again later.",
});

router.post("/signup", async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters" });
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ error: "An account with this email already exists" });
        }

        const hashed = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, password: hashed, name },
        });

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.status(201).json({
            token,
            user: { id: user.id, email: user.email, name: user.name },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.json({
            token,
            user: { id: user.id, email: user.email, name: user.name },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get("/me", authenticate, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { id: true, email: true, name: true, createdAt: true },
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update the logged-in user's name and/or password.
// Body: { name?: string, currentPassword?: string, newPassword?: string }
// currentPassword is required whenever newPassword is provided.
router.put("/me", authenticate, async (req, res) => {
    try {
        const { name, currentPassword, newPassword } = req.body;

        const data = {};

        if (name !== undefined) {
            data.name = name.trim() ? name.trim() : null;
        }

        if (newPassword) {
            if (newPassword.length < 8) {
                return res.status(400).json({
                    error: "New password must be at least 8 characters",
                });
            }

            const existingUser = await prisma.user.findUnique({
                where: { id: req.userId },
            });

            if (!existingUser) {
                return res.status(404).json({ error: "User not found" });
            }

            const match = await bcrypt.compare(
                currentPassword || "",
                existingUser.password
            );

            if (!match) {
                return res.status(401).json({
                    error: "Current password is incorrect",
                });
            }

            data.password = await bcrypt.hash(newPassword, 10);
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ error: "Nothing to update" });
        }

        const updated = await prisma.user.update({
            where: { id: req.userId },
            data,
            select: { id: true, email: true, name: true, createdAt: true },
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Request a password reset email. Always responds the same way whether
// or not the email exists, so this can't be used to check which emails
// have accounts.
router.post("/forgot-password", forgotPasswordRateLimit, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !email.trim()) {
            return res.status(400).json({ error: "Email is required" });
        }

        const user = await prisma.user.findUnique({
            where: { email: email.trim() },
        });

        if (user) {
            const token = crypto.randomBytes(32).toString("hex");
            const resetTokenHash = hashToken(token);
            const resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 min

            await prisma.user.update({
                where: { id: user.id },
                data: { resetTokenHash, resetTokenExpiry },
            });

            try {
                await sendPasswordResetEmail(user, token);
            } catch (err) {
                console.error("Failed to send password reset email:", err.message);
            }
        }

        res.json({
            message:
                "If an account exists for that email, a reset link has been sent.",
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Complete a password reset using the token emailed by /forgot-password.
router.post("/reset-password", async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;

        if (!email || !token || !newPassword) {
            return res.status(400).json({
                error: "Email, token and newPassword are required",
            });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({
                error: "New password must be at least 8 characters",
            });
        }

        const user = await prisma.user.findUnique({
            where: { email: email.trim() },
        });

        if (
            !user ||
            !user.resetTokenHash ||
            !user.resetTokenExpiry ||
            user.resetTokenExpiry < new Date() ||
            user.resetTokenHash !== hashToken(token)
        ) {
            return res.status(400).json({
                error: "This reset link is invalid or has expired",
            });
        }

        const hashed = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashed,
                resetTokenHash: null,
                resetTokenExpiry: null,
            },
        });

        res.json({ message: "Password reset successfully. You can now log in." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;