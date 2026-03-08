'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  className?: string;
}

export function StatCard({ title, value, subtitle, icon, trend, className = '' }: StatCardProps) {
  return (
    <div className={cn('metric-card', className)}>
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
          <p className="text-3xl font-semibold tracking-[-0.04em] text-foreground">{value}</p>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          {trend ? (
            <p className={cn('text-sm font-medium', trend.direction === 'up' ? 'text-emerald-700' : 'text-rose-700')}>
              {trend.direction === 'up' ? 'Up' : 'Down'} {Math.abs(trend.value)}%
            </p>
          ) : null}
        </div>
        {icon ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
