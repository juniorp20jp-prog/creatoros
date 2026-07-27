# Accessibility Foundation

**Status:** Active
**Source of truth:** CreatorOS Design System

---

# Purpose

Accessibility ensures that CreatorOS can be used by the widest possible audience, regardless of ability, device, or environment.

Accessibility is a core product requirement, not an optional enhancement.

---

# Principles

## Build accessibly from the start

Accessibility should be considered during design and development, not added later.

---

## Keyboard First

Every interactive element must be usable using only the keyboard.

Users must be able to:

- Navigate
- Activate controls
- Open menus
- Close dialogs
- Submit forms

without requiring a mouse.

---

## Visible Focus

Every interactive component must display a clearly visible focus indicator.

Never remove focus outlines unless they are replaced with an equivalent or better alternative.

Example:

```css
:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
}
```

---

## Color is not enough

Never communicate information using color alone.

Always combine color with:

- Icons
- Labels
- Text
- Patterns
- Status indicators

---

## Text Contrast

Maintain sufficient contrast between:

- Text and background
- Icons and background
- Interactive controls and surrounding surfaces

Avoid low-contrast combinations.

---

## Typography

Requirements:

- Minimum body text: 16px
- Clear heading hierarchy
- Readable line height
- Avoid decorative fonts

---

## Interactive Targets

Buttons, links, and controls should provide comfortable click and touch targets.

Avoid extremely small interactive areas.

---

## Motion

Respect users who prefer reduced motion.

Support:

```css
@media (prefers-reduced-motion: reduce)
```

Reduce or remove non-essential animations.

---

## Forms

Every form control should include:

- Visible label
- Error message
- Helper text when needed

Do not rely on placeholder text as the only label.

---

## Icons

Icons should always have accessible labels when their meaning is not obvious.

Decorative icons should be hidden from assistive technologies.

Example:

```html
<button aria-label="Search">
```

Decorative example:

```html
<svg aria-hidden="true">
```

---

## Images

Informative images must include meaningful alternative text.

Decorative images should use empty alt attributes.

Examples:

```html
<img alt="CreatorOS dashboard overview">
```

```html
<img alt="">
```

---

## Headings

Use headings in logical order.

Correct:

```
H1
 ├── H2
 │    ├── H3
 │    └── H3
 └── H2
```

Avoid skipping heading levels.

---

## Error Messages

Error messages should:

- Explain the problem
- Explain how to fix it
- Be visible
- Be associated with the correct input

---

## Loading States

Users should always understand when the system is processing an action.

Use:

- Loading indicators
- Disabled buttons
- Progress indicators
- Skeleton screens

when appropriate.

---

## Best Practices

Always:

- Support keyboard navigation
- Maintain visible focus
- Use semantic HTML
- Use sufficient contrast
- Label controls clearly
- Test without a mouse

Avoid:

- Hidden focus indicators
- Tiny buttons
- Low contrast
- Color-only communication
- Autoplay animations
- Flashing effects

---

# Definition of Done

Accessibility is considered implemented when:

- Components support keyboard navigation.
- Focus indicators are visible.
- Contrast is sufficient.
- Forms are properly labeled.
- Motion respects user preferences.
- Semantic HTML is used.
- Accessibility is verified during component reviews.
