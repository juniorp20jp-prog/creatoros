# CreatorOS Design System

**Version:** 1.0
**Status:** Foundation
**Product:** CreatorOS
**Package:** `@repo/ui`

**Implementation status:** Architecture Gate pending

Active components are Button, Card, Field, Input, and Label. Alert, Checkbox,
Modal, Radio, Select, Switch, and Textarea are planned specifications and are
not public APIs.

Sources of truth:

- Tokens: `packages/ui/src/styles/tokens.css`
- Components: `packages/ui/src/components`
- Public API: `packages/ui/src/index.ts`
- Distribution rules: `packages/ui/README.md`

---

## 1. Purpose

CreatorOS Design System is the shared visual and interaction foundation for every CreatorOS product.

Its purpose is to ensure that all applications, modules, pages and components feel consistent, accessible and recognizably part of the same product ecosystem.

The system must support:

- CreatorOS Web
- CreatorOS HQ
- Mission Control
- Revenue Intelligence
- CSI
- Blueprint
- Admin applications
- Marketing experiences
- Future CreatorOS products

---

## 2. Core principles

### Consistency

The same interface problem should use the same visual and interaction solution throughout the platform.

### Reusability

Components must be created for reuse across applications, not for a single screen.

### Clarity

Every interface should help the creator understand:

1. What is happening.
2. Why it matters.
3. What action to take next.

### Accessibility

Components must support keyboard navigation, visible focus states, sufficient contrast and reduced-motion preferences.

### Scalability

The system must support new modules, applications, languages and product areas without requiring duplicated design decisions.

### Product identity

CreatorOS should not feel like a generic analytics dashboard. Its visual language must communicate intelligence, direction, growth and operational control.

---

## 3. Architecture

The implemented Design System currently contains foundations and component
specifications. Patterns and brand are future organizational areas:
design-system/
├── 01-foundations/
├── 02-components/
├── 03-patterns/
├── 04-brand/
└── README.md
