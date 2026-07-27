# Checkbox Component

**Status:** Planned — not implemented

**Component Source:**

```
packages/ui/src/components/forms/Checkbox
```

---

# Purpose

The Checkbox component allows users to select one or more independent options.

Unlike radio buttons, multiple checkboxes may be selected at the same time.

---

# Variants

## Default

Used for standard multiple-choice selections.

Examples:

- Enable notifications
- Accept terms
- Subscribe to updates

---

## Indeterminate

Represents a partially selected state.

Examples:

- "Select All" controls
- Tree views
- Nested permissions

The indeterminate state is visual only and should not be submitted as a value.

---

# Sizes

## Small

Used inside compact layouts.

---

## Medium

Default size.

Recommended for most interfaces.

---

## Large

Used for onboarding, accessibility-focused screens, and touch-first experiences.

---

# States

The Checkbox component supports:

- Unchecked
- Checked
- Indeterminate
- Hover
- Focus
- Disabled
- Error

Each state should provide clear visual feedback.

---

# Accessibility

Checkboxes must:

- Use semantic `<input type="checkbox">`.
- Associate labels correctly.
- Support keyboard navigation.
- Display visible focus indicators.
- Announce checked and unchecked states to assistive technologies.

---

# Usage

Good examples:

- Accept terms and conditions
- Notification preferences
- Feature selection
- User permissions
- Bulk actions

Avoid using checkboxes when only one option may be selected. Use a Radio Group instead.

---

# Example

```tsx
<Checkbox
    label="Accept Terms and Conditions"
/>

<Checkbox
    label="Enable AI Recommendations"
    defaultChecked
/>
```

---

# Design Guidelines

Checkboxes should:

- Use shared spacing tokens.
- Use shared radius tokens.
- Use shared border tokens.
- Use shared focus styles.
- Maintain consistent sizing.

Avoid hardcoded colors, spacing, borders, or shadows.

---

# Validation

Validation messages should:

- Clearly explain the issue.
- Appear directly below the checkbox group.
- Remain visible until resolved.

---

# Definition of Done

The Checkbox component is complete when:

- All variants exist.
- All sizes exist.
- Indeterminate state is supported.
- Accessibility requirements are satisfied.
- Design tokens are used exclusively.
- Documentation matches the implementation.
