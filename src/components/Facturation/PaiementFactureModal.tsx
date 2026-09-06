import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, Banknote, FileCheck, Sparkles, X } from 'lucide-react';
import { Facture } from '../../types/invoice';
import { PaymentMatch, PaymentTrackingService } from '../../services/PaymentTrackingService';
import { StatsService, TransactionListRow } from '../../services/StatsService';
import { formatDateFr, formatMoney } from '../../utils/invoiceFormat';
import { Logger } from '../../services/logger';

type PaiementMode = 'especes' | 'cheque' | 'virement';

interface PaiementFactureModalProps {
  isOpen: boolean;
  onClose: () => void;
  facture: Facture;
  clientName: string;
  onSaved: () => void | Promise<void>;
}

const MODE_OPTIONS: { value: PaiementMode; icon: React.ReactNode; labelKey: string; hintKey: string }[] = [
  { value: 'especes', icon: <Banknote size={18} />, labelKey: 'facturation.pay.modeEspeces', hintKey: 'facturation.pay.hintEspeces' },
  { value: 'cheque', icon: <FileCheck size={18} />, labelKey: 'facturation.pay.modeCheque', hintKey: 'facturation.pay.hintCheque' },
  { value: 'virement', icon: <ArrowRightLeft size={18} />, labelKey: 'facturation.pay.modeTransaction', hintKey: 'facturation.pay.hintTransaction' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

const PaiementFactureModal: React.FC<PaiementFactureModalProps> = ({
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
  const [matches, setMatches] = useState<PaymentMatch[]>([]);
  const [allCredit, setAllCredit] = useState<TransactionListRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedMode(null);
    setMontant('');
    setDate(todayStr());
    setReference('');
    setSearchTerm(facture.numero);
    setError(null);
  }, [isOpen, facture.numero]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const found = await PaymentTrackingService.findPaymentMatches(facture);
        if (!cancelled) setMatches(found);
        const txs = await StatsService.listAllTransactions({});
        const linked = new Set(facture.paiements.map((p) => p.transactionId).filter(Boolean) as string[]);
        if (!cancelled) {
          setAllCredit(txs.filter((tx) => tx.credit > 0 && !linked.has(String(tx.id))));
        }
      } catch (err) {
        Logger.error('PaiementFactureModal.load', err);
        if (!cancelled) {
          setMatches([]);
          setAllCredit([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, facture]);

  const labelMatches = useMemo(
    () => matches.filter((m) => m.reason === 'label' || m.reason === 'both'),
    [matches]
  );

  const filteredTransactions = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    const source = q ? allCredit : labelMatches.map((m) => m.transaction);
    return source
      .filter((tx) => {
        if (!q) return true;
        const blob = `${tx.label} ${tx.accountCode} ${tx.credit} ${tx.date}`.toLowerCase();
        return blob.includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 40);
  }, [searchTerm, allCredit, labelMatches]);

  const handleSaveManual = async () => {
    const parsedMontant = parseFloat(montant.replace(',', '.'));
    if (Number.isNaN(parsedMontant) || parsedMontant <= 0) {
      setError(t('facturation.pay.errorMontant'));
      return;
    }
    if (!date) {
      setError(t('facturation.pay.errorDate'));
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
      await onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleLinkTransaction = async (transaction: TransactionListRow) => {
    setSaving(true);
    setError(null);
    try {
      await PaymentTrackingService.linkTransactionToInvoice(transaction.id, facture.id);
      await onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleAutoLink = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await PaymentTrackingService.autoLinkLabelMatches(facture.id);
      if (result.linked === 0) {
        setError(t('facturation.pay.noAuto'));
      } else {
        await onSaved();
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
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
            <h3 className="paiement-facture-modal-title">{t('facturation.pay.title')}</h3>
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
            <>
              {labelMatches.length > 0 && (
                <div className="inv-auto-matches">
                  <div className="inv-auto-matches-head">
                    <Sparkles size={16} />
                    <strong>{t('facturation.pay.autoFound', { count: labelMatches.length })}</strong>
                    <button type="button" className="ct-btn-primary inv-compact-button" onClick={() => void handleAutoLink()} disabled={saving}>
                      {t('facturation.pay.autoLink')}
                    </button>
                  </div>
                  {labelMatches.slice(0, 5).map((m) => (
                    <button
                      key={m.transaction.id}
                      type="button"
                      className="paiement-facture-transaction-item is-auto"
                      onClick={() => void handleLinkTransaction(m.transaction)}
                      disabled={saving}
                    >
                      <div>
                        <p className="paiement-facture-tx-desc">{m.transaction.label}</p>
                        <p className="paiement-facture-tx-meta">
                          {formatDateFr(m.transaction.date)} • {m.transaction.accountCode} • {t('facturation.pay.reasonLabel')}
                        </p>
                      </div>
                      <span className="paiement-facture-tx-amount">{formatMoney(m.transaction.credit)}</span>
                    </button>
                  ))}
                </div>
              )}
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
            </>
          ) : selectedMode === 'especes' || selectedMode === 'cheque' ? (
            <div className="paiement-facture-form">
              <button type="button" className="paiement-facture-back" onClick={() => setSelectedMode(null)}>
                ← {t('common.back')}
              </button>
              <div className="paiement-facture-form-grid">
                <label>
                  {t('facturation.pay.montant')}
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
                  {t('facturation.pay.date')}
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  {t('facturation.pay.reference')}
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={t('facturation.pay.referencePlaceholder')}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="paiement-facture-transaction">
              <button type="button" className="paiement-facture-back" onClick={() => setSelectedMode(null)}>
                ← {t('common.back')}
              </button>
              <label>
                {t('facturation.pay.searchTransaction')}
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('facturation.pay.searchPlaceholder')}
                  autoFocus
                />
              </label>
              <div className="paiement-facture-transaction-list">
                {isLoading ? (
                  <div className="paiement-facture-empty">{t('common.loading')}</div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="paiement-facture-empty">{t('facturation.pay.noResults')}</div>
                ) : (
                  filteredTransactions.map((tx) => (
                    <button
                      key={tx.id}
                      type="button"
                      className="paiement-facture-transaction-item"
                      onClick={() => void handleLinkTransaction(tx)}
                      disabled={saving}
                    >
                      <div>
                        <p className="paiement-facture-tx-desc">{tx.label}</p>
                        <p className="paiement-facture-tx-meta">
                          {formatDateFr(tx.date)} • {tx.accountCode}
                        </p>
                      </div>
                      <span className="paiement-facture-tx-amount">{formatMoney(tx.credit)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
          {error && <div className="paiement-facture-error">{error}</div>}
        </div>

        <div className="paiement-facture-modal-footer">
          <button type="button" className="ct-btn-secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          {(selectedMode === 'especes' || selectedMode === 'cheque') && (
            <button type="button" className="ct-btn-primary" onClick={() => void handleSaveManual()} disabled={saving}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaiementFactureModal;
