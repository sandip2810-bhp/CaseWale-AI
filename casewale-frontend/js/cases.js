// ============================================================
// CASES — Case Analysis Dashboard
// Loads after dashboard.js and drafts.js, so it can reuse their
// globals (escapeHtml, formatDate, formatDateTime, debounce,
// chatSidebarPanel, draftsSidebarPanel, chatScrollEl, chatErrorOuter,
// chatInputOuter, draftsView) without redeclaring them.
// ============================================================

const CASE_STATUSES = ["OPEN", "PENDING", "CLOSED"];
const EVENT_TYPES = ["HEARING", "DEADLINE", "MEETING", "OTHER"];

const EVENT_TYPE_ICON = {
    HEARING: "gavel",
    DEADLINE: "alarm",
    MEETING: "groups",
    OTHER: "event_note",
};

// ============================================================
// ELEMENTS
// ============================================================

const tabCasesBtn = document.getElementById("tab-cases-btn");
const casesSidebarPanel = document.getElementById("cases-sidebar-panel");
const casesView = document.getElementById("cases-view");

const newCaseBtn = document.getElementById("new-case-btn");
const viewCalendarBtn = document.getElementById("view-calendar-btn");
const casesList = document.getElementById("cases-list");
const casesSearch = document.getElementById("cases-search");
const casesStatusFilter = document.getElementById("cases-status-filter");
const casesSort = document.getElementById("cases-sort");
const casesLoadMoreBtn = document.getElementById("cases-load-more");

const caseEditorSubview = document.getElementById("case-editor-subview");
const caseCalendarSubview = document.getElementById("case-calendar-subview");

const caseEditorTitle = document.getElementById("case-editor-title");
const caseStatusPill = document.getElementById("case-status-pill");
const caseTitleInput = document.getElementById("case-title");
const caseNumberInput = document.getElementById("case-number");
const caseStatusInput = document.getElementById("case-status");
const caseCourtInput = document.getElementById("case-court");
const caseJurisdictionInput = document.getElementById("case-jurisdiction");
const caseClientNameInput = document.getElementById("case-client-name");
const caseOpposingPartyInput = document.getElementById("case-opposing-party");
const caseFiledDateInput = document.getElementById("case-filed-date");
const caseNextHearingInput = document.getElementById("case-next-hearing");
const caseDescriptionInput = document.getElementById("case-description");
const caseError = document.getElementById("case-error");
const caseSaveBtn = document.getElementById("case-save-btn");
const caseDeleteBtn = document.getElementById("case-delete-btn");
const caseStatusNote = document.getElementById("case-status-note");

const caseDocumentsSection = document.getElementById("case-documents-section");
const caseDocumentInput = document.getElementById("case-document-input");
const caseDocumentError = document.getElementById("case-document-error");
const caseDocumentsList = document.getElementById("case-documents-list");

const caseEventsSection = document.getElementById("case-events-section");
const caseEventForm = document.getElementById("case-event-form");
const eventTitleInput = document.getElementById("event-title");
const eventDateInput = document.getElementById("event-date");
const eventTypeInput = document.getElementById("event-type");
const eventNotesInput = document.getElementById("event-notes");
const caseEventError = document.getElementById("case-event-error");
const caseEventsList = document.getElementById("case-events-list");

const calendarBackBtn = document.getElementById("calendar-back-btn");
const calendarPrevBtn = document.getElementById("calendar-prev-btn");
const calendarNextBtn = document.getElementById("calendar-next-btn");
const calendarMonthLabel = document.getElementById("calendar-month-label");
const calendarGrid = document.getElementById("calendar-grid");
const calendarDayLabel = document.getElementById("calendar-day-label");
const calendarDayEvents = document.getElementById("calendar-day-events");


// ============================================================
// STATE
// ============================================================

let caseEntries = [];
let activeCaseId = null;
let casesPage = 1;
let casesTotalPages = 1;

let calendarViewDate = new Date(); // first-of-month anchor
let calendarEventsByDay = {}; // "YYYY-MM-DD" -> [events]
let selectedCalendarDay = null;


