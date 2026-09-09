import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--bg-elev)',
          '--normal-text': 'var(--t1)',
          '--normal-border': 'var(--border-hi)',
        } as CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
