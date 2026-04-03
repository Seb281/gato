import React from "react"

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  State
> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
          <p className="text-sm text-muted-foreground">Something went wrong.</p>
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
