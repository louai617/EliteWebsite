import type React from 'react';

/**
 * Discourages copying listing photos: no right-click "Save image as…", no dragging a photo to
 * the desktop. Pair with the `protected-photo` class (globals.css), which also turns off the
 * long-press "Save to Photos" menu on iPhone and text-style selection.
 *
 * This only stops casual saving — anything a browser can show can be screenshotted or taken
 * from the network tab. The real protection is the watermark the agent app stamps on every
 * public copy (originals never leave the agent app).
 */
export const protectPhoto = {
  onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  onDragStart: (event: React.DragEvent) => event.preventDefault(),
};