// ============================================================
// TAB SWITCHING
// ============================================================

function activateCasesTab() {
    tabCasesBtn.classList.add("bg-primary", "text-on-primary");
    tabCasesBtn.classList.remove("bg-surface-container-highest", "text-on-surface-variant");

    tabChatBtn.classList.remove("bg-primary", "text-on-primary");
    tabChatBtn.classList.add("bg-surface-container-highest", "text-on-surface-variant");
    tabDraftsBtn.classList.remove("bg-primary", "text-on-primary");
    tabDraftsBtn.classList.add("bg-surface-container-highest", "text-on-surface-variant");

    chatSidebarPanel.hidden = true;
    draftsSidebarPanel.hidden = true;
    chatScrollEl.hidden = true;
    chatErrorOuter.hidden = true;
    chatInputOuter.hidden = true;
    draftsView.hidden = true;

    casesSidebarPanel.hidden = false;
    casesView.hidden = false;

    showEditorSubview();
    loadCases();
}

tabCasesBtn.addEventListener("click", activateCasesTab);


function showEditorSubview() {
    caseEditorSubview.hidden = false;
    caseCalendarSubview.hidden = true;
}

function showCalendarSubview() {
    caseEditorSubview.hidden = true;
    caseCalendarSubview.hidden = false;
    loadCalendarMonth();
}

viewCalendarBtn.addEventListener("click", showCalendarSubview);
calendarBackBtn.addEventListener("click", showEditorSubview);


// ============================================================
// LOAD CASES (sidebar list)
// ============================================================

function buildCasesQuery(page = 1) {
    const params = new URLSearchParams();
    if (casesSearch.value.trim()) params.set("search", casesSearch.value.trim());
    if (casesStatusFilter.value) params.set("status", casesStatusFilter.value);
    if (casesSort.value) params.set("sort", casesSort.value);
    params.set("page", String(page));
    params.set("pageSize", "20");
    return params.toString();
}

async function loadCases(selectId = null, { append = false } = {}) {
    try {
        if (!append) {
            casesList.innerHTML = `<li class="px-4 py-3 text-xs text-on-surface-variant opacity-60">Loading…</li>`;
            casesPage = 1;
        }

        const data = await apiFetch(`/cases?${buildCasesQuery(casesPage)}`);

        caseEntries = append ? caseEntries.concat(data.items) : data.items;
        casesTotalPages = data.totalPages || 1;

        renderCasesList(caseEntries);

        if (casesLoadMoreBtn) {
            casesLoadMoreBtn.classList.toggle("hidden", casesPage >= casesTotalPages);
        }

        if (selectId) highlightCaseItem(selectId);
    } catch (error) {
        casesList.innerHTML = `<li class="px-4 py-3 text-xs text-error">${escapeHtml(error.message)}</li>`;
    }
}

if (casesLoadMoreBtn) {
    casesLoadMoreBtn.addEventListener("click", () => {
        casesPage += 1;
        loadCases(activeCaseId, { append: true });
    });
}

const debouncedCasesReload = debounce(() => loadCases(activeCaseId), 350);
casesSearch.addEventListener("input", debouncedCasesReload);
casesStatusFilter.addEventListener("change", () => loadCases(activeCaseId));
casesSort.addEventListener("change", () => loadCases(activeCaseId));


function caseStatusColor(status) {
    if (status === "CLOSED") return "bg-surface-container-highest text-on-surface-variant";
    if (status === "PENDING") return "bg-secondary/20 text-secondary";
    return "bg-primary/20 text-primary";
}

