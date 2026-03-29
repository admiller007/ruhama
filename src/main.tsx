import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

if (import.meta.env.DEV) {
  const { default: theatre } = await import('@theatre/core')
  const { default: studio } = await import('@theatre/studio')
  theatre.init({ studio: true })
  studio.initialize()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
