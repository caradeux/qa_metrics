// apps/api/src/lib/flowpilot/types.ts
export interface FlowpilotCatalogItem {
  id: number;
  name: string;
}

export type FlowpilotEntityType = "contract" | "project";

export interface FlowpilotEntryInput {
  entityType: FlowpilotEntityType;
  clientId: number;
  taskTypeId: number;
  date: string;          // YYYY-MM-DD
  hoursWorked: number;
  description: string;
  contractId?: number | null;
  projectId?: number | null;
}

export interface FlowpilotEntry {
  id: number;
  clientId: number;
  clientName: string;
  date: string;
  description: string;
  hoursWorked: number;
  taskTypeName: string;
}

export interface FlowpilotSession {
  cookie: string;        // "session=..."
}
