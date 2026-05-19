const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const path = require("path");

let mainWindow = null;
let server = null;

function startServer() {
  try {
    server = require("./server.js");
    server.on("error", (err) => {
      dialog.showErrorBox(
        "启动失败",
        `本地服务无法启动（端口 4173 可能被占用）。\n请关闭其他占用该端口的程序后重试。\n\n${err.message}`
      );
      app.quit();
    });
  } catch (err) {
    dialog.showErrorBox("启动失败", String(err?.stack || err));
    app.quit();
  }
}

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
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  Menu.setApplicationMenu(null);

  const loadApp = () => {
    mainWindow.loadURL("http://localhost:4173").catch((err) => {
      console.error("loadURL failed:", err);
      setTimeout(loadApp, 300);
    });
  };

  if (server && server.listening) {
    loadApp();
  } else if (server) {
    server.once("listening", loadApp);
  } else {
    setTimeout(loadApp, 500);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
