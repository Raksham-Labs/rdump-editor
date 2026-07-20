import { useCallback, useMemo, useState } from "react";
import { RDumpEditor } from "@rakshamlabs/rdump-editor";

// Round-trip verification harness.
//
// For each fixture in ../fixtures/*.md, two passes through a hidden
// all-features-on editor:
//   pass 1: mount with the fixture; onReady reports serialize(parse(fixture)).
//   pass 2: remount with that output; onReady reports the second serialization.
//
// Hard invariant (FAIL):   pass2 === pass1 — serialization must be idempotent
//   or every open would dirty the doc (phantom dirty state / phantom pushes).
// Soft invariant (NORMALIZED): pass1 === fixture — the fixture was already in
//   canonical form. Hand-authored fixtures may legitimately normalize once;
//   the diff shows what changed so drift in the serializer is still visible.

const fixtureModules = import.meta.glob("../fixtures/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

interface FixtureResult {
  name: string;
  fixture: string;
  pass1?: string;
  pass2?: string;
  status: "pending" | "pass" | "normalized" | "fail";
}

function firstDivergence(a: string, b: string): { line: number; a: string; b: string } | null {
  const linesA = a.split("\n");
  const linesB = b.split("\n");
  const max = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < max; i++) {
    if (linesA[i] !== linesB[i]) {
      return { line: i + 1, a: linesA[i] ?? "<end of text>", b: linesB[i] ?? "<end of text>" };
    }
  }
  return null;
}

export function RoundTrip() {
  const fixtures = useMemo(
    () =>
      Object.entries(fixtureModules)
        .map(([path, content]) => ({
          name: path.replace(/^.*\//, "").replace(/\.md$/, ""),
          content,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const [results, setResults] = useState<FixtureResult[]>([]);
  const [cursor, setCursor] = useState<{ index: number; pass: 1 | 2; seed: string } | null>(
    null,
  );

  const running = cursor !== null && cursor.index < fixtures.length;

  const start = useCallback(() => {
    if (fixtures.length === 0) return;
    setResults(
      fixtures.map((f) => ({ name: f.name, fixture: f.content, status: "pending" })),
    );
    setCursor({ index: 0, pass: 1, seed: fixtures[0].content });
  }, [fixtures]);

  const handleReady = useCallback(
    (markdown: string) => {
      setCursor((cur) => {
        if (!cur) return cur;
        if (cur.pass === 1) {
          setResults((prev) =>
            prev.map((r, i) => (i === cur.index ? { ...r, pass1: markdown } : r)),
          );
          return { index: cur.index, pass: 2, seed: markdown };
        }
        setResults((prev) =>
          prev.map((r, i) => {
            if (i !== cur.index) return r;
            const pass1 = r.pass1 ?? "";
            const status =
              markdown !== pass1 ? "fail" : pass1 !== r.fixture ? "normalized" : "pass";
            return { ...r, pass2: markdown, status };
          }),
        );
        const nextIndex = cur.index + 1;
        return nextIndex < fixtures.length
          ? { index: nextIndex, pass: 1, seed: fixtures[nextIndex].content }
          : { index: nextIndex, pass: 1, seed: "" };
      });
    },
    [fixtures],
  );

  const counts = results.reduce(
    (acc, r) => {
      acc[r.status] += 1;
      return acc;
    },
    { pending: 0, pass: 0, normalized: 0, fail: 0 },
  );

  return (
    <div className="pg-roundtrip">
      <h2>Markdown round-trip</h2>
      <p>
        {fixtures.length} fixtures.{" "}
        <button type="button" onClick={start} disabled={running}>
          {running ? `Running ${cursor.index + 1}/${fixtures.length}…` : "Run"}
        </button>
      </p>
      {results.length > 0 ? (
        <p>
          <strong>{counts.pass} pass</strong> · {counts.normalized} normalized ·{" "}
          <strong>{counts.fail} fail</strong> · {counts.pending} pending
        </p>
      ) : null}

      {results.map((result) => {
        const cls =
          result.status === "fail"
            ? "pg-fixture--fail"
            : result.status === "normalized"
              ? "pg-fixture--warn"
              : result.status === "pass"
                ? "pg-fixture--pass"
                : "";
        const idempotenceDiff =
          result.status === "fail" && result.pass1 !== undefined && result.pass2 !== undefined
            ? firstDivergence(result.pass1, result.pass2)
            : null;
        const canonicalDiff =
          result.status === "normalized" && result.pass1 !== undefined
            ? firstDivergence(result.fixture, result.pass1)
            : null;
        return (
          <details key={result.name} className={`pg-fixture ${cls}`}>
            <summary>
              {result.name} — {result.status}
            </summary>
            {idempotenceDiff ? (
              <div>
                <p>
                  NOT IDEMPOTENT at line {idempotenceDiff.line} (pass 1 vs pass 2):
                </p>
                <pre>
                  <span className="pg-diff-line pg-diff-line--fixture">
                    − {idempotenceDiff.a}
                  </span>
                  <span className="pg-diff-line pg-diff-line--actual">
                    + {idempotenceDiff.b}
                  </span>
                </pre>
              </div>
            ) : null}
            {canonicalDiff ? (
              <div>
                <p>
                  Fixture normalized at line {canonicalDiff.line} (fixture vs canonical):
                </p>
                <pre>
                  <span className="pg-diff-line pg-diff-line--fixture">
                    − {canonicalDiff.a}
                  </span>
                  <span className="pg-diff-line pg-diff-line--actual">
                    + {canonicalDiff.b}
                  </span>
                </pre>
              </div>
            ) : null}
            <p>Canonical serialization:</p>
            <pre>{result.pass1 ?? "…"}</pre>
          </details>
        );
      })}

      {running ? (
        <div className="pg-hidden-editor" aria-hidden>
          <RDumpEditor
            key={`${cursor.index}:${cursor.pass}`}
            preview
            editable={false}
            documentId={`roundtrip-${cursor.index}-${cursor.pass}`}
            initialContent={cursor.seed}
            onReady={handleReady}
          />
        </div>
      ) : null}
    </div>
  );
}
