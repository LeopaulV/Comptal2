import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import Modal from '../Common/Modal';
import ConfirmModal from '../Common/ConfirmModal';
import { DEFAULT_FINANCE_TABS, FINANCE_TAB_I18N, FinanceTabConfig, FinanceTabId } from '../../types/finance';

interface FinanceChartConfigModalProps {
  isOpen: boolean;
  tabs: FinanceTabConfig[];
  onChange: (tabs: FinanceTabConfig[]) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}

const FinanceChartConfigModal: React.FC<FinanceChartConfigModalProps> = ({
  isOpen,
  tabs,
  onChange,
  onClose,
  onSave,
  saving,
}) => {
  const { t } = useTranslation();
  const [resetOpen, setResetOpen] = useState(false);
  const [dragId, setDragId] = useState<FinanceTabId | null>(null);
  const ordered = useMemo(() => [...tabs].sort((a, b) => a.order - b.order), [tabs]);
  const visibleCount = ordered.filter((tab) => tab.visible).length;

  const reorder = (fromId: FinanceTabId, toId: FinanceTabId) => {
    if (fromId === toId) return;
    const list = [...ordered];
    const from = list.findIndex((tab) => tab.id === fromId);
    const to = list.findIndex((tab) => tab.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved!);
    onChange(list.map((tab, order) => ({ ...tab, order })));
  };

  const move = (id: FinanceTabId, dir: -1 | 1) => {
    const list = [...ordered];
    const index = list.findIndex((tab) => tab.id === id);
    const next = index + dir;
    if (index < 0 || next < 0 || next >= list.length) return;
    const tmp = list[index]!;
    list[index] = list[next]!;
    list[next] = tmp;
    onChange(list.map((tab, order) => ({ ...tab, order })));
  };

  const toggle = (id: FinanceTabId) => {
    const target = ordered.find((tab) => tab.id === id);
    if (target?.visible && visibleCount <= 1) return;
    onChange(ordered.map((tab) => (tab.id === id ? { ...tab, visible: !tab.visible } : tab)));
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        title={t('financeGlobal.configureTitle')}
        onClose={onClose}
        maxWidth="560px"
        footer={
          <>
            <button type="button" className="ct-btn-secondary" onClick={() => setResetOpen(true)}>
              {t('financeGlobal.resetDefault')}
            </button>
            <button type="button" className="ct-btn-secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="button" className="ct-btn-primary" onClick={onSave} disabled={saving}>
              {saving ? t('financeGlobal.saving') : t('common.save')}
            </button>
          </>
        }
      >
        <p className="ct-hint finance-config-hint">{t('financeGlobal.configureHint')}</p>
        <ul className="finance-config-list">
          {ordered.map((tab, index) => (
            <li
              key={tab.id}
              className={`finance-config-item${tab.visible ? ' is-on' : ''}`}
              draggable
              onDragStart={() => setDragId(tab.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragId) reorder(dragId, tab.id);
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
            >
              <GripVertical size={16} className="finance-config-grip" />
              <label>
                <input
                  type="checkbox"
                  checked={tab.visible}
                  disabled={tab.visible && visibleCount <= 1}
                  onChange={() => toggle(tab.id)}
                />
                <span>{t(FINANCE_TAB_I18N[tab.id])}</span>
              </label>
              <span className="finance-config-reorder">
                <button type="button" disabled={index === 0} onClick={() => move(tab.id, -1)}>
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  disabled={index === ordered.length - 1}
                  onClick={() => move(tab.id, 1)}
                >
                  <ChevronDown size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </Modal>
      <ConfirmModal
        isOpen={resetOpen}
        title={t('financeGlobal.resetDefault')}
        message={t('financeGlobal.resetConfirm')}
        confirmLabel={t('financeGlobal.resetDefault')}
        danger={false}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          onChange(DEFAULT_FINANCE_TABS.map((tab) => ({ ...tab })));
          setResetOpen(false);
        }}
      />
    </>
  );
};

export default FinanceChartConfigModal;
