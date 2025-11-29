// Phase 12 - Global Error Shield Component

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorShieldProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorShieldState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorShield extends Component<ErrorShieldProps, ErrorShieldState> {
  constructor(props: ErrorShieldProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorShieldState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorShield caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <Button size="sm" variant="outline" onClick={this.handleReset}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Safe value utilities
export function safeString(value: unknown, fallback: string = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function safeNumber(value: unknown, fallback: number = 0): number {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

export function safeArray<T>(value: unknown, fallback: T[] = []): T[] {
  if (!Array.isArray(value)) return fallback;
  return value;
}

export function safeObject<T extends object>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || typeof value !== 'object') {
    return fallback;
  }
  return value as T;
}

// Safe map function that won't crash on undefined
export function safeMap<T, R>(
  array: T[] | null | undefined,
  mapFn: (item: T, index: number) => R
): R[] {
  if (!Array.isArray(array)) return [];
  return array.map(mapFn);
}

// Safe access nested property
export function safeGet<T>(
  obj: Record<string, unknown> | null | undefined,
  path: string,
  fallback: T
): T {
  if (!obj) return fallback;
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return fallback;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return (current ?? fallback) as T;
}

// HOC for wrapping components with error shield
export function withErrorShield<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function ErrorShieldedComponent(props: P) {
    return (
      <ErrorShield fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorShield>
    );
  };
}
