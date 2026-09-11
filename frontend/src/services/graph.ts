import type { Node, Edge } from "@vue-flow/core";
import { MarkerType } from "@vue-flow/core";

export type ArchNode = {
  id: string;
  title: string;
  description: string;
  depth: number;
  type?: string;
  technology?: string;
  children: ArchNode[];
  edges?: ArchEdge[];
  code?: string;
  path?: string;
};

export type ArchEdge = {
  id?: string;
  source: string;
  target: string;
  type?: "imports" | "calls" | "defines" | "reads_writes" | "pub_sub" | "sync_http" | "grpc" | "flow";
  label?: string;
  protocol?: string;
};

/**
 * Interface representing the computed 2D bounding box and internal card positions
 * for a multi-column subsystem container.
 */
interface ContainerLayoutResult {
  width: number;
  height: number;
  cols: number;
  rows: number;
  cardPositions: { x: number; y: number; width: number; height: number }[];
}

/**
 * Sanitize raw backend node into a clean ArchNode with default fallbacks
 */
function sanitize(node: any): ArchNode {
  return {
    id: node?.id || "unknown-" + Math.random().toString(36).slice(2, 8),
    title: node?.title || "Untitled",
    description: node?.description || "",
    depth: node?.depth || 1,
    type: node?.type || "subsystem",
    technology: node?.technology,
    code: node?.code || "",
    path: node?.path || "",
    edges: Array.isArray(node?.edges) ? node.edges : [],
    children: Array.isArray(node?.children) ? node.children.map(sanitize) : [],
  };
}

/**
 * Count total leaf nodes in subtree for proportional bounding box allocation in drilldown
 */
