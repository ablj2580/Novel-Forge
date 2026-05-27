const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const maxBodyBytes = 1024 * 1024;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && requestUrl.pathname === "/api/chat-completion") {
    handleChatProxy(req, res);
    return;
  }

  let safePath = path.normalize(decodeURIComponent(requestUrl.pathname)).replace(/^(\.\.[/\\])+/, "");
  // 桌面入口 -> index.html
  if (safePath === path.sep || safePath === "/") {
    safePath = "index.html";
  }
  // 移动端入口 -> mobile/index.html(/mobile、/mobile/ 都接受)
  else if (
    safePath === "/mobile" || safePath === "/mobile/" ||
    safePath === path.sep + "mobile" || safePath === path.sep + "mobile" + path.sep
  ) {
    safePath = path.join("mobile", "index.html");
  }
  const filePath = path.join(root, safePath);
  const resolved = path.resolve(filePath);

  if (!resolved.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(resolved, (error, data) => {
    if (error) {
      fs.readFile(path.join(root, "index.html"), (fallbackError, fallbackData) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": mimeTypes[".html"] });
        res.end(fallbackData);
      });
      return;
    }

    const ext = path.extname(resolved);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`Novel Forge demo is running at http://localhost:${port}`);
});

module.exports = server;

async function handleChatProxy(req, res) {
  try {
    const body = await readJsonBody(req);
    const endpoint = new URL(body.endpoint || "");

    if (endpoint.protocol !== "https:" || endpoint.hostname !== "api.deepseek.com") {
      throw Object.assign(new Error("Only DeepSeek API endpoints are allowed in this demo proxy."), { statusCode: 400 });
    }

    if (endpoint.pathname !== "/chat/completions") {
      throw Object.assign(new Error("Unsupported DeepSeek API path."), { statusCode: 400 });
    }

    if (!body.apiKey) {
      throw Object.assign(new Error("Missing DeepSeek API key."), { statusCode: 400 });
    }

    const apiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${body.apiKey}`
      },
      body: JSON.stringify(body.payload || {})
    });

    const responseText = await apiResponse.text();
    res.writeHead(apiResponse.status, {
      "Content-Type": apiResponse.headers.get("content-type") || "application/json; charset=utf-8"
    });
    res.end(responseText);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: describeProxyError(error) }));
  }
}

function describeProxyError(error) {
  const message = error.message || "DeepSeek proxy request failed.";
  if (message === "fetch failed") {
    return "本地代理无法连接 DeepSeek。若在 Codex 沙盒中运行，请用联网权限重启 npm start。";
  }
  return message;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = "";

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(Object.assign(new Error("Invalid JSON request body."), { statusCode: 400 }));
      }
    });

    req.on("error", reject);
  });
}
