# Redux Module Shape

Muc tieu la giu moi feature co mot module ro rang, de test va mo rong.

## Typical Pieces

1. initial state
2. action types
3. action creators
4. reducer
5. selectors

## Guardrails

- Keep action names explicit and domain-based.
- Avoid one giant root reducer file for every concern.
- Export selectors as the public read API for the module.
