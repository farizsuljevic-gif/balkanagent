(() => {
  "use strict";

  if (window.__BALKAN_AGENT_WIDGET_LOADED__) {
    return;
  }

  window.__BALKAN_AGENT_WIDGET_LOADED__ = true;

  const script =
    document.currentScript;

  if (!script) {
    console.error(
      "Balkan Agent: widget script not found."
    );
    return;
  }

  const widgetKey =
    String(
      script.dataset.key || ""
    ).trim();

  if (!widgetKey) {
    console.error(
      "Balkan Agent: data-key is missing."
    );
    return;
  }

  const scriptUrl =
    new URL(script.src);

  const apiBase =
    scriptUrl.origin;

  const root =
    document.createElement("div");

  root.id =
    "balkan-agent-widget-root";

  root.style.position =
    "fixed";

  root.style.right =
    "20px";

  root.style.bottom =
    "20px";

  root.style.zIndex =
    "2147483647";

  document.body.appendChild(root);

  const shadow =
    root.attachShadow({
      mode: "open",
    });

  shadow.innerHTML = `
    <style>

      * {
        box-sizing: border-box;
      }

      :host {
        all: initial;
      }

      .ba-wrap {
        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Roboto,
          Arial,
          sans-serif;
      }

      .ba-launcher {
        width: 62px;
        height: 62px;
        border-radius: 50%;
        border: 1px solid rgba(216,169,76,.55);
        background:
          linear-gradient(
            145deg,
            #111b31,
            #050a14
          );
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow:
          0 16px 45px rgba(0,0,0,.35),
          inset 0 0 0 1px rgba(255,255,255,.04);
        transition:
          transform .2s ease,
          box-shadow .2s ease;
      }

      .ba-launcher:hover {
        transform: translateY(-2px);
        box-shadow:
          0 20px 55px rgba(0,0,0,.45);
      }

      .ba-launcher-logo {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #d8a94c;
        color: #e6bf65;
        font-weight: 900;
        font-size: 14px;
        letter-spacing: -1px;
      }

      .ba-panel {
        position: absolute;
        right: 0;
        bottom: 76px;
        width: 370px;
        max-width:
          calc(100vw - 30px);
        height: 570px;
        max-height:
          calc(100vh - 120px);
        background: #081321;
        border: 1px solid #233d60;
        border-radius: 18px;
        overflow: hidden;
        display: none;
        flex-direction: column;
        box-shadow:
          0 30px 90px rgba(0,0,0,.55);
      }

      .ba-panel.open {
        display: flex;
        animation:
          baOpen .18s ease;
      }

      @keyframes baOpen {
        from {
          opacity: 0;
          transform:
            translateY(10px)
            scale(.98);
        }

        to {
          opacity: 1;
          transform:
            translateY(0)
            scale(1);
        }
      }

      .ba-header {
        background:
          linear-gradient(
            135deg,
            #0b1730,
            #111b3b
          );
        border-bottom:
          1px solid #263c5d;
        padding: 16px;
        display: flex;
        align-items: center;
        justify-content:
          space-between;
      }

      .ba-brand {
        display: flex;
        align-items: center;
        gap: 11px;
      }

      .ba-logo {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        border:
          1px solid #d8a94c;
        color: #e6bf65;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 14px;
      }

      .ba-title {
        color: #fff;
        font-size: 14px;
        font-weight: 800;
        margin: 0;
      }

      .ba-subtitle {
        color: #78e5aa;
        font-size: 11px;
        margin-top: 2px;
      }

      .ba-close {
        border: 0;
        background: transparent;
        color: #9babc1;
        font-size: 20px;
        cursor: pointer;
        padding: 4px 7px;
      }

      .ba-close:hover {
        color: white;
      }

      .ba-messages {
        flex: 1;
        overflow-y: auto;
        padding: 15px;
        background:
          radial-gradient(
            circle at 100% 0,
            rgba(72,91,170,.14),
            transparent 50%
          ),
          #07101d;
      }

      .ba-message {
        display: flex;
        margin-bottom: 12px;
      }

      .ba-message.user {
        justify-content:
          flex-end;
      }

      .ba-bubble {
        max-width: 82%;
        padding:
          10px 12px;
        border-radius: 13px;
        font-size: 13px;
        line-height: 1.45;
        white-space: pre-wrap;
        word-break:
          break-word;
      }

      .ba-message.assistant
      .ba-bubble {
        background: #102039;
        border:
          1px solid #1e385b;
        color: #eef4ff;
        border-bottom-left-radius:
          4px;
      }

      .ba-message.user
      .ba-bubble {
        background:
          linear-gradient(
            135deg,
            #7045ef,
            #566df0
          );
        color: white;
        border-bottom-right-radius:
          4px;
      }

      .ba-typing {
        display: none;
        color: #8294ac;
        font-size: 12px;
        padding:
          0 15px 8px;
        background: #07101d;
      }

      .ba-typing.show {
        display: block;
      }

      .ba-input-area {
        border-top:
          1px solid #1d304d;
        padding: 11px;
        background: #081321;
      }

      .ba-input-row {
        display: flex;
        align-items:
          flex-end;
        gap: 8px;
      }

      .ba-input {
        flex: 1;
        min-height: 42px;
        max-height: 110px;
        resize: none;
        background: #050d19;
        color: #fff;
        border:
          1px solid #263d60;
        border-radius: 11px;
        padding:
          11px 12px;
        outline: none;
        font-family: inherit;
        font-size: 13px;
      }

      .ba-input:focus {
        border-color: #5b73d8;
      }

      .ba-send {
        width: 44px;
        height: 42px;
        border-radius: 10px;
        border:
          1px solid #735ce3;
        background:
          linear-gradient(
            135deg,
            #7550ef,
            #566de7
          );
        color: white;
        cursor: pointer;
        font-size: 17px;
      }

      .ba-send:disabled {
        opacity: .5;
        cursor: default;
      }

      .ba-footer {
        padding-top: 8px;
        text-align: center;
        color: #667991;
        font-size: 9px;
      }

      .ba-footer strong {
        color: #c9a552;
        font-weight: 700;
      }

      .ba-error {
        background:
          rgba(125,31,46,.22);
        border:
          1px solid #6d2935;
        color: #ff9ca8;
        padding: 9px;
        border-radius: 9px;
        font-size: 11px;
        margin-bottom: 10px;
      }

      @media (
        max-width: 500px
      ) {

        .ba-panel {
          position: fixed;
          width:
            calc(100vw - 20px);
          height:
            calc(100vh - 100px);
          max-height: none;
          right: 10px;
          bottom: 88px;
          border-radius: 16px;
        }

        .ba-launcher {
          width: 58px;
          height: 58px;
        }
      }

    </style>

    <div class="ba-wrap">

      <div
        class="ba-panel"
        id="baPanel"
      >

        <div class="ba-header">

          <div class="ba-brand">

            <div class="ba-logo">
              BA
            </div>

            <div>

              <div
                class="ba-title"
                id="baCompany"
              >
                AI Receptionist
              </div>

              <div class="ba-subtitle">
                ● Online
              </div>

            </div>

          </div>

          <button
            class="ba-close"
            id="baClose"
            aria-label="Close"
          >
            ×
          </button>

        </div>


        <div
          class="ba-messages"
          id="baMessages"
        ></div>


        <div
          class="ba-typing"
          id="baTyping"
        >
          AI Receptionist piše...
        </div>


        <div class="ba-input-area">

          <div class="ba-input-row">

            <textarea
              class="ba-input"
              id="baInput"
              rows="1"
              placeholder="Napišite poruku..."
            ></textarea>

            <button
              class="ba-send"
              id="baSend"
              aria-label="Send"
            >
              ➤
            </button>

          </div>

          <div class="ba-footer">
            Powered by
            <strong>
              Balkan Agent
            </strong>
          </div>

        </div>

      </div>


      <button
        class="ba-launcher"
        id="baLauncher"
        aria-label="Open AI Receptionist"
      >
        <div class="ba-launcher-logo">
          BA
        </div>
      </button>

    </div>
  `;


  const panel =
    shadow.getElementById(
      "baPanel"
    );

  const launcher =
    shadow.getElementById(
      "baLauncher"
    );

  const close =
    shadow.getElementById(
      "baClose"
    );

  const messages =
    shadow.getElementById(
      "baMessages"
    );

  const input =
    shadow.getElementById(
      "baInput"
    );

  const send =
    shadow.getElementById(
      "baSend"
    );

  const typing =
    shadow.getElementById(
      "baTyping"
    );

  const company =
    shadow.getElementById(
      "baCompany"
    );


  let sending = false;

  let initialized = false;


  function scrollBottom() {

    messages.scrollTop =
      messages.scrollHeight;
  }


  function addMessage(
    role,
    text
  ) {

    const row =
      document.createElement(
        "div"
      );

    row.className =
      `ba-message ${role}`;


    const bubble =
      document.createElement(
        "div"
      );

    bubble.className =
      "ba-bubble";

    bubble.textContent =
      text;


    row.appendChild(
      bubble
    );

    messages.appendChild(
      row
    );

    scrollBottom();
  }


  function addError(text) {

    const error =
      document.createElement(
        "div"
      );

    error.className =
      "ba-error";

    error.textContent =
      text;

    messages.appendChild(
      error
    );

    scrollBottom();
  }


  async function loadConfig() {

    try {

      const response =
        await fetch(
          `${apiBase}/api/widget/config?key=${encodeURIComponent(widgetKey)}`,
          {
            method: "GET",
          }
        );


      const data =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (!response.ok) {

        throw new Error(
          data.error ||
          "Widget configuration failed."
        );
      }


      company.textContent =
        data.company ||
        "AI Receptionist";


      if (
        data.welcome_message
      ) {

        addMessage(
          "assistant",
          data.welcome_message
        );
      }


      initialized = true;


    } catch (error) {

      console.error(
        "Balkan Agent:",
        error
      );

      addError(
        "AI asistent trenutno nije dostupan."
      );
    }
  }


  async function sendMessage() {

    if (sending) {
      return;
    }


    const message =
      input.value
        .trim();


    if (!message) {
      return;
    }


    if (
      message.length > 4000
    ) {

      addError(
        "Poruka je preduga."
      );

      return;
    }


    addMessage(
      "user",
      message
    );


    input.value = "";

    input.style.height =
      "42px";


    sending = true;

    send.disabled = true;

    typing.classList.add(
      "show"
    );


    try {

      const response =
        await fetch(
          `${apiBase}/api/widget/chat`,
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify({
                key:
                  widgetKey,

                message,
              }),
          }
        );


      const data =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (!response.ok) {

        throw new Error(
          data.error ||
          "AI request failed."
        );
      }


      addMessage(
        "assistant",
        data.reply ||
        "Trenutno nemam odgovor."
      );


    } catch (error) {

      console.error(
        "Balkan Agent:",
        error
      );


      addError(
        "Došlo je do greške. Molimo pokušajte ponovo."
      );


    } finally {

      sending = false;

      send.disabled =
        false;

      typing
        .classList
        .remove(
          "show"
        );

      input.focus();
    }
  }


  launcher.addEventListener(
    "click",
    async () => {

      panel.classList.toggle(
        "open"
      );


      if (
        panel.classList.contains(
          "open"
        )
      ) {

        if (!initialized) {

          await loadConfig();
        }


        setTimeout(
          () => {
            input.focus();
          },
          100
        );
      }
    }
  );


  close.addEventListener(
    "click",
    () => {

      panel.classList.remove(
        "open"
      );
    }
  );


  send.addEventListener(
    "click",
    sendMessage
  );


  input.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {

        event.preventDefault();

        sendMessage();
      }
    }
  );


  input.addEventListener(
    "input",
    () => {

      input.style.height =
        "42px";

      input.style.height =
        Math.min(
          input.scrollHeight,
          110
        ) + "px";
    }
  );

})();
