const composer = document.querySelector("#composer");
const input = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const fileButton = document.querySelector("#fileButton");
const clearButton = document.querySelector("#clearButton");
const fileInput = document.querySelector("#fileInput");
const imagePreview = document.querySelector("#imagePreview");
const emptyState = document.querySelector("#emptyState");
const messages = document.querySelector("#messages");
const conversation = document.querySelector("#conversation");
const wifiName = document.querySelector("#wifiName");
const scanText = document.querySelector("#scanText");
const userList = document.querySelector("#userList");
let lastMessageCount = 0;
let imageList = [];

let clientId = sessionStorage.getItem("nearbychatClientId");
let userName = sessionStorage.getItem("nearbychatUserName");

if (!clientId) {
  clientId = "user-" + Math.random().toString(16).slice(2);
  sessionStorage.setItem("nearbychatClientId", clientId);
}

if (!userName) {
  userName = "";
}

const connection = navigator.connection;
if (connection?.effectiveType) {
  wifiName.textContent = connection.effectiveType;
} else {
  wifiName.textContent = "Unknown";
}

function icon(name) {
  return '<i data-lucide="' + name + '"></i>';
}

function refreshIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}

function flashButton(button, iconName) {
  const oldHtml = button.innerHTML;
  button.innerHTML = icon(iconName);
  button.classList.add("clicked");
  refreshIcons();

  setTimeout(() => {
    button.innerHTML = oldHtml;
    button.classList.remove("clicked");
    refreshIcons();
  }, 800);
}

fileButton.innerHTML = icon("image");
sendButton.innerHTML = icon("send");
clearButton.innerHTML = icon("trash-2");
refreshIcons();

function showUsers(users) {
  userList.innerHTML = "";

  if (users.length === 0) {
    scanText.textContent = "No one online yet";
    return;
  }

  scanText.textContent = users.length + " online";

  users.forEach((user) => {
    const card = document.createElement("div");
    card.className = "user-card";
    if (user.id === clientId) {
      card.classList.add("me");
    }

    const nameBox = document.createElement("div");
    const online = document.createElement("small");

    online.textContent = user.id === clientId ? "You" : "Online";

    if (user.id === clientId) {
      const nameInput = document.createElement("input");
      const error = document.createElement("span");

      nameBox.className = "edit-name";
      nameInput.className = "name-input";
      nameInput.value = userName;

      nameInput.addEventListener("change", () => {
        changeName(nameInput.value, error);
      });
      nameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          nameInput.blur();
        }
      });

      nameBox.append(nameInput, error);
    } else {
      const name = document.createElement("strong");
      name.textContent = user.alias || "Unknown user";
      nameBox.append(name);
    }

    card.append(nameBox, online);
    userList.append(card);
  });
}

async function updateOnlineUsers() {
  try {
    const response = await fetch("/api/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: clientId,
        alias: userName,
      }),
    });
    const result = await response.json();
    userName = result.me.alias;
    sessionStorage.setItem("nearbychatUserName", userName);

    if (!document.activeElement.classList.contains("name-input")) {
      showUsers(result.users);
    }
  } catch (error) {
    userList.innerHTML = "";
    scanText.textContent = "Start server.js first";
  }
}

updateOnlineUsers();
setInterval(updateOnlineUsers, 2000);

async function changeName(value, errorEl) {
  const newName = value.trim();
  errorEl.textContent = "";
  try {
    const response = await fetch("/api/name", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: clientId,
        alias: newName,
      }),
    });
    const result = await response.json();

    if (!result.ok) {
      errorEl.textContent = result.error;
      return;
    }

    userName = result.me.alias;
    sessionStorage.setItem("nearbychatUserName", userName);
    showUsers(result.users);
    loadMessages();
  } catch (error) {
    errorEl.textContent = "Could not change name";
  }
}

async function loadMessages() {
  try {
    const response = await fetch("/api/messages");
    const chatMessages = await response.json();
    showMessages(chatMessages);
  } catch (error) {
    console.log("Could not load messages");
  }
}

