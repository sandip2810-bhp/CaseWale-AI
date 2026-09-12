// ============================================================
// AUTH GUARD
// ============================================================

if (!getToken()) {
    window.location.href = "index.html";
}

const user = getUser();

document.getElementById("user-label").textContent = user
    ? (user.name || user.email || "Account")
    : "Account";

document.getElementById("logout-btn").addEventListener("click", () => {
    clearSession();
    window.location.href = "index.html";
});


// ============================================================
// ELEMENTS
// ============================================================

const historyList = document.getElementById("history-list");
const historySearch = document.getElementById("history-search");
const historyFrom = document.getElementById("history-from");
const historyTo = document.getElementById("history-to");
const historySort = document.getElementById("history-sort");

const askForm = document.getElementById("ask-form");
const askSubmit = document.getElementById("ask-submit");
const askStatus = document.getElementById("ask-status");
const askError = document.getElementById("ask-error");

const newChatBtn = document.getElementById("new-chat-btn");

// Follow-up context for Ask AI: recent {question, answer} turns sent to the
// backend so the AI can consider what was already discussed. Reset on
// "New Chat"; reseeded when opening a past question from history.
let conversationThread = [];

const threadIndicator = document.getElementById("thread-indicator");

function syncThreadIndicator() {
    if (!threadIndicator) return;

    if (conversationThread.length > 0) {
        threadIndicator.textContent =
            conversationThread.length === 1
                ? "Follow-up — using 1 previous answer as context"
                : `Follow-up — using ${conversationThread.length} previous answers as context`;
        threadIndicator.classList.remove("hidden");
    } else {
        threadIndicator.classList.add("hidden");
    }
}


const questionInput = document.getElementById("question");
const jurisdictionInput = document.getElementById("jurisdiction");

const welcomeView = document.getElementById("welcome-view");
const conversationView =
    document.getElementById("conversation-view");

const convQuestion =
    document.getElementById("conv-question");

const convDocket =
    document.getElementById("conv-docket");

const convAnswer =
    document.getElementById("conv-answer");

const convCitationsWrap =
    document.getElementById("conv-citations-wrap");

const convCitations =
    document.getElementById("conv-citations");

const convDisclaimer =
    document.getElementById("conv-disclaimer");

const convDelete =
    document.getElementById("conv-delete");

const convEdit = document.getElementById("conv-edit");
const convPdf = document.getElementById("conv-pdf");
const convAnswerInput = document.getElementById("conv-answer-input");
const convCitationsEditWrap = document.getElementById("conv-citations-edit-wrap");
const convCitationsEdit = document.getElementById("conv-citations-edit");
const convCitationAdd = document.getElementById("conv-citation-add");
const convEditActions = document.getElementById("conv-edit-actions");
const convSave = document.getElementById("conv-save");
const convCancel = document.getElementById("conv-cancel");

const jurisdictionSelect = document.getElementById("jurisdiction-select");

const historyLoadMoreBtn = document.getElementById("history-load-more");

const themeToggle = document.getElementById("theme-toggle");
const themeToggleIcon = document.getElementById("theme-toggle-icon");

function syncThemeToggleIcon() {
    if (!themeToggleIcon) return;
    const isDark = document.documentElement.classList.contains("dark");
    // Icon shows the mode you'll switch TO on click.
    themeToggleIcon.textContent = isDark ? "light_mode" : "dark_mode";
}

if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        const root = document.documentElement;
        const isDark = root.classList.contains("dark");
        const next = isDark ? "light" : "dark";
        root.classList.remove("dark", "light");
        root.classList.add(next);
        localStorage.setItem("cw_theme", next);
        syncThemeToggleIcon();
    });
}

syncThemeToggleIcon();


// ============================================================
// STATE
// ============================================================

let activeEntryId = null;
let activeEntry = null;
let historyEntries = [];
let historyPage = 1;
let historyTotalPages = 1;


