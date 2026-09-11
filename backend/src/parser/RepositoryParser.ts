import { KnowledgeGraph } from "../graph/KnowledgeGraph";
import { TypeScriptParser } from "./languages/TypeScriptParser";
import { PythonParser } from "./languages/PythonParser";

export interface FileEntry {
  path: string;
  content: string;
}

/**
 * Multi-Language Repository Parser
 * 
 * Logic & Capabilities:
 * 1. Root Wrapper Stripping: Detects single top-level folders (e.g. `dinchariya-main/`) from uploaded ZIPs
 *    or folder pickers and normalizes relative paths to reflect the true internal package layout.
 * 2. Multi-Language AST Routing:
 *    - Python (.py, .pyw) -> PythonParser
 *    - JavaScript & TypeScript (.js, .mjs, .cjs, .ts, .tsx, .jsx) -> TypeScriptParser
 * 3. Knowledge Graph Population: Builds real semantic nodes (files, classes, functions) and edges
 *    (imports, extends, defines, calls).
 */
export class RepositoryParser {
  private static TS_JS_EXTENSIONS = new Set([
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".jsx",
  ]);

  private static PYTHON_EXTENSIONS = new Set([
    ".py",
    ".pyw",
  ]);

  /**
   * Parse all supported files in a repository into the KnowledgeGraph
   */
  static parseRepository(files: FileEntry[], graph: KnowledgeGraph): {
    parsedFiles: number;
    skippedFiles: number;
    errors: number;
    normalizedFiles: FileEntry[];
  } {
    let parsedFiles = 0;
    let skippedFiles = 0;
    let errors = 0;

    // Step 1: Strip common root directory wrappers (e.g. `dinchariya-main/`)
    const normalizedFiles = this.stripCommonRoot(files);

    for (const file of normalizedFiles) {
      const ext = this.getExtension(file.path);

      // Route to Python parser
      if (this.PYTHON_EXTENSIONS.has(ext)) {
        try {
          PythonParser.parse(file.path, file.content, graph);
          parsedFiles++;
        } catch (err) {
          errors++;
          console.error(`[RepositoryParser] Failed parsing Python file ${file.path}:`, err);
        }
        continue;
      }

      // Route to TypeScript / JavaScript Babel parser
      if (this.TS_JS_EXTENSIONS.has(ext)) {
        try {
          TypeScriptParser.parse(file.path, file.content, graph);
          parsedFiles++;
        } catch (err) {
          errors++;
          console.error(`[RepositoryParser] Failed parsing TS/JS file ${file.path}:`, err);
        }
        continue;
      }

      // Other non-code files (e.g. .md, .json, .csv) are counted as skipped
      skippedFiles++;
    }

    return { parsedFiles, skippedFiles, errors, normalizedFiles };
  }

  /**
   * Detect and strip redundant common root directory wrapper prefix.
   * Example:
   * If all files start with `dinchariya-main/pipeline/...` and `dinchariya-main/tests/...`,
   * this strips `dinchariya-main/` so paths become `pipeline/...` and `tests/...`.
   */
  static stripCommonRoot(files: FileEntry[]): FileEntry[] {
    if (!files || files.length === 0) return [];

    const normalized = files.map((f) => ({
      path: f.path.replace(/\\/g, "/").replace(/^\/+/, ""),
      content: f.content,
    }));

    // Find the first path segment for all files
    const segments = normalized.map((f) => f.path.split("/"));
    if (segments.length === 0) return normalized;

    // Check if all files have at least 2 segments and share the exact same first segment
    const candidateRoot = segments[0][0];
    const hasCommonRoot = segments.every((s) => s.length > 1 && s[0] === candidateRoot);

    if (hasCommonRoot) {
      const prefixLength = candidateRoot.length + 1;
      return normalized.map((f) => ({
        path: f.path.slice(prefixLength),
        content: f.content,
      }));
    }

    return normalized;
  }

  private static getExtension(filePath: string): string {
    const normalized = filePath.replace(/\\/g, "/");
    const dot = normalized.lastIndexOf(".");
    if (dot < 0) return "";
    return normalized.slice(dot).toLowerCase();
  }
}
