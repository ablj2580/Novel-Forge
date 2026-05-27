const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const path = require("path");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: "墨匣 · 创意整理台",
    backgroundColor: "#f7f3ea",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  Menu.setApplicationMenu(null);

  // 允许 F12 / Ctrl+Shift+I 打开 DevTools（菜单被去掉后默认也没了这个快捷键）
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const isF12 = input.key === "F12";
    const isToggle = input.control && input.shift && (input.key === "I" || input.key === "i");
    if (isF12 || isToggle) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.loadFile("index.html");

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("chat-completion", async (_event, { endpoint, apiKey, payload }) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload || {})
  });

  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type") || "application/json",
    body: text
  };
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