function renderCasesList(items) {
    if (!items.length) {
        casesList.innerHTML = `
            <li class="px-4 py-3 text-xs text-on-surface-variant opacity-60">
                No cases yet. Create one to get started.
            </li>
        `;
        return;
    }

    casesList.innerHTML = "";

    items.forEach((entry) => {
        const li = document.createElement("li");
        li.dataset.id = entry.id || "";

        const button = document.createElement("button");
        button.type = "button";
        button.className =
            "case-item w-full text-left flex items-start gap-3 px-4 py-3 rounded-lg font-label-md text-label-md transition-all hover:bg-primary/10";

        const statusBadge = `<span class="inline-block mt-0.5 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${caseStatusColor(entry.status)}">${escapeHtml(entry.status || "OPEN")}</span>`;

        button.innerHTML = `
            <span class="material-symbols-outlined text-on-surface-variant text-[16px] mt-0.5">folder</span>
            <span class="min-w-0 flex-1 space-y-1">
                <span class="block text-xs text-on-surface truncate">${escapeHtml(entry.title || "Untitled case")}</span>
                <span class="flex items-center gap-2 flex-wrap">
                    ${statusBadge}
                    ${entry.caseNumber ? `<span class="text-[10px] text-on-surface-variant opacity-60">${escapeHtml(entry.caseNumber)}</span>` : ""}
                </span>
                ${entry.nextHearing ? `<span class="block text-[10px] text-primary opacity-80">Next hearing: ${escapeHtml(formatDate(entry.nextHearing))}</span>` : ""}
            </span>
        `;

        button.addEventListener("click", () => openCase(entry.id));

        li.appendChild(button);
        casesList.appendChild(li);
    });
}

function highlightCaseItem(id) {
    casesList.querySelectorAll("[data-id]").forEach((li) => {
        const btn = li.querySelector("button");
        if (!btn) return;
        if (li.dataset.id === id) {
            btn.classList.add("bg-primary/10");
        } else {
            btn.classList.remove("bg-primary/10");
        }
    });
}


// ============================================================
// CASE EDITOR
// ============================================================

function resetCaseEditor() {
    activeCaseId = null;
    caseEditorTitle.textContent = "New Case";
    caseStatusPill.classList.add("hidden");

    caseTitleInput.value = "";
    caseNumberInput.value = "";
    caseStatusInput.value = "OPEN";
    caseCourtInput.value = "";
    caseJurisdictionInput.value = "";
    caseClientNameInput.value = "";
    caseOpposingPartyInput.value = "";
    caseFiledDateInput.value = "";
    caseNextHearingInput.value = "";
    caseDescriptionInput.value = "";

    caseError.classList.add("hidden");
    caseDeleteBtn.hidden = true;
    caseStatusNote.textContent = "";

    caseDocumentsSection.hidden = true;
    caseEventsSection.hidden = true;
    caseDocumentsList.innerHTML = "";
    caseEventsList.innerHTML = "";

    highlightCaseItem(null);
    showEditorSubview();
}

newCaseBtn.addEventListener("click", resetCaseEditor);

function toDateInputValue(isoString) {
    if (!isoString) return "";
    return String(isoString).slice(0, 10);
}

async function openCase(id) {
    try {
        const item = await apiFetch(`/cases/${id}`);

        activeCaseId = item.id;
        caseEditorTitle.textContent = item.title || "Untitled case";

        caseStatusPill.textContent = item.status || "OPEN";
        caseStatusPill.className =
            "shrink-0 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full " +
            caseStatusColor(item.status);
        caseStatusPill.classList.remove("hidden");

        caseTitleInput.value = item.title || "";
        caseNumberInput.value = item.caseNumber || "";
        caseStatusInput.value = item.status || "OPEN";
        caseCourtInput.value = item.court || "";
        caseJurisdictionInput.value = item.jurisdiction || "";
        caseClientNameInput.value = item.clientName || "";
        caseOpposingPartyInput.value = item.opposingParty || "";
        caseFiledDateInput.value = toDateInputValue(item.filedDate);
        caseNextHearingInput.value = toDateInputValue(item.nextHearing);
        caseDescriptionInput.value = item.description || "";

        caseError.classList.add("hidden");
        caseDeleteBtn.hidden = false;
        caseStatusNote.textContent = item.updatedAt
            ? `Last updated ${formatDateTime(item.updatedAt)}`
            : "";

        caseDocumentsSection.hidden = false;
        caseEventsSection.hidden = false;
        renderDocuments(item.documents || []);
        renderEvents(item.events || []);

        showEditorSubview();
        highlightCaseItem(id);
    } catch (error) {
        alert(error.message || "Couldn't open this case.");
    }
}

