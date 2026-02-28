import type { Node, Edge } from "@vue-flow/core";

export type ArchNode = {
  id: string;
  title: string;
  description: string;
  depth: number;
  children: ArchNode[];
};

/**
 * Build Vue Flow nodes/edges from architecture JSON.
 * If focusId is set, only show that node and its children.
 */
export function buildGraph(root: ArchNode, focusId?: string) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const focusPath: ArchNode[] = [];

  let renderRoot: ArchNode = root;

  // Find the focused node and path to it
  if (focusId) {
    findPath(root, focusId, focusPath);
    const found = findNode(root, focusId);
    if (found) renderRoot = found;
  }

  // Lay out the render root and its children
  layoutNode(renderRoot, 0, 0, undefined, nodes, edges);

  return { nodes, edges, focusPath };
}

function findNode(node: ArchNode, targetId: string): ArchNode | null {
  if (node.id === targetId) return node;
  for (const child of node.children) {
    const found = findNode(child, targetId);
    if (found) return found;
  }
  return null;
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
    data: { title: node.title, description: node.description, code: (node as any).code || "" },
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

  const spacingX = 300;
  const spacingY = 180;
  const totalWidth = (node.children.length - 1) * spacingX;
  const startX = x - totalWidth / 2;

  node.children.forEach((child, index) => {
    layoutNode(child, startX + index * spacingX, y + spacingY, node.id, nodes, edges);
  });
}
