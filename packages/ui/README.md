# @repo/ui

Shared UI foundation for CreatorOS applications.

Status: **Architecture Gate pending**

## Usage in the monorepo

Consumers declare the workspace package:

```json
{
  "dependencies": {
    "@repo/ui": "workspace:*"
  }
}
```

Import active components from the package root:

```tsx
import { Button, Card, Field, Input, Label } from "@repo/ui";
import "@repo/ui/styles/globals.css";
```

The supported compatibility subpaths are:

```tsx
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
```

Root and subpath imports resolve to the same canonical implementations.

## Active components

- Button
- Card
- Field
- Input
- Label

Alert, Checkbox, Modal, Radio, Select, Switch, and Textarea are planned.
Their design documents are specifications, not implemented APIs.

## Structure

```text
src/
├── components/
│   ├── actions/
│   ├── data-display/
│   └── forms/
├── styles/
└── utils/
```

`src/Button` and `src/Card` are compatibility paths that reexport the
canonical categorized components. They must not contain independent
implementations.

## Distribution model

`@repo/ui` is source-first and private to this Turborepo. Its export map
points to TypeScript source. Each Next.js consumer must be able to compile
workspace TypeScript directly. Applications may declare `transpilePackages`
explicitly, while supported Next.js configurations may handle workspace
source without that option.

The package therefore has no separate build artifact. Type safety is enforced
with `tsc --noEmit`, and consumer builds validate source distribution.

## Design tokens and styles

`src/styles/tokens.css` is the only token source of truth.

Semantic color, spacing, radius, shadow, typography, and motion tokens are
consumer-facing foundations. Control dimensions, icon dimensions, autofill
values, and component-specific focus treatments are internal implementation
tokens. Internal tokens remain validated but are not a stable consumer API.

Applications must import `@repo/ui/styles/globals.css` from their root layout
before application-local global styles. This loads the shared tokens and reset
while allowing local overrides. Components use CSS Modules and must not
introduce unresolved CSS custom properties. The token test checks this
invariant.

## Public utilities

The root API also exports `cn` and its `ClassValue` type. `cn` combines string
class names and removes false, null, and undefined values. It is intentionally
small and public so consumers do not recreate component class-name joining.

## Testing

```bash
pnpm --filter @repo/ui test
pnpm --filter @repo/ui check-types
pnpm --filter @repo/ui lint
```

Tests focus on behavior, accessible queries, native attributes, refs, public
exports, and token integrity.

## Accessibility

Shared controls must preserve native HTML semantics, visible focus, keyboard
operation, disabled behavior, reduced-motion preferences, and accessible
labels. `Card` is a visual container; interactive controls must be buttons or
links composed inside it.

## Adding a component

1. Add it to the appropriate category.
2. Define a small typed public API.
3. Use existing tokens and CSS Modules.
4. Add behavior and accessibility tests.
5. Export it intentionally from the category and package barrels.
6. Document only implemented behavior.
7. Mark its design-system document Active only after implementation.
