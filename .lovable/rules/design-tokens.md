# Design Tokens

Token reference for **siloshop**. Use utility classes and CSS variables — never raw values.

## Colors

Apply with any color utility: `bg-<name>`, `text-<name>`, `border-<name>`, `ring-<name>`, `divide-<name>`, etc.

| Name | CSS variable |
|---|---|
| `background` | `--background` |
| `foreground` | `--foreground` |
| `card` | `--card` |
| `card-foreground` | `--card-foreground` |
| `popover` | `--popover` |
| `popover-foreground` | `--popover-foreground` |
| `primary` | `--primary` |
| `primary-foreground` | `--primary-foreground` |
| `secondary` | `--secondary` |
| `secondary-foreground` | `--secondary-foreground` |
| `muted` | `--muted` |
| `muted-foreground` | `--muted-foreground` |
| `accent` | `--accent` |
| `accent-foreground` | `--accent-foreground` |
| `destructive` | `--destructive` |
| `destructive-foreground` | `--destructive-foreground` |
| `border` | `--border` |
| `input` | `--input` |
| `ring` | `--ring` |
| `success` | `--success` |
| `success-foreground` | `--success-foreground` |
| `warning` | `--warning` |
| `warning-foreground` | `--warning-foreground` |
| `sale` | `--sale` |
| `sale-foreground` | `--sale-foreground` |
| `info` | `--info` |
| `info-foreground` | `--info-foreground` |
| `gradient-primary` | `--gradient-primary` |
| `sidebar-background` | `--sidebar-background` |
| `sidebar-foreground` | `--sidebar-foreground` |
| `sidebar-primary` | `--sidebar-primary` |
| `sidebar-primary-foreground` | `--sidebar-primary-foreground` |
| `sidebar-accent` | `--sidebar-accent` |
| `sidebar-accent-foreground` | `--sidebar-accent-foreground` |
| `sidebar-border` | `--sidebar-border` |
| `sidebar-ring` | `--sidebar-ring` |
| `status-pending` | `--status-pending` |
| `status-confirmed` | `--status-confirmed` |
| `status-preparing` | `--status-preparing` |
| `status-ready` | `--status-ready` |
| `status-shipped` | `--status-shipped` |
| `status-out` | `--status-out` |
| `status-delivered` | `--status-delivered` |
| `status-completed` | `--status-completed` |
| `status-cancelled` | `--status-cancelled` |
| `status-returned` | `--status-returned` |

## Border Radius

Border-radius classes:

| Class | CSS variable |
|---|---|
| `rounded` | `--radius` |

## Shadows

Box-shadow classes:

| Class | CSS variable |
|---|---|
| `shadow-elegant` | `--shadow-elegant` |
| `shadow-card` | `--shadow-card` |

## Other

Reference via `var(--name)` in inline styles or CSS.

| CSS variable |
|---|
| `--gradient-hero` |
| `--transition-smooth` |

