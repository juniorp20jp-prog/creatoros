# Switch Component

**Status:** Planned — not implemented

**Component Source:**

```
packages/ui/src/components/forms/Switch
```

---

# Purpose

The Switch component allows users to toggle a setting between two states: enabled or disabled.

Unlike a Checkbox, a Switch should apply changes immediately when toggled.

---

# Variants

## Default

Used for standard on/off settings.

Examples:

- Dark Mode
- Notifications
- AI Suggestions
- Auto Save

---

## Labeled

Displays descriptive text next to the switch.

Examples:

- Enable Notifications
- Enable AI Assistant
- Allow Email Reports

---

# Sizes

## Small

Used in compact layouts.

---

## Medium

Default size.

Recommended for most settings.

---

## Large

Used for onboarding and touch-first interfaces.

---

# States

The Switch component supports:

- Off
- On
- Hover
- Focus
- Disabled
- Loading

Each state should provide clear visual feedback.

---

# Accessibility

Switches must:

- Use semantic form controls.
- Support keyboard navigation.
- Display visible focus indicators.
- Announce their current state to assistive technologies.
- Clearly indicate whether the setting is enabled or disabled.

---

# Usage

Good examples:

- Enable dark mode
- Enable AI recommendations
- Turn notifications on or off
- Enable automatic backups
- Toggle experimental features

Avoid using a Switch when changes require confirmation before being applied.

---

# Example

```tsx
<Switch
    label="Enable AI Recommendations"
/>

<Switch
    label="Dark Mode"
    defaultChecked
/>
```

---

# Design Guidelines

Switches should:

- Use shared spacing tokens.
- Use shared radius tokens.
- Use shared color tokens.
- Use shared focus styles.
- Maintain consistent sizing.

Avoid hardcoded colors, spacing, borders, or shadows.

---

# Validation

Switches generally do not require validation.

If validation is necessary:

- Explain the issue clearly.
- Associate the message with the switch.
- Keep the message visible until resolved.

---

# Definition of Done

The Switch component is complete when:

- All variants exist.
- All sizes exist.
- Keyboard navigation is supported.
- Accessibility requirements are satisfied.
- Design tokens are used exclusively.
- Documentation matches the implementation.
