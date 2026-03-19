const highlight: {
  current: Array<HTMLElement>
  selection: (range: Range) => void
  context: (text: string) => void
  clear: () => void
} = {
  current: [],

  selection(range: Range): void {
    const selectedSpan: HTMLSpanElement = document.createElement("span")
    selectedSpan.className = "bg-blue-300 transition-colors"
    selectedSpan.dataset.translatorHighlight = "true"
    try {
      range.surroundContents(selectedSpan)
      this.current.push(selectedSpan)
    } catch {
      // Expected DOM edge case: surroundContents throws when range partially intersects a node boundary.
    }
  },

  context(text: string): void {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    )

    const nodesToHighlight: Array<{
      textNode: Text
      start: number
      end: number
    }> = []

    let node
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        const textNode = node as Text
        const index = textNode.textContent.indexOf(text)
        if (index !== undefined && index !== -1) {
          nodesToHighlight.push({
            textNode,
            start: index,
            end: index + text.length,
          })
        }
      }
    }

    nodesToHighlight.forEach(({ textNode, start, end }) => {
      const range = document.createRange()
      range.setStart(textNode, start)
      range.setEnd(textNode, end)

      const span = document.createElement("span")
      span.className = "bg-blue-100 transition-colors"
      span.dataset.translatorHighlight = "true"

      range.surroundContents(span)
      this.current.push(span)
    })
  },

  clear(): void {
    this.current.forEach((highlight) => {
      const parent = highlight.parentNode
      if (parent) {
        parent.replaceChild(
          document.createTextNode(highlight.textContent || ""),
          highlight
        )
        parent.normalize() // Merge adjacent text nodes
      }
    })
    this.current = []
  },
}

export default highlight
