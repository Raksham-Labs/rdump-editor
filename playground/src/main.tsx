import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Hosts are responsible for katex CSS when features.math is on — the package
// deliberately doesn't bundle it (~60KB + fonts). The playground is a host.
import "katex/dist/katex.min.css";
// No-op in source mode (components import their own CSS); the real packaged
// stylesheet in --mode dist. Mirrors exactly what a consumer writes.
import "@rakshamlabs/rdump-editor/styles.css";
import "./playground.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