caseSaveBtn.addEventListener("click", async () => {
    caseError.classList.add("hidden");

    const title = caseTitleInput.value.trim();
    if (!title) {
        caseError.textContent = "Case title is required.";
        caseError.classList.remove("hidden");
        return;
    }

    const payload = {
        title,
        caseNumber: caseNumberInput.value.trim() || undefined,
        status: caseStatusInput.value,
        court: caseCourtInput.value.trim() || undefined,
        jurisdiction: caseJurisdictionInput.value.trim() || undefined,
        clientName: caseClientNameInput.value.trim() || undefined,
        opposingParty: caseOpposingPartyInput.value.trim() || undefined,
        filedDate: caseFiledDateInput.value || undefined,
        nextHearing: caseNextHearingInput.value || undefined,
        description: caseDescriptionInput.value.trim() || undefined,
    };

    caseSaveBtn.disabled = true;
    caseSaveBtn.textContent = "Saving…";

    try {
        let saved;
        if (activeCaseId) {
            saved = await apiFetch(`/cases/${activeCaseId}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
        } else {
            saved = await apiFetch("/cases", {
                method: "POST",
                body: JSON.stringify(payload),
            });
        }

        await loadCases(saved.id);
        await openCase(saved.id);
    } catch (error) {
        caseError.textContent = error.message || "Couldn't save this case.";
        caseError.classList.remove("hidden");
    } finally {
        caseSaveBtn.disabled = false;
        caseSaveBtn.textContent = "Save Case";
    }
});

caseDeleteBtn.addEventListener("click", async () => {
    if (!activeCaseId) return;
    if (!confirm("Delete this case? Its documents and events will be deleted too.")) return;

    try {
        await apiFetch(`/cases/${activeCaseId}`, { method: "DELETE" });
        resetCaseEditor();
        await loadCases();
    } catch (error) {
        alert(error.message || "Couldn't delete this case.");
    }
});


// ============================================================
// DOCUMENTS
// ============================================================

function fileTypeIcon(fileType) {
    if (!fileType) return "description";
    if (fileType.includes("pdf")) return "picture_as_pdf";
    if (fileType.startsWith("image/")) return "image";
    if (fileType.includes("word")) return "article";
    return "description";
}

function renderDocuments(docs) {
    if (!docs.length) {
        caseDocumentsList.innerHTML = `<li class="text-xs text-on-surface-variant opacity-60">No documents yet.</li>`;
        return;
    }

    caseDocumentsList.innerHTML = "";

    docs.forEach((doc) => {
        const li = document.createElement("li");
        li.className =
            "flex items-center gap-3 bg-surface-container-highest rounded-lg px-3 py-2 border border-white/5";

        const sizeKb = doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : "";

        li.innerHTML = `
            <span class="material-symbols-outlined text-primary text-[20px]">${fileTypeIcon(doc.fileType)}</span>
            <a
                href="${API_BASE_URL}${doc.fileUrl}"
                target="_blank"
                rel="noopener"
                class="min-w-0 flex-1 text-xs text-on-surface truncate hover:text-primary hover:underline"
                title="${escapeHtml(doc.fileName)}"
            >${escapeHtml(doc.fileName)}</a>
            <span class="text-[10px] text-on-surface-variant opacity-60 shrink-0">${sizeKb}</span>
        `;

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "shrink-0 text-on-surface-variant hover:text-error transition-colors";
        deleteBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">delete</span>`;
        deleteBtn.addEventListener("click", async () => {
            if (!confirm(`Delete "${doc.fileName}"?`)) return;
            try {
                await apiFetch(`/cases/${activeCaseId}/documents/${doc.id}`, { method: "DELETE" });
                await openCase(activeCaseId);
            } catch (error) {
                alert(error.message || "Couldn't delete this document.");
            }
        });

        li.appendChild(deleteBtn);
        caseDocumentsList.appendChild(li);
    });
}

// File upload needs multipart/form-data, so this bypasses apiFetch
// (which always sends application/json) and talks to fetch directly.
async function uploadCaseDocument(file) {
    caseDocumentError.classList.add("hidden");

    if (!activeCaseId) {
        caseDocumentError.textContent = "Save the case before uploading documents.";
        caseDocumentError.classList.remove("hidden");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const token = getToken();

    try {
        const res = await fetch(`${API_BASE_URL}/cases/${activeCaseId}/documents`, {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
        });

        const text = await res.text();
        const data = text ? JSON.parse(text) : null;

        if (!res.ok) {
            throw new Error((data && data.error) || `Upload failed (${res.status})`);
        }

        await openCase(activeCaseId);
    } catch (error) {
        caseDocumentError.textContent = error.message || "Couldn't upload this file.";
        caseDocumentError.classList.remove("hidden");
    }
}

caseDocumentInput.addEventListener("change", () => {
    const file = caseDocumentInput.files && caseDocumentInput.files[0];
    if (file) uploadCaseDocument(file);
    caseDocumentInput.value = "";
});


// ============================================================
// EVENTS
// ============================================================

function renderEvents(events) {
    if (!events.length) {
        caseEventsList.innerHTML = `<li class="text-xs text-on-surface-variant opacity-60">No events yet.</li>`;
        return;
    }

    caseEventsList.innerHTML = "";

    events.forEach((ev) => {
        const li = document.createElement("li");
        li.className =
            "flex items-start gap-3 bg-surface-container-highest rounded-lg px-3 py-2 border border-white/5";

        li.innerHTML = `
            <span class="material-symbols-outlined text-primary text-[18px] mt-0.5">${EVENT_TYPE_ICON[ev.eventType] || "event_note"}</span>
            <span class="min-w-0 flex-1">
                <span class="block text-xs text-on-surface">${escapeHtml(ev.title)}</span>
                <span class="block text-[10px] text-on-surface-variant opacity-60">
                    ${escapeHtml(formatDateTime(ev.eventDate))} • ${escapeHtml(ev.eventType || "OTHER")}
                </span>
                ${ev.notes ? `<span class="block text-[10px] text-on-surface-variant opacity-80 mt-0.5">${escapeHtml(ev.notes)}</span>` : ""}
            </span>
        `;

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "shrink-0 text-on-surface-variant hover:text-error transition-colors";
        deleteBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">delete</span>`;
        deleteBtn.addEventListener("click", async () => {
            if (!confirm(`Delete "${ev.title}"?`)) return;
            try {
                await apiFetch(`/cases/${activeCaseId}/events/${ev.id}`, { method: "DELETE" });
                await openCase(activeCaseId);
            } catch (error) {
                alert(error.message || "Couldn't delete this event.");
            }
        });

        li.appendChild(deleteBtn);
        caseEventsList.appendChild(li);
    });
}

caseEventForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    caseEventError.classList.add("hidden");

    if (!activeCaseId) {
        caseEventError.textContent = "Save the case before adding events.";
        caseEventError.classList.remove("hidden");
        return;
    }

    const title = eventTitleInput.value.trim();
    const eventDate = fromDatetimeLocalValue(eventDateInput.value);

    if (!title || !eventDate) {
        caseEventError.textContent = "Title and date/time are required.";
        caseEventError.classList.remove("hidden");
        return;
    }

    try {
        await apiFetch(`/cases/${activeCaseId}/events`, {
            method: "POST",
            body: JSON.stringify({
                title,
                eventDate,
                eventType: eventTypeInput.value,
                notes: eventNotesInput.value.trim() || undefined,
            }),
        });

        caseEventForm.reset();
        await openCase(activeCaseId);
    } catch (error) {
        caseEventError.textContent = error.message || "Couldn't add this event.";
        caseEventError.classList.remove("hidden");
    }
});


// ============================================================
// CALENDAR
// ============================================================

function dateKey(d) {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

async function loadCalendarMonth() {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();

    const from = new Date(year, month, 1);
    const to = new Date(year, month + 1, 0, 23, 59, 59);

    calendarMonthLabel.textContent = calendarViewDate.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
    });

    try {
        const data = await apiFetch(`/cases/calendar?from=${from.toISOString()}&to=${to.toISOString()}`);
        calendarEventsByDay = {};
        (data.items || []).forEach((ev) => {
            const key = dateKey(ev.eventDate);
            if (!calendarEventsByDay[key]) calendarEventsByDay[key] = [];
            calendarEventsByDay[key].push(ev);
        });
        renderCalendarGrid(year, month);
    } catch (error) {
        calendarGrid.innerHTML = `<p class="col-span-7 text-xs text-error">${escapeHtml(error.message)}</p>`;
    }
}

