# NearByChat Project Explanation

## 1. Project Overview

NearByChat is a real-time browser chat project. When a user opens `https://chat.abnerc.com/`, the page shows an online user list on the left and the chat area on the right. The frontend files are in `NearByChat-Main/`, the Cloudflare Worker backend is in `src/worker.js`, and the deployment settings are in `wrangler.jsonc`.

![NearByChat live chat screenshot](images/app-live-chat.png)

The current deployed version is not mainly using the local Node server. It uses Cloudflare instead: the Worker receives normal page requests and WebSocket requests, while a Durable Object stores the currently connected users in a room and broadcasts messages to browsers in that same room.

![Architecture flow](images/flow-architecture.png)

The important files are:

| File | Purpose |
| --- | --- |
| `NearByChat-Main/index.html` | The page structure, including the sidebar, online users, chat area, input box, and buttons. |
| `NearByChat-Main/style.css` | The simple chat UI styling, including the two-column layout, message bubbles, image preview, and mobile layout. |
| `NearByChat-Main/script.js` | The main frontend logic: WebSocket connection, sending messages, showing users, rendering chat messages, image handling, and clearing the chat. |
| `src/worker.js` | The Cloudflare Worker backend. It handles `/api/chat` WebSocket requests and serves static assets for other requests. |
| `wrangler.jsonc` | Cloudflare deployment configuration, including the route, static asset directory, Durable Object binding, and migration. |
| `NearByChat-Main/server.js` | A local development / earlier Node HTTP backend. It is not the main deployed backend now. |

## 2. Frontend Page And Interaction Logic

The frontend page starts from `index.html`. The left side is `Online users`, and the right side is `Chat`. The bottom `form#composer` handles text input, image selection, and sending. When `script.js` starts, it selects DOM elements such as `#messageInput`, `#userList`, `#messages`, and `#conversation`, then turns the static HTML into a live chat interface.

![Second user view](images/app-second-user.png)

The most important frontend step is creating the WebSocket connection:

![Frontend WebSocket code](images/code-frontend-websocket.png)

`connect()` builds the WebSocket URL from the current page protocol:

```text
HTTPS page -> wss://chat.abnerc.com/api/chat
HTTP page  -> ws://current-host/api/chat
```

After the connection opens, the frontend sends a `hello` message with this tab's `clientId` and alias. The `clientId` is stored in `sessionStorage`, so refreshing the same tab keeps the same identity, while opening a new tab creates a different identity. This makes it possible to simulate two users on the same computer.

When the frontend receives a backend message, it handles it by `type`:

| Backend message type | Frontend behavior |
| --- | --- |
| `me` | Updates this user's alias and saves it in `sessionStorage`. |
| `users` | Re-renders the online user list on the left. |
| `message` | Adds the message to `chatMessages` and re-renders the chat area. |
| `clear` | Clears the local message array, image preview, and chat display. |

User and message rendering mainly happens in `showUsers()` and `showMessages()`:

![Frontend message UI code](images/code-frontend-message-ui.png)

`showUsers()` displays the current user as an editable input and other users as normal names. `showMessages()` checks whether `senderId === clientId` to decide whether a message was sent by the current user or by someone else. That decides whether the message uses the `message mine` or `message other` CSS class.

The frontend also includes several small features:

| Feature | Implementation |
| --- | --- |
| Rename user | Editing the current user's input sends `{ type: "name", alias }`. |
| Send text | Pressing Enter or clicking send sends `{ type: "message", message: { type: "text", text } }`. |
| Send image | Selecting or pasting an image uses `FileReader` to convert it to a data URL, then sends it as an image message. |
| Copy message | Text uses `navigator.clipboard.writeText()`. Images are fetched as blobs and then written to the clipboard. |
| Clear chat | The trash button clears the local UI first, then sends `{ type: "clear" }` to all users. |
| Auto-scroll | New messages scroll `#conversation` so the latest message stays visible. |

## 3. Cloudflare Worker And Durable Object Backend

The deployed backend entry point is `src/worker.js`. The Worker's `fetch()` function first checks the request path. If the path is `/api/chat`, it is a chat WebSocket request. Otherwise, it calls `env.ASSETS.fetch(request)` to return static files such as `index.html`, `style.css`, and `script.js`.

![Worker Durable Object code](images/code-worker-durable-object.png)

The `/api/chat` flow is:

1. `getRoomName(request)` creates a room name from the visitor's IP address.
2. `env.CHAT_ROOM.idFromName(roomName)` gets a Durable Object id for that room.
3. `env.CHAT_ROOM.get(id)` gets the matching `ChatRoom` instance.
4. `room.fetch(request)` passes the WebSocket request into that Durable Object.

The `ChatRoom` class is the real-time chat core. It has a `people` array for current connections. Each connected browser is stored as:

```text
{ id, alias, socket }
```

When a browser sends `hello`, `ChatRoom` saves that user's id and alias, then broadcasts the user list. When a browser sends `message`, `ChatRoom` does not do complex storage. It immediately broadcasts the message to everyone. When a browser disconnects, `remove()` deletes that person from `people` and broadcasts the updated user list again.

