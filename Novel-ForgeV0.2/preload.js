const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  chatCompletion: (endpoint, apiKey, payload) =>
    ipcRenderer.invoke("chat-completion", { endpoint, apiKey, payload })
});
