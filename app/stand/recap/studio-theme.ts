import {
  studioIconOverrides,
  studioTheme,
  type AgButtonFilterWidgetStyle,
  type AgPartStyleParams,
  type AgStudioTheme,
  type AgStudioThemeParams,
} from "ag-studio";

// Citrus Glass for AG Studio. Every value is a kit token read as a CSS variable, so Studio follows light and
// dark mode and Increase Contrast with the rest of the app. Sizes are rem-based text styles where Studio
// accepts them, so text follows Dynamic Type.

// Studio reads some colors back with getComputedStyle (widget titles, charts) and only parses rgb() or
// color(srgb …). Our tokens compute to oklch(), which it drops, so titles fell back to black. Mixing a token
// in srgb makes the browser serialize it as color(srgb …), and it still follows light and dark mode.
const c = (token: string) => `color-mix(in srgb, var(--${token}) 100%, transparent)`;

const sans = "var(--font-sans)";
const display = "var(--font-display)";

const type = {
  // One family everywhere except widget titles, which get the kit's display serif. Studio only knows normal
  // and bold for widget titles, so 600 renders as bold.
  fontFamily: sans,
  fontSize: "var(--text-subhead)",
  textColor: c("ink"),
  foregroundColor: c("ink"),
  subtleTextColor: c("ink-2"),
  iconColor: c("ink-2"),
  invalidColor: c("berry"),
  // The kit's tint for text, as on plain buttons. Lemon is too light to read as text on a white card.
  accentColor: c("peel"),

  studioCanvasFontFamily: sans,
  studioPanelHeaderFontFamily: sans,
  studioPanelHeaderFontSize: "var(--text-footnote)",
  studioPanelHeaderFontWeight: 600,
  studioFormLabelColor: c("ink-2"),
  studioFormLabelFontSize: "var(--text-footnote)",
  studioPopupTitleBarFontFamily: sans,
  studioPopupTitleBarTextColor: c("ink"),

  studioWidgetTitleFontFamily: display,
  studioWidgetTitleFontSize: "var(--text-title3)",
  studioWidgetTitleFontWeight: 600,
  studioWidgetTitleTextColor: c("ink"),
  studioWidgetSubtitleFontFamily: sans,
  studioWidgetSubtitleFontSize: "var(--text-footnote)",
  studioWidgetSubtitleTextColor: c("ink-2"),
  studioWidgetCaptionFontFamily: sans,
  studioWidgetCaptionFontSize: "var(--text-caption)",
  studioWidgetCaptionTextColor: c("ink-2"),

  gridFontFamily: sans,
  gridHeaderFontFamily: sans,
  gridCellFontFamily: sans,
  gridFontSize: "var(--text-subhead)",
  gridHeaderFontSize: "var(--text-footnote)",
  gridHeaderFontWeight: 600,
  gridHeaderTextColor: c("ink-2"),
  gridCellTextColor: c("ink"),
  gridIconColor: c("ink-2"),
} as const;

