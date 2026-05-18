const composer = document.querySelector("#composer");
const input = document.querySelector("#messageInput");
const emptyState = document.querySelector("#emptyState");

composer.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = input.value.trim();
  if (!text) return;

  const message = document.createElement("p");
  message.className = "sent-message";
  message.textContent = text;

  emptyState.replaceChildren(message);
  input.value = "";
});
