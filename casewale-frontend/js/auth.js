document.getElementById("api-url-note").textContent = API_BASE_URL;

const params = new URLSearchParams(window.location.search);
const arrivingAtResetLink = params.get("view") === "reset-password";

if (getToken() && !arrivingAtResetLink) {
  window.location.href = "dashboard.html";
}

const viewLogin = document.getElementById("view-login");
const viewSignup = document.getElementById("view-signup");
const viewForgot = document.getElementById("view-forgot");
const viewResetPassword = document.getElementById("view-reset-password");

function showView(view) {
  [viewLogin, viewSignup, viewForgot, viewResetPassword].forEach((v) => {
    v.hidden = v !== view;
  });
}

document.getElementById("go-signup").addEventListener("click", () => showView(viewSignup));
document.getElementById("go-login").addEventListener("click", () => showView(viewLogin));
document.getElementById("go-forgot").addEventListener("click", () => showView(viewForgot));
document.getElementById("go-login-2").addEventListener("click", () => showView(viewLogin));

if (arrivingAtResetLink) {
  showView(viewResetPassword);
}

document.querySelectorAll("[data-toggle-pw]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.togglePw);
    const icon = btn.querySelector(".material-symbols-outlined");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    icon.textContent = show ? "visibility_off" : "visibility";
  });
});

function showError(el, message) {
  el.textContent = message;
  el.classList.remove("hidden");
}
function hideError(el) {
  el.classList.add("hidden");
}

// ---- Login ----
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginSubmit = document.getElementById("login-submit");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError(loginError);
  loginSubmit.disabled = true;
  loginSubmit.textContent = "Signing in…";

  try {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    setSession(data.token, data.user);
    window.location.href = "dashboard.html";
  } catch (err) {
    showError(loginError, err.message);
  } finally {
    loginSubmit.disabled = false;
    loginSubmit.textContent = "Access Vault";
  }
});

// ---- Signup ----
const signupForm = document.getElementById("signup-form");
const signupError = document.getElementById("signup-error");
const signupSubmit = document.getElementById("signup-submit");

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError(signupError);
  signupSubmit.disabled = true;
  signupSubmit.textContent = "Creating account…";

  try {
    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;

    const data = await apiFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, name: name || undefined }),
    });

    setSession(data.token, data.user);
    window.location.href = "dashboard.html";
  } catch (err) {
    showError(signupError, err.message);
  } finally {
    signupSubmit.disabled = false;
    signupSubmit.textContent = "Create Account";
  }
});

// ---- Forgot password ----
const forgotForm = document.getElementById("forgot-form");
const forgotError = document.getElementById("forgot-error");
const forgotSuccess = document.getElementById("forgot-success");
const forgotSubmit = document.getElementById("forgot-submit");

forgotForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError(forgotError);
  forgotSuccess.classList.add("hidden");
  forgotSubmit.disabled = true;
  forgotSubmit.textContent = "Sending…";

  try {
    const email = document.getElementById("forgot-email").value.trim();
    const data = await apiFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    forgotSuccess.textContent = data.message;
    forgotSuccess.classList.remove("hidden");
    forgotForm.reset();
  } catch (err) {
    showError(forgotError, err.message);
  } finally {
    forgotSubmit.disabled = false;
    forgotSubmit.textContent = "Send reset link";
  }
});

// ---- Reset password (from emailed link) ----
const resetForm = document.getElementById("reset-password-form");
const resetError = document.getElementById("reset-password-error");
const resetSuccess = document.getElementById("reset-password-success");
const resetSubmit = document.getElementById("reset-password-submit");

if (resetForm) {
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(resetError);
    resetSuccess.classList.add("hidden");

    const token = params.get("token");
    const email = params.get("email");

    if (!token || !email) {
      showError(resetError, "This reset link is missing information. Please request a new one.");
      return;
    }

    resetSubmit.disabled = true;
    resetSubmit.textContent = "Saving…";

    try {
      const newPassword = document.getElementById("reset-password-new").value;
      const data = await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, token, newPassword }),
      });
      resetSuccess.textContent = data.message + " Redirecting to sign in…";
      resetSuccess.classList.remove("hidden");
      resetForm.reset();
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1800);
    } catch (err) {
      showError(resetError, err.message);
    } finally {
      resetSubmit.disabled = false;
      resetSubmit.textContent = "Set new password";
    }
  });
}
