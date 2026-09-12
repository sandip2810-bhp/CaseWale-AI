// ============================================================
// ELEMENTS
// ============================================================

const tabChatBtn = document.getElementById("tab-chat-btn");
const tabDraftsBtn = document.getElementById("tab-drafts-btn");
const draftsTabBadge = document.getElementById("drafts-tab-badge");

const chatSidebarPanel = document.getElementById("chat-sidebar-panel");
const draftsSidebarPanel = document.getElementById("drafts-sidebar-panel");

const chatScrollEl = document.getElementById("chat-scroll");
const chatErrorOuter = document.getElementById("chat-error-outer");
const chatInputOuter = document.getElementById("chat-input-outer");
const draftsView = document.getElementById("drafts-view");

const newDraftBtn = document.getElementById("new-draft-btn");
const draftsList = document.getElementById("drafts-list");
const draftsReminderBadge = document.getElementById("drafts-reminder-badge");
const draftsSearch = document.getElementById("drafts-search");
const draftsStatusFilter = document.getElementById("drafts-status-filter");
const draftsSort = document.getElementById("drafts-sort");

const draftsRemindersBanner = document.getElementById("drafts-reminders-banner");
const draftsRemindersList = document.getElementById("drafts-reminders-list");

const draftEditorTitle = document.getElementById("draft-editor-title");
const draftStatusPill = document.getElementById("draft-status-pill");
const draftTitleInput = document.getElementById("draft-title");
const draftContentInput = document.getElementById("draft-content");
const draftRemindAtInput = document.getElementById("draft-remind-at");
const draftRecipientEmailInput = document.getElementById("draft-recipient-email");
const draftError = document.getElementById("draft-error");
const draftSaveBtn = document.getElementById("draft-save-btn");
const draftSendBtn = document.getElementById("draft-send-btn");
const draftDeleteBtn = document.getElementById("draft-delete-btn");
const draftStatusNote = document.getElementById("draft-status-note");
const draftPdfBtn = document.getElementById("draft-pdf-btn");
const draftsLoadMoreBtn = document.getElementById("drafts-load-more");


// ============================================================
// STATE
// ============================================================

let draftEntries = [];
let activeDraftId = null;
let draftsPage = 1;
let draftsTotalPages = 1;


// ============================================================
// HELPERS
// ============================================================

function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

// "2026-08-09T14:30:00.000Z" -> "2026-08-09T14:30" (for <input type="datetime-local">)
function toDatetimeLocalValue(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
}

// "2026-08-09T14:30" -> ISO string, or null if empty
function fromDatetimeLocalValue(value) {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
}

function showDraftError(message) {
    draftError.textContent = message;
    draftError.classList.remove("hidden");
}
function hideDraftError() {
    draftError.classList.add("hidden");
}


// ============================================================
// TAB SWITCHING
// ============================================================

function resetCasesTabStyle() {
    const casesBtn = document.getElementById("tab-cases-btn");
    const casesSidebar = document.getElementById("cases-sidebar-panel");
    const casesMainView = document.getElementById("cases-view");
    if (casesBtn) {
        casesBtn.classList.remove("bg-primary", "text-on-primary");
        casesBtn.classList.add("bg-surface-container-highest", "text-on-surface-variant");
    }
    if (casesSidebar) casesSidebar.hidden = true;
    if (casesMainView) casesMainView.hidden = true;
}

function activateChatTab() {
    tabChatBtn.classList.add("bg-primary", "text-on-primary");
    tabChatBtn.classList.remove("bg-surface-container-highest", "text-on-surface-variant");

    tabDraftsBtn.classList.remove("bg-primary", "text-on-primary");
    tabDraftsBtn.classList.add("bg-surface-container-highest", "text-on-surface-variant");

    chatSidebarPanel.hidden = false;
    draftsSidebarPanel.hidden = true;

    chatScrollEl.hidden = false;
    chatErrorOuter.hidden = false;
    chatInputOuter.hidden = false;
    draftsView.hidden = true;

    resetCasesTabStyle();
}

