const loginCard = document.getElementById("login-card");
const appCard = document.getElementById("app-card");
const usernameInput = document.querySelector('[data-testid="username-input"]');
const passwordInput = document.querySelector('[data-testid="password-input"]');
const loginBtn = document.getElementById("login-btn");
const loginError = document.querySelector('[data-testid="login-error"]');
const welcomeText = document.querySelector('[data-testid="welcome-text"]');
const logoutBtn = document.getElementById("logout-btn");
const taskInput = document.querySelector('[data-testid="task-input"]');
const runBtn = document.getElementById("run-btn");
const historyBtn = document.getElementById("history-btn");
const resultArea = document.querySelector('[data-testid="task-result"]');
const historyList = document.getElementById("history-list");

const taskHistory = ["欢迎任务：体验 Onework Demo"];
const validCredential = {
  username: "demo",
  password: "123456"
};

function showLoginScreen() {
  loginCard.classList.remove("hidden");
  appCard.classList.add("hidden");
  loginError.textContent = "";
  passwordInput.value = "";
}

function showAppScreen(username) {
  loginCard.classList.add("hidden");
  appCard.classList.remove("hidden");
  welcomeText.textContent = `欢迎你，${username}`;
}

function renderHistory() {
  historyList.innerHTML = "";
  taskHistory.forEach((item) => {
    const li = document.createElement("li");
    li.setAttribute("data-testid", "history-item");
    li.textContent = item;
    historyList.appendChild(li);
  });
}

loginBtn.addEventListener("click", () => {
  const username = (usernameInput.value || "").trim();
  const password = (passwordInput.value || "").trim();

  if (username !== validCredential.username || password !== validCredential.password) {
    loginError.textContent = "用户名或密码错误，请重试。";
    return;
  }

  loginError.textContent = "";
  showAppScreen(username);
});

logoutBtn.addEventListener("click", () => {
  showLoginScreen();
});

runBtn.addEventListener("click", () => {
  const value = (taskInput.value || "").trim();
  const prompt = value || "默认任务";
  const output = `已完成：${prompt}（示例结果）`;
  resultArea.textContent = output;
  taskHistory.unshift(output);
  renderHistory();
});

historyBtn.addEventListener("click", () => {
  historyList.scrollIntoView({ behavior: "instant", block: "center" });
});

renderHistory();
showLoginScreen();