function countLeaves(node: ArchNode): number {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

/**
 * Calculate dynamic 2D multi-column grid layout for child nodes within a container.
 * 
 * CORE ALGORITHM & CONCEPTS:
 * 1. Column Budgeting: Instead of a 1D vertical stack (which stretches thousands of pixels tall),
 *    we dynamically calculate an optimal number of columns based on total child count and user settings.
 *    - 1-3 items  -> 1 column
 *    - 4-8 items  -> 2 columns
 *    - 9-18 items -> 3 columns
 *    - 19+ items  -> 4 columns (or capped by maxGridCols)
 * 2. 2D Coordinate Projection:
 *    col = index % columns
 *    row = Math.floor(index / columns)
 * 3. Row-by-Row Height Tracking:
 *    Because cards with code previews are taller (170px) than standard cards (110px), we compute
 *    the height of each row dynamically as the maximum height among cards in that row.
 * 4. Collapsed State Handling:
 *    If the subsystem is collapsed, child cards are suppressed and a compact 80px container is returned.
 */
function calculateContainerGridLayout(
  children: ArchNode[],
  isCollapsed: boolean,
  maxColsSetting: number = 3
): ContainerLayoutResult {
  const CARD_WIDTH = 236;
  const CARD_GAP_X = 16;
  const CARD_GAP_Y = 16;
  const PADDING_X = 16;
  const PADDING_BOTTOM = 16;
  const HEADER_HEIGHT = 82; // Height reserved for container header tab, badge, and description

  // If container is collapsed, return compact fixed dimensions with no child cards rendered inside
  if (isCollapsed) {
    return {
      width: 280,
      height: 80,
      cols: 1,
      rows: 0,
      cardPositions: [],
    };
  }

  const childCount = children.length;
  if (childCount === 0) {
    return {
      width: 280,
      height: 100,
      cols: 1,
      rows: 0,
      cardPositions: [],
    };
  }

  // Determine optimal column count based on child density and user max columns setting
  let targetCols = 1;
  if (childCount >= 4 && childCount <= 8) targetCols = 2;
  else if (childCount >= 9 && childCount <= 18) targetCols = 3;
  else if (childCount >= 19) targetCols = 4;

  const cols = Math.min(targetCols, Math.max(1, maxColsSetting));
  const rows = Math.ceil(childCount / cols);

  // Step 1: Compute height for each row based on the maximum card height in that row
  const rowHeights: number[] = new Array(rows).fill(0);
  for (let i = 0; i < childCount; i++) {
    const r = Math.floor(i / cols);
    const cardH = children[i].code ? 170 : 110;
    if (cardH > rowHeights[r]) {
      rowHeights[r] = cardH;
    }
  }

  // Step 2: Compute cumulative Y positions for each row
  const rowYPositions: number[] = new Array(rows).fill(0);
  let currentY = HEADER_HEIGHT;
  for (let r = 0; r < rows; r++) {
    rowYPositions[r] = currentY;
    currentY += rowHeights[r] + CARD_GAP_Y;
  }

  // Step 3: Compute exact 2D (x, y) coordinates for each child card relative to parent container
  const cardPositions = children.map((child, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = PADDING_X + c * (CARD_WIDTH + CARD_GAP_X);
    const y = rowYPositions[r];
    const height = child.code ? 170 : 110;
    return { x, y, width: CARD_WIDTH, height };
  });

  // Step 4: Compute final container bounding box dimensions
  const width = cols * CARD_WIDTH + (cols - 1) * CARD_GAP_X + 2 * PADDING_X;
  const height = currentY - CARD_GAP_Y + PADDING_BOTTOM;

  return {
    width: Math.max(280, width),
    height: Math.max(120, height),
    cols,
    rows,
    cardPositions,
  };
}

/**
 * Build Vue Flow nodes and edges with a true hierarchical Tree / DAG layout and cross-node communication links
 */
export function buildGraph(
  root: any,
  focusId?: string,
  direction: "TB" | "LR" = "TB",
  externalEdges: ArchEdge[] = [],
  collapsedSubsystems: Set<string> = new Set(),
  maxGridCols: number = 3
) {
  const safe = sanitize(root);
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const focusPath: ArchNode[] = [];

  let renderRoot: ArchNode = safe;

  // Handle drilldown breadcrumb path
  if (focusId) {
    findPath(safe, focusId, focusPath);
    const found = findNode(safe, focusId);
    if (found) renderRoot = found;
  }

  // Combine root.edges with externalEdges
  const allCrossEdges: ArchEdge[] = [...(safe.edges || []), ...externalEdges];

  // Choose between high-level overview tree vs focused drilldown tree
  if (!focusId) {
    layoutHierarchicalProjectTree(safe, nodes, edges, direction, allCrossEdges, collapsedSubsystems, maxGridCols);
  } else {
    layoutDrillDownTree(renderRoot, nodes, edges, direction, allCrossEdges);
  }

  return { nodes, edges, focusPath };
}

/**
 * Recursively find node by ID in architecture tree
 */
function findNode(node: ArchNode, targetId: string): ArchNode | null {
  if (node.id === targetId) return node;
  for (const child of node.children || []) {
    const found = findNode(child, targetId);
    if (found) return found;
  }
  return null;
}

/**
 * Find breadcrumb path from root to target node
 */
function findPath(node: ArchNode, targetId: string, path: ArchNode[]): boolean {
  path.push(node);
  if (node.id === targetId) return true;
  for (const child of node.children || []) {
    if (findPath(child, targetId, path)) return true;
  }
  path.pop();
  return false;
}

/**
 * Collect all node IDs present in the rendered tree.
 * If a subsystem container is collapsed, all of its descendant IDs are remapped to the container ID.
 * This guarantees cross-edges smoothly connect to the parent container when children are collapsed!
 */
function collectAllNodeIds(
  node: ArchNode,
  map: Map<string, string>,
  collapsedSubsystems: Set<string> = new Set()
): void {
  // If this subsystem is collapsed, map all internal node IDs to the container itself
  if (collapsedSubsystems.has(node.id)) {
    mapDescendantsToParent(node, node.id, map);
    return;
  }

  map.set(node.id, node.id);
  if (node.path) map.set(node.path, node.id);
  for (const child of node.children || []) {
    collectAllNodeIds(child, map, collapsedSubsystems);
  }
}

/**
 * Recursively map all descendant IDs to a single parent ID (used for collapsed container edge rerouting)
 */
function mapDescendantsToParent(node: ArchNode, parentId: string, map: Map<string, string>): void {
  map.set(node.id, parentId);
  if (node.path) map.set(node.path, parentId);
  for (const child of node.children || []) {
    mapDescendantsToParent(child, parentId, map);
  }
}

/**
 * TRUE HIERARCHICAL TREE LAYOUT ENGINE WITH DYNAMIC 2D MULTI-COLUMN GRIDS & COLLAPSIBLE SUBGRAPHS
 */
function layoutHierarchicalProjectTree(
  root: ArchNode,
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR",
  crossEdges: ArchEdge[],
  collapsedSubsystems: Set<string>,
  maxGridCols: number
) {
  const subsystems = root.children || [];
  const CONTAINER_GAP = 50;

  // Step 1: Precompute dynamic 2D multi-column grid layout for every subsystem
  const containerLayouts = subsystems.map((subsystem) => {
    const isCollapsed = collapsedSubsystems.has(subsystem.id);
    return calculateContainerGridLayout(subsystem.children || [], isCollapsed, maxGridCols);
  });

  const nodeIdLookup = new Map<string, string>();
  collectAllNodeIds(root, nodeIdLookup, collapsedSubsystems);

  if (direction === "TB") {
    // -------------------------------------------------------------------------
    // TOP-TO-BOTTOM (TB) TREE LAYOUT
    // -------------------------------------------------------------------------
    // Calculate total horizontal span across all dynamic-width subsystem containers
    const totalSubsystemsWidth = containerLayouts.reduce((sum, layout, idx) => {
      return sum + layout.width + (idx < subsystems.length - 1 ? CONTAINER_GAP : 0);
    }, 0);

    const startX = 60;
    const rootX = startX + Math.max(0, totalSubsystemsWidth / 2 - 130);
    const rootY = 40;
    const subsystemsStartY = 240;

    // 1. Place Root Node (Top Center)
    nodes.push({
      id: root.id,
      position: { x: rootX, y: rootY },
      type: "card",
      zIndex: 10,
      data: {
        title: root.title,
        description: root.description,
        type: root.type || "system",
        code: root.code || "",
      },
      style: { width: "260px" },
    });

    // 2. Place Subsystems branching out in a clean horizontal tier below Root
    let currentX = startX;
    subsystems.forEach((subsystem, idx) => {
      const layout = containerLayouts[idx];
      const isCollapsed = collapsedSubsystems.has(subsystem.id);
      const subsystemY = subsystemsStartY;

      // Subgraph container box with dynamic 2D multi-column dimensions
      nodes.push({
        id: subsystem.id,
        position: { x: currentX, y: subsystemY },
        type: "container",
        zIndex: 1,
        data: {
          title: subsystem.title,
          description: subsystem.description,
          type: subsystem.type || inferComponentType(subsystem.title),
          childCount: (subsystem.children || []).length,
          isCollapsed,
          cols: layout.cols,
          subsystemId: subsystem.id,
        },
        style: { width: `${layout.width}px`, height: `${layout.height}px` },
      });

      // Downward tree branch edge from Root -> Subsystem
      edges.push({
        id: `tree-${root.id}->${subsystem.id}`,
        source: root.id,
        target: subsystem.id,
        type: "smoothstep",
        animated: true,
        zIndex: 50,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
        style: { stroke: "#3b82f6", strokeWidth: 2 },
      });

      // Render child component cards inside this subsystem in a 2D multi-column grid (if not collapsed)
      if (!isCollapsed) {
        (subsystem.children || []).forEach((file, fileIdx) => {
          const pos = layout.cardPositions[fileIdx];
          nodes.push({
            id: file.id,
            parentNode: subsystem.id,
            position: { x: pos.x, y: pos.y },
            type: "card",
            zIndex: 20,
            data: {
              title: file.title,
              description: file.description,
              type: file.type || inferComponentType(file.title),
              code: file.code || "",
            },
            style: { width: `${pos.width}px` },
          });
        });
      }

      // Advance X coordinate to the start of the next subsystem container
      currentX += layout.width + CONTAINER_GAP;
    });
  } else {
    // -------------------------------------------------------------------------
    // LEFT-TO-RIGHT (LR) TREE LAYOUT
    // -------------------------------------------------------------------------
    // Calculate total vertical height across all dynamic-height subsystem containers
    const totalHeight = containerLayouts.reduce((sum, layout, idx) => {
      return sum + layout.height + (idx < subsystems.length - 1 ? CONTAINER_GAP : 0);
    }, 0);

    const startY = 40;
    const centerY = startY + totalHeight / 2;

    // 1. Place Root Node (Left Center)
    nodes.push({
      id: root.id,
      position: { x: 50, y: Math.max(40, centerY - 50) },
      type: "card",
      zIndex: 10,
      data: {
        title: root.title,
        description: root.description,
        type: root.type || "system",
        code: root.code || "",
      },
      style: { width: "250px" },
    });

    // 2. Place Subsystems branching out in a clean vertical column on the right
    let currentY = startY;
    const subsystemsX = 380;

    subsystems.forEach((subsystem, idx) => {
      const layout = containerLayouts[idx];
      const isCollapsed = collapsedSubsystems.has(subsystem.id);

      // Subgraph container box
      nodes.push({
        id: subsystem.id,
        position: { x: subsystemsX, y: currentY },
        type: "container",
        zIndex: 1,
        data: {
          title: subsystem.title,
          description: subsystem.description,
          type: subsystem.type || inferComponentType(subsystem.title),
          childCount: (subsystem.children || []).length,
          isCollapsed,
          cols: layout.cols,
          subsystemId: subsystem.id,
        },
        style: { width: `${layout.width}px`, height: `${layout.height}px` },
      });

      // Rightward tree branch edge from Root -> Subsystem
      edges.push({
        id: `tree-${root.id}->${subsystem.id}`,
        source: root.id,
        target: subsystem.id,
        type: "smoothstep",
        animated: true,
        zIndex: 50,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
        style: { stroke: "#3b82f6", strokeWidth: 2 },
      });

      // Render child component cards inside this subsystem (if not collapsed)
      if (!isCollapsed) {
        (subsystem.children || []).forEach((file, fileIdx) => {
          const pos = layout.cardPositions[fileIdx];
          nodes.push({
            id: file.id,
            parentNode: subsystem.id,
            position: { x: pos.x, y: pos.y },
            type: "card",
            zIndex: 20,
            data: {
              title: file.title,
              description: file.description,
              type: file.type || inferComponentType(file.title),
              code: file.code || "",
            },
            style: { width: `${pos.width}px` },
          });
        });
      }

      currentY += layout.height + CONTAINER_GAP;
    });
  }

  // -------------------------------------------------------------------------
  // 3. RENDER REAL CROSS-NODE DEPENDENCY & COMMUNICATION EDGES
  // -------------------------------------------------------------------------
  renderCrossNodeEdges(nodes, edges, crossEdges, nodeIdLookup);
}

/**
 * Render cross-node communication, import, and data flow edges between components
 */
function renderCrossNodeEdges(
  nodes: Node[],
  edges: Edge[],
  crossEdges: ArchEdge[],
  nodeIdLookup: Map<string, string>
) {
  const existingNodeIds = new Set(nodes.map((n) => n.id));
  const renderedEdgePairs = new Set<string>();

  // If explicit crossEdges exist (from AST parsing or backend)
  if (crossEdges && crossEdges.length > 0) {
    crossEdges.forEach((e, idx) => {
      const sourceId = nodeIdLookup.get(e.source) || e.source;
      const targetId = nodeIdLookup.get(e.target) || e.target;

      if (sourceId && targetId && sourceId !== targetId && existingNodeIds.has(sourceId) && existingNodeIds.has(targetId)) {
        const pairKey = `${sourceId}->${targetId}`;
        if (renderedEdgePairs.has(pairKey)) return;
        renderedEdgePairs.add(pairKey);

        const edgeMeta = getEdgeStyleMeta(e.type || "calls", e.label);

        edges.push({
          id: `cross-edge-${idx}-${sourceId}->${targetId}`,
          source: sourceId,
          target: targetId,
          type: "smoothstep",
          animated: edgeMeta.animated,
          zIndex: 100,
          label: e.label || edgeMeta.defaultLabel,
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeMeta.color },
          style: {
            stroke: edgeMeta.color,
            strokeWidth: edgeMeta.strokeWidth,
            strokeDasharray: edgeMeta.dashArray,
          },
          labelStyle: { fill: edgeMeta.color, fontWeight: 700, fontSize: "10px", fontFamily: "monospace" },
          labelBgStyle: { fill: "#0f172a", fillOpacity: 0.9 },
          labelBgPadding: [6, 3],
          labelBgBorderRadius: 4,
        });
      }
    });
  }

  // -------------------------------------------------------------------------
  // CROSS-SUBSYSTEM ARCHITECTURAL DATA FLOW CONNECTIONS
  // Connect Gateway Subsystems -> Service Subsystems -> Database/Queue Subsystems
  // -------------------------------------------------------------------------
  const containerNodes = nodes.filter((n) => n.type === "container");
  const gateways = containerNodes.filter((c) => {
    const t = (c.data?.title || "").toLowerCase();
    return t.includes("gateway") || t.includes("api") || t.includes("router") || t.includes("ingress") || t.includes("web") || t.includes("client");
  });
  const databases = containerNodes.filter((c) => {
    const t = (c.data?.title || "").toLowerCase();
    return t.includes("db") || t.includes("database") || t.includes("storage") || t.includes("persistence") || t.includes("data");
  });
  const queues = containerNodes.filter((c) => {
    const t = (c.data?.title || "").toLowerCase();
    return t.includes("queue") || t.includes("stream") || t.includes("kafka") || t.includes("event");
  });
  const generalServices = containerNodes.filter((c) => !gateways.includes(c) && !databases.includes(c) && !queues.includes(c));

  // Connect Ingress / Gateway -> General Services
  gateways.forEach((gw) => {
    const targets = generalServices.length ? generalServices : containerNodes.filter((n) => n.id !== gw.id);
    targets.slice(0, 3).forEach((svc) => {
      const edgeKey = `flow-${gw.id}->${svc.id}`;
      if (!renderedEdgePairs.has(edgeKey) && gw.id !== svc.id) {
        renderedEdgePairs.add(edgeKey);
        edges.push({
          id: edgeKey,
          source: gw.id,
          target: svc.id,
          type: "smoothstep",
          animated: true,
          zIndex: 80,
          label: "HTTPS / REST",
          markerEnd: { type: MarkerType.ArrowClosed, color: "#38bdf8" },
          style: { stroke: "#38bdf8", strokeWidth: 2 },
          labelStyle: { fill: "#38bdf8", fontWeight: 700, fontSize: "10px", fontFamily: "monospace" },
          labelBgStyle: { fill: "#0c4a6e", fillOpacity: 0.9 },
          labelBgPadding: [6, 3],
          labelBgBorderRadius: 4,
        });
      }
    });
  });

  // Connect Services -> Database Subsystems
  (generalServices.length ? generalServices : containerNodes).forEach((svc) => {
    databases.forEach((db) => {
      const edgeKey = `flow-${svc.id}->${db.id}`;
      if (!renderedEdgePairs.has(edgeKey) && svc.id !== db.id) {
        renderedEdgePairs.add(edgeKey);
        edges.push({
          id: edgeKey,
          source: svc.id,
          target: db.id,
          type: "smoothstep",
          animated: false,
          zIndex: 80,
          label: "SQL / Queries",
          markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
          style: { stroke: "#10b981", strokeWidth: 2 },
          labelStyle: { fill: "#34d399", fontWeight: 700, fontSize: "10px", fontFamily: "monospace" },
          labelBgStyle: { fill: "#064e3b", fillOpacity: 0.9 },
          labelBgPadding: [6, 3],
          labelBgBorderRadius: 4,
        });
      }
    });

    // Connect Services -> Queue / Event Subsystems
    queues.forEach((q) => {
      const edgeKey = `flow-${svc.id}->${q.id}`;
      if (!renderedEdgePairs.has(edgeKey) && svc.id !== q.id) {
        renderedEdgePairs.add(edgeKey);
        edges.push({
          id: edgeKey,
          source: svc.id,
          target: q.id,
          type: "smoothstep",
          animated: true,
          zIndex: 80,
          label: "Pub/Sub Event",
          markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
          style: { stroke: "#f59e0b", strokeWidth: 2, strokeDasharray: "5 4" },
          labelStyle: { fill: "#fbbf24", fontWeight: 700, fontSize: "10px", fontFamily: "monospace" },
          labelBgStyle: { fill: "#451a03", fillOpacity: 0.9 },
          labelBgPadding: [6, 3],
          labelBgBorderRadius: 4,
        });
      }
    });
  });

  // Fallback: If no specialized gateway/db detected and multiple containers exist, link adjacent functional clusters
  if (renderedEdgePairs.size === 0 && containerNodes.length > 1) {
    for (let i = 0; i < containerNodes.length - 1; i++) {
      const from = containerNodes[i];
      const to = containerNodes[i + 1];
      const edgeKey = `flow-${from.id}->${to.id}`;
      if (!renderedEdgePairs.has(edgeKey)) {
        renderedEdgePairs.add(edgeKey);
        edges.push({
          id: edgeKey,
          source: from.id,
          target: to.id,
          type: "smoothstep",
          animated: true,
          zIndex: 80,
          label: "gRPC / Data Flow",
          markerEnd: { type: MarkerType.ArrowClosed, color: "#8b5cf6" },
          style: { stroke: "#8b5cf6", strokeWidth: 2 },
          labelStyle: { fill: "#c084fc", fontWeight: 700, fontSize: "10px", fontFamily: "monospace" },
          labelBgStyle: { fill: "#2e1065", fillOpacity: 0.9 },
          labelBgPadding: [6, 3],
          labelBgBorderRadius: 4,
        });
      }
    }
  }
}