function renderCalendarGrid(year, month) {
    calendarGrid.innerHTML = "";

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDay.getDay(); // 0 = Sunday
    const todayKey = dateKey(new Date());

    for (let i = 0; i < startOffset; i++) {
        const blank = document.createElement("div");
        calendarGrid.appendChild(blank);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, month, day);
        const key = dateKey(cellDate);
        const hasEvents = !!calendarEventsByDay[key];

        const cell = document.createElement("button");
        cell.type = "button";
        cell.className =
            "aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative transition-all " +
            (key === todayKey
                ? "border border-primary text-primary font-bold"
                : "text-on-surface-variant hover:bg-primary/10");

        cell.innerHTML = `
            <span>${day}</span>
            ${hasEvents ? `<span class="w-1.5 h-1.5 rounded-full bg-primary mt-0.5"></span>` : ""}
        `;

        cell.addEventListener("click", () => selectCalendarDay(key, cellDate));
        calendarGrid.appendChild(cell);
    }

    if (selectedCalendarDay && calendarEventsByDay[selectedCalendarDay]) {
        renderCalendarDayEvents(selectedCalendarDay);
    } else {
        calendarDayLabel.textContent = "Upcoming";
        calendarDayEvents.innerHTML = `<li class="text-xs text-on-surface-variant opacity-60">Select a day with a dot to see its events.</li>`;
    }
}

