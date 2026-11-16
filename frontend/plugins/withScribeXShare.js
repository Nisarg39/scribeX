const { withEntitlementsPlist, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const APP_GROUP_ID = 'group.com.nashtech.scribex';

/**
 * Expo Config Plugin for ScribeX iOS Share Sheet & App Group Integration.
 * 1. Injects `com.apple.security.application-groups` entitlement into the main iOS app.
 * 2. Copies `ScribeXShareIntentModule.swift` and `ScribeXShareIntentModule.m` into the generated
 *    iOS project directory when `expo prebuild --platform ios` runs.
 */
function withScribeXShare(config) {
  config = withEntitlementsPlist(config, (mod) => {
    const existing = mod.modResults['com.apple.security.application-groups'] || [];
    if (!existing.includes(APP_GROUP_ID)) {
      mod.modResults['com.apple.security.application-groups'] = [...existing, APP_GROUP_ID];
    }
    return mod;
  });

  config = withDangerousMod(config, [
    'ios',
    async (mod) => {
      const projectRoot = mod.modRequest.projectRoot;
      const platformRoot = mod.modRequest.platformProjectRoot;
      const appName = mod.modRequest.projectName || 'ScribeX';
      const sourceDir = path.join(projectRoot, 'ios-native-share');
      const targetAppDir = path.join(platformRoot, appName);

      if (fs.existsSync(sourceDir) && fs.existsSync(targetAppDir)) {
        for (const fileName of ['ScribeXShareIntentModule.swift', 'ScribeXShareIntentModule.m']) {
          const src = path.join(sourceDir, fileName);
          const dst = path.join(targetAppDir, fileName);
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dst);
          }
        }
      }

      return mod;
    },
  ]);

  return config;
}

module.exports = withScribeXShare;
