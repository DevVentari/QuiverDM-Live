// Re-export the global ReactDOM as an ES module for import-map consumers.
const RD = window.ReactDOM;
export default RD;
export const {
  createPortal, flushSync, render, hydrate, unmountComponentAtNode,
  findDOMNode, createRoot, hydrateRoot, version,
} = RD;
