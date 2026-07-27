# Alert Component

**Status:** Planned — not implemented

**Component Source:**

```
packages/ui/src/components/feedback/Alert
```

---

# Purpose

The Alert component communicates important information, feedback, warnings, errors, or success messages to users.

Alerts should attract attention without interrupting the user's workflow unless immediate action is required.

---

# Variants

## Info

Used for neutral information.

Examples:

- New feature available
- System information
- General guidance

---

## Success

Used to confirm successful actions.

Examples:

- Project saved
- Analysis completed
- Settings updated

---

## Warning

Used to notify users about potential issues.

Examples:

- Missing configuration
- Expiring subscription
- Unsaved changes

---

## Danger

Used for critical problems.

Examples:

- Analysis failed
- API connection lost
- Validation errors
- Permission denied

---

# Sizes

## Compact

Used inside cards, tables, and side panels.

---

## Default

Recommended for most interfaces.

---

## Large

Used for onboarding, full-page notifications, and major workflows.

---

# States

The Alert component supports:

- Default
- Dismissible
- With Icon
- With Action Button

---

# Accessibility

Alerts must:

- Be readable with sufficient contrast.
- Include meaningful text.
- Support screen readers.
- Avoid relying only on color.
- Use icons together with labels when appropriate.

---

# Usage

Good examples:

- Display validation errors
- Confirm successful actions
- Warn about incomplete setup
- Notify users of system events

Avoid using alerts for temporary loading feedback. Use a Spinner or Skeleton instead.

---

# Example

```tsx
<Alert
    variant="success"
    title="Analysis Complete"
>
    Your channel has been analyzed successfully.
</Alert>

<Alert
    variant="warning"
    title="Incomplete Configuration"
>
    Connect your YouTube channel to continue.
</Alert>

<Alert
    variant="danger"
    title="Connection Error"
>
    Unable to reach the AI service.
</Alert>
```

---

# Design Guidelines

Alerts should:

- Use shared color tokens.
- Use shared spacing tokens.
- Use shared typography tokens.
- Use shared radius tokens.
- Use shared shadow tokens.

Avoid hardcoded styling values.

---

# Definition of Done

The Alert component is complete when:

- All variants exist.
- Accessibility requirements are satisfied.
- Icons are supported.
- Optional dismiss action is available.
- Design tokens are used exclusively.
- Documentation matches the implementation.
