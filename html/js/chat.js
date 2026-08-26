/* Widget chat - tra loi bang tro ly AI (Gemini) qua /api/chat.
 *
 * Trinh duyet KHONG bao gio thay API key: no chi POST len /api/chat cua chinh site, con
 * Cloudflare Worker (worker/index.js) moi la noi giu key va goi Gemini.
 *
 * Cau hinh giao dien + khoi lien he du phong nam trong js/chat-data.js (do
 * scripts/build.py sinh ra tu data/site-settings.json) - file nay khong hardcode chu nao
 * cua khach.
 *
 * Nguyen tac: moi nhanh loi (mat mang, het quota, Worker chua cau hinh key, bi rate-limit)
 * deu phai ket thuc bang KENH LIEN HE THAT, khong bao gio de khach nhan vao khoang khong. */
(function () {
  var CFG = window.KHT_CHAT_CONFIG;
  if (!CFG || !CFG.enabled) return;

  var MAX_INPUT = 600; // khop MAX_MESSAGE_CHARS ben worker/index.js
  var CONV_KEY = "kht_chat_conversation";

  /** Ma cuoc tro chuyen, de chu site doc lai trong CMS theo tung cuoc thay vi mot dong tin
   * nhan roi rac. Dung sessionStorage: song qua viec chuyen trang (site nhieu trang tinh)
   * nhung khong theo doi khach qua nhieu phien khac nhau. */
  function conversationId() {
    try {
      var id = sessionStorage.getItem(CONV_KEY);
      if (!id) {
        id = (window.crypto && crypto.randomUUID)
          ? crypto.randomUUID()
          : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
        sessionStorage.setItem(CONV_KEY, id);
      }
      return id;
    } catch (e) {
      return "no-storage"; // che do rieng tu: van chat duoc, chi la khong gom nhom duoc
    }
  }
  var history = []; // [{role:"user"|"model", text:"..."}] - gui kem moi luot de bot nho ngu canh
  var busy = false;

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
    launcher.setAttribute("aria-label", "Chat");
    launcher.setAttribute("aria-expanded", "false");

    var panel = el("div", "chat__panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", CFG.title || "Chat");
    panel.hidden = true;

    var header = el("div", "chat__header");
    var headerText = el("div");
    var titleEl = el("p", "chat__title");
    titleEl.textContent = CFG.title || "";
    headerText.appendChild(titleEl);
    var status = el("p", "chat__status");
    status.appendChild(el("span", "chat__dot"));
    status.appendChild(document.createTextNode(CFG.statusText || ""));
    headerText.appendChild(status);
    var closeBtn = el("button", "chat__close", "&times;");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close chat");
    header.appendChild(headerText);
    header.appendChild(closeBtn);

    var body = el("div", "chat__body");
    body.setAttribute("aria-live", "polite");

    var form = el("form", "chat__form");
    var input = el("input");
    input.id = "chatInput";
    input.type = "text";
    input.autocomplete = "off";
    input.maxLength = MAX_INPUT;
    input.placeholder = CFG.inputPlaceholder || "";
    var label = el("label", "sr-only");
    label.setAttribute("for", "chatInput");
    label.textContent = "Message";
    var sendBtn = el(
      "button",
      null,
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
        'stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
    );
    sendBtn.type = "submit";
    sendBtn.setAttribute("aria-label", "Send");
    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(sendBtn);

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(form);
    wrap.appendChild(panel);
    wrap.appendChild(launcher);
    document.body.appendChild(wrap);

    return {
      wrap: wrap,
      launcher: launcher,
      panel: panel,
      body: body,
      form: form,
      input: input,
      closeBtn: closeBtn,
    };
  }

  document.addEventListener("DOMContentLoaded", function () {
    var ui = build();

    // Trang san pham ghim thanh mua hang duoi day tren dien thoai - day widget len tranh de.
    if (document.getElementById("stickyBuyBar")) ui.wrap.classList.add("chat--above-bar");

    function scrollDown() {
      ui.body.scrollTop = ui.body.scrollHeight;
    }

    function addMessage(text, who) {
      var msg = el("div", "chat__msg chat__msg--" + who);
      msg.textContent = text; // textContent, KHONG innerHTML: noi dung do AI sinh ra
      ui.body.appendChild(msg);
      scrollDown();
      return msg;
    }

    /** Khoi lien he that - dung khi khong goi duoc tro ly. Dung tao bang DOM (khong
     * innerHTML) va lay so/email tu chat-data.js nen khong bao gio lech voi footer. */
    function addContactBlock(leadText) {
      var box = el("div", "chat__notice");
      if (leadText) {
        var lead = el("p", "chat__notice-lead");
        lead.textContent = leadText;
        box.appendChild(lead);
      }
      var list = el("ul", "chat__contact");
      var c = CFG.contact || {};
      if (c.zaloPhone) {
        var liPhone = el("li");
        var aPhone = el("a");
        aPhone.href = "tel:" + c.zaloPhone.replace(/[^\d+]/g, "");
        aPhone.textContent = c.zaloPhone;
        liPhone.appendChild(document.createTextNode("Zalo/SĐT: "));
        liPhone.appendChild(aPhone);
        list.appendChild(liPhone);
      }
      if (c.email) {
        var liMail = el("li");
        var aMail = el("a");
        aMail.href = "mailto:" + c.email;
        aMail.textContent = c.email;
        liMail.appendChild(document.createTextNode("Email: "));
        liMail.appendChild(aMail);
        list.appendChild(liMail);
      }
      if (c.formUrl) {
        var liForm = el("li");
        var aForm = el("a");
        aForm.href = c.formUrl;
        aForm.textContent = c.formLabel || "Form liên hệ";
        liForm.appendChild(aForm);
        list.appendChild(liForm);
      }
      box.appendChild(list);
      ui.body.appendChild(box);
      scrollDown();
    }

    function showTyping() {
      var typing = el(
        "div",
        "chat__msg chat__msg--them chat__typing",
        "<span></span><span></span><span></span>",
      );
      ui.body.appendChild(typing);
      scrollDown();
      return typing;
    }

    /** Khung chat mo ra la go duoc ngay: khong nut bat dau, khong loi nhac bat buoc.
     * startHint de trong thi khong hien gi - phan tiet lo "day la tro ly tu dong" nam o
     * dong trang thai tren header (CFG.statusText). */
    function renderIntro() {
      ui.body.innerHTML = "";
      if (CFG.startHint) {
        var hint = el("div", "chat__notice");
        hint.textContent = CFG.startHint;
        ui.body.appendChild(hint);
      }
      setInputEnabled(true);
      scrollDown();
    }

    /** Chi khoa o nhap TRONG LUC cho tra loi, de khach khong gui chong len nhau. */
    function setInputEnabled(on) {
      ui.input.disabled = !on;
      ui.form.querySelector("button[type=submit]").disabled = !on;
      ui.form.classList.toggle("chat__form--disabled", !on);
    }

    function send(text) {
      text = String(text || "").trim().slice(0, MAX_INPUT);
      if (!text || busy) return;

      addMessage(text, "me");
      history.push({ role: "user", text: text });
      ui.input.value = "";
      busy = true;
      setInputEnabled(false);

      var typing = showTyping();
      ask(history)
        .then(function (reply) {
          typing.remove();
          addMessage(reply, "them");
          history.push({ role: "model", text: reply });
        })
        .catch(function () {
          typing.remove();
          // Tro ly khong tra loi duoc -> dua khach sang kenh that, khong de treo.
          addContactBlock(CFG.errorMessage);
        })
        .then(function () {
          busy = false;
          setInputEnabled(true);
          if (!ui.panel.hidden) ui.input.focus();
        });
    }

    function ask(messages) {
      return fetch(CFG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages,
          conversationId: conversationId(),
          page: location.pathname,
        }),
      })
        .then(function (res) {
          return res.json().catch(function () {
            return { ok: false };
          });
        })
        .then(function (data) {
          if (!data || !data.ok || !data.reply) throw new Error(
            (data && data.error) || "no_reply",
          );
          return data.reply;
        });
    }

    var warmed = false;
    /** Danh thuc Apps Script ngay khi khach mo khung chat. Ho con phai go cau hoi (vai
     * giay), nen cold start chay chong len khoang thoi gian do thay vi bat ho cho. Goi
     * dung MOT lan moi lan tai trang; loi thi im lang bo qua - day chi la toi uu. */
    function warmUp() {
      if (warmed) return;
      warmed = true;
      try {
        fetch(CFG.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ warm: true }),
          keepalive: true,
        }).catch(function () {});
      } catch (e) {}
    }

    function toggle(open) {
      ui.panel.hidden = !open;
      ui.wrap.classList.toggle("chat--open", open);
      ui.launcher.setAttribute("aria-expanded", String(open));
      if (open) {
        warmUp();
        if (!busy) ui.input.focus();
      }
    }

    renderIntro();

    ui.launcher.addEventListener("click", function () {
      toggle(ui.panel.hidden);
    });
    ui.closeBtn.addEventListener("click", function () {
      toggle(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !ui.panel.hidden) toggle(false);
    });
    ui.form.addEventListener("submit", function (e) {
      e.preventDefault();
      send(ui.input.value);
    });
  });
})();
