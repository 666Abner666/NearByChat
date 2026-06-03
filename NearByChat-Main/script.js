var form = document.querySelector("#composer");
var msgInput = document.querySelector("#messageInput");
var sendBtn = document.querySelector("#sendButton");
var imgBtn = document.querySelector("#fileButton");
var clearBtn = document.querySelector("#clearButton");
var fileInput = document.querySelector("#fileInput");
var previewBox = document.querySelector("#imagePreview");
var emptyBox = document.querySelector("#emptyState");
var msgBox = document.querySelector("#messages");
var chatBox = document.querySelector("#conversation");
var wifiText = document.querySelector("#wifiName");
var statusText = document.querySelector("#scanText");
var usersBox = document.querySelector("#userList");

var myId = sessionStorage.getItem("nearbychatClientId");
var myName = sessionStorage.getItem("nearbychatUserName") || "";
var ws = null;
var allMessages = [];
var selectedImages = [];

if (!myId) {
  myId = "user-" + Math.random().toString(16).slice(2);
  sessionStorage.setItem("nearbychatClientId", myId);
}

if (navigator.connection) {
  wifiText.textContent = navigator.connection.effectiveType;
} else {
  wifiText.textContent = "Browser";
}

function makeIcon(name) {
  return '<i data-lucide="' + name + '"></i>';
}

function drawIcons() {
  if (window.lucide) lucide.createIcons();
}

imgBtn.innerHTML = makeIcon("image");
sendBtn.innerHTML = makeIcon("send");
clearBtn.innerHTML = makeIcon("trash-2");
drawIcons();

function flash(btn, iconName) {
  var old = btn.innerHTML;
  btn.innerHTML = makeIcon(iconName);
  btn.classList.add("clicked");
  drawIcons();

  setTimeout(function () {
    btn.innerHTML = old;
    btn.classList.remove("clicked");
    drawIcons();
  }, 700);
}

function sendToServer(obj) {
  // console.log("sending toserver:", obj);
  if (ws && ws.readyState == WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function startChat() {
  var start = location.protocol == "https:" ? "wss://" : "ws://";
  ws = new WebSocket(start + location.host + "/api/chat");
  statusText.textContent = "Connecting...";

  ws.onopen = function () {
    // console.log("websocket opened");
    sendToServer({
      type: "hello",
      id: myId,
      alias: myName,
    });
  };

  ws.onmessage = function (event) {
    var data = JSON.parse(event.data);
    // console.log("got message:", data);

    if (data.type == "me") {
      myName = data.me.alias;
      sessionStorage.setItem("nearbychatUserName", myName);
      drawUsers(data.users);
    }

    if (data.type == "users") {
      drawUsers(data.users);
    }

    if (data.type == "message") {
      allMessages.push(data.message);
      drawMessages();
    }

    if (data.type == "clear") {
      allMessages = [];
      selectedImages = [];
      drawPreview();
      drawMessages();
    }
  };

  ws.onclose = function () {
    usersBox.innerHTML = "";
    statusText.textContent = "Disconnected";
    setTimeout(startChat, 1500);
  };
}

function drawUsers(users) {
  usersBox.innerHTML = "";

  if (users.length == 0) {
    statusText.textContent = "No one online yet";
    return;
  }

  statusText.textContent = users.length + " online";

  for (var i = 0; i < users.length; i++) {
    var user = users[i];
    var card = document.createElement("div");
    var left = document.createElement("div");
    var small = document.createElement("small");

    card.className = "user-card";
    small.textContent = user.id == myId ? "You" : "Online";

    if (user.id == myId) {
      card.className = "user-card me";
      left.className = "edit-name";

      var input = document.createElement("input");
      input.className = "name-input";
      input.value = myName;

      input.onchange = function () {
        myName = this.value.trim();
        sendToServer({ type: "name", alias: myName });
      };

      input.onkeydown = function (event) {
        if (event.key == "Enter") {
          event.preventDefault();
          this.blur();
        }
      };

      left.append(input);
    } else {
      var name = document.createElement("strong");
      name.textContent = user.alias;
      left.append(name);
    }

    card.append(left, small);
    usersBox.append(card);
  }
}

function drawMessages() {
  msgBox.innerHTML = "";

  if (allMessages.length == 0) {
    emptyBox.classList.remove("hidden");
    msgBox.classList.remove("active");
    return;
  }

  emptyBox.classList.add("hidden");
  msgBox.classList.add("active");

  for (var i = 0; i < allMessages.length; i++) {
    var item = allMessages[i];
    var row = document.createElement("div");
    var who = document.createElement("strong");

    if (item.senderId == myId) row.className = "message mine";
    else row.className = "message other";

    who.textContent = item.sender;
    row.append(who);

    if (item.type == "image") {
      var imgLine = document.createElement("div");
      var img = document.createElement("img");
      var copyImg = document.createElement("button");

      imgLine.className = "image-line";
      img.className = "chat-image";
      img.src = item.image;
      copyImg.type = "button";
      copyImg.className = "icon-button copy-button";
      copyImg.innerHTML = makeIcon("copy");
      copyImg.title = "Copy image";

      copyImg.onclick = (function (image, button) {
        return function () {
          copyImage(image);
          flash(button, "check");
        };
      })(item.image, copyImg);

      imgLine.append(img, copyImg);
      row.append(imgLine);
    } else {
      var textLine = document.createElement("div");
      var text = document.createElement("p");
      var copyText = document.createElement("button");

      textLine.className = "text-line";
      text.textContent = item.text;
      copyText.type = "button";
      copyText.className = "icon-button copy-button";
      copyText.innerHTML = makeIcon("copy");
      copyText.title = "Copy text";

      copyText.onclick = (function (msg, button) {
        return function () {
          navigator.clipboard.writeText(msg);
          flash(button, "check");
        };
      })(item.text, copyText);

      textLine.append(text, copyText);
      row.append(textLine);
    }

    msgBox.append(row);
  }

  chatBox.scrollTop = chatBox.scrollHeight;
  drawIcons();
}

async function copyImage(image) {
  try {
    var res = await fetch(image);
    var blob = await res.blob();
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob,
      }),
    ]);
  } catch (e) {
    navigator.clipboard.writeText(image);
  }
}

