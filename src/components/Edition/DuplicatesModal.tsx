import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../Common/Modal';
import { DuplicateGroup } from '../../services/EditionService';
import { formatFrDate } from '../../utils/dateFormats';
import { formatMoney } from '../../utils/amounts';

interface DuplicatesModalProps {
  isOpen: boolean;
  groups: DuplicateGroup[];
  onClose: () => void;
  onDelete: (ids: number[]) => void;
}

const DuplicatesModal: React.FC<DuplicatesModalProps> = ({ isOpen, groups, onClose, onDelete }) => {
  const { t } = useTranslation();
  const [toDelete, setToDelete] = useState<number[]>([]);

  useEffect(() => {
    if (isOpen && groups.length > 0) {
      const allCopies = groups.flatMap((g) => g.ids.slice(1));
      setToDelete(allCopies);
    } else {
      setToDelete([]);
    }
  }, [isOpen, groups]);

  const toggleKeepFirst = (extraId: number) => {
    setToDelete((prev) =>
      prev.includes(extraId) ? prev.filter((id) => id !== extraId) : [...prev, extraId]
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      title={t('edition.duplicates')}
      onClose={onClose}
      maxWidth="720px"
      footer={
        <>
          <button type="button" className="ct-btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="ct-btn-danger"
            disabled={toDelete.length === 0}
            onClick={() => onDelete(toDelete)}
          >
            {t('common.delete')} ({toDelete.length})
          </button>
        </>
      }
    >
      {groups.length === 0 && <p className="ct-hint">{t('edition.noDuplicates')}</p>}
      {groups.map((group) => (
        <div key={group.ids.join('-')} className="mb-4">
          <p className="text-sm font-medium" style={{ color: 'var(--invoicing-gray-800)' }}>
            {formatFrDate(group.date)} — {group.label} ({formatMoney(group.credit + group.debit)})
          </p>
          <p className="ct-hint m-0">{t('edition.keepFirst')}</p>
          {group.ids.slice(1).map((id) => (
            <label key={id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={toDelete.includes(id)}
                onChange={() => toggleKeepFirst(id)}
              />
              {t('edition.deleteCopy')} #{id}
            </label>
          ))}
        </div>
      ))}
    </Modal>
  );
};

export default DuplicatesModal;
