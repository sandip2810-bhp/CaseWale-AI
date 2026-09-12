// Periodically checks for drafts whose reminder is due and emails the
// owner. Runs in-process via setInterval — fine for a single-instance
// deployment (Railway/Render free tier etc). If this ever runs on
// multiple instances, move this to a real job queue so reminders aren't
// sent more than once.

const prisma = require("../config/prisma");
const { sendDraftReminderEmail } = require("./email");

async function checkAndSendReminders() {
    const now = new Date();

    // Due, still pending, and not already emailed for *this* remindAt
    // (lastReminderAt gets bumped to "now" right after sending, so a
    // reminder is only ever emailed once unless the user snoozes it to
    // a new remindAt).
    const due = await prisma.draft.findMany({
        where: {
            status: "PENDING",
            remindAt: { lte: now },
        },
        include: { user: true },
    });

    // Prisma's where-builder can't compare two columns against each
    // other (lastReminderAt vs remindAt), so we filter that part in JS:
    // only notify if we haven't already emailed for this remindAt.
    const toNotify = due.filter(
        (d) => !d.lastReminderAt || d.lastReminderAt < d.remindAt
    );

    for (const draft of toNotify) {
        try {
            if (draft.user?.email) {
                await sendDraftReminderEmail(draft.user, draft);
            }
            await prisma.draft.update({
                where: { id: draft.id },
                data: { lastReminderAt: now },
            });
        } catch (err) {
            console.error(
                `Failed to send reminder email for draft ${draft.id}:`,
                err.message
            );
        }
    }

    return toNotify.length;
}

function startReminderScheduler({ intervalMs = 5 * 60 * 1000 } = {}) {
    const tick = async () => {
        try {
            const count = await checkAndSendReminders();
            if (count > 0) {
                console.log(`Sent ${count} draft reminder email(s).`);
            }
        } catch (err) {
            console.error("Reminder scheduler error:", err.message);
        }
    };

    // Run once shortly after boot, then on the interval.
    setTimeout(tick, 10 * 1000);
    return setInterval(tick, intervalMs);
}

module.exports = { startReminderScheduler, checkAndSendReminders };
