import React from "react"

interface State {
  hasError: boolean
  error: Error | null
  componentStack: string | null
}

export default class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  State
> {
  state: State = { hasError: false, error: null, componentStack: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: null }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack)
    this.setState({ componentStack: info.componentStack ?? null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
          <p className="text-sm text-muted-foreground">Something went wrong.</p>
          {this.state.error && (
            <pre className="text-xs text-destructive bg-destructive/10 p-3 rounded-md max-w-full overflow-auto text-left whitespace-pre-wrap">
              {this.state.error.message}
              {this.state.componentStack && (
                <>
                  {"\n\nComponent stack:"}
                  {this.state.componentStack}
                </>
              )}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
