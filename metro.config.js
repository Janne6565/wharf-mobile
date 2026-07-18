// Metro config wired for NativeWind v4 (CSS interop via the global stylesheet).
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Defense-in-depth: keep any stray co-located test files out of the app bundle.
// expo-router discovers routes via require.context over app/, which would otherwise
// pull *.test.tsx (and their Node-only RTL deps) into the production bundle. Jest
// uses its own resolver, so the tests still run.
//
// IMPORTANT: test files may NOT live inside app/ at all — this blockList is only a
// bundle-time safety net and does NOT protect the typed-routes generator. That
// generator scans app/ in Node WITHOUT Metro's blockList, so a file like
// app/(tabs)/_layout.test.tsx gets treated as the (tabs) group's layout node and
// silently collapses every (tabs) route out of .expo/types/router.d.ts, breaking
// `bun run typecheck`. Route-screen tests live next to their feature in src/ instead.
config.resolver.blockList = /.*\.(test|spec)\.[jt]sx?$/;

// Bundle the committed, self-contained terminal.html (xterm.js + JetBrains Mono
// inlined) as a static asset so `require("@/terminal/terminal.html")` resolves to
// a localUri the WebView loads — works in release builds on both platforms.
config.resolver.assetExts.push("html");

module.exports = withNativeWind(config, { input: "./global.css" });