/**
 * Determine visual stroke color, animation, and label for semantic relationship types
 */
function getEdgeStyleMeta(type: string, customLabel?: string) {
  switch (type) {
    case "calls":
    case "sync_http":
    case "grpc":
      return {
        color: "#ec4899", // Pink
        animated: true,
        defaultLabel: customLabel || "calls",
        strokeWidth: 2,
        dashArray: undefined,
      };
    case "reads_writes":
    case "database":
      return {
        color: "#10b981", // Emerald Green
        animated: false,
        defaultLabel: customLabel || "reads/writes",
        strokeWidth: 2,
        dashArray: undefined,
      };
    case "pub_sub":
    case "async_event":
    case "queue":
      return {
        color: "#f59e0b", // Amber
        animated: true,
        defaultLabel: customLabel || "publishes",
        strokeWidth: 2,
        dashArray: "5 4",
      };
    case "imports":
    case "defines":
    case "extends":
    default:
      return {
        color: "#38bdf8", // Sky Blue
        animated: false,
        defaultLabel: customLabel || "imports",
        strokeWidth: 1.75,
        dashArray: undefined,
      };
  }
}

/**
 * Focused Subtree Drilldown Layout (Hierarchical branching of child nodes)
 */
function layoutDrillDownTree(
  root: ArchNode,
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR",
  crossEdges: ArchEdge[]
) {
  const NODE_WIDTH = 250;
  const H_GAP = 160;

  const totalLeaves = countLeaves(root);
  const totalHeight = totalLeaves * 150;

  function place(node: ArchNode, y: number, height: number, x: number, parentId?: string) {
    const cardHeight = node.code ? 170 : 110;
    const cy = y + height / 2 - cardHeight / 2;

    nodes.push({
      id: node.id,
      position: { x, y: cy },
      type: "card",
      zIndex: 20,
      data: {
        title: node.title,
        description: node.description,
        type: node.type || inferComponentType(node.title),
        code: node.code || "",
      },
      style: { width: `${NODE_WIDTH}px` },
    });

    if (parentId) {
      edges.push({
        id: `branch-${parentId}->${node.id}`,
        source: parentId,
        target: node.id,
        type: "smoothstep",
        animated: true,
        zIndex: 50,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
        style: { stroke: "#10b981", strokeWidth: 2 },
      });
    }

    const children = node.children || [];
    if (children.length === 0) return;

    const childLeaves = children.map(countLeaves);
    const totalChildLeaves = childLeaves.reduce((a, b) => a + b, 0);

    let offsetY = y;
    children.forEach((child, i) => {
      const childHeight = (childLeaves[i] / totalChildLeaves) * height;
      place(child, offsetY, childHeight, x + NODE_WIDTH + H_GAP, node.id);
      offsetY += childHeight;
    });
  }

  place(root, 40, totalHeight, 50);

  const nodeIdLookup = new Map<string, string>();
  collectAllNodeIds(root, nodeIdLookup);
  renderCrossNodeEdges(nodes, edges, crossEdges, nodeIdLookup);
}

