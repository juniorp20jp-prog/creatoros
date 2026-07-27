# Card

Status: **Active — Architecture Gate pending**

```tsx
import { Card } from "@repo/ui";
```

Card is a composable visual container that forwards native div attributes and
refs.

## Public API

- Variants: `default`, `elevated`, `interactive`, `highlighted`
- Padding: `none`, `sm`, `md`, `lg`
- Optional composition helpers: `title`, `subtitle`

`interactive` provides hover and `focus-within` presentation only. It does not
turn the Card into a control and does not add a role, tab stop, or click
behavior. Compose a semantic button or link inside the Card when interaction
is required.

```tsx
<Card title="Channel" subtitle="Last 28 days">
  <a href="/channel">Open channel</a>
</Card>
```
