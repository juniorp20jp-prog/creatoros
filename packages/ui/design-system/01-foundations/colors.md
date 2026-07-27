# Color Foundation

**Status:** Active
**Source of truth:** `packages/ui/src/styles/tokens.css`

---

## Purpose

The CreatorOS color system provides a consistent visual language across all products, modules, dashboards, and workflows.

Colors must communicate:

- Hierarchy
- Status
- Emphasis
- Interaction
- Product identity

Color should support comprehension, not decoration alone.

---

## Principles

### Use semantic tokens

New interfaces must use semantic token names instead of hardcoded color values.

Use:

```css
color: var(--color-text-primary);
background: var(--color-surface);
border-color: var(--color-border);
```

Avoid:

```css
color: #f8fafc;
background: #111c31;
border-color: #25324d;
```

### Preserve hierarchy

Surfaces, text, and borders should create clear visual layers.

Do not use the strongest contrast for every element.

### Use color intentionally

Brand colors should guide attention toward meaningful actions, active states, and important information.

### Do not rely on color alone

Status, validation, and alerts must also use text, icons, or labels.

---

## Brand Colors

### Primary

```css
--color-brand-primary: #4f7cff;
```

Primary use cases:

- Main call-to-action buttons
- Active navigation states
- Progress indicators
- Important links
- Selected controls
- Focus emphasis

### Secondary

```css
--color-brand-secondary: #5b6cff;
```

Secondary use cases:

- Hover states
- Supporting gradients
- Secondary emphasis
- Brand transitions

### Accent

```css
--color-brand-accent: #8b7cff;
```

Accent use cases:

- Controlled visual highlights
- Illustrations
- Decorative brand details
- Data visualization accents

The accent color should not compete with the primary action color.

---

## Background Colors

### Main Background

```css
--color-background: #081426;
```

Used for:

- Application canvas
- Main page background
- Large workspace areas

### Elevated Background

```css
--color-background-elevated: #0d192b;
```

Used for:

- Elevated sections
- Navigation containers
- Secondary page regions
- Layered layouts

---

## Surface Colors

### Default Surface

```css
--color-surface: #111c31;
```

Used for:

- Cards
- Panels
- Form containers
- Dashboard modules
- Modal content

### Hover Surface

```css
--color-surface-hover: #16233b;
```

Used for:

- Hoverable cards
- Interactive navigation items
- Selectable options
- Secondary buttons

### Soft Surface

```css
--color-surface-soft: rgba(255, 255, 255, 0.04);
```

Used for:

- Low-emphasis backgrounds
- Subtle grouping
- Ghost button hover states
- Soft separators

---

## Border Colors

### Default Border

```css
--color-border: #25324d;
```

Used for:

- Standard component boundaries
- Inputs
- Cards
- Navigation sections

### Subtle Border

```css
--color-border-subtle: rgba(148, 163, 184, 0.14);
```

Used for:

- Low-emphasis cards
- Internal dividers
- Decorative separation

### Strong Border

```css
--color-border-strong: rgba(148, 163, 184, 0.28);
```

Used for:

- Hover states
- Active controls
- Higher-emphasis boundaries

---

## Text Colors

### Primary Text

```css
--color-text-primary: #f8fafc;
```

Used for:

- Headings
- Main values
- Strong labels
- Primary content

### Secondary Text

```css
--color-text-secondary: #a8b3c7;
```

Used for:

- Descriptions
- Supporting text
- Secondary labels

### Muted Text

```css
--color-text-muted: #718096;
```

Used for:

- Metadata
- Timestamps
- Low-priority information
- Placeholder-like content

### Disabled Text

```css
--color-text-disabled: #4b5568;
```

Used for:

- Disabled controls
- Unavailable actions
- Inactive content

### Inverse Text

```css
--color-text-inverse: #ffffff;
```

Used for:

- Text over brand backgrounds
- High-contrast status surfaces
- Strong dark-to-light contrast situations

---

## Status Colors

### Success

```css
--color-success: #21c77a;
```

Used for:

- Completed actions
- Healthy system states
- Positive outcomes
- Valid inputs

### Warning

```css
--color-warning: #f5b942;
```

Used for:

- Attention-required states
- Incomplete configuration
- Potential risk
- Non-blocking issues

### Danger

```css
--color-danger: #f04e4e;
```

Used for:

- Errors
- Destructive actions
- Failed operations
- Critical alerts

### Information

```css
--color-info: #4aa8ff;
```

Used for:

- Informational notices
- Guidance
- Neutral system messaging
- Educational context

---

## Interaction Guidance

### Buttons

Primary actions use:

```css
background: var(--color-brand-primary);
color: var(--color-text-inverse);
```

Primary hover state uses:

```css
background: var(--color-brand-secondary);
```

Secondary actions use:

```css
background: var(--color-surface);
border-color: var(--color-border);
color: var(--color-text-primary);
```

### Focus States

Interactive elements must use a visible focus treatment.

Current system focus token:

```css
--focus-ring: 0 0 0 3px rgba(79, 124, 255, 0.35);
```

Focus should remain visible against all supported surfaces.

### Selected States

Selected controls should use more than color alone when practical.

Recommended combination:

- Brand border
- Subtle brand-tinted background
- Clear text label
- Optional check or icon

---

## Gradients

Gradients should be used sparingly.

Recommended brand gradient:

```css
background:
  linear-gradient(
    135deg,
    var(--color-brand-primary),
    var(--color-brand-secondary)
  );
```

Recommended highlighted surface:

```css
background:
  linear-gradient(
    135deg,
    rgba(79, 124, 255, 0.12),
    rgba(91, 108, 255, 0.04)
  ),
  var(--color-surface);
```

Gradients should not reduce readability or obscure hierarchy.

---

## Accessibility

Color combinations must maintain readable contrast.

Required practices:

- Do not use muted text for essential instructions.
- Do not use disabled colors for active content.
- Do not communicate status using color alone.
- Maintain visible focus indicators.
- Review text contrast on every surface.
- Avoid placing secondary text over complex gradients.
- Test critical workflows under reduced brightness and common display conditions.

Formal contrast validation should be performed as the Design System matures.

---

## Temporary Compatibility Aliases

The following aliases exist only to preserve legacy interfaces:

```css
--color-primary: var(--color-brand-primary);
--color-primary-hover: var(--color-brand-secondary);
--color-white: var(--color-text-inverse);
```

New code must not use these aliases.

They should be removed after all legacy styles have been migrated.

---

## Approved Usage Example

```css
.panel {
  color: var(--color-text-primary);
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
}

.panel:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-strong);
}

.panelDescription {
  color: var(--color-text-secondary);
}
```

---

## Incorrect Usage Example

```css
.panel {
  color: white;
  background: #101d33;
  border: 1px solid #2b3a58;
}

.panel:hover {
  background: #172742;
}
```

The incorrect example introduces arbitrary values and bypasses the shared token system.

---

## Definition of Done

The color foundation is considered implemented when:

- Tokens exist in `tokens.css`.
- Shared components use semantic color tokens.
- New product interfaces avoid hardcoded colors.
- Legacy aliases are tracked for removal.
- Contrast and focus behavior are reviewed.
- At least one real CreatorOS workflow uses the documented system.
