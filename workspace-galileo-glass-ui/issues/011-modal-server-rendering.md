# Rendering a closed Modal on the server accesses document and throws

Suggested priority: **P1**  
Suggested labels: bug, ssr, components  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

With the default mountOnEnter=false, isMounted starts true even when open=false. Rendering proceeds to createPortal(..., document.body) without a browser guard. Including a closed modal in a server-rendered page therefore throws before hydration.

## Reproduction

In a Node environment with no document, call renderToString(<Modal open={false}><span>body</span></Modal>). The implementation reaches document.body and throws ReferenceError.

## Expected behavior

A closed modal can safely participate in server rendering, and an initially open modal follows a documented hydration-safe mounting strategy.

## Source references

- [src/components/Modal/Modal.tsx:244](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/Modal/Modal.tsx#L244)
- [src/components/Modal/Modal.tsx:363](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/Modal/Modal.tsx#L363)

## Acceptance criteria for one PR

- [ ] Avoid accessing portal targets until a browser container is available.
- [ ] Keep server and initial hydration output consistent.
- [ ] Add SSR coverage for both open values, default mount behavior, and a hydration smoke case.

## Verification

Reproduced in the Node Jest environment with renderToString and the actual Modal; only context/reduced-motion dependencies were stubbed. The exception was document is not defined.
