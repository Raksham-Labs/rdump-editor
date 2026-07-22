// Window CustomEvent names used to decouple non-React editor code (slash
// menu items, extension click handlers) from the editor component's React
// state. The editor component listens; extension code dispatches.

// Dispatched by the slash menu's Image item; the editor opens the
// ImagePopover in response.
export const OPEN_IMAGE_PICKER_EVENT = "rdump:open-image-picker";

// Dispatched when a math node (or the toolbar's math button) asks for the
// MathPopover; detail carries { type, pos, latex }.
export const EDIT_MATH_EVENT = "rdump:edit-math";
