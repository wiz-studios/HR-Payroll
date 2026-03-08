'use client';

import { useEffect } from 'react';
import { initializeDemoData } from '@/lib/demo-data';

export function DemoBootstrap() {
  useEffect(() => {
    initializeDemoData();
  }, []);

  return null;
}
