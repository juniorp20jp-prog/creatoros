# Shadows Foundation

**Status:** Active
**Source of truth:** `packages/ui/src/styles/tokens.css`

---

# Purpose

The shadow system provides depth, hierarchy, and visual separation between interface elements.

Shadows should communicate elevation, not decoration.

---

# Principles

## Use predefined shadow tokens

Always use the shared shadow tokens defined in `tokens.css`.

Avoid custom box-shadow values.

---

## Keep shadows subtle

CreatorOS follows a modern interface style.

Shadows should be soft and unobtrusive.

---

## Elevation reflects importance

Higher elevation indicates higher importance or interaction.

---

# Shadow Scale

```css
--shadow-none: none;
--shadow-sm: 0 8px 24px rgba(0, 0, 0, 0.14);
--shadow-md: 0 16px 48px rgba(0, 0, 0, 0.20);
--shadow-lg: 0 24px 80px rgba(0, 0, 0, 0.24);
```

---

# Usage

## None

```css
--shadow-none
```

Used for:

- Flat layouts
- Dividers
- Structural containers

---

## Small

```css
--shadow-sm
```

Used for:

- Buttons
- Inputs
- Dropdown menus
- Small cards

---

## Medium

```css
--shadow-md
```

Used for:

- Standard cards
- Dashboard widgets
- Popovers
- Navigation panels

---

## Large

```css
--shadow-lg
```

Used for:

- Modals
- Dialogs
- Floating windows
- High-priority overlays

---

# Hover States

Interactive components may increase elevation slightly.

Example:

```css
.card {
    box-shadow: var(--shadow-sm);
}

.card:hover {
    box-shadow: var(--shadow-md);
}
```

Avoid dramatic shadow changes.

---

# Accessibility

Shadows must never be the only indicator of interaction.

Always combine elevation with:

- Border changes
- Background changes
- Focus states
- Cursor changes

---

# Approved Usage Example

```css
.card {
    box-shadow: var(--shadow-md);
}

.modal {
    box-shadow: var(--shadow-lg);
}

.button {
    box-shadow: var(--shadow-sm);
}
```

---

# Incorrect Usage Example

```css
.card {
    box-shadow: 0 0 40px black;
}

.modal {
    box-shadow: 0 0 100px rgba(0,0,0,.8);
}
```

These values create unnecessary visual noise and break consistency.

---

# Definition of Done

Shadows are considered implemented when:

- Shadow tokens exist in `tokens.css`.
- Components use shared shadow tokens.
- Hover elevation is subtle.
- Large shadows are reserved for overlays.
- Custom shadow values are avoided.
