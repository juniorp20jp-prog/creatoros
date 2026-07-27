# Select Component

**Status:** Planned — not implemented

**Component Source:**

```
packages/ui/src/components/forms/Select
```

---

# Purpose

The Select component allows users to choose a single option from a predefined list.

It should provide a consistent, accessible, and intuitive selection experience across the CreatorOS platform.

---

# Variants

## Default

Used for standard option selection.

Examples:

- Language
- Theme
- Workspace
- Timezone

---

## Searchable

Allows users to search within a long list of options.

Examples:

- Countries
- Categories
- AI Models
- Creators

---

## Disabled

Prevents interaction when selection is unavailable.

---

# Sizes

## Small

Used in compact layouts.

---

## Medium

Default size.

Recommended for most forms.

---

## Large

Used in onboarding and primary workflows.

---

# States

The Select component supports:

- Default
- Hover
- Focus
- Open
- Selected
- Disabled
- Error
- Success

Each state should provide clear visual feedback.

---

# Accessibility

Select components must:

- Support keyboard navigation.
- Use semantic form controls.
- Display visible focus indicators.
- Announce selected values to assistive technologies.
- Allow navigation using arrow keys.

---

# Usage

Good examples:

- Language selection
- AI model selection
- Workspace selection
- Project category
- Country
- Currency

Avoid using a Select when only two choices exist. In those cases, prefer a Switch or Radio Group.

---

# Example

```tsx
<Select
    label="Language"
    placeholder="Choose a language"
    options={[
        { label: "English", value: "en" },
        { label: "Español", value: "es" },
        { label: "Português", value: "pt" }
    ]}
/>
```

---

# Design Guidelines

Select components should:

- Use shared spacing tokens.
- Use shared typography tokens.
- Use shared radius tokens.
- Use shared border tokens.
- Use shared focus styles.

Avoid hardcoded colors, spacing, borders, or shadows.

---

# Validation

Validation messages should:

- Clearly describe the issue.
- Be displayed below the component.
- Remain visible until resolved.

---

# Definition of Done

The Select component is complete when:

- All variants exist.
- All sizes exist.
- Keyboard navigation works correctly.
- Accessibility requirements are satisfied.
- Design tokens are used exclusively.
- Documentation matches the implementation.