// ============================================================
// HELPERS
// ============================================================

function pick(obj, keys, fallback = "") {
    for (const key of keys) {
        if (
            obj &&
            obj[key] !== undefined &&
            obj[key] !== null
        ) {
            return obj[key];
        }
    }

    return fallback;
}


function normalizeEntry(raw) {
    const nested =
        raw?.result ||
        raw?.data ||
        {};

    return {
        id: pick(
            raw,
            ["id", "_id"],
            pick(nested, ["id", "_id"], null)
        ),

        question: pick(
            raw,
            ["question", "prompt"],
            pick(nested, ["question", "prompt"], "")
        ),

        jurisdiction: pick(
            raw,
            ["jurisdiction"],
            pick(nested, ["jurisdiction"], "India")
        ),

        answer: pick(
            raw,
            ["answer"],
            pick(nested, ["answer"], "")
        ),

        citations: pick(
            raw,
            ["citations"],
            pick(nested, ["citations"], [])
        ),

        disclaimer: pick(
            raw,
            ["disclaimer"],
            pick(nested, ["disclaimer"], "")
        ),

        createdAt: pick(
            raw,
            ["createdAt", "created_at"],
            pick(
                nested,
                ["createdAt", "created_at"],
                null
            )
        ),
    };
}


function docketNumber(entry) {
    const date = entry.createdAt
        ? new Date(entry.createdAt)
        : new Date();

    const stamp =
        `${date.getFullYear()}` +
        `${String(date.getMonth() + 1).padStart(2, "0")}` +
        `${String(date.getDate()).padStart(2, "0")}`;

    const idPart = entry.id
        ? String(entry.id).slice(-4).toUpperCase()
        : "NEW";

    return `CW-${stamp}-${idPart}`;
}


function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}


function escapeHtml(str) {
    const div = document.createElement("div");

    div.textContent = str ?? "";

    return div.innerHTML;
}


// ============================================================
// JURISDICTION SELECT <-> TEXT INPUT
// ============================================================

const JURISDICTION_OPTION_VALUES = Array.from(
    jurisdictionSelect.options
).map((o) => o.value);

function setJurisdiction(value) {
    const jurisdiction = (value || "India").trim();

    if (JURISDICTION_OPTION_VALUES.includes(jurisdiction)) {
        jurisdictionSelect.value = jurisdiction;
        jurisdictionInput.classList.add("hidden");
        jurisdictionInput.value = jurisdiction;
    } else {
        jurisdictionSelect.value = "__custom__";
        jurisdictionInput.classList.remove("hidden");
        jurisdictionInput.value = jurisdiction;
    }
}

jurisdictionSelect.addEventListener("change", () => {
    if (jurisdictionSelect.value === "__custom__") {
        jurisdictionInput.classList.remove("hidden");
        jurisdictionInput.value = "";
        jurisdictionInput.focus();
    } else {
        jurisdictionInput.classList.add("hidden");
        jurisdictionInput.value = jurisdictionSelect.value;
    }
});


// ============================================================
// SHOW WELCOME
// ============================================================

function showWelcome() {
    activeEntryId = null;

    welcomeView.hidden = false;
    conversationView.hidden = true;

    highlightHistoryItem(null);
}


// ============================================================
// RENDER CONVERSATION
// ============================================================