![WebSocket message flow](images/flow-websocket.png)

Durable Object is useful here because normal Workers are mostly stateless between requests, while this app needs all WebSocket connections in the same room to share state. For chat, collaboration, or small multiplayer features, a Durable Object is a better fit than a plain stateless Worker function.

## 4. Cloudflare Configuration And Dashboard Operations

The deployment configuration is in `wrangler.jsonc`:

![Wrangler config code](images/code-wrangler-config.png)

The most important configuration parts are:

| Configuration | Meaning |
| --- | --- |
| `"main": "src/worker.js"` | The Worker entry file that Cloudflare runs. |
| `"assets": { "directory": "./NearByChat-Main" }` | Uploads the frontend static directory, so the Worker can return pages through `env.ASSETS.fetch()`. |
| `"routes": [{ "pattern": "chat.abnerc.com/*", "zone_name": "abnerc.com" }]` | Routes requests for `chat.abnerc.com/*` to this Worker. |
| `"durable_objects"` and `"migrations"` | Creates and binds the `CHAT_ROOM` Durable Object. The class name is `ChatRoom`. |

The Cloudflare Worker overview page shows the project name, recent versions, binding count, request metrics, and route information.

![Cloudflare Worker overview](images/cloudflare-worker-overview.png)

The Deployments page shows that this Worker was manually deployed with Wrangler and has multiple version records. Each deployment has a version ID, and the active version receives 100% of the traffic.

![Cloudflare deployments](images/cloudflare-deployments.png)

The Bindings page shows that the `nearbychat` Worker is connected to a Durable Object binding named `CHAT_ROOM`. This matches both `env.CHAT_ROOM` in the code and `durable_objects.bindings` in `wrangler.jsonc`.

![Cloudflare bindings](images/cloudflare-bindings.png)

The Durable Objects page shows the namespace `nearbychat_ChatRoom`, connected to the `nearbychat` Worker. Its storage type is SQLite because `wrangler.jsonc` uses the migration `new_sqlite_classes: ["ChatRoom"]`.

![Cloudflare Durable Objects](images/cloudflare-durable-objects.png)

The Domains & Routes page shows that the Worker URL is currently inactive, and the public route is `chat.abnerc.com/*`. This means requests to `chat.abnerc.com` are routed by Cloudflare into this Worker.

![Cloudflare domains and routes](images/cloudflare-domains-routes.png)

The Settings page shows runtime settings such as the compatibility date, `Jun 2, 2026`, and the project name, `nearbychat`. The current Dashboard does not show Static Assets as a separate screenshot card; the accurate source for the assets setup is the `assets.directory` field in `wrangler.jsonc`.

![Cloudflare settings](images/cloudflare-settings.png)

According to Cloudflare's docs, Workers routes/custom domains let a Worker receive external requests; Static Assets can be uploaded together with a Worker; Durable Object bindings let the Worker access an object through `env.CHAT_ROOM`; and Durable Object migrations create or update Durable Object classes.

References:

- [Cloudflare Workers routes and domains](https://developers.cloudflare.com/workers/configuration/routing/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Workers Static Assets binding](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Durable Object migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)

## 5. Why The Local Node Backend Still Exists

`NearByChat-Main/server.js` is the local development / earlier backend. It uses Node's `http` module and serves the page and API on local port `4173`:

![Local server code](images/code-local-server.png)

This version has HTTP endpoints such as `/api/heartbeat`, `/api/name`, `/api/messages`, and `/api/clear`. It is useful for testing online users and chat behavior locally, but it is not the main deployed version now. The current online version uses WebSockets and a Durable Object for real-time communication, which fits Cloudflare better than repeated HTTP polling.

Keeping `server.js` helps show how the project moved from a local prototype to a Cloudflare deployment. It also makes the early feature logic easier to understand without Cloudflare. However, when explaining the current online frontend-backend interaction, `src/worker.js` and `wrangler.jsonc` should be treated as the source of truth.

## 6. Real Limitations And Tradeoffs

This project demonstrates real-time chat and Cloudflare deployment, but it is still a small demo project. These limitations are important to explain clearly:

| Limitation | Explanation |
| --- | --- |
| "Nearby / Same Wi-Fi" is an approximation | The Worker cannot read the user's real Wi-Fi name. The current room is based on the request IP address. The page's `Current Wi-Fi` can only show browser network information such as `3g`, not the actual Wi-Fi SSID. |
| Chat history is not long-term storage | The current `ChatRoom` mainly stores live connection state. Messages are broadcast but not written into a database. After refresh or reconnect, history does not behave like a full chat app. |
| Image sending is best for small demos | Images are sent as data URLs inside WebSocket messages. This is simple, but large images make messages too big for a production app. |
| Nickname handling is simple | The backend can add numbers to avoid duplicate aliases, such as `User` and `User2`, but there is no account system or login verification. |
| Clear chat affects everyone online | This is fine for a demo, but a production app would usually require permissions. |

These tradeoffs keep the project simple: the frontend is plain HTML/CSS/JS, and the backend only needs one Worker and one Durable Object. There is no database, account system, or heavy framework. That makes the project easier to present in class and easier to explain from code.
