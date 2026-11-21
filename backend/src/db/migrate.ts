import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadConfig } from "../config.js";

export interface MigrationResult {
  version: string;
  checksum: string;
  applied: boolean;
}

const DEFAULT_MIGRATION_VERSION = "001_initial_schema";

export function resolveDefaultSchemaPath(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return join(currentDir, "schema.sql");
}

/**
 * Applies `schema.sql` idempotently inside a PostgreSQL transaction and records
 * the applied SHA-256 checksum in `schema_migrations`.
 */
export async function runDatabaseMigrations(
  databaseUrlOrPool: string | pg.Pool,
  schemaPath = resolveDefaultSchemaPath(),
): Promise<MigrationResult> {
  const ownsPool = typeof databaseUrlOrPool === "string";
  const pool = ownsPool ? new pg.Pool({ connectionString: databaseUrlOrPool }) : databaseUrlOrPool;

  const sql = readFileSync(schemaPath, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
           version TEXT PRIMARY KEY,
           checksum TEXT NOT NULL,
           applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`,
      );

      const existing = await client.query(
        `SELECT checksum FROM schema_migrations WHERE version = $1`,
        [DEFAULT_MIGRATION_VERSION],
      );
      const existingChecksum = existing.rows[0]?.checksum
        ? String(existing.rows[0].checksum)
        : null;

      if (existingChecksum === checksum) {
        await client.query("COMMIT");
        return {
          version: DEFAULT_MIGRATION_VERSION,
          checksum,
          applied: false,
        };
      }

      await client.query(sql);
      await client.query(
        `INSERT INTO schema_migrations (version, checksum, applied_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (version) DO UPDATE
         SET checksum = EXCLUDED.checksum, applied_at = NOW()`,
        [DEFAULT_MIGRATION_VERSION, checksum],
      );
      await client.query("COMMIT");

      return {
        version: DEFAULT_MIGRATION_VERSION,
        checksum,
        applied: true,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } finally {
    if (ownsPool) {
      await pool.end();
    }
  }
}

export const LEDGER_PARTITION_SIZE = 100_000;
const PARTITIONED_TABLES = ["raw_events", "unit_transfers"] as const;
const DEFAULT_VACUUM_TABLES = ["raw_events", "unit_transfers", "unit_events"] as const;

export function formatPartitionName(tableName: string, startLedger: number): string {
  if (!/^[a-z_]+$/.test(tableName)) {
    throw new Error(`Invalid partitioned table name: ${tableName}`);
  }
  return `${tableName}_p${startLedger}`;
}

/**
 * Ensures range partitions of `partitionSize` ledgers exist for `raw_events` and
 * `unit_transfers` covering `currentLedger` plus `lookaheadPartitions` future ranges.
 */
export async function ensureLedgerPartitions(
  databaseUrlOrPool: string | pg.Pool,
  currentLedger: number,
  lookaheadPartitions = 2,
  partitionSize = LEDGER_PARTITION_SIZE,
): Promise<string[]> {
  if (currentLedger < 0 || partitionSize <= 0) {
    throw new Error("Invalid ledger or partitionSize");
  }
  const ownsPool = typeof databaseUrlOrPool === "string";
  const pool = ownsPool ? new pg.Pool({ connectionString: databaseUrlOrPool }) : databaseUrlOrPool;
  const created: string[] = [];

  try {
    const baseBucket = Math.floor(currentLedger / partitionSize) * partitionSize;
    for (let i = 0; i <= lookaheadPartitions; i++) {
      const start = baseBucket + i * partitionSize;
      const end = start + partitionSize;
      for (const tableName of PARTITIONED_TABLES) {
        const partName = formatPartitionName(tableName, start);
        await pool.query(
          `CREATE TABLE IF NOT EXISTS ${partName} PARTITION OF ${tableName} FOR VALUES FROM (${start}) TO (${end})`,
        );
        created.push(partName);
      }
    }
    return created;
  } finally {
    if (ownsPool) {
      await pool.end();
    }
  }
}

/**
 * Runs `VACUUM ANALYZE` on high-volume event tables outside of a transaction block.
 */
export async function runVacuumAnalyze(
  databaseUrlOrPool: string | pg.Pool,
  tables: readonly string[] = DEFAULT_VACUUM_TABLES,
): Promise<void> {
  const ownsPool = typeof databaseUrlOrPool === "string";
  const pool = ownsPool ? new pg.Pool({ connectionString: databaseUrlOrPool }) : databaseUrlOrPool;

  try {
    for (const table of tables) {
      if (!/^[a-z0-9_]+$/.test(table)) {
        throw new Error(`Invalid table name for VACUUM ANALYZE: ${table}`);
      }
      await pool.query(`VACUUM ANALYZE ${table}`);
    }
  } finally {
    if (ownsPool) {
      await pool.end();
    }
  }
}

const isMainModule =
  process.argv[1] &&
  fileURLToPath(import.meta.url).endsWith(process.argv[1].replace(/^.*\/src\//, "/src/"));

if (isMainModule) {
  const config = loadConfig();
  const argv = process.argv.slice(2);

  if (argv.includes("--ensure-partitions")) {
    const ledgerIdx = argv.indexOf("--ledger");
    const ledger = ledgerIdx !== -1 && argv[ledgerIdx + 1] ? Number(argv[ledgerIdx + 1]) : 0;
    ensureLedgerPartitions(config.databaseUrl, ledger)
      .then((parts) => {
        console.log(`Ensured ${parts.length} partitions: ${parts.join(", ")}`);
      })
      .catch((err) => {
        console.error("Partition creation failed:", err);
        process.exitCode = 1;
      });
  } else if (argv.includes("--vacuum")) {
    runVacuumAnalyze(config.databaseUrl)
      .then(() => {
        console.log("VACUUM ANALYZE completed on high-volume event tables.");
      })
      .catch((err) => {
        console.error("VACUUM ANALYZE failed:", err);
        process.exitCode = 1;
      });
  } else {
    runDatabaseMigrations(config.databaseUrl)
      .then((res) => {
        console.log(
          res.applied
            ? `Applied migration ${res.version} (checksum ${res.checksum.slice(0, 12)}...)`
            : `Migration ${res.version} already up to date (checksum ${res.checksum.slice(0, 12)}...)`,
        );
      })
      .catch((err) => {
        console.error("Database migration failed:", err);
        process.exitCode = 1;
      });
  }
}