function renderConversation(entry) {
    activeEntryId = entry.id;
    activeEntry = entry;

    exitEditMode();

    welcomeView.hidden = true;
    conversationView.hidden = false;

    convQuestion.textContent =
        entry.question || "—";

    convDocket.textContent =
        docketNumber(entry);

    convAnswer.textContent =
        entry.answer || "No answer returned.";


    // ========================================================
    // CITATIONS
    // ========================================================

    const citations =
        Array.isArray(entry.citations)
            ? entry.citations
            : [];

    convCitations.innerHTML = "";

    if (citations.length > 0) {
        citations.forEach((citation) => {
            const chip =
                document.createElement("div");

            chip.className =
                "px-3 py-2 bg-primary/10 border border-primary/30 text-primary text-[11px] rounded-lg";

            if (typeof citation === "string") {
                chip.textContent = citation;
            } else {
                const label =
                    citation.label ||
                    citation.text ||
                    citation.citation ||
                    "Legal authority";

                const note =
                    citation.note || "";

                const labelElement =
                    document.createElement("a");

                labelElement.className =
                    "font-bold underline decoration-dotted hover:decoration-solid";

                labelElement.textContent = label;

                labelElement.href =
                    "https://indiankanoon.org/search/?formInput=" +
                    encodeURIComponent(label);

                labelElement.target = "_blank";
                labelElement.rel = "noopener noreferrer";
                labelElement.title = "Search this citation on Indian Kanoon";

                chip.appendChild(labelElement);

                if (note) {
                    const noteElement =
                        document.createElement("div");

                    noteElement.className =
                        "text-[10px] text-on-surface-variant mt-1";

                    noteElement.textContent = note;

                    chip.appendChild(noteElement);
                }
            }

            convCitations.appendChild(chip);
        });

        convCitationsWrap.hidden = false;
    } else {
        convCitationsWrap.hidden = true;
    }


    // ========================================================
    // DISCLAIMER
    // ========================================================

    if (entry.disclaimer) {
        convDisclaimer.textContent =
            entry.disclaimer;

        convDisclaimer.hidden = false;
    } else {
        convDisclaimer.textContent =
            "This information is for general informational purposes only and is not a substitute for advice from a qualified lawyer.";

        convDisclaimer.hidden = false;
    }


    // ========================================================
    // DELETE
    // ========================================================

    convDelete.hidden =
        !entry.id;

    conversationView.scrollIntoView({
        behavior: "smooth",
        block: "start",
    });

    highlightHistoryItem(entry.id);
}


// ============================================================
// HISTORY
// ============================================================

function buildHistoryQuery(page = 1) {
    const params = new URLSearchParams();

    const term = historySearch.value.trim();
    if (term) params.set("search", term);

    if (historyFrom.value) params.set("from", historyFrom.value);
    if (historyTo.value) params.set("to", historyTo.value);

    if (historySort.value) params.set("sort", historySort.value);

    params.set("page", String(page));
    params.set("pageSize", "20");

    const qs = params.toString();
    return qs ? `?${qs}` : "";
}

async function loadHistory(selectId = null, { append = false } = {}) {
    const page = append ? historyPage + 1 : 1;

    try {
        const data =
            await apiFetch(`/history${buildHistoryQuery(page)}`, {
                method: "GET",
            });

        const items =
            Array.isArray(data)
                ? data
                : (
                    data.history ||
                    data.items ||
                    []
                );

        const normalized = items.map(normalizeEntry);

        historyEntries = append
            ? historyEntries.concat(normalized)
            : normalized;

        historyPage = page;
        historyTotalPages = Array.isArray(data)
            ? 1
            : (data.totalPages || 1);

        renderHistoryList(historyEntries);

        if (historyLoadMoreBtn) {
            historyLoadMoreBtn.classList.toggle(
                "hidden",
                historyPage >= historyTotalPages
            );
        }

        if (selectId) {
            highlightHistoryItem(selectId);
        }
    } catch (error) {
        historyList.innerHTML = `
            <li class="px-4 py-3 text-xs text-error">
                ${escapeHtml(
                    error.message ||
                    "Unable to load history."
                )}
            </li>
        `;
    }
}


// ============================================================
// RENDER HISTORY LIST
// ============================================================

