import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Facture } from '../../../types/Invoice';
import { Transaction } from '../../../types/Transaction';
import { InvoiceService } from '../../../services/InvoiceService';
import { PaymentTrackingService } from '../../../services/PaymentTrackingService';
import { TransactionSearchDialog } from './TransactionSearchDialog';
import { formatCurrency } from '../../../utils/format';

export const TransactionMatcher: React.FC = () => {
  const { t } = useTranslation();
  const [factures, setFactures] = useState<Facture[]>([]);
  const [selectedFactureId, setSelectedFactureId] = useState<string>('');
  const [matches, setMatches] = useState<Transaction[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await InvoiceService.loadFactures();
      setFactures(data.filter((f) => !f.supprime));
    };
    load();
  }, []);

  useEffect(() => {
    const loadMatches = async () => {
      const facture = factures.find((f) => f.id === selectedFactureId);
      if (!facture) {
        setMatches([]);
        return;
      }
      const data = await PaymentTrackingService.searchMatchingTransactions(facture);
      const linkedIds = new Set(facture.paiements.map((p) => p.transactionId).filter(Boolean) as string[]);
      setMatches(data.filter((item) => !linkedIds.has(item.id)));
    };
    loadMatches();
  }, [selectedFactureId, factures]);

  const selectedFacture = useMemo(
    () => factures.find((f) => f.id === selectedFactureId) || null,
    [factures, selectedFactureId]
  );

  const excludedTransactionIds = useMemo(() => {
    if (!selectedFacture) return [];
    return selectedFacture.paiements.map((p) => p.transactionId).filter(Boolean) as string[];
  }, [selectedFacture]);

  const handleLinkTransaction = async (transaction: Transaction) => {
    if (!selectedFactureId) {
      return;
    }
    setIsLinking(true);
    try {
      await PaymentTrackingService.linkTransactionToInvoice(transaction.id, selectedFactureId);
      const updatedFactures = await InvoiceService.loadFactures();
      setFactures(updatedFactures);
      setStatus(t('invoicing.payments.linked'));
    } catch (error) {
      setStatus(t('invoicing.payments.linkError'));
    } finally {
      setIsLinking(false);
      setIsSearchOpen(false);
    }
  };

  return (
    <div className="invoicing-card">
      <h2>{t('invoicing.payments.matchTitle')}</h2>
      <label>
        {t('invoicing.payments.selectInvoice')}
        <select value={selectedFactureId} onChange={(e) => setSelectedFactureId(e.target.value)}>
          <option value="">{t('invoicing.payments.selectPlaceholder')}</option>
          {factures.map((facture) => (
            <option key={facture.id} value={facture.id}>
              {facture.numero}
            </option>
          ))}
        </select>
      </label>
      <div className="invoicing-actions">
        <button
          type="button"
          className="primary"
          onClick={() => setIsSearchOpen(true)}
          disabled={!selectedFactureId || isLinking}
        >
          {t('invoicing.payments.searchTransaction')}
        </button>
        {status && <span className="status">{status}</span>}
      </div>
      <div className="invoicing-list">
        {matches.map((match) => (
          <div key={match.id} className="invoicing-list-item">
            <div className="name">{match.description}</div>
            <div className="meta">{formatCurrency(match.amount)}</div>
            <button
              type="button"
              className="secondary"
              onClick={() => handleLinkTransaction(match)}
              disabled={isLinking}
            >
              {t('invoicing.payments.linkAction')}
            </button>
          </div>
        ))}
        {selectedFactureId && matches.length === 0 && (
          <div className="invoicing-empty">{t('invoicing.payments.noMatches')}</div>
        )}
      </div>
      <TransactionSearchDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelect={handleLinkTransaction}
        excludeTransactionIds={excludedTransactionIds}
      />
    </div>
  );
};
