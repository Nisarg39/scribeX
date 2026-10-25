import { Platform, ViewStyle, TextStyle } from 'react-native';

/**
 * Universal Web Styles & Native Browser Reset for ScribeX.
 *
 * Fully eliminates browser-default blue focus rectangles, sets up Inter typography,
 * and ensures that focus highlights only appear on our designed containers according
 * to the ScribeX Pastel Tile UI Design System.
 */

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // 1. Load Inter font family
  if (!document.getElementById('scribex-font-inter')) {
    const link = document.createElement('link');
    link.id = 'scribex-font-inter';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }

  // 2. Eradicate all native browser blue focus outlines across all inputs, textareas, and interactive tags
  if (!document.getElementById('scribex-global-styles')) {
    const style = document.createElement('style');
    style.id = 'scribex-global-styles';
    style.textContent = `
      * {
        box-sizing: border-box;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      /* Remove browser default blue rectangular focus outlines completely */
      input,
      textarea,
      select,
      button,
      a,
      [contenteditable="true"],
      [role="textbox"],
      [tabindex] {
        outline: none !important;
        outline-style: none !important;
        outline-width: 0 !important;
        outline-color: transparent !important;
        box-shadow: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      input:focus,
      input:focus-visible,
      input:active,
      textarea:focus,
      textarea:focus-visible,
      textarea:active,
      select:focus,
      select:focus-visible,
      button:focus,
      button:focus-visible,
      [contenteditable="true"]:focus,
      [contenteditable="true"]:focus-visible,
      [role="textbox"]:focus,
      [role="textbox"]:focus-visible,
      *:focus,
      *:focus-visible {
        outline: none !important;
        outline-style: none !important;
        outline-width: 0 !important;
        outline-color: transparent !important;
        box-shadow: none !important;
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

/**
 * React Native Web style reset object for TextInput components.
 * Cast to ViewStyle/TextStyle to safely pass to style arrays.
 */
export const webInputReset: (ViewStyle & TextStyle) = Platform.select({
  web: {
    outlineStyle: 'none' as any,
    outlineWidth: 0 as any,
    outlineColor: 'transparent' as any,
    boxShadow: 'none' as any,
  },
  default: {},
}) as any;
