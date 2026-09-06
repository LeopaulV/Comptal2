import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { differenceInMonths } from 'date-fns';
import { Category } from '../../types/models';
import { FlowType, Periodicity } from '../../types/projection';
import { EditionService } from '../../services/EditionService';
import { Logger } from '../../services/logger';
import { formatMoney } from '../../utils/amounts';
import Modal from '../Common/Modal';

export interface ForecastLineDraft {
  name: string;
  type: FlowType;
  amount: number;
  periodicity: Periodicity;
  categoryCode: string | null;
  color: string;
}

interface FromCategoryDialogProps {
  isOpen: boolean;
  categories: Category[];
  onClose: () => void;
  onValidate: (draft: ForecastLineDraft) => void;
}

const FromCategoryDialog: React.FC<FromCategoryDialogProps> = ({
  isOpen,
  categories,
  onClose,
  onValidate,
}) => {
  const { t } = useTranslation();
  const [categoryCode, setCategoryCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [average, setAverage] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setCategoryCode('');
    setStartDate('');
    setEndDate('');
    setAverage(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  useEffect(() => {
    if (!isOpen || !categoryCode || !startDate || !endDate) {
      setAverage(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setCalculating(true);
      setError(null);
      try {
        if (startDate > endDate) {
          setError(t('previsionnel.fromCategory.dateOrder'));
          setAverage(null);
          return;
        }
        const txs = await EditionService.list({
          categoryCodes: [categoryCode],
          dateStart: startDate,
          dateEnd: endDate,
        });
        if (cancelled) return;
        if (txs.length === 0) {
          setAverage(0);
          setError(t('previsionnel.fromCategory.noData'));
          return;
        }
        const total = txs.reduce((sum, tx) => sum + Math.abs((tx.credit || 0) + (tx.debit || 0)), 0);
        const months = differenceInMonths(new Date(endDate), new Date(startDate)) + 1;
        setAverage(months > 0 ? total / months : 0);
        setError(null);
      } catch (err) {
        Logger.error('FromCategoryDialog.calculate', err);
        if (!cancelled) {
          setError(t('common.error'));
          setAverage(null);
        }
      } finally {
        if (!cancelled) setCalculating(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [isOpen, categoryCode, startDate, endDate, t]);

  const handleValidate = () => {
    const cat = categories.find((c) => c.code === categoryCode);
    if (!cat || average === null || average === 0) return;
    onValidate({
      name: `${cat.name} (${t('previsionnel.fromCategory.averageSuffix')})`,
      type: 'debit',
      amount: average,
      periodicity: 'monthly',
      categoryCode,
      color: cat.color,
    });
    onClose();
  };

  const canValidate =
    Boolean(categoryCode && startDate && endDate) && average !== null && average > 0 && !calculating;

  return (
    <Modal
      isOpen={isOpen}
      title={t('previsionnel.fromCategory.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="ct-btn-primary" disabled={!canValidate} onClick={handleValidate}>
            {t('common.validate')}
          </button>
        </>
      }
    >
      <div className="previsionnel-dialog-fields">
        <label className="previsionnel-field">
          <span>{t('previsionnel.fromCategory.selectCategory')}</span>
          <select className="ct-select w-full" value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)}>
            <option value="">{t('previsionnel.noCategory')}</option>
            {categories
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
              .map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <div className="previsionnel-dialog-dates">
          <label className="previsionnel-field">
            <span>{t('previsionnel.startDate')}</span>
            <input className="ct-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="previsionnel-field">
            <span>{t('previsionnel.endDate')}</span>
            <input className="ct-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        {(calculating || average !== null) && (
          <div className="previsionnel-dialog-result">
            {calculating ? (
              t('previsionnel.fromCategory.calculating')
            ) : (
              <>
                <span>{t('previsionnel.fromCategory.calculatedAverage')}</span>
                <strong>{formatMoney(average ?? 0)}</strong>
              </>
            )}
          </div>
        )}
        {error && <p className="previsionnel-dialog-error">{error}</p>}
      </div>
    </Modal>
  );
};

export default FromCategoryDialog;
