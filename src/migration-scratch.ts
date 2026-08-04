export const MIGRATION_MARKER_NAME = ".empirical.schema5-migration.json";
export const MIGRATION_SCRATCH_PREFIX = ".empirical.schema5-";
export const MIGRATION_STAGE_PREFIX = ".empirical.schema5-stage-";
export const MIGRATION_BACKUP_PREFIX = ".empirical.schema4-backup-";

export type MigrationScratchKind = "marker" | "stage" | "backup";

export function migrationScratchKind(name: string): MigrationScratchKind | null {
  if (name === MIGRATION_MARKER_NAME) return "marker";
  if (name.startsWith(MIGRATION_STAGE_PREFIX)) return "stage";
  if (name.startsWith(MIGRATION_BACKUP_PREFIX)) return "backup";
  return null;
}

export function isMigrationScratchPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  const topLevel = normalized.split("/", 1)[0] ?? "";
  return topLevel.startsWith(MIGRATION_SCRATCH_PREFIX)
    || topLevel.startsWith(MIGRATION_BACKUP_PREFIX);
}
