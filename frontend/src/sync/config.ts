let platformOS = 'web';
try {
  const rn = require('react-native');
  if (rn?.Platform?.OS) platformOS = rn.Platform.OS;
} catch (e) {}

function resolveDefaultHost(): string {
  if (platformOS === 'android') {
    // Android emulator host loopback
    return '10.0.2.2';
  }
  if (platformOS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return window.location.hostname;
  }
  return 'localhost';
}

const DEFAULT_HOST = resolveDefaultHost();
const DEFAULT_PORT = '8000';

const rawApiUrl =
  process.env.EXPO_PUBLIC_API_URL || `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;

function deriveWebSocketUrl(apiUrl: string): string {
  if (process.env.EXPO_PUBLIC_WS_URL) {
    return process.env.EXPO_PUBLIC_WS_URL;
  }
  // Convert http:// -> ws:// and https:// -> wss://
  const wsProtocol = apiUrl.startsWith('https://') ? 'wss://' : 'ws://';
  const hostAndPort = apiUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `${wsProtocol}${hostAndPort}/ws/sync`;
}

export const syncConfig = {
  apiUrl: rawApiUrl.replace(/\/+$/, ''),
  wsUrl: deriveWebSocketUrl(rawApiUrl),
  // Default fallback until dynamic central AuthContext is active
  defaultUserId: 'default_user',
  reconnectBaseDelayMs: 1000,
  reconnectMaxDelayMs: 10000,
  heartbeatIntervalMs: 25000,
};
