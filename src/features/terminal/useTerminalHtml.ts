// Resolves the bundled terminal.html asset to a local URI the WebView can load.
// expo-asset copies the committed asset out of the bundle (release-safe on both
// platforms); until it resolves, the screen shows the connecting overlay.

import { Asset } from "expo-asset";
import { useEffect, useState } from "react";

// A require() of a Metro-bundled asset yields its numeric module id (see the
// "*.html" declaration in global.d.ts + assetExts in metro.config.js).
const TERMINAL_HTML_MODULE = require("../../terminal/terminal.html") as number;

export function useTerminalHtml(): string | null {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const asset = Asset.fromModule(TERMINAL_HTML_MODULE);
      await asset.downloadAsync();
      if (active) {
        setUri(asset.localUri ?? asset.uri);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return uri;
}
