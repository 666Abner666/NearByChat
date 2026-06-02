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
const clientKey = "nearbychatClientId";
const nameKey = "nearbychatUserName";
const usersKey = "nearbychatUsers";
const messagesKey = "nearbychatMessages";
let lastMessageCount = 0;
let imageList = [];

let clientId = localStorage.getItem(clientKey);
let userName = localStorage.getItem(nameKey);

if (!clientId) {
  clientId = "user-" + Math.random().toString(16).slice(2);
  localStorage.setItem(clientKey, clientId);
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

function readSaved(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch (error) {
    return fallback;
  }
}

function saveSaved(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    alert("Browser storage is full. Try clearing messages first.");
    return false;
  }
}

function onlineUsers() {
  const now = Date.now();
  return readSaved(usersKey, []).filter((user) => now - user.lastSeen < 15000);
}

function nameExists(name, id) {
  return onlineUsers().some((user) => user.alias.toLowerCase() === name.toLowerCase() && user.id !== id);
}

function makeName(name, id) {
  const baseName = (name || "Student").trim() || "Student";
  let finalName = baseName;
  let count = 2;

  while (nameExists(finalName, id)) {
    finalName = baseName + count;
    count += 1;
  }

  return finalName;
}

function saveCurrentUser() {
  const users = onlineUsers().filter((user) => user.id !== clientId);

  if (!userName) {
    userName = makeName("Student", clientId);
    localStorage.setItem(nameKey, userName);
  }

  const me = {
    id: clientId,
    alias: userName,
    lastSeen: Date.now(),
  };

  const nextUsers = [me, ...users];
  saveSaved(usersKey, nextUsers);
  return nextUsers;
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
  const users = saveCurrentUser();

  if (!document.activeElement.classList.contains("name-input")) {
    showUsers(users);
  }
}

updateOnlineUsers();
setInterval(updateOnlineUsers, 2000);

async function changeName(value, errorEl) {
  const newName = value.trim();
  errorEl.textContent = "";
  userName = makeName(newName, clientId);
  localStorage.setItem(nameKey, userName);

  const chatMessages = readSaved(messagesKey, []);
  chatMessages.forEach((message) => {
    if (message.senderId === clientId) {
      message.sender = userName;
    }
  });
  saveSaved(messagesKey, chatMessages);

  showUsers(saveCurrentUser());
  loadMessages();
}

async function loadMessages() {
  showMessages(readSaved(messagesKey, []));
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
  saveMessage({
    senderId: clientId,
    sender: userName,
    type: "text",
    text,
  });
}

async function sendImage(image) {
  saveMessage({
    senderId: clientId,
    sender: userName,
    type: "image",
    image,
  });
}

function saveMessage(message) {
  const chatMessages = readSaved(messagesKey, []);
  chatMessages.push({
    senderId: message.senderId,
    sender: message.sender || "Unknown",
    type: message.type || "text",
    text: message.text || "",
    image: message.image || "",
  });

  if (chatMessages.length > 100) {
    chatMessages.splice(0, chatMessages.length - 100);
  }

  saveSaved(messagesKey, chatMessages);
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
  localStorage.removeItem(messagesKey);
  localStorage.removeItem(usersKey);
  localStorage.removeItem(nameKey);
  localStorage.removeItem(clientKey);
  sessionStorage.removeItem(clientKey);
  sessionStorage.removeItem(nameKey);

  clientId = "user-" + Math.random().toString(16).slice(2);
  userName = "";
  imageList = [];
  lastMessageCount = 0;
  localStorage.setItem(clientKey, clientId);
  showImagePreview();
  showMessages([]);
  updateOnlineUsers();
  flashButton(clearButton, "check");
}

window.clearMessages = clearMessages;

clearButton.addEventListener("click", clearMessages);

window.addEventListener("beforeunload", () => {
  const users = onlineUsers().filter((user) => user.id !== clientId);
  saveSaved(usersKey, users);
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
