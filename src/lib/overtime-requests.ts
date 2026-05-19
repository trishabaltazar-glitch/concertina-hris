export async function ensureOvertimeRequestTable() {
  // Schema changes are managed by Prisma migrations. Keeping this helper as a
  // no-op avoids request-time DDL on the Supabase pooler, which has a very
  // small connection limit in this project.
}
