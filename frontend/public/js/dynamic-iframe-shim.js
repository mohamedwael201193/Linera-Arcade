/**
 * Dynamic Iframe Shim
 * 
 * This script must load BEFORE any other scripts in the app.
 * It marks Dynamic authentication iframes as credentialless to work
 * with COEP (Cross-Origin-Embedder-Policy) headers required for WASM.
 * 
 * Without this, Dynamic's authentication iframes would be blocked by COEP,
 * breaking wallet connection functionality.
 */
(() => {
  'use strict';

  // Match Dynamic authentication hosts
  const matchesAuthHost = (url) => {
    try {
      const u = new URL(url, document.baseURI);
      return (
        u.hostname === 'relay.dynamicauth.com' ||
        /\.dynamicauth\.com$/.test(u.hostname)
      );
    } catch {
      return false;
    }
  };

  // Mark iframe as credentialless
  const markCredentialless = (iframe) => {
    try {
      iframe.credentialless = true;
    } catch (e) {
      // Silently ignore if browser doesn't support credentialless
    }
  };

  // 1. Intercept iframe.src setter
  try {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLIFrameElement.prototype,
      'src'
    );
    if (descriptor && descriptor.set) {
      const originalSet = descriptor.set;
      Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
        configurable: true,
        enumerable: descriptor.enumerable,
        get: descriptor.get,
        set(value) {
          if (matchesAuthHost(value)) {
            markCredentialless(this);
          }
          return originalSet.call(this, value);
        },
      });
    }
  } catch (e) {
    console.warn('[Dynamic Shim] Failed to intercept src setter:', e);
  }

  // 2. Intercept setAttribute('src', ...)
  try {
    const originalSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      if (
        this instanceof HTMLIFrameElement &&
        name?.toLowerCase() === 'src' &&
        matchesAuthHost(value)
      ) {
        markCredentialless(this);
      }
      return originalSetAttribute.call(this, name, value);
    };
  } catch (e) {
    console.warn('[Dynamic Shim] Failed to intercept setAttribute:', e);
  }

  // 3. MutationObserver fallback for dynamically added iframes
  try {
    const checkAndMark = (iframe) => {
      const src = iframe.getAttribute('src') || iframe.src;
      if (src && matchesAuthHost(src)) {
        markCredentialless(iframe);
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLIFrameElement) {
              checkAndMark(node);
            } else if (node.querySelectorAll) {
              node.querySelectorAll('iframe').forEach(checkAndMark);
            }
          }
        } else if (
          mutation.type === 'attributes' &&
          mutation.target instanceof HTMLIFrameElement &&
          mutation.attributeName === 'src'
        ) {
          checkAndMark(mutation.target);
        }
      }
    });

    // Start observing once DOM is ready
    if (document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src'],
      });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['src'],
        });
      });
    }
  } catch (e) {
    console.warn('[Dynamic Shim] Failed to setup MutationObserver:', e);
  }

  console.log('[Dynamic Shim] Initialized successfully');
})();
