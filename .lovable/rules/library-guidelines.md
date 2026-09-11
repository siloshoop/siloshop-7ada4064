# siloshop — Guidelines

## Components

The design system exports these components — import them from `@ws-qxm2zykovh8ikugellxc/456c8c16-1d24-407c-a1f5-c7b374b1fe4d` and compose them before building anything from scratch:

`AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogOverlay`, `AlertDialogPortal`, `AlertDialogTitle`, `AlertDialogTrigger`, `AlertDialog`, `AvatarFallback`, `AvatarImage`, `Avatar`, `Badge`, `Button`, `CardContent`, `CardDescription`, `CardFooter`, `CardHeader`, `CardTitle`, `Card`, `CategoryCardItem`, `Checkbox`, `Constants`, `DialogClose`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogOverlay`, `DialogPortal`, `DialogTitle`, `DialogTrigger`, `Dialog`, `DropdownMenuCheckboxItem`, `DropdownMenuContent`, `DropdownMenuGroup`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuPortal`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuSeparator`, `DropdownMenuShortcut`, `DropdownMenuSubContent`, `DropdownMenuSubTrigger`, `DropdownMenuSub`, `DropdownMenuTrigger`, `DropdownMenu`, `FavoriteButton`, `FlyToCartProvider`, `ImageGallery`, `Input`, `Label`, `NavigationMenuContent`, `NavigationMenuIndicator`, `NavigationMenuItem`, `NavigationMenuLink`, `NavigationMenuList`, `NavigationMenuTrigger`, `NavigationMenuViewport`, `NavigationMenu`, `NotificationsDropdown`, `ProductCardSkeleton`, `ProductGridSkeleton`, `ProductPicker`, `ProductRailSkeleton`, `ProductReviews`, `Progress`, `RadioGroupItem`, `RadioGroup`, `ScrollArea`, `ScrollBar`, `SearchFilters`, `SelectContent`, `SelectGroup`, `SelectItem`, `SelectLabel`, `SelectScrollDownButton`, `SelectScrollUpButton`, `SelectSeparator`, `SelectTrigger`, `SelectValue`, `Select`, `Separator`, `SheetClose`, `SheetContent`, `SheetDescription`, `SheetFooter`, `SheetHeader`, `SheetOverlay`, `SheetPortal`, `SheetTitle`, `SheetTrigger`, `Sheet`, `Skeleton`, `Slider`, `Switch`, `TabsContent`, `TabsList`, `TabsTrigger`, `Tabs`, `Textarea`, `ThemeToggle`, `ToastAction`, `ToastClose`, `ToastDescription`, `ToastProvider`, `ToastTitle`, `ToastViewport`, `Toast`, `VendorPicker`, `VendorRating`

Per-component details (import stanzas, props, variants, examples) live in `.lovable/rules/libraries/{slug}/components.md` — on disk, not auto-loaded. Read that file or the component source when the name alone isn't enough.

## Theme Files

The design system's theme is delivered through the following files. The author's original source files carry the full wiring the design system needs — variable declarations, framework-specific directives, provider objects, etc. — and are the canonical import target.

- `@ws-qxm2zykovh8ikugellxc/456c8c16-1d24-407c-a1f5-c7b374b1fe4d/index.css` (source — preferred import)
- `@ws-qxm2zykovh8ikugellxc/456c8c16-1d24-407c-a1f5-c7b374b1fe4d/dist/tokens.css` (auto-generated flat list of CSS custom properties — a raw-values fallback only; does NOT carry framework-specific wiring that the source files above provide)

