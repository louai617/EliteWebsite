'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders a dialog at the end of <body>. Dialogs opened from inside a sticky or
 * transformed box (like the property sidebar) are otherwise trapped in its stacking
 * layer and slide under the header and the section tabs. Also stops the page behind
 * from scrolling while the dialog is open.
 */
export default function ModalPortal({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return createPortal(children, document.body);
}
