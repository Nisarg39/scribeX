import { registerRootComponent } from 'expo';
import './src/core/webStyles';
import App from './App';

// Web Global Resets & Typography Injection for ScribeX Pastel Tile Design System
if (typeof document !== 'undefined') {
  // 1. Load Inter font family
  if (!document.getElementById('scribex-font-inter')) {
    const link = document.createElement('link');
    link.id = 'scribex-font-inter';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }

  // 2. Global CSS reset to eliminate native browser blue focus rings and configure typography
  if (!document.getElementById('scribex-global-styles')) {
    const style = document.createElement('style');
    style.id = 'scribex-global-styles';
    style.textContent = `
      * {
        box-sizing: border-box;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      /* Remove browser default blue rectangular focus outlines */
      input, textarea, select, [contenteditable="true"], [role="textbox"] {
        outline: none !important;
        outline-style: none !important;
        outline-width: 0 !important;
        box-shadow: none !important;
      }
      input:focus, textarea:focus, select:focus {
        outline: none !important;
        outline-style: none !important;
      }
      body, html, #root {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        margin: 0;
        padding: 0;
        height: 100%;
        width: 100%;
      }
    `;
    document.head.appendChild(style);
  }
}

registerRootComponent(App);
