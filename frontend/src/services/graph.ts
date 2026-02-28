import type { Node, Edge } from "@vue-flow/core";

export type ArchNode = {
  id: string;
  title: string;
  description: string;
  depth: number;
  children: ArchNode[];
  code?: string;
};

/** Ensure node has all required fields with safe defaults */
function sanitize(node: any): ArchNode {
  return {
    id: node?.id || "unknown-" + Math.random().toString(36).slice(2, 8),
    title: node?.title || "Untitled",
    description: node?.description || "",
    depth: node?.depth || 1,
    code: node?.code || "",
    children: Array.isArray(node?.children) ? node.children.map(sanitize) : [],
  };
}

/**
 * Build Vue Flow nodes/edges from architecture JSON.
 * If focusId is set, only show that node and its children.
 */
export function buildGraph(root: any, focusId?: string) {
  const safe = sanitize(root);
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const focusPath: ArchNode[] = [];

  let renderRoot: ArchNode = safe;

  if (focusId) {
    findPath(safe, focusId, focusPath);
    const found = findNode(safe, focusId);
    if (found) renderRoot = found;
  }

  layoutNode(renderRoot, 0, 0, undefined, nodes, edges);

  return { nodes, edges, focusPath };
}

function findNode(node: ArchNode, targetId: string): ArchNode | null {
  if (node.id === targetId) return node;
  for (const child of node.children || []) {
    const found = findNode(child, targetId);
    if (found) return found;
  }
  return null;
}

function findPath(node: ArchNode, targetId: string, path: ArchNode[]): boolean {
  path.push(node);
  if (node.id === targetId) return true;
  for (const child of node.children || []) {
    if (findPath(child, targetId, path)) return true;
  }
  path.pop();
  return false;
}

function layoutNode(
  node: ArchNode,
  x: number,
  y: number,
  parentId: string | undefined,
  nodes: Node[],
  edges: Edge[]
) {
  nodes.push({
    id: node.id,
    position: { x, y },
    type: "card",
    data: { title: node.title, description: node.description, code: node.code || "" },
  });

  if (parentId) {
    edges.push({
      id: `${parentId}-${node.id}`,
      source: parentId,
      target: node.id,
      animated: true,
      style: { stroke: "#4F8CFF", strokeWidth: 2 },
    });
  }

  const children = node.children || [];
  const spacingX = 300;
  const spacingY = 180;
  const totalWidth = (children.length - 1) * spacingX;
  const startX = x - totalWidth / 2;

  children.forEach((child, index) => {
    layoutNode(child, startX + index * spacingX, y + spacingY, node.id, nodes, edges);
  });
}
