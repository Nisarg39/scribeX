import { appConfig } from '../core/config';

export const syncConfig = {
  apiUrl: appConfig.apiUrl,
  wsUrl: appConfig.wsUrl,
  defaultUserId: 'default_user',
  reconnectBaseDelayMs: appConfig.sync.reconnectBaseDelayMs,
  reconnectMaxDelayMs: appConfig.sync.reconnectMaxDelayMs,
  heartbeatIntervalMs: appConfig.sync.heartbeatIntervalMs,
};