function activateDraftsTab() {
    tabDraftsBtn.classList.add("bg-primary", "text-on-primary");
    tabDraftsBtn.classList.remove("bg-surface-container-highest", "text-on-surface-variant");

    tabChatBtn.classList.remove("bg-primary", "text-on-primary");
    tabChatBtn.classList.add("bg-surface-container-highest", "text-on-surface-variant");

    chatSidebarPanel.hidden = true;
    draftsSidebarPanel.hidden = false;

    chatScrollEl.hidden = true;
    chatErrorOuter.hidden = true;
    chatInputOuter.hidden = true;
    draftsView.hidden = false;

    resetCasesTabStyle();

    loadDrafts();
    loadReminders();
}

tabChatBtn.addEventListener("click", activateChatTab);
tabDraftsBtn.addEventListener("click", activateDraftsTab);


// ============================================================
// LOAD DRAFTS
// ============================================================

function buildDraftsQuery(page = 1) {
    const params = new URLSearchParams();

    const term = draftsSearch.value.trim();
    if (term) params.set("search", term);

    if (draftsStatusFilter.value) params.set("status", draftsStatusFilter.value);
    if (draftsSort.value) params.set("sort", draftsSort.value);

    params.set("page", String(page));
    params.set("pageSize", "20");

    const qs = params.toString();
    return qs ? `?${qs}` : "";
}

async function loadDrafts(selectId = null, { append = false } = {}) {
    const page = append ? draftsPage + 1 : 1;

    try {
        const data = await apiFetch(`/drafts${buildDraftsQuery(page)}`, { method: "GET" });

        const items = Array.isArray(data) ? data : (data.items || []);

        draftEntries = append ? draftEntries.concat(items) : items;
        draftsPage = page;
        draftsTotalPages = Array.isArray(data) ? 1 : (data.totalPages || 1);

        renderDraftsList(draftEntries);

        if (!append) {
            // Reminders come from a separate, unpaginated endpoint, but
            // it's convenient to also refresh the badge off page 1.
            renderReminders(draftEntries.filter((d) => d.reminderDue));
        }

        if (draftsLoadMoreBtn) {
            draftsLoadMoreBtn.classList.toggle("hidden", draftsPage >= draftsTotalPages);
        }

        if (selectId) highlightDraftItem(selectId);
    } catch (error) {
        draftsList.innerHTML = `
            <li class="px-4 py-3 text-xs text-error">
                ${escapeHtml(error.message || "Unable to load drafts.")}
            </li>
        `;
    }
}

const debouncedDraftsReload = debounce(() => {
    loadDrafts(activeDraftId);
}, 350);

draftsSearch.addEventListener("input", debouncedDraftsReload);
draftsStatusFilter.addEventListener("change", () => loadDrafts(activeDraftId));
draftsSort.addEventListener("change", () => loadDrafts(activeDraftId));

if (draftsLoadMoreBtn) {
    draftsLoadMoreBtn.addEventListener("click", () => {
        loadDrafts(activeDraftId, { append: true });
    });
}


// ============================================================
// RENDER DRAFTS LIST (sidebar)
// ============================================================

function renderDraftsList(items) {
    if (!items.length) {
        draftsList.innerHTML = `
            <li class="px-4 py-3 text-xs text-on-surface-variant opacity-60">
                No drafts yet.
            </li>
        `;
        return;
    }

    draftsList.innerHTML = "";

    items.forEach((entry) => {
        const li = document.createElement("li");
        li.dataset.id = entry.id || "";

        const button = document.createElement("button");
        button.type = "button";
        button.className =
            "draft-item w-full text-left flex items-start gap-3 px-4 py-3 rounded-lg font-label-md text-label-md transition-all hover:bg-primary/10";

        const isSent = entry.status === "SENT";
        const dueBadge = entry.reminderDue
            ? `<span class="material-symbols-outlined text-primary text-[16px] mt-0.5" title="Reminder due">notifications_active</span>`
            : `<span class="material-symbols-outlined text-on-surface-variant text-[16px] mt-0.5">draft</span>`;

        button.innerHTML = `
            ${dueBadge}
            <span class="min-w-0 flex-1">
                <span class="block text-xs text-on-surface truncate">
                    ${escapeHtml(entry.title || "Untitled draft")}
                </span>
                <span class="block text-[10px] text-on-surface-variant opacity-60 mt-0.5">
                    ${isSent ? "Sent" : "Pending"}
                    ${entry.updatedAt ? " • " + escapeHtml(formatDateTime(entry.updatedAt)) : ""}
                </span>
            </span>
        `;

        button.addEventListener("click", () => openDraft(entry.id));

        li.appendChild(button);
        draftsList.appendChild(li);
    });
}


