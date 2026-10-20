/*
 * Relay website chat (decided 2026-10-19). Paste on any page:
 *   <script src="https://YOUR-RELAY-HOST/widget.js" data-relay-key="WIDGET_KEY" async></script>
 * It adds a chat button; the conversation itself runs in a Relay page inside a frame, so it never touches the
 * site's own code or cookies. No dependencies; safe to load twice.
 */
(function () {
  if (window.__relayWidget) return;
  var script = document.currentScript || document.querySelector("script[data-relay-key]");
  if (!script) return;
  var key = script.getAttribute("data-relay-key");
  if (!/^[0-9a-f]{32}$/.test(key || "")) return;
  var origin = new URL(script.src).origin;
  window.__relayWidget = true;

  fetch(origin + "/api/widget/" + key)
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      if (!cfg || !cfg.live) return;
      var side = cfg.position === "left" ? "left" : "right";

      var frame = document.createElement("iframe");
      frame.src = origin + "/widget/" + key;
      frame.title = "Chat with " + cfg.business;
      frame.setAttribute("allow", "clipboard-write");
      frame.style.cssText =
        "position:fixed;bottom:88px;" + side + ":16px;width:min(380px,calc(100vw - 32px));height:min(600px,calc(100vh - 120px));" +
        "border:0;border-radius:16px;box-shadow:0 24px 56px -12px rgba(0,0,0,.35);z-index:2147483646;display:none;background:#fff;color-scheme:light";

      var button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", "Chat with " + cfg.business);
      button.setAttribute("aria-expanded", "false");
      button.style.cssText =
        "position:fixed;bottom:16px;" + side + ":16px;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;z-index:2147483647;" +
        "background:" + cfg.color + ";color:#fff;box-shadow:0 8px 24px -6px rgba(0,0,0,.35);display:grid;place-items:center;transition:transform .15s";
      var chat = '<svg width="26" height="26" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M128 24A104 104 0 0 0 36.2 176.9l-11.4 34A16 16 0 0 0 45 231.2l34-11.4A104 104 0 1 0 128 24Z"/></svg>';
      var close = '<svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M205.7 194.3a8 8 0 0 1-11.4 11.4L128 139.3l-66.3 66.4a8 8 0 0 1-11.4-11.4l66.4-66.3-66.4-66.3a8 8 0 0 1 11.4-11.4l66.3 66.4 66.3-66.4a8 8 0 0 1 11.4 11.4L139.3 128Z"/></svg>';
      button.innerHTML = chat;
      button.onpointerdown = function () { button.style.transform = "scale(.94)"; };
      button.onpointerup = button.onpointerleave = function () { button.style.transform = ""; };

      function toggle(open) {
        frame.style.display = open ? "block" : "none";
        button.innerHTML = open ? close : chat;
        button.setAttribute("aria-expanded", String(open));
        if (frame.contentWindow) frame.contentWindow.postMessage({ relay: open ? "opened" : "closed" }, origin);
      }
      button.onclick = function () { toggle(frame.style.display === "none"); };
      window.addEventListener("message", function (e) {
        if (e.origin === origin && e.data && e.data.relay === "close") toggle(false);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && frame.style.display !== "none") toggle(false);
      });

      document.body.appendChild(frame);
      document.body.appendChild(button);
    })
    .catch(function () {});
})();
