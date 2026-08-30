import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StorageService } from './core/storageService';
import { DeviceService } from './core/deviceService';
import './styles/index.css';
import { registerSW } from 'virtual:pwa-register';

async function bootstrap() {
  // Seed local storage defaults + generate device id before first render.
  await StorageService.init();
  DeviceService.getOrCreateDeviceId();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

  // Registered here rather than injected into every HTML entry, so the
  // display's service worker never lands on the congregation page.
  // Skipped in the native (Capacitor) build: the APK already ships every asset,
  // and a worker caching them would serve the previous build's JS after an app
  // update until its own cache expired.
  if (!import.meta.env.VITE_NATIVE) registerSW({ immediate: true });
}

void bootstrap();
