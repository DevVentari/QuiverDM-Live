// Re-export the global React (UMD, loaded by the DC runtime) as an ES module,
// so import-map consumers (framer-motion) share the SAME React instance.
const R = window.React;
export default R;
export const {
  Children, Component, Fragment, Profiler, PureComponent, StrictMode, Suspense,
  cloneElement, createContext, createElement, createFactory, createRef,
  forwardRef, isValidElement, lazy, memo, startTransition,
  useCallback, useContext, useDebugValue, useDeferredValue, useEffect, useId,
  useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo, useReducer,
  useRef, useState, useSyncExternalStore, useTransition, version,
} = R;
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED =
  R.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
