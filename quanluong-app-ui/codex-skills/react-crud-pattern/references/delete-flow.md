# Delete Flow

Delete la action nhay cam nen can mot pattern an toan va ro rang.

## Recommended Flow

1. user clicks delete
2. app shows confirmation UI
3. mutation runs
4. app shows success or failure feedback
5. app refetches or updates the list

## Good Practices

- name the entity clearly in confirmation content
- make the destructive action visually distinct
- close confirmation UI only after the mutation result is known or clearly handled

## Guardrails

- Do not delete immediately without confirmation unless the product explicitly requires it.
- Do not hide destructive impact behind vague messaging.
- Keep delete feedback visible and unambiguous.
