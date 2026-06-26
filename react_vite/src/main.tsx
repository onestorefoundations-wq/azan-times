import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StorageService } from './core/storageService';
import { DeviceService } from './core/deviceService';
import './styles/index.css';

async function bootstrap() {
  // Seed local storage defaults + generate device id before first render.
  await StorageService.init();
  DeviceService.getOrCreateDeviceId();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
