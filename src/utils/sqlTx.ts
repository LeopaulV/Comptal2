/** Transactions non archivées (soft-delete conservation 10 ans). */
export function sqlTxActive(alias?: string): string {
  const col = alias ? `${alias}.deleted_at` : 'deleted_at';
  return `(${col} IS NULL OR ${col} = '')`;
}