function renderHistoryList(items) {
    if (!items.length) {
        historyList.innerHTML = `
            <li class="px-4 py-3 text-xs text-on-surface-variant opacity-60">
                No matching questions found.
            </li>
        `;

        return;
    }

    historyList.innerHTML = "";

    items.forEach((entry) => {
        const li =
            document.createElement("li");

        li.dataset.id =
            entry.id || "";

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "history-item w-full text-left flex items-start gap-3 px-4 py-3 rounded-lg font-label-md text-label-md transition-all hover:bg-primary/10";

        button.innerHTML = `
            <span class="material-symbols-outlined text-on-surface-variant text-[18px] mt-0.5">
                description
            </span>

            <span class="min-w-0 flex-1">
                <span class="block text-xs text-on-surface truncate">
                    ${escapeHtml(
                        entry.question ||
                        "Untitled question"
                    )}
                </span>

                <span class="block text-[10px] text-on-surface-variant opacity-60 mt-0.5">
                    ${escapeHtml(
                        entry.jurisdiction ||
                        "India"
                    )}
                    ${entry.createdAt ? " • " : ""}
                    ${escapeHtml(
                        formatDate(entry.createdAt)
                    )}
                </span>
            </span>
        `;

        button.addEventListener(
            "click",
            () => {
                openHistoryEntry(entry.id);
            }
        );

        li.appendChild(button);

        historyList.appendChild(li);
    });
}


// ============================================================
// HIGHLIGHT HISTORY
// ============================================================

function highlightHistoryItem(id) {
    document
        .querySelectorAll("#history-list li")
        .forEach((li) => {
            const button =
                li.querySelector(".history-item");

            if (!button) return;

            const active =
                String(li.dataset.id) ===
                    String(id) &&
                id !== null;

            button.classList.toggle(
                "bg-primary/10",
                active
            );

            button.classList.toggle(
                "text-primary",
                active
            );

            button.classList.toggle(
                "border-l-4",
                active
            );

            button.classList.toggle(
                "border-primary",
                active
            );
        });
}


// ============================================================
// OPEN HISTORY ENTRY
// ============================================================

async function openHistoryEntry(id) {
    if (!id) return;

    try {
        const raw =
            await apiFetch(
                `/history/${id}`,
                {
                    method: "GET",
                }
            );

        const entry =
            normalizeEntry(raw);

        conversationThread = entry.question && entry.answer
            ? [{ question: entry.question, answer: entry.answer }]
            : [];
        syncThreadIndicator();

        renderConversation(entry);

        highlightHistoryItem(id);
    } catch (error) {
        alert(
            error.message ||
            "Unable to open this history entry."
        );
    }
}


// ============================================================
// HISTORY SEARCH & FILTERS
// ============================================================

const debouncedHistoryReload = debounce(() => {
    loadHistory(activeEntryId);
}, 350);

if (historySearch) {
    historySearch.addEventListener("input", debouncedHistoryReload);
}

if (historyFrom) {
    historyFrom.addEventListener("change", () => loadHistory(activeEntryId));
}

if (historyTo) {
    historyTo.addEventListener("change", () => loadHistory(activeEntryId));
}

if (historySort) {
    historySort.addEventListener("change", () => loadHistory(activeEntryId));
}

if (historyLoadMoreBtn) {
    historyLoadMoreBtn.addEventListener("click", () => {
        loadHistory(activeEntryId, { append: true });
    });
}


// ============================================================
// NEW QUESTION
// ============================================================

newChatBtn.addEventListener(
    "click",
    () => {
        askForm.reset();

        conversationThread = [];
        syncThreadIndicator();

        // Keep India as default.
        setJurisdiction("India");

        showWelcome();

        questionInput.focus();
    }
);


// ============================================================
// SUGGESTED PROMPTS
// ============================================================

document
    .querySelectorAll(".prompt-card")
    .forEach((card) => {
        card.addEventListener(
            "click",
            () => {
                questionInput.value =
                    card.dataset.prompt || "";

                setJurisdiction(
                    card.dataset.jurisdiction ||
                    "India"
                );

                questionInput.focus();
            }
        );
    });


// ============================================================
// ASK AI
// ============================================================

askForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        askError.classList.add("hidden");

        askSubmit.disabled = true;

        askStatus.textContent =
            "Reviewing Indian law…";

        const question =
            questionInput.value.trim();

        const jurisdiction =
            jurisdictionInput.value.trim() ||
            "India";

        if (!question) {
            askSubmit.disabled = false;
            askStatus.textContent = "";
            return;
        }

        try {
            const raw =
                await apiFetch(
                    "/ask",
                    {
                        method: "POST",

                        body: JSON.stringify({
                            question,
                            jurisdiction,
                            history: conversationThread,
                        }),
                    }
                );

            const entry =
                normalizeEntry(raw);

            if (!entry.question) {
                entry.question = question;
            }

            if (!entry.jurisdiction) {
                entry.jurisdiction =
                    jurisdiction;
            }

            conversationThread = [
                ...conversationThread,
                { question: entry.question, answer: entry.answer || "" },
            ].slice(-6);
            syncThreadIndicator();

            renderConversation(entry);

            askForm.reset();

            setJurisdiction("India");

            await loadHistory(
                entry.id
            );
        } catch (error) {
            askError.textContent =
                error.message ||
                "Something went wrong while processing your question.";

            askError.classList.remove(
                "hidden"
            );
        } finally {
            askSubmit.disabled = false;
            askStatus.textContent = "";
        }
    }
);


// ============================================================
// EDIT ANSWER & CITATIONS
// ============================================================

function renderCitationEditRow(citation = { label: "", note: "" }) {
    const row = document.createElement("div");
    row.className = "flex items-start gap-2 citation-edit-row";

    row.innerHTML = `
        <div class="flex-1 space-y-1">
            <input
                type="text"
                class="citation-label-input w-full bg-surface-container-highest border border-white/10 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary outline-none"
                placeholder="Citation label (e.g. Consumer Protection Act, 2019, s.2(47))"
            />
            <input
                type="text"
                class="citation-note-input w-full bg-surface-container-highest border border-white/10 rounded-lg px-3 py-2 text-[11px] text-on-surface-variant focus:ring-1 focus:ring-primary outline-none"
                placeholder="What this authority supports"
            />
        </div>
        <button type="button" class="citation-remove-btn text-on-surface-variant hover:text-error mt-2" title="Remove citation">
            <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
    `;

    row.querySelector(".citation-label-input").value = citation.label || "";
    row.querySelector(".citation-note-input").value = citation.note || "";
    row.querySelector(".citation-remove-btn").addEventListener("click", () => row.remove());

    return row;
}

function enterEditMode() {
    if (!activeEntry || !activeEntry.id) return;

    convAnswer.classList.add("hidden");
    convAnswerInput.classList.remove("hidden");
    convAnswerInput.value = activeEntry.answer || "";

    convCitationsWrap.hidden = true;
    convCitationsEditWrap.classList.remove("hidden");
    convCitationsEdit.innerHTML = "";

    const citations = Array.isArray(activeEntry.citations) ? activeEntry.citations : [];
    citations.forEach((c) => {
        convCitationsEdit.appendChild(renderCitationEditRow(c));
    });

    convEditActions.classList.remove("hidden");
    convEdit.classList.add("hidden");
}

function exitEditMode() {
    convAnswer.classList.remove("hidden");
    convAnswerInput.classList.add("hidden");
    convCitationsEditWrap.classList.add("hidden");
    convEditActions.classList.add("hidden");
    convEdit.classList.remove("hidden");
}

convEdit.addEventListener("click", enterEditMode);
convCancel.addEventListener("click", () => {
    exitEditMode();
    if (activeEntry) renderConversation(activeEntry);
});

convCitationAdd.addEventListener("click", () => {
    convCitationsEdit.appendChild(renderCitationEditRow());
});