// Widgets read as kit Cards on a calm canvas. The page already draws the outer card, so Studio's own frame,
// canvas border and the grids' inner borders go away and only hairlines separate things.
const surfaces = {
  backgroundColor: c("surface"),
  borderColor: c("hairline"),
  browserColorScheme: "inherit",

  studioWrapperBorder: false,
  studioWrapperBorderRadius: 0,
  studioWrapperBackgroundColor: "transparent",

  studioCanvasBackgroundColor: c("canvas"),
  studioCanvasBorder: false,
  studioCanvasBorderRadius: 0,
  studioCanvasShadow: false,
  studioCanvasGridLineColor: c("hairline"),

  studioWidgetBackgroundColor: c("surface"),
  studioWidgetBorder: "0.5px solid var(--hairline)",
  studioWidgetBorderRadius: "var(--radius-card)",
  studioWidgetShadow: "var(--shadow-card)",
  // Enough inset that titles clear the card's 22px corner.
  studioWidgetPadding: 16,
  studioWidgetNoDataOverlayBackgroundColor: "transparent",
  studioWidgetNoDataOverlayBorderWidth: 0,
  studioWidgetLoadingOverlayBackgroundColor: "transparent",
  studioWidgetLoadingOverlayBorderWidth: 0,

  studioPanelContainerBackgroundColor: c("surface"),
  studioPanelContainerBorder: false,
  studioPanelContainerBorderRadius: 0,
  studioPanelDividerColor: c("hairline"),
  studioPanelDividerActiveColor: c("focus"),
  studioPanelSectionBorderColor: c("hairline"),
  studioPanelGroupBackgroundColor: c("fill"),

  gridWrapperBorder: false,
  gridWrapperBorderRadius: 0,
  gridHeaderBackgroundColor: "transparent",
  // Solid, matching the card: the grand total row sticks to the bottom and rows scroll under it.
  gridDataBackgroundColor: c("surface"),
  gridOddRowBackgroundColor: c("surface"),
  gridColumnBorder: false,
  gridHeaderRowBorder: "0.5px solid var(--hairline)",
  gridRowBorder: "0.5px solid var(--hairline)",
  gridRowHoverColor: c("fill"),
} as const;

// Grids read like a GroupedList: 44pt rows, quiet semibold headers, hairline rows, no zebra stripes.
const grids = {
  gridRowHeight: 44,
  gridHeaderHeight: 36,
  gridCellHorizontalPadding: 12,
  scrollbarThumbColor: c("fill-3"),
  scrollbarTrackColor: "transparent",
  gridScrollbarThumbColor: c("fill-3"),
  gridScrollbarTrackColor: "transparent",
} as const;

// Series colors in a fixed order, lemon first. Lemon is too light to meet 3:1 against the card on its own, so
// its bars get a peel outline; the other accents already pass and outline in their own color.
const series = [
  ["lemon-deep", "peel"],
  ["leaf", "leaf"],
  ["pool", "pool"],
  ["berry", "berry"],
  ["peel", "peel"],
  ["ink-3", "ink-3"],
] as const;

const palette = Object.fromEntries(
  series.flatMap(([fill, stroke], i) => [
    [`chartPaletteFills${i + 1}Color`, c(fill)],
    [`chartPaletteStrokes${i + 1}Color`, c(stroke)],
  ]),
);

// Charts draw to a canvas, so Studio reads these back as resolved values (see `c` above).
const charts = {
  chartFontFamily: sans,
  chartTextColor: c("ink"),
  chartSubtleTextColor: c("ink-2"),
  chartAxisLabelColor: c("ink-2"),
  chartAxisLabelFontFamily: sans,
  chartAxisTitleColor: c("ink-2"),
  chartAxisTitleFontFamily: sans,
  chartAxisLineColor: c("hairline"),
  chartGridLineColor: c("hairline"),
  chartLegendLabelColor: c("ink-2"),
  chartLegendLabelFontFamily: sans,
  chartSeriesLabelFontFamily: sans,
  chartTooltipBackgroundColor: c("surface"),
  chartTooltipTextColor: c("ink"),
  chartTooltipBorder: "0.5px solid var(--hairline)",
  chartTooltipBorderRadius: "var(--radius-chip)",
  chartCrosshairLabelBackgroundColor: c("ink"),
  chartCrosshairLabelTextColor: c("on-ink"),
} as const;

// The kit's focus ring: a canvas-colored gap, then the 3:1 focus color.
const focusRing = "0 0 0 2px var(--canvas), 0 0 0 5px var(--focus)";

