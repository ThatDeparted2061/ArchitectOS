import { ArchitectureNode, ArchitectureNodeType } from "../types/ArchitectureTypes";

export class TreeValidator {
  /**
   * Validate and programmatically repair architecture tree to satisfy requested depth and schema.
   */
  static validateAndRepair(
    root: any,
    requestedLevel: number = 2
  ): ArchitectureNode {
    const seenIds = new Set<string>();

    const sanitize = (node: any, currentDepth: number, parentTitle = ""): ArchitectureNode => {
      let rawId = String(node?.id || "").trim();
      let id = rawId.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
      
      if (!id || seenIds.has(id)) {
        id = `${id || "node"}-${Math.random().toString(36).slice(2, 7)}`;
      }
      seenIds.add(id);

      const title = String(node?.title || "Untitled Component").trim();
      const description = String(node?.description || "").trim() || `${title} component`;
      const type = this.inferNodeType(node?.type, currentDepth, title);
      const code = typeof node?.code === "string" ? node.code : "";
      const path = typeof node?.path === "string" ? node.path : undefined;

      const rawChildren = Array.isArray(node?.children) ? node.children : [];
      let children: ArchitectureNode[] = rawChildren.map((c: any) =>
        sanitize(c, currentDepth + 1, title)
      );

      // Depth Enforcement: If currentDepth < requestedLevel and node has 0 children, synthesize children
      if (currentDepth < requestedLevel && children.length === 0) {
        children = this.synthesizeChildComponents(id, title, currentDepth + 1, requestedLevel, seenIds);
      }

      // Branching factor: intermediate nodes should have at least 2 children
      if (currentDepth < requestedLevel && children.length === 1) {
        const extraChild = this.createSubNode(
          id,
          `${title} Helper`,
          `Internal handler and utility functions for ${title}`,
          currentDepth + 1,
          seenIds
        );
        children.push(extraChild);
      }

      return {
        id,
        title,
        description,
        depth: currentDepth,
        type,
        technology: node?.technology || undefined,
        path,
        code,
        metadata: node?.metadata || {},
        children,
      };
    };

    return sanitize(root, 1);
  }

  private static inferNodeType(
    rawType: string | undefined,
    depth: number,
    title: string
  ): ArchitectureNodeType {
    if (rawType && this.isValidNodeType(rawType)) {
      return rawType as ArchitectureNodeType;
    }
    const lower = title.toLowerCase();
    if (depth === 1) return "system";
    if (depth === 2) return "domain";
    if (lower.includes("db") || lower.includes("database") || lower.includes("sql") || lower.includes("mongo")) return "database";
    if (lower.includes("cache") || lower.includes("redis")) return "cache";
    if (lower.includes("queue") || lower.includes("kafka") || lower.includes("rabbit") || lower.includes("event")) return "queue";
    if (lower.includes("api") || lower.includes("gateway") || lower.includes("router")) return "api_gateway";
    if (lower.includes("controller")) return "controller";
    if (lower.includes("service")) return "service_layer";
    if (lower.includes("repository") || lower.includes("store")) return "repository";
    if (depth === 3) return "subsystem";
    if (depth >= 4) return "file";
    return "module";
  }

  private static isValidNodeType(type: string): boolean {
    const valid = new Set([
      "project", "system", "domain", "subsystem", "module",
      "microservice", "api_gateway", "controller", "service_layer",
      "repository", "database", "cache", "queue", "event_stream",
      "external", "file", "class", "function"
    ]);
    return valid.has(type);
  }

  private static synthesizeChildComponents(
    parentId: string,
    parentTitle: string,
    targetDepth: number,
    maxLevel: number,
    seenIds: Set<string>
  ): ArchitectureNode[] {
    const defaultArchetypes = [
      { name: "Service Logic", desc: `Core business logic and execution unit for ${parentTitle}`, type: "service_layer" as ArchitectureNodeType },
      { name: "Data Adapter", desc: `Data persistence, state management and adapter for ${parentTitle}`, type: "repository" as ArchitectureNodeType },
    ];

    return defaultArchetypes.map((arch) => {
      const child = this.createSubNode(parentId, `${parentTitle} ${arch.name}`, arch.desc, targetDepth, seenIds, arch.type);
      if (targetDepth < maxLevel) {
        child.children = this.synthesizeChildComponents(child.id, child.title, targetDepth + 1, maxLevel, seenIds);
      }
      return child;
    });
  }

  private static createSubNode(
    parentId: string,
    title: string,
    description: string,
    depth: number,
    seenIds: Set<string>,
    type: ArchitectureNodeType = "module"
  ): ArchitectureNode {
    let id = `${parentId}-${title.replace(/[^a-z0-9-_]/gi, "-").toLowerCase()}`;
    if (seenIds.has(id)) {
      id = `${id}-${Math.random().toString(36).slice(2, 6)}`;
    }
    seenIds.add(id);

    return {
      id,
      title,
      description,
      depth,
      type,
      code: "",
      metadata: { synthesized: true },
      children: [],
    };
  }
}
