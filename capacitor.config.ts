import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'np.com.grisma.baghchal',
  appName: 'Baghchal',
  webDir: 'dist',
  bundledWebRuntime: false,
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
};

export default config;
