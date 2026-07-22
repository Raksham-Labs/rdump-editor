// Emits dist/content.css: the document skin (styles/content.css) prefixed
// with the theme tokens (styles/theme.css), so a host page that renders
// serialized rdump content WITHOUT the editor can import one self-contained
// stylesheet. dist/styles.css already contains both (plus the chrome); this
// file exists so published/preview pages don't ship toolbar and popover CSS.
//
// Plain concatenation is safe because neither source file uses @import or
// url() references that need resolving, and the library build is unminified
// by design. Runs after `vite build` (see package.json build script).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const banner = `/* @rakshamlabs/rdump-editor content.css — theme tokens + document skin.
 * For host surfaces that render serialized editor HTML (previews, published
 * pages) without loading the editor itself. Wrap the HTML in an element with
 * class="rdump-content" (plus data-rdump-color-scheme, see README). Do not
 * import alongside styles.css — styles.css already includes all of this. */
`;

const theme = await readFile(resolve(root, "src/styles/theme.css"), "utf8");
const content = await readFile(resolve(root, "src/styles/content.css"), "utf8");

await mkdir(resolve(root, "dist"), { recursive: true });
await writeFile(resolve(root, "dist/content.css"), `${banner}\n${theme}\n${content}`);
console.log("dist/content.css written");
