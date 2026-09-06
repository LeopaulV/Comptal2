export const TRANSFER_CATEGORY_CODE = 'X';

export function isTransferCategory(code: string | null | undefined): boolean {
  return (code ?? '').trim().toUpperCase() === TRANSFER_CATEGORY_CODE;
}
