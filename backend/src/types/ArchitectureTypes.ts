export type ArchitectureNodeType =
  | "project"
  | "system"
  | "domain"
  | "subsystem"
  | "module"
  | "microservice"
  | "api_gateway"
  | "controller"
  | "service_layer"
  | "repository"
  | "database"
  | "cache"
  | "queue"
  | "event_stream"
  | "external"
  | "file"
  | "class"
  | "function";

export type ArchitectureEdgeType =
  | "sync_http"
  | "grpc"
  | "async_event"
  | "pub_sub"
  | "reads_writes"
  | "imports"
  | "calls"
  | "defines"
  | "exports"
  | "extends"
  | "flow";

export interface ArchitectureEdge {
  id: string;
  source: string;
  target: string;
  type: ArchitectureEdgeType;
  label?: string;
  protocol?: string;
  properties?: Record<string, any>;
}

export interface ArchitectureNode {
  id: string;
  title: string;
  description: string;
  depth: number;
  type?: ArchitectureNodeType;
  technology?: string;
  path?: string;
  code?: string;
  metadata?: {
    tags?: string[];
    isExternal?: boolean;
    isEntryPoint?: boolean;
    isHub?: boolean;
    fanIn?: number;
    fanOut?: number;
    fileCount?: number;
    [key: string]: any;
  };
  children: ArchitectureNode[];
}

export interface ArchitectureGraphResult {
  root: ArchitectureNode;
  edges?: ArchitectureEdge[];
  archetype?: string;
  metrics?: {
    totalFiles: number;
    totalClusters: number;
    godNodes: string[];
    entryPoints: string[];
  };
}
