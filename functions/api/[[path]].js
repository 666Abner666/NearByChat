const state =
  globalThis.nearByChatState ||
  (globalThis.nearByChatState = {
    users: {},
    messages: [],
  });

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function body(request) {
  try {
    return await request.json();
  } catch (error) {
    return {};
  }
}

function onlineUsers() {
  const now = Date.now();
  return Object.values(state.users).filter((user) => now - user.lastSeen < 15000);
}

function nameExists(name, id) {
  return onlineUsers().some((user) => user.alias.toLowerCase() === name.toLowerCase() && user.id !== id);
}

function makeName(name, id) {
  const defaultName = "Abner";
  const baseName = (name || defaultName).trim() || defaultName;
  let finalName = baseName;
  let count = 2;

  while (nameExists(finalName, id)) {
    finalName = baseName + count;
    count += 1;
  }

  return finalName;
}

export async function onRequest(context) {
  const request = context.request;
  const method = request.method;
  const path = "/" + (context.params.path || []).join("/");

  if (path === "/heartbeat") {
    const data = await body(request);
    const oldUser = state.users[data.id];
    const alias = oldUser ? oldUser.alias : makeName(data.alias, data.id);

    state.users[data.id] = {
      id: data.id,
      alias,
      lastSeen: Date.now(),
    };

    return json({ me: state.users[data.id], users: onlineUsers() });
  }

  if (path === "/name") {
    const data = await body(request);
    const alias = makeName(data.alias, data.id);

    state.users[data.id] = {
      id: data.id,
      alias,
      lastSeen: Date.now(),
    };

    state.messages.forEach((message) => {
      if (message.senderId === data.id) {
        message.sender = alias;
      }
    });

    return json({ ok: true, me: state.users[data.id], users: onlineUsers() });
  }

  if (path === "/logout") {
    const data = await body(request);
    delete state.users[data.id];
    return json({ ok: true });
  }

  if (path === "/messages" && method === "GET") {
    return json(state.messages);
  }

  if (path === "/messages" && method === "POST") {
    const data = await body(request);

    state.messages.push({
      senderId: data.senderId,
      sender: data.sender || "Unknown",
      type: data.type || "text",
      text: data.text || "",
      image: data.image || "",
    });

    if (state.messages.length > 100) {
      state.messages.splice(0, state.messages.length - 100);
    }

    return json(state.messages);
  }

  if (path === "/clear") {
    state.messages.length = 0;
    state.users = {};
    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
}