// ============================================================
// REMINDERS (banner + badges)
// ============================================================

function renderReminders(due) {
    if (due.length > 0) {
        draftsReminderBadge.textContent = String(due.length);
        draftsReminderBadge.classList.remove("hidden");

        draftsTabBadge.textContent = due.length > 9 ? "9+" : String(due.length);
        draftsTabBadge.classList.remove("hidden");
        draftsTabBadge.classList.add("flex");
    } else {
        draftsReminderBadge.classList.add("hidden");
        draftsTabBadge.classList.add("hidden");
        draftsTabBadge.classList.remove("flex");
    }

    if (due.length === 0) {
        draftsRemindersBanner.classList.add("hidden");
        draftsRemindersList.innerHTML = "";
        return;
    }

    draftsRemindersBanner.classList.remove("hidden");
    draftsRemindersList.innerHTML = "";

    due.forEach((entry) => {
        const li = document.createElement("li");
        li.className =
            "flex items-center justify-between gap-3 bg-primary/10 border border-primary/20 rounded-lg px-4 py-2";

        li.innerHTML = `
            <span class="text-xs text-on-surface truncate">
                ${escapeHtml(entry.title || "Untitled draft")}
                <span class="text-on-surface-variant opacity-60 ml-1">
                    — was due ${escapeHtml(formatDateTime(entry.remindAt))}
                </span>
            </span>
        `;

        const openBtn = document.createElement("button");
        openBtn.type = "button";
        openBtn.className = "shrink-0 text-[10px] font-bold uppercase tracking-widest text-primary hover:underline";
        openBtn.textContent = "Open";
        openBtn.addEventListener("click", async () => {
            // The due draft might not be in the currently-filtered list —
            // reset filters so it's guaranteed to be there, then open it.
            draftsSearch.value = "";
            draftsStatusFilter.value = "";
            await loadDrafts(entry.id);
            openDraft(entry.id);
        });

        li.appendChild(openBtn);
        draftsRemindersList.appendChild(li);
    });
}

async function loadReminders() {
    try {
        const due = await apiFetch("/drafts/reminders", { method: "GET" });
        renderReminders(Array.isArray(due) ? due : []);
    } catch (error) {
        // Non-critical — don't block the rest of the UI on this.
    }
}


// ============================================================
// HIGHLIGHT ACTIVE DRAFT
// ============================================================

function highlightDraftItem(id) {
    document.querySelectorAll("#drafts-list li").forEach((li) => {
        const button = li.querySelector(".draft-item");
        if (!button) return;

        const active = String(li.dataset.id) === String(id) && id !== null;

        button.classList.toggle("bg-primary/10", active);
        button.classList.toggle("text-primary", active);
        button.classList.toggle("border-l-4", active);
        button.classList.toggle("border-primary", active);
    });
}


// ============================================================
// EDITOR: NEW / OPEN
// ============================================================

function resetEditor() {
    activeDraftId = null;
    draftEditorTitle.textContent = "New Draft";
    draftTitleInput.value = "";
    draftContentInput.value = "";
    draftRemindAtInput.value = "";
    draftRecipientEmailInput.value = "";
    draftStatusPill.classList.add("hidden");
    draftSendBtn.hidden = true;
    draftDeleteBtn.hidden = true;
    if (draftPdfBtn) draftPdfBtn.hidden = true;
    draftStatusNote.textContent = "";
    hideDraftError();
    highlightDraftItem(null);
}

function openDraft(id) {
    const entry = draftEntries.find((d) => String(d.id) === String(id));
    if (!entry) return;

    activeDraftId = entry.id;
    draftEditorTitle.textContent = "Edit Draft";
    draftTitleInput.value = entry.title || "";
    draftContentInput.value = entry.content || "";
    draftRemindAtInput.value = toDatetimeLocalValue(entry.remindAt);
    draftRecipientEmailInput.value = "";

    const isSent = entry.status === "SENT";
    draftStatusPill.textContent = isSent ? "Sent" : "Pending";
    draftStatusPill.className = isSent
        ? "shrink-0 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-surface-container-highest text-on-surface-variant"
        : "shrink-0 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-primary/20 text-primary";
    draftStatusPill.classList.remove("hidden");

    draftSendBtn.hidden = isSent;
    draftDeleteBtn.hidden = false;
    if (draftPdfBtn) draftPdfBtn.hidden = false;
    draftStatusNote.textContent = "";
    hideDraftError();

    highlightDraftItem(id);
    draftContentInput.focus();
}

