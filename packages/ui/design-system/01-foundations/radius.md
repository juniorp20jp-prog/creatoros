# Radius Foundation

**Status:** Active
**Source of truth:** `packages/ui/src/styles/tokens.css`

---

# Purpose

The radius system defines the shape language of CreatorOS.

Consistent corner radius values create visual coherence across buttons, cards, inputs, panels, modals, and other interface elements.

---

# Principles

## Use predefined radius tokens

Always use the shared radius scale.

Avoid arbitrary border-radius values.

---

## Match radius to component size

Small components should use smaller radius values.

Large surfaces may use larger radius values.

---

## Preserve consistency

Components with similar purposes should use the same radius.

For example:

- Buttons should share a consistent shape.
- Cards should share a consistent shape.
- Inputs should share a consistent shape.

---

## Avoid excessive rounding

Rounded corners should support the interface without making every component look like a pill.

Use fully rounded shapes only when the component requires it.

---

# Radius Scale

```css
--radius-none: 0;
--radius-sm: 8px;
--radius-md: 16px;
--radius-lg: 24px;
--radius-xl: 32px;
--radius-full: 9999px;
```

---

# Usage

## None

```css
--radius-none: 0;
```

Used for:

- Edge-to-edge layouts
- Dividers
- Full-width structural elements
- Components that must align directly with container edges

---

## Small

```css
--radius-sm: 8px;
```

Used for:

- Small badges
- Compact buttons
- Small controls
- Tooltips
- Tags

---

## Medium

```css
--radius-md: 16px;
```

Used for:

- Standard buttons
- Inputs
- Dropdowns
- Small cards
- Navigation items

This is the default radius for most controls.

---

## Large

```css
--radius-lg: 24px;
```

Used for:

- Cards
- Panels
- Dashboard modules
- Medium modal containers

---

## Extra Large

```css
--radius-xl: 32px;
```

Used for:

- Large feature cards
- Hero panels
- Major containers
- Onboarding surfaces
- Large modals

Use this token selectively.

---

## Full

```css
--radius-full: 9999px;
```

Used for:

- Pills
- Avatars
- Circular icon buttons
- Status indicators
- Fully rounded badges

Do not use this token for standard cards or inputs.

---

# Component Guidance

## Buttons

Standard buttons should use:

```css
border-radius: var(--radius-md);
```

Compact buttons may use:

```css
border-radius: var(--radius-sm);
```

Pill buttons may use:

```css
border-radius: var(--radius-full);
```

Use pill buttons only when the design intentionally requires that shape.

---

## Cards

The canonical shared Card uses:

```css
border-radius: var(--radius-md);
```

Larger product surfaces that are not the shared Card may use
`--radius-lg` or `--radius-xl` when their design explicitly requires
greater separation.

Card variants do not change radius.

---

## Inputs

Inputs should use:

```css
border-radius: var(--radius-md);
```

All form controls in the same workflow should use consistent radius values.

---

## Badges

Badges may use:

```css
border-radius: var(--radius-sm);
```

or:

```css
border-radius: var(--radius-full);
```

The choice depends on whether the badge is rectangular or pill-shaped.

---

## Modals

Modal surfaces should generally use:

```css
border-radius: var(--radius-xl);
```

Small dialogs may use:

```css
border-radius: var(--radius-lg);
```

---

# Nested Components

Nested elements should usually have a smaller radius than their parent container.

Example:

```css
.panel {
  border-radius: var(--radius-xl);
}

.panelItem {
  border-radius: var(--radius-md);
}
```

This preserves visual hierarchy.

---

# Responsive Behavior

Radius values should generally remain consistent across screen sizes.

Do not reduce radius automatically on mobile unless the layout becomes edge-to-edge.

For full-width mobile surfaces, it may be appropriate to remove the radius from the edges touching the viewport.

---

# Accessibility

Radius does not replace clear interaction states.

Interactive components must still provide:

- Visible focus states
- Clear hover states
- Sufficient contrast
- Adequate touch target size

Do not rely on shape alone to communicate meaning.

---

# Approved Usage Example

```css
.card {
  border-radius: var(--radius-md);
}

.input {
  border-radius: var(--radius-md);
}

.badge {
  border-radius: var(--radius-full);
}

.modal {
  border-radius: var(--radius-xl);
}
```

---

# Incorrect Usage Example

```css
.card {
  border-radius: 13px;
}

.input {
  border-radius: 9px;
}

.badge {
  border-radius: 100px;
}

.modal {
  border-radius: 22px;
}
```

The incorrect example introduces arbitrary values and weakens consistency.

---

# Definition of Done

Radius is considered implemented when:

- Radius tokens exist in `tokens.css`.
- Shared components use radius tokens.
- Similar components use consistent radius values.
- Arbitrary radius values are avoided.
- Pill shapes are used intentionally.
- Nested components preserve visual hierarchy.
