# Radio Component

**Status:** Planned — not implemented

**Component Source:**

```
packages/ui/src/components/forms/Radio
```

---

# Purpose

The Radio component allows users to select a single option from a predefined group of mutually exclusive choices.

Only one radio button within a group can be selected at a time.

---

# Variants

## Default

Used for standard single-choice selections.

Examples:

- Subscription plan
- Payment method
- Theme selection
- Account type

---

## Card Radio

Displays each option inside a selectable card.

Examples:

- AI Model selection
- Workspace templates
- Pricing plans
- Onboarding choices

Card radios should clearly indicate the selected option.

---

# Sizes

## Small

Used inside compact layouts.

---

## Medium

Default size.

Recommended for most forms.

---

## Large

Used in onboarding and touch-first interfaces.

---

# States

The Radio component supports:

- Unselected
- Selected
- Hover
- Focus
- Disabled
- Error

Each state should provide clear visual feedback.

---

# Accessibility

Radio buttons must:

- Use semantic `<input type="radio">`.
- Belong to a properly labeled radio group.
- Support keyboard navigation.
- Display visible focus indicators.
- Announce the selected option to assistive technologies.

---

# Usage

Good examples:

- Choose one pricing plan
- Select one AI provider
- Select one workspace
- Select one language

Avoid using radio buttons when multiple selections are allowed. Use Checkbox instead.

---

# Example

```tsx
<RadioGroup label="Workspace">

    <Radio
        value="personal"
        label="Personal"
    />

    <Radio
        value="team"
        label="Team"
    />

</RadioGroup>
```

---

# Design Guidelines

Radio components should:

- Use shared spacing tokens.
- Use shared typography tokens.
- Use shared radius tokens.
- Use shared border tokens.
- Use shared focus styles.

Avoid hardcoded colors, spacing, borders, or shadows.

---

# Validation

Validation messages should:

- Clearly explain the issue.
- Appear directly below the radio group.
- Remain visible until resolved.

---

# Definition of Done

The Radio component is complete when:

- All variants exist.
- All sizes exist.
- Keyboard navigation is supported.
- Accessibility requirements are satisfied.
- Design tokens are used exclusively.
- Documentation matches the implementation.
