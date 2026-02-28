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
  let focusNode: ArchNode | null = null;

  function findPath(node: ArchNode, targetId: string, path: ArchNode[]): boolean {
    path.push(node);
    if (node.id === targetId) {
      focusNode = node;
      return true;
    }
    for (const child of node.children) {
      if (findPath(child, targetId, path)) return true;
    }
    path.pop();
    return false;
  }

  if (focusId) {
    findPath(root, focusId, focusPath);
  }

  function shouldRender(node: ArchNode) {
    if (!focusId) return true;
    if (focusPath.some((n) => n.id === node.id)) return true;
    if (focusNode) {
      return isDescendant(focusNode, node.id);
    }
    return false;
  }

  function isDescendant(node: ArchNode, targetId: string): boolean {
    if (node.id === targetId) return true;
    return node.children.some((child) => isDescendant(child, targetId));
  }

  function walk(node: ArchNode, x: number, y: number, parentId?: string) {
    if (!shouldRender(node)) return;

    nodes.push({
      id: node.id,
      position: { x, y },
      type: "card",
      data: { title: node.title, description: node.description },
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

  walk(root, 0, 0);

  return { nodes, edges, focusPath };
}
