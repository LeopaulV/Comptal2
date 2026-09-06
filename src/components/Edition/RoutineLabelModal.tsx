import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../Common/Modal';
import { Category, TransactionRow } from '../../types/models';
import { AutoCategorisationService } from '../../services/AutoCategorisationService';
import { LabelRuleService, MIN_SEQUENCE_LENGTH } from '../../services/LabelRuleService';

interface RoutineLabelModalProps {
  isOpen: boolean;
  row: TransactionRow | null;
  initialWord?: string;
  categories: Category[];
  onClose: () => void;
  onSaved: (applied: number) => void;
}

const RoutineLabelModal: React.FC<RoutineLabelModalProps> = ({
  isOpen,
  row,
  initialWord = '',
  categories,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [word, setWord] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tokens = useMemo(() => {
    if (!row?.label) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const token of AutoCategorisationService.tokenizeLabel(row.label)) {
      if (AutoCategorisationService.isNumericWord(token) || seen.has(token)) continue;
      seen.add(token);
      out.push(token);
    }
    return out;
  }, [row]);

  useEffect(() => {
    if (!isOpen) return;
    const preset = initialWord.trim();
    setWord(preset || tokens[0] || '');
    setCategoryCode(row?.categoryCode ?? '');
    setSaving(false);
    setError('');
  }, [isOpen, row, tokens, initialWord]);

  const normalized = LabelRuleService.normalizeSequence(word);
  const canSave = normalized.length >= MIN_SEQUENCE_LENGTH && Boolean(categoryCode);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError('');
    try {
      await LabelRuleService.upsert({
        word: normalized,
        categoryCode: categoryCode || null,
        tag: null,
      });
      const applied = await LabelRuleService.apply();
      onSaved(applied);
    } catch {
      setError(t('common.error'));
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={t('edition.routineLabelTitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn-secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="ct-btn-primary"
            onClick={() => void handleSave()}
            disabled={!canSave || saving}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <p className="routine-label-hint">{t('edition.routineLabelHint')}</p>
      {row && (
        <p className="routine-label-source" title={row.label}>
          {row.label}
        </p>
      )}
      <label className="block text-sm font-medium mb-1" htmlFor="routine-sequence">
        {t('edition.routineLabelSequence')}
      </label>
      <input
        id="routine-sequence"
        className="ct-input w-full"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        placeholder={t('edition.routineLabelSequencePlaceholder')}
        autoComplete="off"
      />
      <p className="routine-label-hint" style={{ marginTop: 6 }}>
        {t('edition.routineLabelSequenceHelp')}
      </p>
      {tokens.length > 0 && (
        <div className="routine-word-chips mt-3" role="listbox" aria-label={t('edition.routineLabelWord')}>
          {tokens.map((token) => (
            <button
              key={token}
              type="button"
              role="option"
              aria-selected={LabelRuleService.normalizeSequence(word) === token}
              className={`routine-word-chip${LabelRuleService.normalizeSequence(word) === token ? ' selected' : ''}`}
              onClick={() => setWord(token)}
            >
              {token}
            </button>
          ))}
        </div>
      )}
      <label className="block text-sm font-medium mt-4 mb-1">{t('edition.routineLabelCategory')}</label>
      <select
        className="ct-select w-full"
        value={categoryCode}
        onChange={(e) => setCategoryCode(e.target.value)}
      >
        <option value="">{t('edition.routineLabelNoCategory')}</option>
        {categories.map((cat) => (
          <option key={cat.code} value={cat.code}>
            {cat.code} — {cat.name}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-3" style={{ color: 'var(--invoicing-danger)' }}>
          {error}
        </p>
      )}
    </Modal>
  );
};

export default RoutineLabelModal;
