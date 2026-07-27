# Typography Foundation

**Status:** Active
**Source of truth:** `packages/ui/src/styles/tokens.css`

---

# Purpose

Typography establishes visual hierarchy, readability, and consistency across the entire CreatorOS platform.

A predictable typography system improves usability, accessibility, and the overall product experience.

---

# Principles

## Clarity over decoration

Typography exists to communicate information.

Decorative styles should never reduce readability.

---

## Consistency

The same heading level should always represent the same importance.

Do not change font sizes arbitrarily.

---

## Hierarchy

Visual hierarchy should be created primarily through:

- Font size
- Font weight
- Spacing

Avoid relying only on color.

---

## Readability

Always prioritize comfortable reading.

Avoid extremely small text or excessive line lengths.

---

# Font Family

CreatorOS uses:

```css
font-family:
  Inter,
  system-ui,
  sans-serif;
```

Reasons:

- Excellent readability
- Modern appearance
- Great screen rendering
- Wide language support

---

# Font Weights

## Regular

```css
400
```

Used for:

- Paragraphs
- Descriptions
- Long text

---

## Medium

```css
500
```

Used for:

- Labels
- Navigation
- Secondary headings

---

## SemiBold

```css
600
```

Used for:

- Card titles
- Section titles
- Buttons

---

## Bold

```css
700
```

Used for:

- Main headings
- Dashboard metrics
- Important values

---

# Typography Scale

The source tokens are:

```css
--font-size-xs: 0.75rem;
--font-size-sm: 0.875rem;
--font-size-md: 1rem;
--font-size-lg: 1.25rem;
--font-size-xl: 2rem;
--font-size-display: clamp(2.5rem, 5vw, 4rem);
--font-size-h1: 2.25rem;
--font-size-h2: 1.875rem;
--font-size-h3: 1.5rem;
--font-size-body-lg: 1.125rem;
```

## Display

```css
var(--font-size-display)
```

Used for:

- Landing pages
- Hero sections

---

## H1

```css
var(--font-size-h1)
```

Used for:

- Main page titles

---

## H2

```css
var(--font-size-h2)
```

Used for:

- Major sections

---

## H3

```css
var(--font-size-h3)
```

Used for:

- Cards
- Panels
- Modules

---

## H4

```css
var(--font-size-lg)
```

Used for:

- Small sections

---

## Body Large

```css
var(--font-size-body-lg)
```

Used for:

- Important descriptions

---

## Body

```css
var(--font-size-md)
```

Default body text.

---

## Small

```css
var(--font-size-sm)
```

Used for:

- Labels
- Metadata
- Helper text

---

## Caption

```css
var(--font-size-xs)
```

Used for:

- Minor information
- Status details

---

# Line Height

Recommended values:

```css
Heading:
1.2

Body:
1.5

Long text:
1.6
```

---

# Letter Spacing

Default:

```css
normal
```

Large headings may use:

```css
-0.02em
```

Never apply excessive letter spacing.

---

# Text Alignment

Default:

```css
left
```

Center alignment should be reserved for:

- Empty states
- Landing pages
- Success screens

Avoid justified text.

---

# Accessibility

Requirements:

- Minimum body size: 16px
- Maintain sufficient contrast
- Avoid ultra-light weights
- Use semantic heading order
- Do not skip heading levels

---

# Example

```css
.pageTitle {
  font-size: var(--font-size-h1);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}

.cardTitle {
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-semibold);
}

.body {
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
}

.caption {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
```

---

# Definition of Done

Typography is considered implemented when:

- Font family is consistent.
- Typography scale is respected.
- Components use semantic typography.
- Heading hierarchy is maintained.
- Accessibility guidelines are followed.
