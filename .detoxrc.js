module.exports = {
  configurations: {
   ios: {
     binaryPath: "ios/build/Build/Products/Debug-iphonesimulator/yourApp.app",
     build: "xcodebuild -workspace ios/yourApp.xcworkspace -scheme yourApp -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build",
     type: "ios.simulator",
     name: "iPhone 11",
   },
   android: {
     binaryPath: "android/app/build/outputs/apk/debug/app-debug.apk",
     build: "gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug",
     type: "android.emulator",
     name: "Pixel_4_API_30",
   },
  },
  session: {
     configuration: "ios", // or "android"
     retries: 3,
  },
};