/**
 * Helper to infer semantic architectural type from component name
 */
function inferComponentType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("db") || t.includes("database") || t.includes("sql") || t.includes("mongo") || t.includes("redis") || t.includes("store") || t.includes("repo") || t.includes("pool") || t.includes("persistence")) return "database";
  if (t.includes("queue") || t.includes("kafka") || t.includes("rabbit") || t.includes("event") || t.includes("stream") || t.includes("pubsub") || t.includes("worker") || t.includes("ingestion")) return "queue";
  if (t.includes("gateway") || t.includes("api") || t.includes("router") || t.includes("route") || t.includes("ingress") || t.includes("web") || t.includes("client")) return "api_gateway";
  if (t.includes("controller") || t.includes("handler")) return "controller";
  if (t.includes("external") || t.includes("saas") || t.includes("stripe") || t.includes("cloud") || t.includes("aws")) return "external_saas";
  return "service_layer";
}

/**
 * Dependency Graph layout for AST visualization.
 * 
 * CORE ALGORITHM & CONCEPTS:
 * Prevents 1D vertical infinite stacking by packing entities into bounded 2D sub-grids:
 * - Max rows per sub-column = 8
 * - When items exceed 8, they automatically wrap into the next column:
 *   subCol = Math.floor(index / MAX_ROWS_PER_COLUMN)
 *   subRow = index % MAX_ROWS_PER_COLUMN
 * - This creates clean, balanced panels for Files, Classes, and Functions.
 */
