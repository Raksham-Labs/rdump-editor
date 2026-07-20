"use client";

import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export const CODE_LANGUAGES = [
  { value: "plaintext", label: "Plain text" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "tsx", label: "TSX" },
  { value: "jsx", label: "JSX" },
  { value: "python", label: "Python" },
  { value: "rust", label: "Rust" },
  { value: "go", label: "Go" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "java", label: "Java" },
  { value: "kotlin", label: "Kotlin" },
  { value: "swift", label: "Swift" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "bash", label: "Bash" },
  { value: "shell", label: "Shell" },
  { value: "sql", label: "SQL" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "toml", label: "TOML" },
  { value: "markdown", label: "Markdown" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "diff", label: "Diff" },
  { value: "dockerfile", label: "Dockerfile" },
  { value: "mermaid", label: "Mermaid" },
  { value: "chart", label: "Chart" },
];

export function CodeBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const language = (node.attrs.language as string | undefined) ?? "plaintext";
  const [copied, setCopied] = useState(false);
  const editable = editor.isEditable;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard write can fail on insecure contexts; silently no-op.
    }
  };

  return (
    <NodeViewWrapper className="rdump-codeblock">
      <div className="rdump-codeblock__header" contentEditable={false}>
        {editable ? (
          <select
            className="rdump-codeblock__lang"
            value={language}
            onChange={(event) => updateAttributes({ language: event.target.value })}
            spellCheck={false}
          >
            {CODE_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="rdump-codeblock__lang rdump-codeblock__lang--static">
            {languageLabel(language)}
          </span>
        )}
        <button
          type="button"
          className="rdump-codeblock__copy"
          onClick={handleCopy}
          title="Copy code"
          aria-label="Copy code to clipboard"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre>
        <NodeViewContent<"code">
          as="code"
          spellCheck={false}
          className={`language-${language}`}
        />
      </pre>
    </NodeViewWrapper>
  );
}

function languageLabel(value: string): string {
  return CODE_LANGUAGES.find((l) => l.value === value)?.label ?? value;
}
