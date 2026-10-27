const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Enable WebAssembly for expo-sqlite web OPFS/wa-sqlite support
config.resolver.assetExts.push("wasm");

module.exports = withNativeWind(config, { input: "./global.css" });
