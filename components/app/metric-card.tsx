import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  detail?: string;
  icon?: ReactNode;
  tone?: 'primary' | 'accent' | 'neutral';
  className?: string;
}

const toneClasses = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/20 text-accent-foreground',
  neutral: 'bg-secondary text-secondary-foreground',
};

export function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = 'neutral',
  className,
}: MetricCardProps) {
  return (
    <div className={cn('metric-card', className)}>
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
          <div className="space-y-1">
            <p className="text-3xl font-semibold tracking-[-0.04em] text-foreground">{value}</p>
            {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
          </div>
        </div>
        {icon ? (
          <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', toneClasses[tone])}>
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
