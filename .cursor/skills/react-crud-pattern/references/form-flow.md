# Form Flow

Create va update form nen dung cung mot pattern co the du doan.

## Recommended Flow

1. open create modal or navigate to create page
2. load defaults or existing entity data for update
3. validate with schema
4. submit mutation
5. show feedback
6. invalidate or refetch list data

## Good Practices

- reuse one form component for create and update when the fields largely match
- split large forms into sections
- keep submit logic near the container, not in tiny field components

## Guardrails

- Do not duplicate near-identical create and update forms without a reason.
- Do not keep mutation side effects inside low-level inputs.
- Prefer dedicated pages over crowded modals for complex forms.