function selectCalendarDay(key, dateObj) {
    selectedCalendarDay = key;
    calendarDayLabel.textContent = dateObj.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
    });
    renderCalendarDayEvents(key);
}

function renderCalendarDayEvents(key) {
    const events = calendarEventsByDay[key] || [];

    if (!events.length) {
        calendarDayEvents.innerHTML = `<li class="text-xs text-on-surface-variant opacity-60">No events on this day.</li>`;
        return;
    }

    calendarDayEvents.innerHTML = "";

    events.forEach((ev) => {
        const li = document.createElement("li");
        li.className =
            "flex items-start gap-3 bg-surface-container-highest rounded-lg px-3 py-2 border border-white/5";

        li.innerHTML = `
            <span class="material-symbols-outlined text-primary text-[18px] mt-0.5">${EVENT_TYPE_ICON[ev.eventType] || "event_note"}</span>
            <span class="min-w-0 flex-1">
                <span class="block text-xs text-on-surface">${escapeHtml(ev.title)}</span>
                <span class="block text-[10px] text-on-surface-variant opacity-60">
                    ${escapeHtml(formatDateTime(ev.eventDate))}
                    ${ev.case ? " • " + escapeHtml(ev.case.title) : ""}
                </span>
            </span>
        `;

        if (ev.case && ev.case.id) {
            const openBtn = document.createElement("button");
            openBtn.type = "button";
            openBtn.className = "shrink-0 text-[10px] font-bold uppercase tracking-widest text-primary hover:underline";
            openBtn.textContent = "Open case";
            openBtn.addEventListener("click", async () => {
                showEditorSubview();
                await loadCases(ev.case.id);
                await openCase(ev.case.id);
            });
            li.appendChild(openBtn);
        }

        calendarDayEvents.appendChild(li);
    });
}

calendarPrevBtn.addEventListener("click", () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1);
    selectedCalendarDay = null;
    loadCalendarMonth();
});

calendarNextBtn.addEventListener("click", () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1);
    selectedCalendarDay = null;
    loadCalendarMonth();
});
