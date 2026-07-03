/* eslint-disable @typescript-eslint/no-require-imports */

// Load .env.<APP_ENV> via dotenv
const APP_ENV = process.env.APP_ENV ?? 'development';

require('dotenv').config({ path: `.env.${APP_ENV}` });

// Version codes: dev=1, staging=2, prod=3
const VERSION_CODE = { development: 1, staging: 2, production: 3 }[APP_ENV] ?? 1;
const APP_VERSION = '1.0.0';

const APP_NAME_MAP = {
  development: 'Cocohub (Dev)',
  staging: 'Cocohub (Staging)',
  production: 'Cocohub',
};

module.exports = {
  expo: {
    name: APP_NAME_MAP[APP_ENV] ?? 'Cocohub',
    slug: 'cocohub-mobile',
    scheme: 'cocohub',
    version: APP_VERSION,
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#1A1A1A',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier:
        APP_ENV === 'production' ? 'app.cocohub.mobile' : `app.cocohub.mobile.${APP_ENV}`,
      associatedDomains: ['applinks:cocohub.app'],
      buildNumber: String(VERSION_CODE),
      infoPlist: {
        NSCameraUsageDescription:
          'Cocohub needs camera access to scan QR codes for pet identification and medical record sharing.',
        NSPhotoLibraryUsageDescription:
          'Cocohub needs photo library access to upload pictures of your pets for their profiles.',
        NSPhotoLibraryAddUsageDescription: 'Cocohub saves photos you take to your pet profile.',
        NSLocationWhenInUseUsageDescription:
          'Cocohub uses your location for the Emergency SOS feature to share your whereabouts with emergency contacts when you request help.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Cocohub uses your location for the Emergency SOS feature to share your whereabouts with emergency contacts when you request help.',
        NSUserTrackingUsageDescription: 'Cocohub does not track you for advertising purposes.',
        NSFaceIDUsageDescription:
          "Cocohub uses Face ID/Touch ID for secure biometric authentication to protect your pet's medical data.",
        UIBackgroundModes: ['location', 'background-fetch'],
      },
      // App Groups for widget data sharing
      appGroups: ['group.app.cocohub.mobile'],
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#4A90A4',
      },
      package: APP_ENV === 'production' ? 'app.cocohub.mobile' : `app.cocohub.mobile.${APP_ENV}`,
      versionCode: VERSION_CODE,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: 'cocohub.app', pathPrefix: '/' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
      permissions: [
        'CAMERA',
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'POST_NOTIFICATIONS',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'READ_MEDIA_IMAGES',
      ],
      softwareKeyboardLayoutMode: 'pan',
      // Widget configuration for Android
      metaData: [
        {
          name: 'com.google.android.gms.version',
          value: '@integer/google_play_services_version',
        },
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-updates',
      [
        '@sentry/react-native/expo',
        {
          organization: 'cocohub',
          project: 'mobile-app',
          // Upload source maps so stack traces are human-readable in the dashboard
          uploadNativeSymbols: true,
          uploadSourceMaps: true,
        },
      ],
      './plugins/withAndroidLockScreen.js',
      // Widget support plugin disabled for local web dev (native builds only)
      // [
      //   './expoWidgetPlugin.js',
      //   {
      //     ios: { appGroup: 'group.app.cocohub.mobile', targetName: 'CocohubWidget' },
      //     android: { widgetName: 'CocohubWidgetProvider' },
      //   },
      // ],
    ],
    extra: {
      APP_ENV,
      API_BASE_URL:
        process.env.API_BASE_URL ??
        (APP_ENV === 'production'
          ? (process.env.PROD_API_URL ?? 'https://api.cocohub.app/api')
          : APP_ENV === 'staging'
            ? (process.env.STAGING_API_URL ?? 'https://staging.cocohub.app/api')
            : 'http://localhost:3000/api'),
      STAGING_API_URL: process.env.STAGING_API_URL ?? 'https://staging.cocohub.app/api',
      PROD_API_URL: process.env.PROD_API_URL ?? 'https://api.cocohub.app/api',
      API_TIMEOUT: process.env.API_TIMEOUT ?? '10000',
      SENTRY_DSN: process.env.SENTRY_DSN ?? '',
      SENTRY_ENABLE_IN_DEV: process.env.SENTRY_ENABLE_IN_DEV ?? 'false',
      MAX_CACHE_SIZE: process.env.MAX_CACHE_SIZE ?? '50',
      PAGINATION_LIMIT: process.env.PAGINATION_LIMIT ?? '20',
      IOS_STORE_URL: process.env.IOS_STORE_URL ?? 'https://apps.apple.com/app/cocohub/id000000000',
      ANDROID_STORE_URL:
        process.env.ANDROID_STORE_URL ??
        'https://play.google.com/store/apps/details?id=app.cocohub.mobile',
      MIN_NATIVE_VERSION_IOS: process.env.MIN_NATIVE_VERSION_IOS ?? '1.0.0',
      MIN_NATIVE_VERSION_ANDROID: process.env.MIN_NATIVE_VERSION_ANDROID ?? '1.0.0',
    },
  },
};
