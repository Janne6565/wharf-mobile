// Builds src/terminal/terminal.html: a COMMITTED, fully self-contained page that
// renders the SSH scrollback with xterm.js inside a react-native-webview. It has
// NO network access whatsoever (enforced by a strict CSP meta tag) — xterm.js,
// its CSS, and the JetBrains Mono font are all inlined at build time from
// node_modules. Run with `bun run gen:terminal` whenever xterm or the font bumps.
//
// The in-page bootstrap speaks the bridge protocol in src/terminal/protocol.ts:
//   WebView → RN : {type:"ready"} | {type:"data",dataB64} | {type:"size",cols,rows}
//   RN → WebView : window.__wharf.push(json) with {type:"write",dataB64} | {type:"theme",accent}

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const req = (p) => resolve(root, "node_modules", p);

const xtermJs = readFileSync(req("@xterm/xterm/lib/xterm.js"), "utf8");
const xtermCss = readFileSync(req("@xterm/xterm/css/xterm.css"), "utf8");
const fitJs = readFileSync(req("@xterm/addon-fit/lib/addon-fit.js"), "utf8");
const fontTtf = readFileSync(
  req("@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf"),
);
const fontDataUri = `data:font/ttf;base64,${fontTtf.toString("base64")}`;

// Guard against a stray "</script>" inside minified bundles breaking the tag.
const safeJs = (s) => s.replaceAll("</script>", "<\\/script>");

// Palette mirrors src/theme/colors.ts (the shell tokens the mock uses). The
// cursor colour is the runtime accent, defaulted here and overridable via the
// {type:"theme"} push and the before-content injection (window.__wharf_accent).
const THEME = {
  background: "#0A0E13",
  foreground: "#E8EDF2",
  cursorAccent: "#0A0E13",
  selectionBackground: "#233140",
  black: "#0A0E13",
  brightBlack: "#54646F",
  white: "#BCC8D2",
  brightWhite: "#E8EDF2",
};
const DEFAULT_ACCENT = "#57D7C2";

const bootstrap = `
(function () {
  var accent = window.__wharf_accent || ${JSON.stringify(DEFAULT_ACCENT)};
  function baseTheme(cursor) {
    return {
      background: ${JSON.stringify(THEME.background)},
      foreground: ${JSON.stringify(THEME.foreground)},
      cursor: cursor,
      cursorAccent: ${JSON.stringify(THEME.cursorAccent)},
      selectionBackground: ${JSON.stringify(THEME.selectionBackground)}
    };
  }
  var term = new window.Terminal({
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12.5,
    lineHeight: 1.2,
    scrollback: 5000,
    cursorBlink: true,
    allowProposedApi: true,
    theme: baseTheme(accent)
  });
  var fit = new window.FitAddon.FitAddon();
  term.loadAddon(fit);
  var el = document.getElementById("terminal");
  term.open(el);

  function post(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }
  function b64ToBytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function utf8ToB64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function doFit() {
    try { fit.fit(); } catch (e) {}
    post({ type: "size", cols: term.cols, rows: term.rows });
  }

  window.__wharf = {
    push: function (json) {
      var msg;
      try { msg = JSON.parse(json); } catch (e) { return; }
      if (msg.type === "write") {
        term.write(b64ToBytes(msg.dataB64));
      } else if (msg.type === "theme") {
        term.options.theme = baseTheme(msg.accent);
      }
    }
  };

  term.onData(function (d) { post({ type: "data", dataB64: utf8ToB64(d) }); });

  window.addEventListener("resize", doFit);
  if (window.ResizeObserver) {
    new window.ResizeObserver(doFit).observe(el);
  }
  doFit();
  term.focus();
  post({ type: "ready" });
})();
`;

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'" />
    <style>
${xtermCss}
      @font-face {
        font-family: 'JetBrains Mono';
        font-style: normal;
        font-weight: 400;
        src: url(${fontDataUri}) format('truetype');
      }
      html, body {
        margin: 0;
        padding: 0;
        height: 100%;
        background: ${THEME.background};
        overflow: hidden;
      }
      #terminal {
        position: absolute;
        inset: 0;
        padding: 8px 10px;
      }
      .xterm .xterm-viewport { background-color: ${THEME.background} !important; }
    </style>
  </head>
  <body>
    <div id="terminal"></div>
    <script>${safeJs(xtermJs)}</script>
    <script>${safeJs(fitJs)}</script>
    <script>${bootstrap}</script>
  </body>
</html>
`;

const out = resolve(root, "src/terminal/terminal.html");
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KiB)`);
