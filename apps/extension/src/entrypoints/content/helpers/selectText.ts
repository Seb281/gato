const handleSelection = {
  selectionRect: null as DOMRect | null,

  getExpandedSelection(): Range | null {
    const selection: Selection | null = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      return null
    }

    const selectedText: string = selection.toString().trim()
    if (!selectedText) {
      return null
    }

    const range: Range = selection.getRangeAt(0)
    const expandedRange: Range = range.cloneRange()

    this.selectionRect = expandedRange.getBoundingClientRect()

    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const textNode = range.startContainer
      const textBefore = textNode.textContent!.substring(0, range.startOffset)

      const wordStart = textBefore.lastIndexOf(" ") + 1

      if (wordStart !== 0) {
        expandedRange.setStart(textNode, wordStart)
      } else {
        expandedRange.setStart(textNode, 0)
      }
    }

    if (range.endContainer.nodeType === Node.TEXT_NODE) {
      const textNode = range.endContainer
      const textAfter = textNode.textContent!.substring(range.endOffset)

      const wordEnd = textAfter.search(/[\s,.;:!?—–\-()]/)

      if (wordEnd !== -1) {
        expandedRange.setEnd(textNode, range.endOffset + wordEnd)
      } else {
        expandedRange.setEnd(textNode, textNode.textContent!.length)
      }
    }

    return expandedRange
  },

  getContextAround(range: Range): {
    before: string
    after: string
  } {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0)
      return { before: "", after: "" }

    const beforeRange: Range = range.cloneRange()
    beforeRange.setStart(
      range.startContainer.parentNode || range.startContainer,
      0
    )
    beforeRange.setEnd(range.startContainer, range.startOffset)
    const beforeText: string = beforeRange.toString()

    const lastSentenceMatch = beforeText.match(/[.!?][^.!?]*$/)
    const beforeContext: string = lastSentenceMatch
      ? lastSentenceMatch[0].slice(1).trimStart()
      : beforeText

    const afterRange: Range = range.cloneRange()
    afterRange.setStart(range.endContainer, range.endOffset)

    const container: Node =
      range.endContainer.nodeType === Node.TEXT_NODE
        ? range.endContainer.parentNode!
        : range.endContainer

    afterRange.setEndAfter(container)
    const afterText: string = afterRange.toString()

    const firstSentenceMatch = afterText.match(/^[^.!?]*[.!?]/)
    const afterContext = firstSentenceMatch ? firstSentenceMatch[0] : afterText

    return {
      before: beforeContext.trim(),
      after: afterContext.trim(),
    }
  },
}

export default handleSelection
