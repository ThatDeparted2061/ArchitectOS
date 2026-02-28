import type { Node, Edge } from "@vue-flow/core";

export type ArchNode = {
  id: string;
  title: string;
  description: string;
  depth: number;
  children: ArchNode[];
};

export function buildGraph(root: ArchNode, focusId?: string) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const focusPath: ArchNode[] = [];

  function walk(node: ArchNode, x: number, y: number, parentId?: string) {
    const isFocused = !focusId || node.id === focusId || focusPath.some((n) => n.id === node.id);
    if (!isFocused && focusId) return;

    nodes.push({
      id: node.id,
      position: { x, y },
      data: { label: node.title },
      style: {
        background: "rgba(21,25,34,0.8)",
        border: "1px solid rgba(255,255,255,0.06)",
        color: "#fff",
        borderRadius: "16px",
        padding: "12px",
        minWidth: "200px",
      },
    });

    if (parentId) {
      edges.push({ id: `${parentId}-${node.id}`, source: parentId, target: node.id });
    }

    const spacingX = 260;
    const spacingY = 160;
    node.children.forEach((child, index) => {
      walk(child, x + (index - (node.children.length - 1) / 2) * spacingX, y + spacingY, node.id);
    });
  }

  function findPath(node: ArchNode, targetId: string, path: ArchNode[]): boolean {
    path.push(node);
    if (node.id === targetId) return true;
    for (const child of node.children) {
      if (findPath(child, targetId, path)) return true;
    }
    path.pop();
    return false;
  }

  if (focusId) {
    findPath(root, focusId, focusPath);
  }

  walk(root, 0, 0);

  return { nodes, edges, focusPath };
}
