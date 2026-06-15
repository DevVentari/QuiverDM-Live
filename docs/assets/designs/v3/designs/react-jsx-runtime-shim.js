// Minimal react/jsx-runtime backed by the global React.createElement.
const R = window.React;
export const Fragment = R.Fragment;
function make(type, props, key) {
  const config = {};
  let children;
  if (props) {
    for (const k in props) {
      if (k === 'children') { children = props[k]; }
      else { config[k] = props[k]; }
    }
  }
  if (key !== undefined) config.key = key;
  if (children === undefined) return R.createElement(type, config);
  if (Array.isArray(children)) return R.createElement(type, config, ...children);
  return R.createElement(type, config, children);
}
export const jsx = make;
export const jsxs = make;
export const jsxDEV = make;
