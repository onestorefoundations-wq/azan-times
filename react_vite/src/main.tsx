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
  registerSW({ immediate: true });
}

void bootstrap();
