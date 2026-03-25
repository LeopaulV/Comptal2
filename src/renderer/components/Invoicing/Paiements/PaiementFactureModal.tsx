import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Banknote, FileCheck, ArrowRightLeft } from 'lucide-react';
import { Facture } from '../../../types/Invoice';
import { Transaction } from '../../../types/Transaction';
import { DataService } from '../../../services/DataService';
import { PaymentTrackingService } from '../../../services/PaymentTrackingService';
import { formatCurrency, formatDate } from '../../../utils/format';

type PaiementMode = 'especes' | 'cheque' | 'virement';

interface PaiementFactureModalProps {
  isOpen: boolean;
  onClose: () => void;
  facture: Facture;
  clientName: string;
  onSaved: () => void;
}

const MODE_OPTIONS: { value: PaiementMode; icon: React.ReactNode; labelKey: string; hintKey: string }[] = [
  { value: 'especes', icon: <Banknote size={18} />, labelKey: 'invoicing.paiementModal.modeEspeces', hintKey: 'invoicing.paiementModal.hintEspeces' },
  { value: 'cheque', icon: <FileCheck size={18} />, labelKey: 'invoicing.paiementModal.modeCheque', hintKey: 'invoicing.paiementModal.hintCheque' },
  { value: 'virement', icon: <ArrowRightLeft size={18} />, labelKey: 'invoicing.paiementModal.modeTransaction', hintKey: 'invoicing.paiementModal.hintTransaction' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

export const PaiementFactureModal: React.FC<PaiementFactureModalProps> = ({
  isOpen,
  onClose,
  facture,
  clientName,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [selectedMode, setSelectedMode] = useState<PaiementMode | null>(null);
  const [montant, setMontant] = useState('');
  const [date, setDate] = useState(todayStr());
  const [reference, setReference] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedMode(null);
      setMontant('');
      setDate(todayStr());
      setReference('');
      setSearchTerm('');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const load = async () => {
      if (!isOpen || selectedMode !== 'virement') return;
      setIsLoading(true);
      try {
        const transactions = await DataService.getTransactions();
        setAllTransactions(transactions);
      } catch (err) {
        console.error('Erreur chargement transactions:', err);
        setAllTransactions([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isOpen, selectedMode]);

  const excludedIds = useMemo(
    () => new Set(facture.paiements.map((p) => p.transactionId).filter(Boolean) as string[]),
    [facture.paiements]
  );

  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const lower = searchTerm.toLowerCase().trim();
    return allTransactions
      .filter((tx) => {
        if (excludedIds.has(tx.id)) return false;
        if (tx.amount <= 0) return false;
        const desc = (tx.description || '').toLowerCase();
        const acc = (tx.accountCode || '').toLowerCase();
        const amt = Math.abs(tx.amount).toString();
        return desc.includes(lower) || acc.includes(lower) || amt.includes(lower);
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 25);
  }, [searchTerm, allTransactions, excludedIds]);

  const handleSaveManual = async () => {
    const parsedMontant = parseFloat(montant.replace(',', '.'));
    if (isNaN(parsedMontant) || parsedMontant <= 0) {
      setError(t('invoicing.paiementModal.errorMontant'));
      return;
    }
    if (!date) {
      setError(t('invoicing.paiementModal.errorDate'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await PaymentTrackingService.addManualPaiement(facture.id, {
        montant: parsedMontant,
        datePaiement: new Date(date),
        modePaiement: selectedMode as 'especes' | 'cheque',
        reference: reference.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleLinkTransaction = async (transaction: Transaction) => {
    setSaving(true);
    setError(null);
    try {
      await PaymentTrackingService.linkTransactionToInvoice(transaction.id, facture.id);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setSelectedMode(null);
    setMontant('');
    setReference('');
    setSearchTerm('');
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="paiement-facture-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="paiement-facture-modal">
        <div className="paiement-facture-modal-header">
          <div>
            <h3 className="paiement-facture-modal-title">
              {t('invoicing.paiementModal.title')}
            </h3>
            <p className="paiement-facture-modal-subtitle">
              {facture.numero} • {clientName}
            </p>
          </div>
          <button type="button" className="paiement-facture-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="paiement-facture-modal-body">
          {selectedMode === null ? (
            <div className="paiement-facture-type-grid">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="paiement-facture-type-card"
                  onClick={() => setSelectedMode(opt.value)}
                >
                  <span className="paiement-facture-type-icon">{opt.icon}</span>
                  <span className="paiement-facture-type-label">{t(opt.labelKey)}</span>
                  <span className="paiement-facture-type-hint">{t(opt.hintKey)}</span>
                </button>
              ))}
            </div>
          ) : selectedMode === 'especes' || selectedMode === 'cheque' ? (
            <div className="paiement-facture-form">
              <button type="button" className="paiement-facture-back" onClick={handleBack}>
                ← {t('common.back')}
              </button>
              <div className="paiement-facture-form-grid">
                <label>
                  {t('invoicing.paiementModal.montant')}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={montant}
                      onChange={(e) => setMontant(e.target.value)}
                      placeholder="0.00"
                      style={{ flex: 1 }}
                    />
                    <span style={{ color: 'var(--invoicing-gray-600)', fontWeight: 600 }}>€</span>
                  </div>
                </label>
                <label>
                  {t('invoicing.paiementModal.date')}
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  {t('invoicing.gestion.reference')}
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={t('invoicing.paiementModal.referencePlaceholder')}
                  />
                </label>
              </div>
              {error && <div className="paiement-facture-error">{error}</div>}
            </div>
          ) : (
            <div className="paiement-facture-transaction">
              <button type="button" className="paiement-facture-back" onClick={handleBack}>
                ← {t('common.back')}
              </button>
              <label>
                {t('invoicing.paiementModal.searchTransaction')}
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('invoicing.paiementModal.searchPlaceholder')}
                  autoFocus
                />
              </label>
              <div className="paiement-facture-transaction-list">
                {isLoading ? (
                  <div className="paiement-facture-empty">{t('common.loading')}</div>
                ) : searchTerm.trim() === '' ? (
                  <div className="paiement-facture-empty">
                    {t('invoicing.paiementModal.searchPlaceholder')}
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="paiement-facture-empty">
                    {t('invoicing.paiementModal.noResults')}
                  </div>
                ) : (
                  filteredTransactions.map((tx) => (
                    <button
                      key={tx.id}
                      type="button"
                      className="paiement-facture-transaction-item"
                      onClick={() => handleLinkTransaction(tx)}
                      disabled={saving}
                    >
                      <div>
                        <p className="paiement-facture-tx-desc">{tx.description}</p>
                        <p className="paiement-facture-tx-meta">
                          {formatDate(tx.date)} • {tx.accountCode}
                        </p>
                      </div>
                      <span className="paiement-facture-tx-amount">{formatCurrency(tx.amount)}</span>
                    </button>
                  ))
                )}
              </div>
              {error && <div className="paiement-facture-error">{error}</div>}
            </div>
          )}
        </div>

        <div className="paiement-facture-modal-footer">
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          {(selectedMode === 'especes' || selectedMode === 'cheque') && (
            <button type="button" className="primary" onClick={handleSaveManual} disabled={saving}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
