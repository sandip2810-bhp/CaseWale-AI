// Thin wrapper around fetch that adds the JWT, parses JSON, and
// bounces the user back to the login screen if the token is dead.

function getToken() {
  return localStorage.getItem("cw_token");
}

function getUser() {
  const raw = localStorage.getItem("cw_user");
  return raw ? JSON.parse(raw) : null;
}

function setSession(token, user) {
  localStorage.setItem("cw_token", token);
  localStorage.setItem("cw_user", JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem("cw_token");
  localStorage.removeItem("cw_user");
}

// Small debounce helper — used by History and Drafts search inputs so we
// don't hit the API on every keystroke.
function debounce(fn, delay = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch (err) {
    throw new Error(
      `Can't reach the server at ${API_BASE_URL}. Is the backend running?`
    );
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = null;
    }
  }

  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `Request failed (${res.status})`;

    // A 401 only means "your session died" if we actually sent a token.
    // A 401 on /auth/login or /auth/signup just means wrong credentials.
    if (res.status === 401 && token) {
      clearSession();
      if (!location.pathname.endsWith("index.html") && location.pathname !== "/") {
        window.location.href = "index.html";
      }
      throw new Error("Session expired. Please log in again.");
    }

    throw new Error(message);
  }

  return data;
}