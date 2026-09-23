import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'to.joli.app',
  appName: 'Jolito',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#fdf5f8',
  },
  ios: {
    // 'never' prevents UIKit from double-insetting WKWebView scroll views
    // on top of CSS env(safe-area-inset-*) when viewport-fit=cover is set.
    contentInset: 'never',
    preferredContentMode: 'mobile',
    backgroundColor: '#fdf5f8',
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'light',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#fdf5f8',
    },
  },
}

export default config
