/**
 * Expo config plugin to enable Android lock screen visibility for the SOS feature.
 *
 * This plugin modifies the AndroidManifest.xml to add:
 * - android:showWhenLocked="true" – allows the activity to be displayed above the lock screen
 * - android:turnScreenOn="true" – turns the screen on when the activity is launched
 *
 * These flags are required for the SOS emergency button to function when the device is locked.
 * The flags are added to the main (launcher) activity via intent-filter merge.
 *
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
const { withAndroidManifest } = require('@expo/config-plugins');

function withSOSLockScreen(config) {
  return withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];

    if (!mainApplication) {
      return config;
    }

    const activities = mainApplication.activity;
    if (!activities || activities.length === 0) {
      return config;
    }

    // Find the main launcher activity and add lock screen flags
    for (const activity of activities) {
      const intentFilters = activity['intent-filter'];
      if (intentFilters) {
        const filters = Array.isArray(intentFilters) ? intentFilters : [intentFilters];
        for (const filter of filters) {
          const actions = filter.action || [];
          const actionArray = Array.isArray(actions) ? actions : [actions];
          if (actionArray.some((a) => a['android:name'] === 'android.intent.action.MAIN')) {
            // Add showWhenLocked and turnScreenOn to the main activity
            activity.$['android:showWhenLocked'] = 'true';
            activity.$['android:turnScreenOn'] = 'true';
            break;
          }
        }
      }
    }

    return config;
  });
}

module.exports = withSOSLockScreen;
