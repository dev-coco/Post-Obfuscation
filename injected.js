try {
  const element = document.createElement('script')
  element.src = chrome.runtime.getURL('content.js')
  element.onload = () => element.remove()
  ;(document.head || document.documentElement).appendChild(element)
} catch (error) {
  console.error('error', error)
}