function resizeBox() {
  msgInput.style.height = "auto";
  msgInput.style.height = Math.min(msgInput.scrollHeight, 130) + "px";
}

function addImage(file) {
  var reader = new FileReader();
  reader.onload = function () {
    selectedImages.push(reader.result);
    drawPreview();
  };
  reader.readAsDataURL(file);
}

function drawPreview() {
  previewBox.innerHTML = "";

  if (selectedImages.length == 0) {
    previewBox.classList.add("hidden");
    return;
  }

  previewBox.classList.remove("hidden");

  for (var i = 0; i < selectedImages.length; i++) {
    var wrap = document.createElement("div");
    var thumb = document.createElement("img");
    var del = document.createElement("button");

    wrap.className = "preview-item";
    thumb.src = selectedImages[i];
    del.type = "button";
    del.innerHTML = makeIcon("x");
    del.title = "Remove image";

    del.onclick = (function (num) {
      return function () {
        selectedImages.splice(num, 1);
        drawPreview();
      };
    })(i);

    wrap.append(thumb, del);
    previewBox.append(wrap);
  }

  drawIcons();
}

function clearAll() {
  allMessages = [];
  selectedImages = [];
  drawPreview();
  drawMessages();
  sendToServer({ type: "clear" });
  flash(clearBtn, "check");
}

function sendMessage() {
  var text = msgInput.value.trim();
  // console.log("text:", text, "images:", selectedImages.length);
  if (!text && selectedImages.length == 0) return;

  if (text) {
    sendToServer({
      type: "message",
      message: {
        type: "text",
        text: text,
      },
    });
  }

  for (var i = 0; i < selectedImages.length; i++) {
    sendToServer({
      type: "message",
      message: {
        type: "image",
        image: selectedImages[i],
      },
    });
  }

  selectedImages = [];
  drawPreview();
  msgInput.value = "";
  resizeBox();
  flash(sendBtn, "check");
}

clearBtn.onclick = clearAll;
imgBtn.onclick = function () {
  fileInput.click();
};

msgInput.oninput = resizeBox;
msgInput.onkeydown = function (event) {
  if (event.key == "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
};

msgInput.onpaste = function (event) {
  var items = event.clipboardData.items;

  for (var i = 0; i < items.length; i++) {
    if (items[i].type.startsWith("image/")) {
      var file = items[i].getAsFile();
      if (file) {
        event.preventDefault();
        addImage(file);
        flash(imgBtn, "check");
      }
    }
  }
};

fileInput.onchange = function () {
  for (var i = 0; i < fileInput.files.length; i++) {
    if (fileInput.files[i].type.startsWith("image/")) {
      addImage(fileInput.files[i]);
    }
  }

  if (fileInput.files.length > 0) flash(imgBtn, "check");
  fileInput.value = "";
};

form.onsubmit = function (event) {
  event.preventDefault();
  sendMessage();
};

startChat();
