// Metro config wired for NativeWind v4 (CSS interop via the global stylesheet).
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Keep co-located test files out of the app bundle. expo-router discovers routes
// via require.context over app/, which would otherwise pull *.test.tsx (and their
// Node-only RTL deps) into the production bundle. Jest uses its own resolver, so
// the tests still run.
config.resolver.blockList = /.*\.(test|spec)\.[jt]sx?$/;

module.exports = withNativeWind(config, { input: "./global.css" });
