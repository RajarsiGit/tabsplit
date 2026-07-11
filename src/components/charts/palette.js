// Validated 8-slot categorical palette (see the dataviz skill's reference/palette.md) -
// fixed order, assigned by sorted entity name so an entity keeps its color across
// reloads/filtering instead of repainting when the data changes.
export const CATEGORICAL = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"];
export const OTHER_COLOR = "#898781";

export function colorsFor(names) {
  const colorByName = {};
  [...names].sort().forEach((name, i) => {
    colorByName[name] = i < CATEGORICAL.length ? CATEGORICAL[i] : OTHER_COLOR;
  });
  return colorByName;
}
