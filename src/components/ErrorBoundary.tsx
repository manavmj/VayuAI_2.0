import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Vayu AI UI boundary caught error:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <section
          role="alert"
          className="rounded-2xl border border-[#ba1a1a]/30 bg-white p-8 text-center space-y-4"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#ffdad6]/60 text-[#93000a]">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="font-display text-xl font-semibold text-[#131b2e]">
            {this.props.fallbackTitle || 'Section temporarily unavailable'}
          </h2>
          <p className="mx-auto max-w-md text-xs text-[#3f493f]">{this.state.errorMessage}</p>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 rounded-lg bg-[#15803d] px-4 py-2 text-xs font-semibold text-white hover:bg-[#00652c]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry View
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
