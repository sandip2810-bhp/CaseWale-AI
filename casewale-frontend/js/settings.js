// ============================================================
// ELEMENTS
// ============================================================

const settingsBtn = document.getElementById("settings-btn");
const settingsBackdrop = document.getElementById("settings-modal-backdrop");
const settingsCloseBtn = document.getElementById("settings-close-btn");
const settingsCancelBtn = document.getElementById("settings-cancel-btn");
const settingsSaveBtn = document.getElementById("settings-save-btn");

const settingsEmail = document.getElementById("settings-email");
const settingsName = document.getElementById("settings-name");
const settingsCurrentPassword = document.getElementById("settings-current-password");
const settingsNewPassword = document.getElementById("settings-new-password");

const settingsError = document.getElementById("settings-error");
const settingsSuccess = document.getElementById("settings-success");


// ============================================================
// OPEN / CLOSE
// ============================================================

function openSettingsModal() {
    const currentUser = getUser();

    settingsEmail.textContent = currentUser?.email || "—";
    settingsName.value = currentUser?.name || "";
    settingsCurrentPassword.value = "";
    settingsNewPassword.value = "";

    settingsError.classList.add("hidden");
    settingsSuccess.classList.add("hidden");

    settingsBackdrop.hidden = false;
}

function closeSettingsModal() {
    settingsBackdrop.hidden = true;
}

settingsBtn.addEventListener("click", openSettingsModal);
settingsCloseBtn.addEventListener("click", closeSettingsModal);
settingsCancelBtn.addEventListener("click", closeSettingsModal);

// Click on the dark backdrop (outside the card) also closes it.
settingsBackdrop.addEventListener("click", (event) => {
    if (event.target === settingsBackdrop) closeSettingsModal();
});


// ============================================================
// SAVE
// ============================================================

settingsSaveBtn.addEventListener("click", async () => {
    settingsError.classList.add("hidden");
    settingsSuccess.classList.add("hidden");

    const name = settingsName.value.trim();
    const currentPassword = settingsCurrentPassword.value;
    const newPassword = settingsNewPassword.value;

    if (newPassword && newPassword.length < 8) {
        settingsError.textContent = "New password must be at least 8 characters.";
        settingsError.classList.remove("hidden");
        return;
    }

    if (newPassword && !currentPassword) {
        settingsError.textContent = "Enter your current password to set a new one.";
        settingsError.classList.remove("hidden");
        return;
    }

    const payload = { name };
    if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
    }

    settingsSaveBtn.disabled = true;
    settingsSaveBtn.textContent = "Saving…";

    try {
        const updatedUser = await apiFetch("/auth/me", {
            method: "PUT",
            body: JSON.stringify(payload),
        });

        // Keep the session's cached user info (name) in sync everywhere.
        setSession(getToken(), updatedUser);

        const userLabel = document.getElementById("user-label");
        if (userLabel) {
            userLabel.textContent = updatedUser.name || updatedUser.email || "Account";
        }

        settingsCurrentPassword.value = "";
        settingsNewPassword.value = "";

        settingsSuccess.textContent = "Saved.";
        settingsSuccess.classList.remove("hidden");
    } catch (error) {
        settingsError.textContent = error.message || "Unable to save changes.";
        settingsError.classList.remove("hidden");
    } finally {
        settingsSaveBtn.disabled = false;
        settingsSaveBtn.textContent = "Save Changes";
    }
});