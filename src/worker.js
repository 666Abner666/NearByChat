export default {
  async fetch(request, env) {
    var url = new URL(request.url);

    if (url.pathname == "/api/chat") {
      var roomName = getRoom(request);
      var roomId = env.CHAT_ROOM.idFromName(roomName);
      var room = env.CHAT_ROOM.get(roomId);
      return room.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};

function getRoom(request) {
  var ip = request.headers.get("CF-Connecting-IP");
  var backup = request.headers.get("x-forwarded-for");

  if (!ip && backup) {
    ip = backup.split(",")[0].trim();
  }

  if (!ip) ip = "local";

  if (ip.indexOf(":") == -1) {
    return ip;
  }

  var parts = ip.split(":").filter(function (part) {
    return part;
  });

  return parts.slice(0, 4).join(":") || ip;
}

export class ChatRoom {
  constructor() {
    this.people = [];
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") != "websocket") {
      return new Response("WebSocket only", { status: 400 });
    }

    var pair = new WebSocketPair();
    var client = pair[0];
    var socket = pair[1];
    var person = {
      id: "",
      alias: "",
      socket: socket,
    };

    socket.accept();
    this.people.push(person);

    var room = this;

    socket.addEventListener("message", function (event) {
      room.gotMessage(person, event.data);
    });

    socket.addEventListener("close", function () {
      room.removePerson(person);
    });

    socket.addEventListener("error", function () {
      room.removePerson(person);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  gotMessage(person, text) {
    var data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      return;
    }

    // console.log("room got:", data);

    if (data.type == "hello") {
      person.id = data.id;
      person.alias = this.pickName(data.alias, data.id);
      this.sendOne(person, {
        type: "me",
        me: { id: person.id, alias: person.alias },
        users: this.getUsers(),
      });
      this.sendAll({ type: "users", users: this.getUsers() });
    }

    if (data.type == "name") {
      person.alias = this.pickName(data.alias, person.id);
      this.sendOne(person, {
        type: "me",
        me: { id: person.id, alias: person.alias },
        users: this.getUsers(),
      });
      this.sendAll({ type: "users", users: this.getUsers() });
    }

    if (data.type == "message") {
      var msg = data.message || {};
      this.sendAll({
        type: "message",
        message: {
          senderId: person.id,
          sender: person.alias,
          type: msg.type || "text",
          text: msg.text || "",
          image: msg.image || "",
        },
      });
    }

    if (data.type == "clear") {
      this.sendAll({ type: "clear" });
    }
  }

  getUsers() {
    var list = [];

    for (var i = 0; i < this.people.length; i++) {
      if (this.people[i].id) {
        list.push({
          id: this.people[i].id,
          alias: this.people[i].alias,
        });
      }
    }

    return list;
  }

  pickName(name, id) {
    var base = (name || "User " + String(id || "").slice(-4)).trim();
    if (!base) base = "User";

    var finalName = base;
    var num = 2;
    var ok = false;

    while (!ok) {
      ok = true;

      for (var i = 0; i < this.people.length; i++) {
        var p = this.people[i];
        if (p.id != id && p.alias.toLowerCase() == finalName.toLowerCase()) {
          ok = false;
          finalName = base + num;
          num++;
        }
      }
    }

    return finalName;
  }

  sendOne(person, data) {
    try {
      person.socket.send(JSON.stringify(data));
    } catch (e) {
      this.removePerson(person);
    }
  }

  sendAll(data) {
    // console.log("sending to everyone:", data);
    for (var i = 0; i < this.people.length; i++) {
      this.sendOne(this.people[i], data);
    }
  }

  removePerson(person) {
    var left = [];

    for (var i = 0; i < this.people.length; i++) {
      if (this.people[i] != person) {
        left.push(this.people[i]);
      }
    }

    this.people = left;
    this.sendAll({ type: "users", users: this.getUsers() });
  }
}