// Controls follow the kit: tinted pill buttons, the leaf Switch, inset-edged fields, 44pt rows, and the
// kit focus ring instead of Studio's accent outline.
const controls = {
  focusShadow: focusRing,
  inputFocusShadow: focusRing,
  listItemHeight: 44,
  rowHoverColor: c("fill"),

  toggleButtonWidth: 44,
  toggleButtonHeight: 26,
  toggleButtonSwitchInset: 2,
  toggleButtonOnBackgroundColor: c("leaf"),
  toggleButtonOffBackgroundColor: c("fill-3"),
  toggleButtonSwitchBackgroundColor: "white",

  buttonTextColor: c("ink"),
  buttonFontWeight: 600,
  buttonBackgroundColor: c("fill-2"),
  buttonBorder: false,
  buttonBorderRadius: 999,
  buttonHorizontalPadding: 14,
  buttonVerticalPadding: 8,
  buttonHoverTextColor: c("ink"),
  buttonHoverBackgroundColor: c("fill-3"),
  buttonHoverBorder: false,
  buttonActiveTextColor: c("ink"),
  buttonActiveBackgroundColor: c("fill-3"),
  buttonActiveBorder: false,
  buttonDisabledTextColor: c("ink-3"),
  buttonDisabledBackgroundColor: c("fill"),
  buttonDisabledBorder: false,

  inputBackgroundColor: c("fill"),
  inputBorder: "1px solid var(--control-edge)",
  inputBorderRadius: "var(--radius-chip)",
  inputFocusBorder: "1px solid var(--focus)",
  inputTextColor: c("ink"),
  inputPlaceholderTextColor: c("ink-3"),
  inputIconColor: c("ink-2"),
  inputInvalidBorder: "1px solid var(--berry)",
  pickerButtonBorder: "1px solid var(--control-edge)",
  pickerButtonFocusBorder: "1px solid var(--focus)",
  pickerButtonBackgroundColor: c("fill"),
  pickerListBackgroundColor: c("surface"),
  pickerListBorder: "0.5px solid var(--hairline)",

  checkboxBorderRadius: 6,
  checkboxUncheckedBorderColor: c("control-edge"),
  checkboxUncheckedBackgroundColor: "transparent",
  checkboxCheckedBackgroundColor: c("ink"),
  checkboxCheckedBorderColor: c("ink"),
  checkboxCheckedShapeColor: c("on-ink"),
  checkboxIndeterminateBackgroundColor: c("ink"),
  checkboxIndeterminateBorderColor: c("ink"),
  checkboxIndeterminateShapeColor: c("on-ink"),

  tabTextColor: c("ink-2"),
  tabHoverTextColor: c("ink"),
  tabSelectedTextColor: c("ink"),
  tabSelectedBorderColor: c("lemon-deep"),
  tabSelectedBorderWidth: 3,

  // Studio's own toggle groups and icon buttons: selected is a lemon wash with dark text.
  studioToggleButtonActiveBackgroundColor: c("lemon-soft"),
  studioToggleButtonActiveBorderColor: c("lemon-deep"),
  studioToggleButtonActiveColor: c("ink"),
  studioIconButtonBorderRadius: 999,
  studioIconButtonHoverBackgroundColor: c("fill-2"),
  studioIconButtonHoverColor: c("ink"),
  studioPanelChevronButtonBorderRadius: 999,
  studioPanelChevronButtonHoverBackgroundColor: c("fill-2"),
  studioPanelChevronButtonHoverColor: c("ink"),
  studioWidgetSelectedBorderColor: c("focus"),
  studioWidgetResizeBorderColor: c("focus"),
} as const;

// Menus, popups and the hover toolbar float above content, so they get the kit's float shadow and larger radii.
const floating = {
  menuBackgroundColor: c("surface"),
  menuTextColor: c("ink"),
  menuBorder: "0.5px solid var(--hairline)",
  menuSeparatorColor: c("hairline"),
  menuShadow: "var(--shadow-float)",
  popupShadow: "var(--shadow-float)",
  dropdownShadow: "var(--shadow-float)",
  dialogShadow: "var(--shadow-float)",
  dialogBorder: "0.5px solid var(--hairline)",
  tooltipBackgroundColor: c("ink"),
  tooltipTextColor: c("on-ink"),
  tooltipBorder: false,

  studioPopupBackgroundColor: c("surface"),
  studioPopupBorderRadius: "var(--radius-card)",
  studioPopupTitleBarBackgroundColor: "transparent",
  studioPopupTitleBarBorder: "0.5px solid var(--hairline)",
  studioPopupTitleBarIconColor: c("ink-2"),

  studioWidgetToolbarBackgroundColor: c("surface"),
  studioWidgetToolbarBorder: "0.5px solid var(--hairline)",
  studioWidgetToolbarShadow: "var(--shadow-float)",
  studioWidgetToolbarButtonColor: c("ink-2"),
  studioWidgetToolbarButtonHoverBackgroundColor: c("fill-2"),
} as const;

