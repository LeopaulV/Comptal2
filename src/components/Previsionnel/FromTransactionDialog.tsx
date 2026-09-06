import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Category, TransactionRow } from '../../types/models';
import { Periodicity, PERIODICITY_VALUES } from '../../types/projection';
import { ForecastLineDraft } from './FromCategoryDialog';
import { EditionService } from '../../services/EditionService';
import { Logger } from '../../services/logger';
import { formatMoney } from '../../utils/amounts';
import { formatFrDate } from '../../utils/dateFormats';
import Modal from '../Common/Modal';

interface FromTransactionDialogProps {
  isOpen: boolean;
  categories: Category[];
  onClose: () => void;
  onValidate: (draft: ForecastLineDraft) => void;
}

function signedAmount(tx: TransactionRow): number {
  return (tx.credit || 0) + (tx.debit || 0);
}

const FromTransactionDialog: React.FC<FromTransactionDialogProps> = ({
  isOpen,
  categories,
  onClose,
  onValidate,
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Map<number, TransactionRow>>(new Map());
  const [mode, setAggregationMode] = useState<'sum' | 'average'>('sum');
  const [periodicity, setPeriodicity] = useState<Periodicity>('monthly');

  const reset = useCallback(() => {
    setSearch('');
    setResults([]);
    setSelected(new Map());
    setAggregationMode('sum');
    setPeriodicity('monthly');
  }, []);

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  useEffect(() => {
    if (!isOpen) return;
    const term = search.trim();
    if (!term) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const rows = await EditionService.list({
            search: term,
            limit: 20,
            sortBy: 'date',
            sortDir: 'desc',
          });
          if (!cancelled) setResults(rows);
        } catch (err) {
          Logger.error('FromTransactionDialog.search', err);
          if (!cancelled) setResults([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [isOpen, search]);

  const selectedList = useMemo(() => Array.from(selected.values()), [selected]);
  const allFilteredSelected =
    results.length > 0 && results.every((tx) => selected.has(tx.id));

  const signedTotal = selectedList.reduce((sum, tx) => sum + signedAmount(tx), 0);
  const signedValue = mode === 'average' && selectedList.length > 0 ? signedTotal / selectedList.length : signedTotal;

  const toggleOne = (tx: TransactionRow) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(tx.id)) next.delete(tx.id);
      else next.set(tx.id, tx);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (allFilteredSelected) {
        results.forEach((tx) => next.delete(tx.id));
      } else {
        results.forEach((tx) => next.set(tx.id, tx));
      }
      return next;
    });
  };

  const handleValidate = () => {
    if (selectedList.length === 0) return;
    const uniqueCats = new Set(selectedList.map((tx) => tx.categoryCode).filter(Boolean) as string[]);
    const categoryCode = uniqueCats.size === 1 ? Array.from(uniqueCats)[0]! : null;
    const cat = categories.find((c) => c.code === categoryCode);
    const label =
      mode === 'average' ? t('previsionnel.fromTransaction.averageLabel') : t('previsionnel.fromTransaction.sumLabel');
    onValidate({
      name: `${label} (${selectedList.length})`,
      type: signedValue < 0 ? 'debit' : 'credit',
      amount: Math.abs(signedValue),
      periodicity,
      categoryCode,
      color: cat?.color ?? '#0ea5e9',
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      title={t('previsionnel.fromTransaction.title')}
      onClose={onClose}
      maxWidth="640px"
      footer={
        <>
          <button type="button" className="ct-btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="ct-btn-primary"
            disabled={selectedList.length === 0}
            onClick={handleValidate}
          >
            {t('previsionnel.fromTransaction.create')}
          </button>
        </>
      }
    >
      <div className="previsionnel-dialog-fields">
        <input
          className="ct-input w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('previsionnel.fromTransaction.searchPlaceholder')}
          autoFocus
        />
        <div className="previsionnel-dialog-dates">
          <label className="previsionnel-field">
            <span>{t('previsionnel.fromTransaction.mode')}</span>
            <select
              className="ct-select"
              value={mode}
              onChange={(e) => setAggregationMode(e.target.value as 'sum' | 'average')}
            >
              <option value="sum">{t('previsionnel.fromTransaction.sum')}</option>
              <option value="average">{t('previsionnel.fromTransaction.average')}</option>
            </select>
          </label>
          <label className="previsionnel-field">
            <span>{t('previsionnel.fromTransaction.frequency')}</span>
            <select
              className="ct-select"
              value={periodicity}
              onChange={(e) => setPeriodicity(e.target.value as Periodicity)}
            >
              {PERIODICITY_VALUES.map((p) => (
                <option key={p} value={p}>
                  {t(`previsionnel.periodicity.${p}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="previsionnel-field">
            <span>{t('previsionnel.fromTransaction.selectedCount')}</span>
            <div className="previsionnel-dialog-select-bar">
              <strong>{selectedList.length}</strong>
              <button type="button" className="ct-btn-secondary previsionnel-sm-btn" disabled={results.length === 0} onClick={toggleAll}>
                {allFilteredSelected
                  ? t('previsionnel.fromTransaction.unselectAll')
                  : t('previsionnel.fromTransaction.selectAll')}
              </button>
            </div>
          </div>
        </div>

        <div className="previsionnel-tx-list">
          {loading ? (
            <p className="previsionnel-empty">{t('common.loading')}</p>
          ) : !search.trim() ? (
            <p className="previsionnel-empty">{t('previsionnel.fromTransaction.searchPlaceholder')}</p>
          ) : results.length === 0 ? (
            <p className="previsionnel-empty">{t('previsionnel.fromTransaction.noResults')}</p>
          ) : (
            results.map((tx) => {
              const cat = categories.find((c) => c.code === tx.categoryCode);
              const amount = signedAmount(tx);
              const isOn = selected.has(tx.id);
              return (
                <button
                  key={tx.id}
                  type="button"
                  className={`previsionnel-tx-item${isOn ? ' selected' : ''}`}
                  onClick={() => toggleOne(tx)}
                >
                  <input type="checkbox" readOnly checked={isOn} />
                  <div className="previsionnel-tx-meta">
                    <strong>{tx.label}</strong>
                    <span>
                      {formatFrDate(tx.date)}
                      {cat ? ` · ${cat.name}` : ''}
                    </span>
                  </div>
                  <span className={amount < 0 ? 'previsionnel-stat-debit' : 'previsionnel-stat-credit'}>
                    {formatMoney(amount)}
                  </span>
                </button>
              );
            })
          )}
        </div>
        {selectedList.length > 0 && (
          <p className="previsionnel-dialog-preview">
            {mode === 'average' ? t('previsionnel.fromTransaction.average') : t('previsionnel.fromTransaction.sum')}
            {': '}
            {formatMoney(signedValue)}
          </p>
        )}
      </div>
    </Modal>
  );
};

export default FromTransactionDialog;
