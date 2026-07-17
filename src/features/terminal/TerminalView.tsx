import { forwardRef, useImperativeHandle, useRef } from "react";
import { Platform } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import {
  parseOutbound,
  serializeInbound,
  type TerminalInbound,
  type TerminalOutbound,
} from "@/terminal/protocol";
import { colors } from "@/theme/colors";

// The imperative handle the logic hook drives to push remote output / theme
// changes into the page (RN → WebView half of the bridge).
export interface TerminalHandle {
  push: (msg: TerminalInbound) => void;
}

interface TerminalViewProps {
  readonly htmlUri: string;
  readonly accent: string;
  readonly onOutbound: (msg: TerminalOutbound) => void;
}

// Hosts xterm.js in a locked-down WebView: local self-contained asset only, JS
// on, no cookies, and (iOS) our own key row instead of the system accessory bar.
// Keystrokes and fit/size come back through onMessage; writes go in via the ref.
export const TerminalView = forwardRef<TerminalHandle, TerminalViewProps>(function TerminalView(
  { htmlUri, accent, onOutbound },
  ref,
) {
  const webviewRef = useRef<WebView>(null);

  useImperativeHandle(
    ref,
    () => ({
      push: (msg: TerminalInbound) => {
        const json = serializeInbound(msg);
        webviewRef.current?.injectJavaScript(
          `window.__wharf && window.__wharf.push(${JSON.stringify(json)}); true;`,
        );
      },
    }),
    [],
  );

  const handleMessage = (event: WebViewMessageEvent) => {
    const msg = parseOutbound(event.nativeEvent.data);
    if (msg) {
      onOutbound(msg);
    }
  };

  return (
    <WebView
      ref={webviewRef}
      source={{ uri: htmlUri }}
      originWhitelist={["file://*"]}
      onMessage={handleMessage}
      injectedJavaScriptBeforeContentLoaded={`window.__wharf_accent=${JSON.stringify(accent)}; true;`}
      javaScriptEnabled
      domStorageEnabled={false}
      thirdPartyCookiesEnabled={false}
      sharedCookiesEnabled={false}
      overScrollMode="never"
      keyboardDisplayRequiresUserAction={false}
      hideKeyboardAccessoryView={Platform.OS === "ios"}
      automaticallyAdjustContentInsets={false}
      style={{ flex: 1, backgroundColor: colors.shell }}
    />
  );
});