// The assistant: the person's messages sit in a tinted bubble, the assistant's on the panel itself.
const assistant = {
  studioAiPanelInputMessageBackgroundColor: c("fill-2"),
  studioAiPanelRichTextAccentBackgroundColor: c("fill"),
  studioAiPanelButtonHoverBackgroundColor: c("fill-2"),
} as const;

// Studio's icons redrawn in the kit's symbol style: a 24pt grid, 1.75 strokes, round caps and joins. Studio
// draws icons as masks, so only the shape matters and they take their color from the theme.
const chevronDown = "m5.5 9.5 6.5 6.5 6.5-6.5";
const chevronRight = "m9.5 5.5 6.5 6.5-6.5 6.5";
const trash =
  "M4.5 7h15M9.5 7V5.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5V7M6.5 7l.8 11.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7";
const iconPaths: Record<string, string> = {
  "double-chevron-right": "m6 6.5 5.5 5.5L6 17.5M12.5 6.5 18 12l-5.5 5.5",
  "double-chevron-left": "M18 6.5 12.5 12l5.5 5.5M11.5 6.5 6 12l5.5 5.5",
  "double-chevron-down": "m6.5 6 5.5 5.5L17.5 6M6.5 12.5 12 18l5.5-5.5",
  "chevron-expand": chevronDown,
  "chevron-collapse": "m5.5 14.5 6.5-6.5 6.5 6.5",
  "accordion-closed": chevronRight,
  "accordion-open": chevronDown,
  "ai-dropdown": chevronDown,
  add: "M12 5v14M5 12h14",
  csv: "M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2ZM4.5 10h15M4.5 14.5h15M10 10v9.5",
  download: "M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14",
  copy: "M8.5 10.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2ZM15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2",
  reset: "M9 14 4.5 9.5 9 5M4.5 9.5h10a5 5 0 0 1 0 10H11",
  delete: trash,
  "ai-delete": trash,
  "ai-new-chat": "M11 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V13M17.5 3.5l3 3L12 15l-3.5.5.5-3.5Z",
  "ai-back-to-bottom": "M12 5v13M6.5 12.5 12 18l5.5-5.5",
};

const kitIcons = studioIconOverrides({
  type: "image",
  mask: true,
  icons: Object.fromEntries(
    Object.entries(iconPaths).map(([name, d]) => [
      name,
      {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`,
      },
    ]),
  ),
});

// Studio's base theme already includes the button, input, tab and checkbox parts, but its type leaves their
// params out.
const base = studioTheme as AgStudioTheme<AgStudioThemeParams & AgPartStyleParams>;

export const lemonTheme = base.withPart(kitIcons).withParams({
  ...type,
  ...surfaces,
  ...grids,
  ...palette,
  ...charts,
  ...controls,
  ...floating,
  ...assistant,
  borderRadius: "var(--radius-field)",
  // Studio scrolls the canvas sideways below 720px, which happens on an iPad as soon as a panel opens. The
  // 24-column layout scales down well, so let it shrink instead.
  studioCanvasMinWidth: 0,
});

/**
 * The button filter styles its items per widget, not from the theme. Items are tinted pills at the 44pt
 * minimum; the selected one turns lemon with dark text, which stays dark in dark mode, as everywhere on lemon.
 */
export const filterButtonStyle: AgButtonFilterWidgetStyle = {
  dimensions: { height: 44 },
  defaultItem: {
    color: c("ink"),
    backgroundColor: c("fill-2"),
    borderEnabled: false,
    borderRadius: 999,
  },
  activeItem: {
    color: "color-mix(in srgb, oklch(0.23 0.03 85) 100%, transparent)",
    backgroundColor: c("lemon"),
    borderColor: c("lemon-deep"),
  },
};
