export default {
  expo: {
    entryPoint: "./index.ts",
    name: "Tikatu Coleta",
    slug: "tikatu-coleta",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/imagem-home.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    jsEngine: "jsc",
    appId: "com.tikatu.coleta",
    splash: {
      image: "./assets/imagem-home.png",
      resizeMode: "contain",
      backgroundColor: "#f8fafc"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.tikatu.coleta",
      icon: "./assets/imagem-home.png"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/imagem-home.png",
        backgroundColor: "#f8fafc"
      },
      edgeToEdgeEnabled: false,
      package: "com.tikatu.coleta",
      icon: "./assets/imagem-home.png"
    },
    web: {
      favicon: "./assets/imagem-home.png",
      bundler: "metro",
      name: "Tikatu Coleta",
      shortName: "Tikatu",
      description: "Sistema de Coleta de Dados de Qualidade da Água",
      themeColor: "#0066CC",
      backgroundColor: "#f8fafc",
      display: "standalone",
      startUrl: "/",
      scope: "/",
      orientation: "portrait",
      manifest: {
        name: "Tikatu Coleta",
        short_name: "Tikatu",
        description: "Sistema de Coleta de Dados de Qualidade da Água",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#0066CC",
        background_color: "#f8fafc",
        orientation: "portrait",
        icons: [
          {
            src: "./assets/imagem-home.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "./assets/imagem-home.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable any"
          }
        ]
      }
    },
    extra: {
      eas: {
        projectId: "ac77685a-cb11-437e-b8e3-04c3a7aed0c9"
      }
    }
  }
};
