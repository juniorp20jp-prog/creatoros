# Button Component

**Status:** Active

**Component Source:**

```
packages/ui/src/components/actions/Button
```

---

# Purpose

The Button component allows users to trigger actions throughout the CreatorOS platform.

Buttons should clearly communicate priority and intent while maintaining a consistent appearance across all applications.

---

# Variants

## Primary

Used for the main action on a page.

Examples:

- Save
- Continue
- Publish
- Analyze
- Create

Only one primary button should exist within the same action group whenever possible.

---

## Secondary

Used for supporting actions.

Examples:

- Cancel
- Back
- Edit
- Configure

---

## Ghost

Used for low-emphasis actions.

Examples:

- Learn more
- View details
- Optional navigation

---

## Danger

Used for destructive actions.

Examples:

- Delete
- Remove
- Reset
- Disconnect

Danger buttons should require additional confirmation when appropriate.

---

# Sizes

## Small

Used inside:

- Tables
- Compact cards
- Toolbars

---

## Medium

Default size.

Most buttons should use this size.

---

## Large

Used for:

- Landing pages
- Hero actions
- Onboarding
- Empty states

---

# States

The Button component supports:

- Default
- Hover
- Focus
- Active
- Disabled
- Loading

Each state should provide clear visual feedback.

---

# Accessibility

Buttons must:

- Support keyboard navigation.
- Display a visible focus indicator.
- Use semantic `<button>` elements.
- Include accessible labels.
- Communicate loading state.

---

# Usage

Good examples:

- Submit forms
- Confirm actions
- Start workflows
- Save changes
- Open dialogs

Avoid using buttons for simple navigation links.

---

# Example

```tsx
import { Button } from "@repo/ui";

<Button variant="primary">
    Analyze Channel
</Button>

<Button variant="secondary">
    Cancel
</Button>

<Button variant="danger">
    Delete Project
</Button>
```

---

# Definition of Done

The Button component is complete when:

- All variants exist.
- All sizes exist.
- Loading state is supported.
- Accessibility requirements are met.
- Design tokens are used exclusively.
- No hardcoded colors or spacing are present.
- Loading content is configurable and contains no mandatory localized text.
