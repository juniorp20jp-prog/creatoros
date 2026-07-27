# Button

Status: **Active — Architecture Gate pending**

```tsx
import { Button } from "@repo/ui";
```

Button is the canonical CreatorOS action control. It forwards native button
attributes and refs, defaults to `type="button"`, and preserves explicit
`submit` or `reset` types.

## Public API

- Variants: `primary`, `secondary`, `ghost`, `danger`, `outline`
- Sizes: `sm`, `md`, `lg`
- Compatibility size aliases: `small`, `medium`, `large`
- Layout: `fullWidth`, `iconOnly`
- Content: `leftIcon`, `rightIcon`
- Loading: `isLoading`, optional `loadingContent`

Loading disables the native button. No localized loading string is embedded;
consumers may supply `loadingContent`.

Icon-only buttons require an accessible `aria-label`.

```tsx
<Button variant="primary" onClick={startAnalysis}>
  Analyze
</Button>

<Button isLoading loadingContent="Saving" aria-label="Saving project">
  Save
</Button>
```
