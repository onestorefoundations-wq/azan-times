/**
 * about-main.tsx
 * Entry point for the public landing page (about.html).
 *
 * A third entry alongside the display and the congregation app: someone reading
 * a marketing page should not download the TV bundle or the prayer-times app to
 * do it, and this page has no service worker or manifest of its own — it is an
 * ordinary web page, not something to install.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import AboutPage from './pages/AboutPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AboutPage />
  </React.StrictMode>,
);
