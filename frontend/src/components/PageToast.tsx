import { useEffect } from 'react';
import '../styles/PageToast.css';

interface PageToastProps {
  message: string | null;
  variant?: 'info' | 'error' | 'success';
  onClear?: () => void;
  durationMs?: number;
}

function PageToast({
  message,
  variant = 'info',
  onClear,
  durationMs = 4000,
}: PageToastProps) {
  useEffect(() => {
    if (!message || !onClear) return;
    const t = setTimeout(onClear, durationMs);
    return () => clearTimeout(t);
  }, [message, onClear, durationMs]);

  if (!message) return null;

  return (
    <div className={`page-toast page-toast--${variant}`} role="status">
      {message}
    </div>
  );
}

export default PageToast;