function showMessages(chatMessages) {
  const hadNewMessage = chatMessages.length > lastMessageCount;
  const wasNearBottom = conversation.scrollTop + conversation.clientHeight >= conversation.scrollHeight - 80;

  messages.innerHTML = "";

  if (chatMessages.length === 0) {
    emptyState.classList.remove("hidden");
    messages.classList.remove("active");
    lastMessageCount = 0;
    return;
  }

  emptyState.classList.add("hidden");
  messages.classList.add("active");

  chatMessages.forEach((chatMessage) => {
    const message = document.createElement("div");
    const sender = document.createElement("strong");

    message.className = chatMessage.senderId === clientId ? "message mine" : "message other";
    sender.textContent = chatMessage.sender;

    message.append(sender);

    if (chatMessage.type === "image") {
      const imageLine = document.createElement("div");
      const image = document.createElement("img");
      const copyButton = document.createElement("button");

      imageLine.className = "image-line";
      image.className = "chat-image";
      image.src = chatMessage.image;
      copyButton.type = "button";
      copyButton.className = "icon-button copy-button";
      copyButton.innerHTML = icon("copy");
      copyButton.title = "Copy image";
      copyButton.addEventListener("click", () => {
        copyImage(chatMessage.image);
        flashButton(copyButton, "check");
      });

      imageLine.append(image, copyButton);
      message.append(imageLine);
    } else {
      const textLine = document.createElement("div");
      const text = document.createElement("p");
      const copyButton = document.createElement("button");

      textLine.className = "text-line";
      text.textContent = chatMessage.text;
      copyButton.type = "button";
      copyButton.className = "icon-button copy-button";
      copyButton.innerHTML = icon("copy");
      copyButton.title = "Copy text";
      copyButton.addEventListener("click", () => {
        navigator.clipboard.writeText(chatMessage.text);
        flashButton(copyButton, "check");
      });

      textLine.append(text, copyButton);
      message.append(textLine);
    }

    messages.append(message);
  });

  if (wasNearBottom || hadNewMessage) {
    requestAnimationFrame(() => {
      conversation.scrollTop = conversation.scrollHeight;
    });
  }
  lastMessageCount = chatMessages.length;
  refreshIcons();
}

async function sendMessage(text) {
  await fetch("/api/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      senderId: clientId,
      sender: userName,
      type: "text",
      text,
    }),
  });
}

async function sendImage(image) {
  await fetch("/api/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      senderId: clientId,
      sender: userName,
      type: "image",
      image,
    }),
  });
}

async function copyImage(image) {
  try {
    const response = await fetch(image);
    const blob = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob,
      }),
    ]);
  } catch (error) {
    navigator.clipboard.writeText(image);
  }
}

function resizeInput() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 130) + "px";
}

function readImage(file) {
  const reader = new FileReader();
  reader.onload = () => {
    imageList.push(reader.result);
    showImagePreview();
  };
  reader.readAsDataURL(file);
}

function showImagePreview() {
  imagePreview.innerHTML = "";

  if (imageList.length === 0) {
    imagePreview.classList.add("hidden");
    return;
  }

  imagePreview.classList.remove("hidden");

  imageList.forEach((image, index) => {
    const item = document.createElement("div");
    const thumb = document.createElement("img");
    const remove = document.createElement("button");

    item.className = "preview-item";
    thumb.src = image;
    remove.type = "button";
    remove.innerHTML = icon("x");
    remove.title = "Remove image";
    remove.addEventListener("click", () => {
      imageList.splice(index, 1);
      showImagePreview();
    });

    item.append(thumb, remove);
    imagePreview.append(item);
  });

  refreshIcons();
}

async function clearMessages() {
  await fetch("/api/clear", {
    method: "POST",
  });
  lastMessageCount = 0;
  await loadMessages();
  flashButton(clearButton, "check");
}

window.clearMessages = clearMessages;

clearButton.addEventListener("click", clearMessages);

window.addEventListener("beforeunload", () => {
  navigator.sendBeacon(
    "/api/logout",
    JSON.stringify({
      id: clientId,
    }),
  );
});

loadMessages();
setInterval(loadMessages, 1000);

input.addEventListener("input", resizeInput);

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendCurrentMessage();
  }
});

input.addEventListener("paste", (event) => {
  const items = event.clipboardData.items;

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];

    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        event.preventDefault();
        readImage(file);
        flashButton(fileButton, "check");
      }
    }
  }
});

fileButton.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  const files = Array.from(fileInput.files);

  files.forEach((file) => {
    if (file.type.startsWith("image/")) {
      readImage(file);
    }
  });

  if (files.length > 0) {
    flashButton(fileButton, "check");
  }

  fileInput.value = "";
});

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  sendCurrentMessage();
});

// sendButton.addEventListener("click", () => {
//   const text = input.value.trim();
//   if (text) sendMessage(text);
// });

async function sendCurrentMessage() {
  const text = input.value.trim();
  if (!text && imageList.length === 0) return;

  if (text) {
    await sendMessage(text);
  }

  for (let i = 0; i < imageList.length; i += 1) {
    await sendImage(imageList[i]);
  }

  imageList = [];
  showImagePreview();
  await loadMessages();
  input.value = "";
  resizeInput();
  flashButton(sendButton, "check");
}
