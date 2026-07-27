# Modal Component

**Status:** Planned — not implemented

**Component Source:**

```
packages/ui/src/components/feedback/Modal
```

---

# Purpose

The Modal component presents important information or workflows that require the user's full attention before continuing.

Modals should interrupt the current workflow only when necessary.

---

# Variants

## Default

Used for standard dialogs.

Examples:

- Edit Project
- Create Workspace
- Rename Channel

---

## Confirmation

Used before performing irreversible actions.

Examples:

- Delete Project
- Disconnect Channel
- Remove User

---

## Full Screen

Used for complex workflows.

Examples:

- AI Prompt Builder
- Analytics Dashboard
- CreatorOS Setup Wizard

---

# Sizes

## Small

Used for confirmations and simple dialogs.

---

## Medium

Default size.

Recommended for most workflows.

---

## Large

Used for complex forms and detailed information.

---

## Full Screen

Occupies the full viewport.

Used only for advanced workflows.

---

# States

The Modal component supports:

- Open
- Closing
- Loading
- Disabled Actions

---

# Accessibility

Modals must:

- Trap keyboard focus while open.
- Return focus to the triggering element when closed.
- Close using the Escape key.
- Support screen readers.
- Include accessible titles and descriptions.

---

# Usage

Good examples:

- Confirm destructive actions.
- Display complex forms.
- Configure integrations.
- Review AI results before saving.

Avoid opening multiple modals at the same time.

---

# Example

```tsx
<Modal
    title="Delete Project"
    open={isOpen}
>

    <p>
        This action cannot be undone.
    </p>

</Modal>
```

---

# Design Guidelines

Modals should:

- Use shared spacing tokens.
- Use shared radius tokens.
- Use shared shadow tokens.
- Use shared typography tokens.
- Dim the background with an overlay.

Avoid custom spacing, colors, or shadows.

---

# Definition of Done

The Modal component is complete when:

- All variants exist.
- Keyboard focus is trapped.
- Escape closes the modal.
- Accessibility requirements are satisfied.
- Design tokens are used exclusively.
- Documentation matches the implementation.