convSave.addEventListener("click", async () => {
    if (!activeEntry || !activeEntry.id) return;

    const answer = convAnswerInput.value.trim();
    if (!answer) {
        alert("Answer can't be empty.");
        return;
    }

    const citations = Array.from(
        convCitationsEdit.querySelectorAll(".citation-edit-row")
    )
        .map((row) => ({
            label: row.querySelector(".citation-label-input").value.trim(),
            note: row.querySelector(".citation-note-input").value.trim(),
        }))
        .filter((c) => c.label && c.note);

    convSave.disabled = true;
    convSave.textContent = "Saving…";

    try {
        const updated = await apiFetch(`/history/${activeEntry.id}`, {
            method: "PUT",
            body: JSON.stringify({ answer, citations }),
        });

        const entry = normalizeEntry(updated);
        renderConversation(entry);

        // Keep the sidebar list's cached copy in sync too.
        const idx = historyEntries.findIndex((e) => e.id === entry.id);
        if (idx !== -1) historyEntries[idx] = entry;
    } catch (error) {
        alert(error.message || "Unable to save changes.");
    } finally {
        convSave.disabled = false;
        convSave.textContent = "Save changes";
    }
});


// ============================================================
// PDF EXPORT
// ============================================================

function exportConversationPdf(entry) {
    if (!entry || !window.jspdf) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const marginX = 48;
    const pageWidth = doc.internal.pageSize.getWidth() - marginX * 2;
    let y = 56;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("CaseWale — Legal Information Memo", marginX, y);
    y += 20;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`${docketNumber(entry)}  •  Jurisdiction: ${entry.jurisdiction || "India"}`, marginX, y);
    y += 24;
    doc.setTextColor(0);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Question", marginX, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const questionLines = doc.splitTextToSize(entry.question || "", pageWidth);
    doc.text(questionLines, marginX, y);
    y += questionLines.length * 14 + 16;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Answer", marginX, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const answerLines = doc.splitTextToSize(entry.answer || "", pageWidth);
    answerLines.forEach((line) => {
        if (y > 780) {
            doc.addPage();
            y = 56;
        }
        doc.text(line, marginX, y);
        y += 14;
    });
    y += 10;

    const citations = Array.isArray(entry.citations) ? entry.citations : [];
    if (citations.length) {
        if (y > 740) {
            doc.addPage();
            y = 56;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Citations", marginX, y);
        y += 16;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        citations.forEach((c) => {
            const label = typeof c === "string" ? c : (c.label || "");
            const note = typeof c === "string" ? "" : (c.note || "");
            const lines = doc.splitTextToSize(`• ${label}${note ? " — " + note : ""}`, pageWidth);
            lines.forEach((line) => {
                if (y > 780) {
                    doc.addPage();
                    y = 56;
                }
                doc.text(line, marginX, y);
                y += 13;
            });
        });
        y += 10;
    }

    if (y > 750) {
        doc.addPage();
        y = 56;
    }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(140);
    const disclaimerLines = doc.splitTextToSize(
        entry.disclaimer ||
            "This information is for general informational purposes only and is not a substitute for advice from a qualified lawyer.",
        pageWidth
    );
    doc.text(disclaimerLines, marginX, y);

    doc.save(`casewale-${docketNumber(entry)}.pdf`);
}

convPdf.addEventListener("click", () => exportConversationPdf(activeEntry));


// ============================================================
// DELETE HISTORY ENTRY
// ============================================================

convDelete.addEventListener(
    "click",
    async () => {
        if (!activeEntryId) return;

        const confirmed =
            confirm(
                "Delete this entry from your case history?"
            );

        if (!confirmed) return;

        try {
            await apiFetch(
                `/history/${activeEntryId}`,
                {
                    method: "DELETE",
                }
            );

            showWelcome();

            await loadHistory();
        } catch (error) {
            alert(
                error.message ||
                "Unable to delete this entry."
            );
        }
    }
);


// ============================================================
// INITIALIZE
// ============================================================

setJurisdiction(jurisdictionInput.value || "India");

loadHistory();