let mode = new URLSearchParams(location.search).get("mode") === "login" ? "login" : "signup";

const $ = (selector) => document.querySelector(selector);

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail;
    const message = typeof detail === "string"
      ? detail
      : Array.isArray(detail)
        ? detail.map((issue) => issue.msg).filter(Boolean).join("; ")
        : "Request failed";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

function setMode(nextMode) {
  mode = nextMode;
  const signup = mode === "signup";
  $("#loginTab").classList.toggle("active", !signup);
  $("#signupTab").classList.toggle("active", signup);
  $("#loginTab").setAttribute("aria-selected", String(!signup));
  $("#signupTab").setAttribute("aria-selected", String(signup));
  $("#nameGroup").hidden = !signup;
  $("#name").required = signup;
  $("#password").autocomplete = signup ? "new-password" : "current-password";
  $("#authTitle").textContent = signup ? "Create your account." : "Welcome back.";
  $("#authSubtitle").textContent = signup
    ? "Start exploring and saving your ingredient ideas."
    : "Sign in to continue to NouriLab.";
  $("#authSubmit").textContent = signup ? "Create account" : "Log in";
  $("#authMessage").textContent = "";
  history.replaceState(null, "", `?mode=${signup ? "signup" : "login"}`);
}

async function checkExistingSession() {
  const token = localStorage.getItem("nourilab_token");
  if (!token) return;
  try {
    await api("/api/auth/me", { headers: { Authorization: "Bearer " + token } });
    location.replace("/app");
  } catch (error) {
    if (error.status === 401) {
      localStorage.removeItem("nourilab_token");
      return;
    }
    $("#authMessage").textContent = "We couldn't verify your saved session. Please try again.";
  }
}

$("#name").autocomplete = "name";
$("#loginTab").addEventListener("click", () => setMode("login"));
$("#signupTab").addEventListener("click", () => setMode("signup"));

$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = $("#authSubmit");
  const message = $("#authMessage");
  submit.disabled = true;
  message.textContent = "";
  const body = {
    email: $("#email").value.trim(),
    password: $("#password").value
  };
  if (mode === "signup") body.name = $("#name").value.trim();
  try {
    const data = await api(mode === "signup" ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body)
    });
    localStorage.setItem("nourilab_token", data.access_token);
    location.replace("/app");
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

setMode(mode);
checkExistingSession();
setTimeout(() => $("#brandLoader").classList.add("is-hidden"), 900);
