import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'np.com.grisma.baghchal',
  appName: 'Baghchal',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0c0a09',
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'always',
    allowsLinkPreview: false,
    scrollEnabled: false,
  },
};

export default config;
