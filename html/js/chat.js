/* Live-chat widget. The site is static, so there is no seller on the other end:
   the panel says so plainly and points at the real phone/Zalo/email instead of
   pretending a person replied. Markup is injected here so the nine pages only
   need to load this one file. */
(function () {
  var REPLIES = [
    "Thanks for your message. This demo chat is not connected to our team yet — the quickest way to reach us is Zalo or WhatsApp on (+84) 708 976 136.",
    "Noted. For a formal quote, email admin@kyucraft.com with the product codes and quantities and we reply within one working day.",
    "Our minimum is 50 pcs per design, and you can mix designs in one order.",
  ];
  var replyIndex = 0;

  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function build() {
    var wrap = el("div", "chat");

    var launcher = el(
      "button",
      "chat__launcher",
      '<svg class="chat__icon-open" viewBox="0 0 24 24" fill="currentColor">' +
        '<path d="M12 3C6.9 3 3 6.5 3 10.8c0 2.3 1.1 4.3 3 5.7V21l3.3-1.9c.9.2 1.8.3 2.7.3 5.1 0 9-3.5 9-7.8S17.1 3 12 3z"/>' +
        '<circle cx="8.5" cy="11" r="1.1" fill="#fff"/><circle cx="12" cy="11" r="1.1" fill="#fff"/>' +
        '<circle cx="15.5" cy="11" r="1.1" fill="#fff"/></svg>' +
        '<svg class="chat__icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    );
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Chat with us");
    launcher.setAttribute("aria-expanded", "false");

    var panel = el("div", "chat__panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Chat with KHT Card");
    panel.hidden = true;
    panel.innerHTML =
      '<div class="chat__header">' +
      "<div>" +
      '<p class="chat__title">KHT Card</p>' +
      '<p class="chat__status"><span class="chat__dot"></span>Mon&ndash;Sat, 8:00&ndash;17:30 (GMT+7)</p>' +
      "</div>" +
      '<button type="button" class="chat__close" aria-label="Close chat">&times;</button>' +
      "</div>" +
      '<div class="chat__body" id="chatBody"></div>' +
      '<form class="chat__form">' +
      '<label class="sr-only" for="chatInput">Message</label>' +
      '<input id="chatInput" type="text" placeholder="Type a message…" autocomplete="off">' +
      '<button type="submit" aria-label="Send">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
      'stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>' +
      "</button>" +
      "</form>";

    wrap.appendChild(panel);
    wrap.appendChild(launcher);
    document.body.appendChild(wrap);
    return { wrap: wrap, launcher: launcher, panel: panel };
  }

  document.addEventListener("DOMContentLoaded", function () {
    var ui = build();
    var body = ui.panel.querySelector("#chatBody");
    var form = ui.panel.querySelector(".chat__form");
    var input = ui.panel.querySelector("#chatInput");

    // The product page keeps a buy bar pinned to the bottom on phones.
    if (document.getElementById("stickyBuyBar"))
      ui.wrap.classList.add("chat--above-bar");

    function scrollDown() {
      body.scrollTop = body.scrollHeight;
    }

    function addMessage(text, who) {
      var msg = el("div", "chat__msg chat__msg--" + who);
      msg.textContent = text;
      body.appendChild(msg);
      scrollDown();
      return msg;
    }

    function autoReply() {
      var typing = el(
        "div",
        "chat__msg chat__msg--them chat__typing",
        "<span></span><span></span><span></span>",
      );
      body.appendChild(typing);
      scrollDown();
      setTimeout(function () {
        typing.remove();
        addMessage(REPLIES[replyIndex % REPLIES.length], "them");
        replyIndex++;
      }, 700);
    }

    function send(text) {
      if (!text.trim()) return;
      addMessage(text.trim(), "me");
      input.value = "";
      autoReply();
    }

    function toggle(open) {
      ui.panel.hidden = !open;
      ui.wrap.classList.toggle("chat--open", open);
      ui.launcher.setAttribute("aria-expanded", String(open));
      if (open) input.focus();
    }

    ui.launcher.addEventListener("click", function () {
      toggle(ui.panel.hidden);
    });
    ui.panel
      .querySelector(".chat__close")
      .addEventListener("click", function () {
        toggle(false);
      });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !ui.panel.hidden) toggle(false);
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      send(input.value);
    });
  });
})();
