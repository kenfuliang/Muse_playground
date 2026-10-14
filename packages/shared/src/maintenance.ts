/**
 * Mold maintenance logic.
 *
 * The mold's shot counter is the heartbeat of an injection molding shop:
 * every production report adds shots, and maintenance is due every
 * N shots. The interval is configurable per mold because the factory
 * does not have fixed rules yet — a null interval means "no reminder".
 */

export interface MoldShotState {
  totalShots: number;
  lastMaintenanceShots: number;
  /** null = no maintenance rule configured for this mold yet */
  maintenanceIntervalShots: number | null;
}

export function shotsSinceMaintenance(m: MoldShotState): number {
  return Math.max(0, m.totalShots - m.lastMaintenanceShots);
}

export function isMaintenanceDue(m: MoldShotState): boolean {
  if (m.maintenanceIntervalShots == null) return false;
  return shotsSinceMaintenance(m) >= m.maintenanceIntervalShots;
}

/** Shots remaining before maintenance is due. null when no rule configured. */
export function shotsUntilMaintenance(m: MoldShotState): number | null {
  if (m.maintenanceIntervalShots == null) return null;
  return Math.max(0, m.maintenanceIntervalShots - shotsSinceMaintenance(m));
}
