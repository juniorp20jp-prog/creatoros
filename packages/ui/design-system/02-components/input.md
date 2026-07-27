# Input Component

**Status:** Active

**Component Source:**

```
packages/ui/src/components/forms/Input
```

---

# Purpose

The Input component allows users to enter and edit textual information throughout the CreatorOS platform.

It is the primary control for collecting user input and must provide a consistent, accessible, and predictable experience.

---

# Variants

## Default

Used for standard text entry.

Examples:

- Project name
- Channel name
- Email
- Username

---

## Search

Use the native `type="search"` attribute for search experiences.
Input does not add a separate visual search variant.

Examples:

- Search creators
- Search projects
- Search analytics

---

## Password

Use the native `type="password"` attribute for secure text entry.
Input does not currently include a visibility toggle.

Examples:

- Login
- API keys
- Account settings

---

# Sizes

## Small

Used inside compact interfaces.

Examples:

- Tables
- Toolbars
- Filters

---

## Medium

Default size.

Recommended for most forms.

---

## Large

Used in onboarding and primary workflows.

---

# States

The Input component supports:

- Default
- Hover
- Focus
- Filled
- Disabled
- Read Only
- Error
- Success

Each state should provide clear visual feedback.

---

# Accessibility

Inputs must:

- Use semantic `<input>` elements.
- Associate labels correctly.
- Support keyboard navigation.
- Display visible focus indicators.
- Announce validation errors to assistive technologies.

---

# Usage

Good examples:

- Login forms
- Project settings
- Search bars
- Configuration panels
- AI prompts
- User profiles

Avoid using inputs for selections that are better represented by dropdowns, checkboxes, or radio buttons.

---

# Example

```tsx
import { Input } from "@repo/ui";

<Input
    label="Project Name"
    placeholder="Enter project name"
/>

<Input
    type="email"
    label="Email"
/>

<Input
    type="password"
    label="Password"
/>
```

---

# Design Guidelines

Inputs should:

- Use shared spacing tokens.
- Use shared typography tokens.
- Use shared radius tokens.
- Use shared border tokens.
- Use shared focus styles.

Do not hardcode colors, borders, spacing, or shadows.

---

# Validation

Validation messages should:

- Explain the problem.
- Explain how to fix it.
- Appear close to the input.
- Remain visible until resolved.

---

# Definition of Done

The Input component is complete when:

- Native input types remain available.
- All sizes exist.
- Validation states are implemented.
- Accessibility requirements are satisfied.
- Design tokens are used exclusively.
- Documentation matches the implementation.
- Optional text is supplied explicitly by consumers.
