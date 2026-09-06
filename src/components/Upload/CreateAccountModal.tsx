import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../Common/Modal';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: { code: string; name: string; color: string; initialBalance: number }) => void;
}

const CreateAccountModal: React.FC<CreateAccountModalProps> = ({ isOpen, onClose, onCreate }) => {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4a90e2');
  const [initialBalance, setInitialBalance] = useState('0');

  const submit = () => {
    if (!code.trim() || !name.trim()) return;
    onCreate({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      color,
      initialBalance: parseFloat(initialBalance.replace(',', '.')) || 0,
    });
    setCode('');
    setName('');
    setInitialBalance('0');
  };

  return (
    <Modal
      isOpen={isOpen}
      title={t('upload.createAccount')}
      onClose={onClose}
      footer={
        <>
          <button className="ct-btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="ct-btn-primary" onClick={submit} disabled={!code.trim() || !name.trim()}>
            {t('common.add')}
          </button>
        </>
      }
    >
      <div className="grid gap-3">
        <label className="ct-label">
          {t('common.code')}
          <input className="ct-input w-full mt-1" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <label className="ct-label">
          {t('common.name')}
          <input className="ct-input w-full mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="ct-label">
          {t('common.color')}
          <input type="color" className="mt-1 h-10 w-16" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label className="ct-label">
          {t('settings.accounts.initialBalance')}
          <input
            className="ct-input w-full mt-1"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
};

export default CreateAccountModal;
