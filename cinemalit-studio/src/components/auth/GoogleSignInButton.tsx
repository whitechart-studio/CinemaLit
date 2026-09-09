// src/components/auth/GoogleSignInButton.tsx — real Google Identity Services sign-in
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

interface Props {
  onCredential: (credential: string) => void;
}

export function GoogleSignInButton({ onCredential }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId || !ref.current) return;

    let cancelled = false;
    const render = () => {
      if (cancelled || !window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => onCredential(resp.credential),
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
      });
    };

    if (window.google) {
      render();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval);
          render();
        }
      }, 100);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [onCredential]);

  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
    return <div style={{ fontSize: '.72rem', color: 'var(--t3)', textAlign: 'center' }}>Google sign-in not configured (set VITE_GOOGLE_CLIENT_ID)</div>;
  }

  return <div ref={ref} style={{ display: 'flex', justifyContent: 'center' }} />;
}
