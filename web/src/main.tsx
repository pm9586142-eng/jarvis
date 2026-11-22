import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerAmServiceWorker } from './services/offline/swRegister';
import './styles/index.css';

if (typeof window !== 'undefined' && import.meta.env.PROD) {
  void registerAmServiceWorker();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
