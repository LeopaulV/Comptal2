import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../Common/Modal';
import { formatFrDate } from '../../utils/dateFormats';

export interface SuggestionItem {
  id: number;
  date: string;
  label: string;
  category: string;
  confidence: number;
}

type TabKey = 'high' | 'medium' | 'low';

const TABS: { key: TabKey; labelKey: string; min: number; max: number }[] = [
  { key: 'high', labelKey: 'edition.confidenceHigh', min: 0.7, max: 1 },
  { key: 'medium', labelKey: 'edition.confidenceMedium', min: 0.4, max: 0.7 },
  { key: 'low', labelKey: 'edition.confidenceLow', min: 0, max: 0.4 },
];

interface AutoCatReviewModalProps {
  isOpen: boolean;
  items: SuggestionItem[];
  onClose: () => void;
  onApply: (selected: SuggestionItem[]) => void;
}

const AutoCatReviewModal: React.FC<AutoCatReviewModalProps> = ({
  isOpen,
  items,
  onClose,
  onApply,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('high');
  const [unchecked, setUnchecked] = useState<Set<number>>(new Set());

  const tabItems = useMemo(() => {
    const tab = TABS.find((x) => x.key === activeTab);
    if (!tab) return [];
    if (tab.key === 'high') {
      return items.filter((s) => s.confidence >= 0.7);
    }
    if (tab.key === 'medium') {
      return items.filter((s) => s.confidence >= 0.4 && s.confidence < 0.7);
    }
    return items.filter((s) => s.confidence < 0.4);
  }, [items, activeTab]);

  const selected = items.filter((item) => !unchecked.has(item.id));

  const toggleItem = (id: number, checked: boolean) => {
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllInTab = () => {
    const tabIds = new Set(tabItems.map((i) => i.id));
    const allSelected = tabItems.every((i) => !unchecked.has(i.id));
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        tabItems.forEach((i) => next.add(i.id));
      } else {
        tabIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const selectAll = () => {
    const allSelected = items.every((i) => !unchecked.has(i.id));
    if (allSelected) {
      setUnchecked(new Set(items.map((i) => i.id)));
    } else {
      setUnchecked(new Set());
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={t('edition.autocatReview')}
      onClose={onClose}
      maxWidth="720px"
      footer={
        <>
          <button type="button" className="ct-btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="ct-btn-primary" onClick={() => onApply(selected)}>
            {t('edition.applySuggestions', { count: selected.length })}
          </button>
        </>
      }
    >
      <div className="edition-autocat-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`edition-filter-nav-button${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-3">
        <button type="button" className="ct-btn-secondary text-xs" onClick={selectAll}>
          {t('edition.selectAll')}
        </button>
        <button type="button" className="ct-btn-secondary text-xs" onClick={selectAllInTab}>
          {t('edition.selectAllTab')}
        </button>
      </div>
      <table className="ct-table">
        <thead>
          <tr>
            <th />
            <th>{t('upload.colDate')}</th>
            <th>{t('upload.colLabel')}</th>
            <th>{t('settings.tabs.categories')}</th>
            <th>{t('edition.confidence')}</th>
          </tr>
        </thead>
        <tbody>
          {tabItems.map((item) => (
            <tr key={item.id}>
              <td>
                <input
                  type="checkbox"
                  checked={!unchecked.has(item.id)}
                  onChange={(e) => toggleItem(item.id, e.target.checked)}
                />
              </td>
              <td>{formatFrDate(item.date)}</td>
              <td>{item.label}</td>
              <td>{item.category}</td>
              <td>{Math.round(item.confidence * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && <p className="ct-hint">{t('edition.noSuggestions')}</p>}
      {items.length > 0 && tabItems.length === 0 && (
        <p className="ct-hint">{t('edition.noSuggestionsTab')}</p>
      )}
    </Modal>
  );
};

export default AutoCatReviewModal;