newDraftBtn.addEventListener("click", resetEditor);


// ============================================================
// PDF EXPORT
// ============================================================

function exportDraftPdf() {
    if (!window.jspdf) return;

    const title = draftTitleInput.value.trim() || "Untitled draft";
    const content = draftContentInput.value.trim();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const marginX = 48;
    const pageWidth = doc.internal.pageSize.getWidth() - marginX * 2;
    let y = 56;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    const titleLines = doc.splitTextToSize(title, pageWidth);
    doc.text(titleLines, marginX, y);
    y += titleLines.length * 20 + 12;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`CaseWale draft — generated ${new Date().toLocaleDateString()}`, marginX, y);
    y += 24;
    doc.setTextColor(0);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const contentLines = doc.splitTextToSize(content || "(No content yet)", pageWidth);
    contentLines.forEach((line) => {
        if (y > 780) {
            doc.addPage();
            y = 56;
        }
        doc.text(line, marginX, y);
        y += 15;
    });

    const safeName = title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "draft";
    doc.save(`casewale-draft-${safeName}.pdf`);
}

if (draftPdfBtn) {
    draftPdfBtn.addEventListener("click", exportDraftPdf);
}


// ============================================================
// SAVE DRAFT (create or update)
// ============================================================

draftSaveBtn.addEventListener("click", async () => {
    hideDraftError();

    const content = draftContentInput.value.trim();
    if (!content) {
        showDraftError("Draft content is required.");
        return;
    }

    const payload = {
        title: draftTitleInput.value.trim() || null,
        content,
        remindAt: fromDatetimeLocalValue(draftRemindAtInput.value),
        recipientEmail: draftRecipientEmailInput.value.trim() || null,
    };

    draftSaveBtn.disabled = true;
    draftStatusNote.textContent = "Saving…";

    try {
        let saved;
        if (activeDraftId) {
            saved = await apiFetch(`/drafts/${activeDraftId}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
        } else {
            saved = await apiFetch("/drafts", {
                method: "POST",
                body: JSON.stringify(payload),
            });
        }

        await loadDrafts(saved.id);
        await loadReminders();
        openDraft(saved.id);

        if (saved.emailedTo) {
            draftStatusNote.textContent = `Saved and emailed to ${saved.emailedTo}.`;
            draftRecipientEmailInput.value = "";
        } else if (saved.emailError) {
            draftStatusNote.textContent = "Saved.";
            showDraftError(saved.emailError);
        } else {
            draftStatusNote.textContent = "Saved.";
        }
    } catch (error) {
        showDraftError(error.message || "Unable to save this draft.");
        draftStatusNote.textContent = "";
    } finally {
        draftSaveBtn.disabled = false;
    }
});



// ============================================================
// MARK AS SENT
// ============================================================

draftSendBtn.addEventListener("click", async () => {
    if (!activeDraftId) return;

    const confirmed = confirm("Mark this draft as sent? It will stop reminding you.");
    if (!confirmed) return;

    draftSendBtn.disabled = true;

    try {
        const updated = await apiFetch(`/drafts/${activeDraftId}/send`, {
            method: "POST",
        });

        await loadDrafts(updated.id);
        await loadReminders();
        openDraft(updated.id);
    } catch (error) {
        showDraftError(error.message || "Unable to mark this draft as sent.");
    } finally {
        draftSendBtn.disabled = false;
    }
});


// ============================================================
// DELETE DRAFT
// ============================================================

draftDeleteBtn.addEventListener("click", async () => {
    if (!activeDraftId) return;

    const confirmed = confirm("Delete this draft? This can't be undone.");
    if (!confirmed) return;

    try {
        await apiFetch(`/drafts/${activeDraftId}`, { method: "DELETE" });
        resetEditor();
        await loadDrafts();
        await loadReminders();
    } catch (error) {
        showDraftError(error.message || "Unable to delete this draft.");
    }
});