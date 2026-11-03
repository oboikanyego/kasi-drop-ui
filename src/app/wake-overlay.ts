const overlayId = 'wake-overlay';
// Same look as the splash in index.html (the .boot-* styles live there).
const markup = `
  <div class="boot-mark">
    <span class="boot-ring" aria-hidden="true"></span>
    <img src="/assets/brand/kasidrop-icon-transparent.webp" alt="" width="56" height="56" />
  </div>
  <p class="boot-name">kasi<b>drop</b></p>
  <p class="boot-message">
    Welcome back. The shop was resting, so we're waking it up. This can take up to a minute.
  </p>`;

/**
 * A full-screen loader for when the API went to sleep while the tab sat idle. The app underneath
 * is made inert, so nothing behind the loader can be clicked, tabbed to or read out. hide() is
 * safe to call at any time, including when nothing is showing.
 */
export function createWakeOverlay(doc: Document = document) {
  let previouslyFocused: Element | null = null;
  return {
    show() {
      if (doc.getElementById(overlayId)) return;
      previouslyFocused = doc.activeElement;
      const overlay = doc.createElement('div');
      overlay.id = overlayId;
      overlay.className = 'boot-splash wake-overlay';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      overlay.setAttribute('aria-label', 'Waking up KasiDrop');
      overlay.innerHTML = markup;
      doc.body.appendChild(overlay);
      doc.querySelector('app-root')?.setAttribute('inert', '');
    },
    hide() {
      const overlay = doc.getElementById(overlayId);
      if (!overlay) return;
      overlay.remove();
      doc.querySelector('app-root')?.removeAttribute('inert');
      if (previouslyFocused instanceof HTMLElement && doc.contains(previouslyFocused))
        previouslyFocused.focus();
      previouslyFocused = null;
    },
  };
}
