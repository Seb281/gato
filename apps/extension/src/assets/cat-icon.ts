/**
 * Returns the extension-internal URL for the Gato cat icon.
 * Works in popup, sidepanel, and content script contexts.
 */
const catIconUrl: string =
  typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL('cat-icon.png')
    : '/cat-icon.png'

export default catIconUrl
