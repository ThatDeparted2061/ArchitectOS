import path from "path";
import { KnowledgeGraph } from "../../graph/KnowledgeGraph";

/**
 * Python Source Code Parser & AST Lexical Analyzer
 *
 * Core Capabilities:
 * 1. Module & File Registration: Creates file nodes with path and size metadata.
 * 2. Import Dependency Extraction:
 *    - Parses `import x, y as z`
 *    - Parses `from x.y import a, b as c`
 *    - Parses relative imports `from . import config`, `from ..core import emi`
 * 3. Class & Inheritance Extraction:
 *    - Parses `class ClassName(SuperClass):`
 *    - Captures class methods and extends relationships.
 * 4. Function & Async Function Extraction:
 *    - Parses `def function_name(arg1, arg2):` and `async def`
 *    - Captures parameter signatures.
 * 5. Call Graph Resolution:
 *    - Identifies function calls made within method bodies.
 * 6. Semantic Technology Inference:
 *    - Identifies database, web API, excel, and testing frameworks.
 */
export class PythonParser {
  static parse(filePath: string, code: string, graph: KnowledgeGraph): void {
    const normalizedPath = filePath.replace(/\\/g, "/");
    const fileName = path.basename(normalizedPath);

    // 1. Add the File Node to Knowledge Graph
    graph.addNode(normalizedPath, fileName, "file", {
      path: normalizedPath,
      size: code.length,
      language: "python",
    });

    const lines = code.split(/\r?\n/);
    const totalLines = lines.length;

    let currentClass: { name: string; superClass?: string; methods: string[]; startLine: number } | null = null;
    let currentFunction: { name: string; isAsync: boolean; params: string[]; startLine: number } | null = null;

    // Track technological markers
    const techMarkers = new Set<string>();

    for (let lineIdx = 0; lineIdx < totalLines; lineIdx++) {
      const rawLine = lines[lineIdx];
      // Strip line comments
      const lineWithoutComment = rawLine.replace(/#.*$/, "");
      const trimmed = lineWithoutComment.trim();

      if (!trimmed) continue;

      // ── 2. IMPORT EXTRACTION ─────────────────────────────────────────
      // Match: `from some.package.module import Foo, Bar as B`
      const fromImportMatch = trimmed.match(/^from\s+([.\w]+)\s+import\s+(.+)$/);
      if (fromImportMatch) {
        const fromModule = fromImportMatch[1];
        const importedSymbols = fromImportMatch[2]
          .replace(/[()]/g, "")
          .split(",")
          .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
          .filter(Boolean);

        // Convert python module dot notation `pipeline.core.emi_engine` to path representation
        const targetModule = this.resolvePythonImportPath(normalizedPath, fromModule);
        graph.addEdge(normalizedPath, targetModule, "imports", {
          filePath: normalizedPath,
          symbols: importedSymbols,
          raw: fromModule,
        });

        this.checkTechMarkers(fromModule, techMarkers);
        continue;
      }

      // Match: `import module1, module2 as m2`
      const importMatch = trimmed.match(/^import\s+(.+)$/);
      if (importMatch && !trimmed.startsWith("import.meta")) {
        const modules = importMatch[1]
          .split(",")
          .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
          .filter(Boolean);

        modules.forEach((mod) => {
          const targetModule = this.resolvePythonImportPath(normalizedPath, mod);
          graph.addEdge(normalizedPath, targetModule, "imports", {
            filePath: normalizedPath,
            raw: mod,
          });
          this.checkTechMarkers(mod, techMarkers);
        });
        continue;
      }

      // ── 3. CLASS DECLARATION EXTRACTION ──────────────────────────────
      // Match: `class ClassName(SuperClass):` or `class ClassName:`
      const classMatch = trimmed.match(/^class\s+([A-Za-z0-9_]+)(?:\s*\(([^)]*)\))?\s*:/);
      if (classMatch) {
        const className = classMatch[1];
        const superClass = classMatch[2] ? classMatch[2].trim() : undefined;

        currentClass = {
          name: className,
          superClass,
          methods: [],
          startLine: lineIdx,
        };

        // Add class node into Knowledge Graph
        graph.addNode(className, className, "class", {
          filePath: normalizedPath,
          superClass,
          methods: [],
        });

        // Edge: File -> Class (defines)
        graph.addEdge(normalizedPath, className, "defines", { filePath: normalizedPath });

        if (superClass && superClass !== "object") {
          // Edge: Class -> SuperClass (extends)
          graph.addEdge(className, superClass, "extends", { filePath: normalizedPath });
        }
        continue;
      }

      // ── 4. FUNCTION / METHOD EXTRACTION ──────────────────────────────
      // Match: `def function_name(arg1, arg2):` or `async def function_name(...):`
      const defMatch = trimmed.match(/^(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*(?:->\s*[^:]+)?\s*:/);
      if (defMatch) {
        const fnName = defMatch[1];
        const rawParams = defMatch[2];
        const isAsync = trimmed.startsWith("async ");

        const params = rawParams
          .split(",")
          .map((p) => p.trim().split(/[=:]/)[0].trim())
          .filter((p) => p && p !== "self" && p !== "cls");

        if (currentClass && rawLine.startsWith("    ") && !rawLine.startsWith("        ")) {
          // This is a method on the current active class
          currentClass.methods.push(`${isAsync ? "async " : ""}${fnName}()`);
          // Update the class node's properties
          const classNode = graph.getNode(currentClass.name);
          if (classNode) {
            classNode.properties.methods = [...currentClass.methods];
          }
        } else {
          // Top-level standalone function
          currentFunction = {
            name: fnName,
            isAsync,
            params,
            startLine: lineIdx,
          };

          graph.addNode(fnName, fnName, "function", {
            filePath: normalizedPath,
            params,
            isAsync,
          });

          // Edge: File -> Function (defines)
          graph.addEdge(normalizedPath, fnName, "defines", { filePath: normalizedPath });
        }
        continue;
      }

      // ── 5. FUNCTION CALL EXTRACTION ──────────────────────────────────
      // Look for function invocations like `some_function(...)` or `engine.calculate(...)`
      const callMatches = trimmed.matchAll(/([A-Za-z0-9_]+)\s*\(/g);
      const pythonKeywords = new Set([
        "if", "elif", "while", "for", "with", "return", "yield", "print", "len",
        "range", "str", "int", "float", "bool", "list", "dict", "set", "tuple",
        "super", "isinstance", "type", "enumerate", "zip", "open", "max", "min", "sum"
      ]);

      for (const cm of callMatches) {
        const callee = cm[1];
        if (!pythonKeywords.has(callee) && callee.length > 2) {
          const caller = currentFunction?.name || currentClass?.name || "(top-level)";
          if (caller !== callee) {
            graph.addEdge(caller, callee, "calls", { filePath: normalizedPath });
          }
        }
      }
    }

    // Attach inferred technology markers to the file node
    const fileNode = graph.getNode(normalizedPath);
    if (fileNode && techMarkers.size > 0) {
      fileNode.properties.technologies = Array.from(techMarkers);
    }
  }

  /**
   * Helper to normalize Python import paths to repository-relative file paths
   * Examples:
   * `from pipeline.core.emi_engine import x` in `pipeline/orchestrator.py` -> `pipeline/core/emi_engine`
   * `from .config import y` in `pipeline/orchestrator.py` -> `pipeline/config`
   */
  private static resolvePythonImportPath(currentFilePath: string, importModule: string): string {
    const currentDir = path.dirname(currentFilePath).replace(/\\/g, "/");

    // Relative import: `from . import foo` or `from ..core import bar`
    if (importModule.startsWith(".")) {
      let dots = 0;
      while (importModule[dots] === ".") {
        dots++;
      }
      const rest = importModule.slice(dots).replace(/\./g, "/");
      let baseDir = currentDir;
      for (let i = 1; i < dots; i++) {
        baseDir = path.dirname(baseDir).replace(/\\/g, "/");
      }
      return rest ? `${baseDir}/${rest}` : baseDir;
    }

    // Absolute package import: `pipeline.core.emi_engine` -> `pipeline/core/emi_engine`
    return importModule.replace(/\./g, "/");
  }

  /**
   * Detect semantic library categories from import names
   */
  private static checkTechMarkers(moduleName: string, markers: Set<string>): void {
    const m = moduleName.toLowerCase();
    if (m.includes("pandas") || m.includes("numpy") || m.includes("scipy")) markers.add("data_processing");
    if (m.includes("openpyxl") || m.includes("xlsxwriter")) markers.add("excel_reporting");
    if (m.includes("pydantic") || m.includes("pandera") || m.includes("dataclass")) markers.add("schema_contracts");
    if (m.includes("sqlite3") || m.includes("sqlalchemy") || m.includes("psycopg") || m.includes("pymssql")) markers.add("database");
    if (m.includes("fastapi") || m.includes("flask") || m.includes("django")) markers.add("api_framework");
    if (m.includes("pytest") || m.includes("unittest")) markers.add("testing_framework");
  }
}
