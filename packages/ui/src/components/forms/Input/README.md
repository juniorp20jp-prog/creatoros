# Input

**Status:** Active — Architecture Gate pending

## Overview

The Input component is the standard text input used throughout CreatorOS.

It is designed to be:

- Accessible
- Responsive
- Themeable
- Fully typed
- Token-based
- WCAG AA compliant

---

# Features

- Label
- Helper Text
- Error Text
- Required
- Optional
- Prefix
- Suffix
- Left Icon
- Right Icon
- Disabled
- Read Only
- Success State
- Error State
- Three Sizes
- Full Width
- Forward Ref Support

---

# Import

```tsx
import { Input } from "@repo/ui";
```

---

# Basic Usage

```tsx
<Input
    label="Project Name"
    placeholder="Enter a project name"
/>
```

---

# With Helper Text

```tsx
<Input
    label="Workspace"
    helperText="Choose a unique workspace name."
/>
```

---

# With Error

```tsx
<Input
    label="Email"
    errorText="A valid email address is required."
/>
```

---

# Required

```tsx
<Input
    label="Title"
    required
/>
```

---

# Optional

```tsx
<Input
    label="Website"
    optionalText="Optional"
/>
```

Optional text is not generated automatically. Consumers must provide localized
content through `optionalText`.

---

# Prefix

```tsx
<Input
    label="Website"
    prefix="https://"
/>
```

---

# Suffix

```tsx
<Input
    label="Budget"
    suffix="USD"
/>
```

---

# Sizes

```tsx
<Input inputSize="sm" />

<Input inputSize="md" />

<Input inputSize="lg" />
```

---

# Status

```tsx
<Input status="default" />

<Input status="success" />

<Input status="error" />
```

---

# Accessibility

The component supports:

- Keyboard navigation
- Screen readers
- Focus management
- Proper labels
- aria-invalid
- aria-describedby

---

# Design Rules

Always use Design Tokens.

Never hardcode:

- Colors
- Radius
- Shadows
- Typography
- Spacing

---

# Future Improvements

- Password visibility toggle
- Search variant
- Clear button
- Loading indicator
- Character counter
- Input masking
- Currency formatting
- Number formatting
- Validation hooks

---

# Status

Architecture Gate pending
