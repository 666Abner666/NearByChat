const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const users = {};
const messages = [];
const defaultName = os.userInfo().username || "Abner";

function json(res, data) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function body(req, done) {
  let data = "";
  req.on("data", (chunk) => (data += chunk));
  req.on("end", () => done(data ? JSON.parse(data) : {}));
}

function onlineUsers() {
  const now = Date.now();
  return Object.values(users).filter((user) => now - user.lastSeen < 15000);
}

function nameExists(name, id) {
  return onlineUsers().some((user) => user.alias.toLowerCase() === name.toLowerCase() && user.id !== id);
}

function makeName(name, id) {
  let finalName = (name || defaultName).trim() || defaultName;
  let count = 2;

  while (nameExists(finalName, id)) {
    finalName = (name || defaultName).trim() + count;
    count += 1;
  }

  return finalName;
}

function file(req, res) {
  const name = req.url === "/" ? "index.html" : req.url.slice(1);
  const filePath = path.join(__dirname, name);
  const type = name.endsWith(".css") ? "text/css" : name.endsWith(".js") ? "text/javascript" : "text/html";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

http
  .createServer((req, res) => {
    if (req.url === "/api/heartbeat") {
      body(req, (data) => {
        const oldUser = users[data.id];
        const alias = oldUser ? oldUser.alias : makeName(data.alias, data.id);

        users[data.id] = {
          id: data.id,
          alias,
          lastSeen: Date.now(),
        };
        json(res, { me: users[data.id], users: onlineUsers() });
      });
      return;
    }

    if (req.url === "/api/name") {
      body(req, (data) => {
        const alias = makeName(data.alias, data.id);
        if (!alias) return json(res, { ok: false, error: "Name cannot be empty" });

        users[data.id] = {
          id: data.id,
          alias,
          lastSeen: Date.now(),
        };

        messages.forEach((message) => {
          if (message.senderId === data.id) {
            message.sender = alias;
          }
        });

        json(res, { ok: true, me: users[data.id], users: onlineUsers() });
      });
      return;
    }

    if (req.url === "/api/logout") {
      body(req, (data) => {
        delete users[data.id];
        json(res, { ok: true });
      });
      return;
    }

    if (req.url === "/api/messages" && req.method === "GET") return json(res, messages);

    if (req.url === "/api/clear") {
      messages.length = 0;
      Object.keys(users).forEach((id) => delete users[id]);
      return json(res, { ok: true });
    }

    if (req.url === "/api/messages") {
      body(req, (data) => {
        messages.push({
          senderId: data.senderId,
          sender: data.sender || "Unknown",
          type: data.type || "text",
          text: data.text || "",
          image: data.image || "",
        });
        json(res, messages);
      });
      return;
    }

    file(req, res);
  })
  .listen(4173, () => console.log("NearByChat: http://localhost:4173"));
