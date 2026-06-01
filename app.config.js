const IS_PRODUCTION = process.env.EAS_BUILD_PROFILE === 'production';

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: "Meal Planner Roulette",
  slug: "meal-planner-roulette",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: ["mealplannerroulette"],
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#FF6B6B",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.mealplanner.roulette",
    infoPlist: {
      NSPhotoLibraryUsageDescription: "Allow $(PRODUCT_NAME) to access your photos",
      NSCameraUsageDescription: "Allow $(PRODUCT_NAME) to access your camera",
      NSMicrophoneUsageDescription: "Allow $(PRODUCT_NAME) to access your microphone",
      NSLocationAlwaysAndWhenInUseUsageDescription: "Allow $(PRODUCT_NAME) to use your location.",
      NSLocationAlwaysUsageDescription: "Allow $(PRODUCT_NAME) to use your location.",
      NSLocationWhenInUseUsageDescription: "Allow $(PRODUCT_NAME) to use your location.",
      UIBackgroundModes: ["location", "audio"],
      ITSAppUsesNonExemptEncryption: false,
    },
    usesIcloudStorage: true,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#FF6B6B",
    },
    package: "com.mealplanner.roulette",
    permissions: [
      "android.permission.CAMERA",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_LOCATION",
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      "android.permission.RECORD_AUDIO",
      "android.permission.MODIFY_AUDIO_SETTINGS",
    ],
  },
  web: {
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    ["expo-router", { origin: "https://mealplannerroulette.com/" }],
    ["expo-image-picker", { photosPermission: "The app accesses your photos to let you share them with your friends." }],
    ["expo-document-picker", { iCloudContainerEnvironment: "Production" }],
    [
      "expo-location",
      {
        isAndroidForegroundServiceEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isIosBackgroundLocationEnabled: true,
        locationAlwaysAndWhenInUsePermission: "Allow $(PRODUCT_NAME) to use your location.",
      },
    ],
    ["expo-av", { microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone" }],
    "expo-font",
    "expo-web-browser",
    // Only include expo-dev-client in non-production builds
    ...(!IS_PRODUCTION ? ["expo-dev-client"] : []),
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: { origin: "https://mealplannerroulette.com/" },
    eas: { projectId: "e36152c2-4d13-42cf-8583-ca804d6dae79" },
  },
};

module.exports = { expo: config };
