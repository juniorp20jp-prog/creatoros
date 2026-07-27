# Card Component

**Status:** Active

**Component Source:**

```
packages/ui/src/components/data-display/Card
```

---

# Purpose

The Card component is the primary surface container used throughout CreatorOS.

Cards organize related information into visually distinct sections while maintaining a consistent layout and appearance across the platform.

---

# Variants

## Default

The standard card used throughout the application.

Examples:

- Dashboard widgets
- Information panels
- Analytics summaries

---

## Elevated

Used to emphasize important information.

Examples:

- Featured insights
- Premium content
- Highlighted recommendations

---

## Interactive

Used when the entire card acts as a clickable element.

Examples:

- Project selection
- Template gallery
- Dashboard navigation

The `interactive` variant provides hover and `focus-within` presentation. Card
remains a semantic container; compose a button or anchor inside it for actual
interaction.

---

## Highlighted

Used for high-priority content.

Examples:

- AI recommendations
- Critical alerts
- Featured opportunities

Use this variant sparingly.

---

# Padding

The Card component supports the following padding options:

## None

Used when child components control their own spacing.

---

## Small

Used for compact layouts.

---

## Medium

Default padding.

Recommended for most cards.

---

## Large

Used for feature panels and onboarding screens.

---

# States

The Card component supports:

- Default
- Hover
- Focus
- Selected
- Disabled (when applicable)

Interactive presentation must not be treated as control semantics.

---

# Accessibility

Cards must:

- Maintain sufficient contrast.
- Compose semantic buttons or links for interaction.
- Preserve keyboard navigation through the nested control.
- Display visible `focus-within` feedback.
- Preserve readable spacing and typography.

---

# Usage

Good examples:

- Dashboard widgets
- Analytics panels
- User profiles
- Settings groups
- Reports
- Statistics
- AI recommendations

Avoid using cards when a simple container is sufficient.

---

# Example

```tsx
<Card>
    Dashboard Content
</Card>

<Card variant="interactive">
    Open Project
</Card>

<Card variant="highlighted">
    AI Opportunity
</Card>
```

---

# Design Guidelines

Cards should:

- Use shared spacing tokens.
- Use shared radius tokens.
- Use shared shadow tokens.
- Avoid excessive nesting.
- Maintain consistent internal spacing.

Cards should never introduce hardcoded colors, spacing, or shadows.

---

# Definition of Done

The Card component is complete when:

- All variants are implemented.
- Padding options are available.
- Interactive behavior is accessible.
- Design tokens are used exclusively.
- No hardcoded styling values exist.
- Documentation matches the implementation.
