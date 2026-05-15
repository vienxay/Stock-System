import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'primary', loading, children, disabled, className = '', ...rest }: Props) {
  const cls = { primary: 'btn-primary', secondary: 'btn-secondary', danger: 'btn-danger' }[variant];
  return (
    <button {...rest} disabled={disabled || loading} className={`${cls} ${className}`}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
