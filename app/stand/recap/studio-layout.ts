import { createPart } from "ag-grid-community";

/**
 * Card layout for AG Studio, as a theme part. Studio's theme has no settings for a widget card's inner padding
 * or the filter buttons' shape, so this adds a little CSS. As a part it ships with lemonTheme, and Studio wraps
 * it in the theme's own selector, so it only applies to Studio and outranks Studio's single-class rules.
 *
 * Written against AG Studio 3.1.0. Studio's DOM can change in any release, minor ones included, so each rule
 * targets one Studio class and changes only padding, margins, size, font and color, as AG's docs advise. After
 * upgrading ag-studio, check the recap's card spacing and filter buttons.
 *
 * Every card: 20px inset on each side, a 24px title line, 16px under the title. That matches the 20px gap
 * between cards and around the canvas (studioWidgetPadding and studioCanvasPadding). Canvas rows are 16px, so
 * a card is 16n − 20px tall; a title plus one 44px row of buttons is exactly 9 rows.
 */
const css = /* css */ `
.ag-studio-layout-widget-container {
  padding: 20px;
}

/* Hidden headers (the custom Today's sales widget) keep Studio's margin: 0. */
.ag-studio-layout-widget-header:not(.ag-studio-layout-widget-header-hidden) {
  margin: 0 0 16px;
}

/* Studio sets the title with an inline font shorthand, which resets line-height to normal (24.5px for
   Fraunces). Pin a whole pixel so cards land on whole rows. */
.ag-studio-layout-widget-title {
  line-height: 24px !important;
}

/* Grid cells keep 12px of horizontal padding to space their columns (gridCellHorizontalPadding). Pulling the
   grid out by that much lines the first column's text up with the title. */
.ag-studio-layout-widget-body .ag-root-wrapper {
  margin-inline: -12px;
}

/* The button filter's "Filter by: Item" label repeats the card title. recap-studio.tsx blanks its locale
   string, and this hides the empty label so it takes no space. */
.ag-studio-filter-widget-title:empty {
  display: none;
}

.ag-studio-filter-widget-title {
  padding: 0 0 8px;
  font-size: var(--text-footnote);
}

/* Filter buttons are the kit's medium button: 44px pills sized to their label, 8px apart, wrapping onto more
   rows when a stand sells many items. Studio lays them out as a stretched grid, so this is a flex row. */
.ag-studio-filter-widget-content {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 8px;
  padding: 0;
}

.ag-studio-button-filter-widget-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 20px;
  font: 600 var(--text-callout) / 1 var(--font-sans);
  transition: background-color 150ms var(--ease-glide);
}

/* Selection shows a checkmark as well as the lemon fill, so it never relies on color alone. */
.ag-studio-button-filter-widget-item-active::before {
  content: "";
  width: 1.1em;
  height: 1.1em;
  margin-inline-start: -4px;
  background-color: currentColor;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 12.5 4.5 4.5L19 7.5'/%3E%3C/svg%3E")
    center / contain no-repeat;
}

/* Fixed-width digits in grid cells, so totals don't jitter as sales arrive. */
.ag-cell {
  font-variant-numeric: tabular-nums;
}
`;

export const layoutPart = createPart({ feature: "lemonLayout", css });
