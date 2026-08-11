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
  ios: {
    buildNumber: "8",
    // icon.png stays opaque — the App Store rejects light icons with alpha.
    // The dark variant is transparent so iOS composites it on the system dark
    // background. Omitting `tinted` lets iOS derive it from the light icon.
    icon: {
      light: "./assets/images/icon.png",
      dark: "./assets/images/icon-dark.png",
    },
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
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 220,
        resizeMode: "contain",
        backgroundColor: "#FFFFFF",
        dark: { backgroundColor: "#000000" },
      },
    ],
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
    "expo-apple-authentication",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: { origin: "https://mealplannerroulette.com/" },
    eas: { projectId: "fd4e8da8-2d8b-41f6-b6ed-6f1b9b885066" },
  },
};

module.exports = { expo: config };