export function buildDependencyGraph(rawNodes: any[], rawEdges: any[]) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const fileNodes = rawNodes.filter((n) => n.type === "file");
  const classNodes = rawNodes.filter((n) => n.type === "class");
  const functionNodes = rawNodes.filter((n) => n.type === "function");

  const CARD_WIDTH = 280;
  const ROW_HEIGHT = 135;
  const GAP_X = 24;
  const GAP_Y = 16;
  const MAX_ROWS_PER_COLUMN = 8; // Automatically wrap to a new column after 8 rows

  const pathBasename = (p: string): string => {
    const parts = p.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1];
  };

  /**
   * Place a category of nodes into a multi-column 2D grid block starting at baseStartX
   */
  const placeNodeCategoryGrid = (
    categoryNodes: any[],
    baseStartX: number,
    typeResolver: (node: any) => { type: string; title: string; description: string; code: string }
  ): number => {
    let maxSubCols = 1;
    categoryNodes.forEach((node, idx) => {
      // 2D grid coordinate calculation
      const subCol = Math.floor(idx / MAX_ROWS_PER_COLUMN);
      const subRow = idx % MAX_ROWS_PER_COLUMN;
      if (subCol + 1 > maxSubCols) maxSubCols = subCol + 1;

      const posX = baseStartX + subCol * (CARD_WIDTH + GAP_X);
      const posY = 50 + subRow * (ROW_HEIGHT + GAP_Y);

      const meta = typeResolver(node);

      nodes.push({
        id: node.id,
        position: { x: posX, y: posY },
        type: "card",
        zIndex: 20,
        data: {
          title: meta.title,
          description: meta.description,
          type: meta.type,
          code: meta.code,
        },
        style: { width: `${CARD_WIDTH}px` },
      });
    });

    // Return the total horizontal width consumed by this category section
    return maxSubCols * (CARD_WIDTH + GAP_X) + 60;
  };

  // 1. Position File Nodes (Multi-Column Grid Group 1)
  let currentStartX = 50;
  const fileWidth = placeNodeCategoryGrid(fileNodes, currentStartX, (node) => ({
    title: node.name,
    description: `File: ${node.id}`,
    type: "file",
    code: "",
  }));
  currentStartX += fileWidth;

  // 2. Position Class Nodes (Multi-Column Grid Group 2)
  const classWidth = placeNodeCategoryGrid(classNodes, currentStartX, (node) => ({
    title: node.name,
    description: `Class defined in ${pathBasename(node.properties?.filePath || "")}`,
    type: "service_layer",
    code: node.properties?.methods?.join("\n") || "",
  }));
  currentStartX += classWidth;

  // 3. Position Function Nodes (Multi-Column Grid Group 3)
  placeNodeCategoryGrid(functionNodes, currentStartX, (node) => ({
    title: node.name,
    description: `Function defined in ${pathBasename(node.properties?.filePath || "")}`,
    type: "controller",
    code: node.properties?.params?.length
      ? `Parameters: ${node.properties.params.join(", ")}`
      : "No parameters",
  }));

  // Map edges
  rawEdges.forEach((edge, idx) => {
    let color = "#38bdf8"; // Blue for imports/extends
    if (edge.type === "calls") color = "#ec4899"; // Pink for calls
    if (edge.type === "defines") color = "#10b981"; // Green for definitions
    if (edge.type === "exports") color = "#8b5cf6"; // Purple for exports

    edges.push({
      id: `edge-${idx}`,
      source: edge.from,
      target: edge.to,
      type: "smoothstep",
      animated: edge.type === "calls",
      zIndex: 100,
      label: edge.type,
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: { stroke: color, strokeWidth: 1.75 },
    });
  });

  return { nodes, edges };
}
