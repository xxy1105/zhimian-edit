export type Entity = Record<string, unknown> & { key: string };

export type Database = {
  projects: Entity[];
  jobs: Entity[];
  interviews: Entity[];
  candidates: Entity[];
  questions: Entity[];
  scoreTemplates: Entity[];
  approvals: Entity[];
  notifications: Entity[];
  downloads: Entity[];
  updates: Entity[];
  users: Entity[];
  calendarEvents: Entity[];
  templates: Entity[];
  auditLogs: Entity[];
  settings: Record<string, unknown>;
  metadata: {
    version: number;
    createdAt: string;
    updatedAt: string;
    processedEventIds?: string[];
  };
};

export const collectionNames = [
  'projects',
  'jobs',
  'interviews',
  'candidates',
  'questions',
  'scoreTemplates',
  'approvals',
  'notifications',
  'downloads',
  'updates',
  'users',
  'calendarEvents',
  'templates',
  'auditLogs',
] as const satisfies readonly (keyof Database)[];

export type CollectionName = (typeof collectionNames)[number];
