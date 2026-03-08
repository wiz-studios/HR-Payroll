import { cn } from '@/lib/utils';

interface StatusPillProps {
  label: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  className?: string;
}

const tones = {
  success: 'bg-emerald-500/12 text-emerald-700 ring-emerald-600/20',
  warning: 'bg-amber-500/16 text-amber-800 ring-amber-600/20',
  danger: 'bg-rose-500/12 text-rose-700 ring-rose-600/20',
  info: 'bg-sky-500/12 text-sky-700 ring-sky-600/20',
  neutral: 'bg-secondary text-secondary-foreground ring-border/70',
};

export function StatusPill({ label, tone = 'neutral', className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset',
        tones[tone],
        className
      )}
    >
      {label}
    </span>
  );
}
