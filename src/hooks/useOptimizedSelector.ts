// Optimized Redux selectors with memoization and performance monitoring
import { useSelector, shallowEqual } from 'react-redux';
import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import type { RootState } from '@/store/store';

// Performance monitoring for selectors
const selectorPerformance = new Map<string, { calls: number, totalTime: number }>();

function trackSelectorPerformance<T>(selectorName: string, selector: () => T): T {
  const start = performance.now();
  const result = selector();
  const end = performance.now();
  
  const stats = selectorPerformance.get(selectorName) || { calls: 0, totalTime: 0 };
  stats.calls++;
  stats.totalTime += (end - start);
  selectorPerformance.set(selectorName, stats);
  
  // Log slow selectors in development
  if (process.env.NODE_ENV === 'development' && (end - start) > 5) {
    console.warn(`Slow selector: ${selectorName} took ${(end - start).toFixed(2)}ms`);
  }
  
  return result;
}

// Optimized useSelector with shallow comparison by default
export function useOptimizedSelector<T>(
  selector: (state: RootState) => T,
  selectorName?: string
): T {
  return useSelector(selector, shallowEqual);
}

// Memoized selector hook for expensive computations
export function useMemoizedSelector<T>(
  selector: (state: RootState) => T,
  deps: any[] = [],
  selectorName?: string
): T {
  const memoizedSelector = useMemo(() => selector, deps);
  
  return useSelector(
    useCallback((state: RootState) => {
      if (selectorName) {
        return trackSelectorPerformance(selectorName, () => memoizedSelector(state));
      }
      return memoizedSelector(state);
    }, [memoizedSelector, selectorName]),
    shallowEqual
  );
}

// Batch selector hook to reduce re-renders
export function useBatchSelector<T extends Record<string, any>>(
  selectors: { [K in keyof T]: (state: RootState) => T[K] }
): T {
  return useSelector(
    useCallback((state: RootState) => {
      const result = {} as T;
      for (const [key, selector] of Object.entries(selectors)) {
        result[key as keyof T] = selector(state);
      }
      return result;
    }, [selectors]),
    shallowEqual
  );
}

// Conditional selector hook - only runs when condition is met
export function useConditionalSelector<T>(
  selector: (state: RootState) => T,
  condition: boolean,
  fallback: T
): T {
  return useSelector(
    useCallback((state: RootState) => {
      return condition ? selector(state) : fallback;
    }, [selector, condition, fallback]),
    shallowEqual
  );
}

// Debounced selector for frequently changing values
export function useDebouncedSelector<T>(
  selector: (state: RootState) => T,
  delay: number = 100
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const valueRef = useRef<T>();
  const [debouncedValue, setDebouncedValue] = useState<T>();
  
  const currentValue = useSelector(selector, shallowEqual);
  
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (currentValue !== valueRef.current) {
        valueRef.current = currentValue;
        setDebouncedValue(currentValue);
      }
    }, delay);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentValue, delay]);
  
  return debouncedValue ?? currentValue;
}

// Performance debugging utility
export function getSelectorsPerformance() {
  return Array.from(selectorPerformance.entries())
    .map(([name, stats]) => ({
      name,
      calls: stats.calls,
      totalTime: stats.totalTime,
      avgTime: stats.totalTime / stats.calls
    }))
    .sort((a, b) => b.totalTime - a.totalTime);
}

// Clear performance stats
export function clearSelectorStats() {
  selectorPerformance.clear();
}
