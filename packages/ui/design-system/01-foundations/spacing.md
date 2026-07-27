# Spacing Foundation

**Status:** Active
**Source of truth:** `packages/ui/src/styles/tokens.css`

---

# Purpose

The spacing system creates rhythm, consistency, and visual balance throughout the CreatorOS interface.

Consistent spacing improves readability, usability, and overall design quality.

---

# Principles

## Use the spacing scale

Always use the predefined spacing tokens.

Avoid arbitrary values whenever possible.

---

## Consistency

Equal relationships should use equal spacing.

Components with similar layouts should share the same spacing values.

---

## Breathing Room

Interfaces should feel open and organized.

Avoid placing elements too close together.

---

## Visual Hierarchy

Spacing helps users understand relationships between elements.

More important groups should receive more surrounding space.

---

# Spacing Scale

```css
--space-0: 0;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
--space-7: 48px;
--space-8: 64px;
--space-10: 80px;
--space-12: 96px;
```

---

# Usage

## 4px

Minor adjustments.

Examples:

- Icon alignment
- Tiny gaps

---

## 8px

Very small spacing.

Examples:

- Label to input
- Small button icons

---

## 12px

Compact spacing.

Examples:

- Card content
- Small lists

---

## 16px

Default spacing.

Examples:

- Component padding
- Form fields
- Navigation items

---

## 24px

Section spacing.

Examples:

- Card groups
- Dashboard widgets

---

## 32px

Large separation.

Examples:

- Between major sections
- Page content blocks

---

## 48px

Major layout spacing.

Examples:

- Large containers
- Hero sections

---

## 64px+

Used only for major page layouts.

---

# Component Padding

Recommended values:

Buttons

```css
padding:
8px 16px;
```

Cards

```css
padding:
24px;
```

Inputs

```css
padding:
12px 16px;
```

Panels

```css
padding:
24px;
```

---

# Grid System

CreatorOS uses an 8px spacing system.

Most spacing values should be multiples of 8.

Exceptions:

- 4px
- 12px
- Fine adjustments

---

# Layout Guidelines

Use larger spacing:

- Between sections

Use medium spacing:

- Between related components

Use small spacing:

- Between labels and controls

---

# Responsive Behavior

Spacing may be reduced slightly on small screens.

Hierarchy should always remain consistent.

Never remove spacing completely.

---

# Accessibility

Adequate spacing improves usability.

Maintain enough distance between:

- Buttons
- Inputs
- Interactive controls

Touch targets should remain comfortable.

---

# Example

```css
.page {
  padding: var(--space-6);
}

.section {
  margin-bottom: var(--space-7);
}

.card {
  padding: var(--space-5);
}

.buttonGroup {
  display: flex;
  gap: var(--space-4);
}
```

---

# Definition of Done

Spacing is considered implemented when:

- Components use spacing tokens.
- Arbitrary spacing values are avoided.
- Layout hierarchy is clear.
- Responsive spacing remains consistent.
- New interfaces follow the spacing scale.
