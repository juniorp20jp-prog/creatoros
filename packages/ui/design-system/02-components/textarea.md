# Textarea Component

**Status:** Planned — not implemented

**Component Source:**

```
packages/ui/src/components/forms/Textarea
```

---

# Purpose

The Textarea component allows users to enter multi-line text throughout the CreatorOS platform.

It is intended for longer content such as prompts, descriptions, notes, comments, and AI instructions.

---

# Variants

## Default

Used for standard multi-line text input.

Examples:

- Project description
- AI prompt
- Creator notes
- Mission statement

---

## Auto Resize

Automatically expands as the user types.

Used for:

- AI conversations
- Prompt builders
- Long-form editing

---

## Fixed Height

Maintains a constant height with scrolling when content exceeds the available space.

Used for:

- Settings panels
- Configuration forms

---

# Sizes

## Small

Used in compact interfaces.

---

## Medium

Default size.

Recommended for most forms.

---

## Large

Used in onboarding and AI workflows.

---

# States

The Textarea component supports:

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

Textareas must:

- Use semantic `<textarea>` elements.
- Associate labels correctly.
- Support keyboard navigation.
- Display visible focus indicators.
- Announce validation errors to assistive technologies.

---

# Usage

Good examples:

- AI prompts
- Content descriptions
- Internal notes
- Comments
- Workflow documentation
- Creator goals

Avoid using a textarea for short, single-line values.

---

# Example

```tsx
<Textarea
    label="AI Prompt"
    placeholder="Describe what you want the AI to generate..."
/>

<Textarea
    label="Project Description"
    rows={6}
/>
```

---

# Design Guidelines

Textareas should:

- Use shared spacing tokens.
- Use shared typography tokens.
- Use shared border tokens.
- Use shared radius tokens.
- Use shared focus styles.

Do not hardcode colors, borders, spacing, or shadows.

---

# Validation

Validation messages should:

- Clearly explain the issue.
- Appear directly below the textarea.
- Remain visible until resolved.

---

# Definition of Done

The Textarea component is complete when:

- All variants exist.
- All sizes exist.
- Validation states are implemented.
- Accessibility requirements are satisfied.
- Design tokens are used exclusively.
- Documentation matches the implementation.
