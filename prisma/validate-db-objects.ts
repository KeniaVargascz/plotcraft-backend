/**
 * Validates that the database has no orphan triggers or custom functions
 * that could break inserts/updates at runtime.
 *
 * Run after every migration:
 *   pnpm prisma:validate-db
 *
 * Exits with code 1 if orphan objects are found.
 */
import { PrismaClient } from '@prisma/client';

const ALLOWED_FUNCTION_PREFIXES = [
  // PostgreSQL extensions (pgcrypto, pg_trgm, etc.)
  'digest', 'hmac', 'crypt', 'gen_salt', 'gen_random',
  'encrypt', 'decrypt', 'encrypt_iv', 'decrypt_iv',
  'pgp_', 'armor', 'dearmor',
  'set_limit', 'show_limit', 'show_trgm',
  'similarity', 'word_similarity', 'strict_word_similarity',
  'gtrgm_', 'gin_extract', 'gin_trgm',
];

function isExtensionFunction(name: string): boolean {
  return ALLOWED_FUNCTION_PREFIXES.some((p) => name.startsWith(p));
}

async function main() {
  const prisma = new PrismaClient();

  try {
    // 1. Check for orphan triggers (any trigger in public schema)
    const triggers = await prisma.$queryRawUnsafe<
      { trigger_name: string; event_object_table: string }[]
    >(`
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
    `);

    // 2. Check for custom functions (excluding extension-provided ones)
    const allFunctions = await prisma.$queryRawUnsafe<
      { routine_name: string }[]
    >(`
      SELECT DISTINCT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
    `);

    const customFunctions = allFunctions.filter(
      (f) => !isExtensionFunction(f.routine_name),
    );

    // 3. For each trigger, verify the column it writes to actually exists
    const orphanTriggers: string[] = [];
    for (const t of triggers) {
      // A trigger on a table whose referenced columns were dropped is orphan.
      // We flag ALL triggers since Prisma manages the schema declaratively —
      // triggers should only exist if explicitly needed and documented.
      orphanTriggers.push(`${t.trigger_name} ON ${t.event_object_table}`);
    }

    // 4. Report
    const problems: string[] = [];

    if (orphanTriggers.length > 0) {
      problems.push(
        `Orphan triggers found:\n${orphanTriggers.map((t) => `  - ${t}`).join('\n')}`,
      );
    }

    if (customFunctions.length > 0) {
      problems.push(
        `Custom functions found (not from extensions):\n${customFunctions.map((f) => `  - ${f.routine_name}`).join('\n')}`,
      );
    }

    if (problems.length > 0) {
      console.error('❌ Database validation FAILED:\n');
      problems.forEach((p) => console.error(p + '\n'));
      console.error(
        'Fix: Create a migration to DROP these orphan objects, or add them to the allow-list if intentional.',
      );
      process.exit(1);
    }

    console.log('✅ Database validation passed — no orphan triggers or functions.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Validation script error:', err);
  process.exit(1);
});
