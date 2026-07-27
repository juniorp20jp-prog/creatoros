# Motion Foundation

**Status:** Active
**Source of truth:** `packages/ui/src/styles/tokens.css`

---

# Purpose

Motion provides visual feedback, reinforces user interactions, and creates a smoother experience throughout CreatorOS.

Animations should improve usability, not distract users.

---

# Principles

## Motion has a purpose

Every animation should communicate something meaningful, such as:

- A completed action
- A hover interaction
- A page transition
- A loading state
- A change in interface state

Avoid decorative animations.

---

## Keep animations fast

Interfaces should feel responsive.

Long animations make the application feel slower.

---

## Maintain consistency

Use the same animation durations and easing functions across the platform.

---

## Respect accessibility

Motion should never cause discomfort.

Animations must remain subtle and should not interfere with usability.

---

# Duration Scale

```css
--duration-fast: 160ms;
--duration-normal: 220ms;
--duration-slow: 320ms;
--easing-standard: ease;
--transition-fast: var(--duration-fast) var(--easing-standard);
--transition-normal: var(--duration-normal) var(--easing-standard);
```

---

# Easing

CreatorOS uses:

```css
ease
```

or

```css
ease-in-out
```

Avoid complex custom easing curves unless necessary.

---

# Recommended Usage

## Fast

```css
160ms
```

Used for:

- Hover effects
- Button interactions
- Icon transitions

---

## Normal

```css
220ms
```

Used for:

- Cards
- Navigation
- Panels
- Inputs
- Dropdowns

---

## Slow

```css
320ms
```

Used for:

- Dialogs
- Modals
- Page transitions
- Large interface changes

---

# Hover Example

```css
.button {
    transition:
        background var(--duration-normal) ease,
        transform var(--duration-fast) ease;
}

.button:hover {
    transform: translateY(-1px);
}
```

---

# Card Example

```css
.card {
    transition:
        background var(--duration-normal) ease,
        box-shadow var(--duration-normal) ease;
}

.card:hover {
    box-shadow: var(--shadow-md);
}
```

---

# Modal Example

```css
.modal {
    transition:
        opacity var(--duration-slow) ease,
        transform var(--duration-slow) ease;
}
```

---

# Accessibility

Respect users who prefer reduced motion.

Whenever possible, support:

```css
@media (prefers-reduced-motion: reduce)
```

In reduced motion mode:

- Remove unnecessary animations.
- Keep transitions minimal.
- Preserve usability.

---

# Best Practices

Use motion to:

- Confirm actions
- Guide attention
- Improve continuity

Avoid:

- Continuous animations
- Flashing effects
- Excessive scaling
- Rotating interface elements
- Long transitions

---

# Definition of Done

Motion is considered implemented when:

- Shared duration tokens exist.
- Components use consistent transition timing.
- Motion communicates interaction.
- Reduced-motion preferences are respected.
- Decorative animations are avoided.
