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

export const syncConfig = {
  apiUrl:
    process.env.EXPO_PUBLIC_API_URL ||
    `http://${DEFAULT_HOST}:${DEFAULT_PORT}`,
  wsUrl:
    process.env.EXPO_PUBLIC_WS_URL ||
    `ws://${DEFAULT_HOST}:${DEFAULT_PORT}/ws/sync`,
  defaultUserId:
    process.env.EXPO_PUBLIC_USER_ID ||
    'default_user',
  reconnectBaseDelayMs: 1000,
  reconnectMaxDelayMs: 10000,
  heartbeatIntervalMs: 25000,
};
