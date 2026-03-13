import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataService } from '../../services/DataService';
import { DonateurService } from '../../services/DonateurService';
import { Transaction } from '../../types/Transaction';
import { formatCurrency, formatDate } from '../../utils/format';

interface TransactionLinkDialogProps {
  isOpen: boolean;
  donateurId: string;
  onClose: () => void;
  onLinked: () => void;
}

export const TransactionLinkDialog: React.FC<TransactionLinkDialogProps> = ({
  isOpen,
  donateurId,
  onClose,
  onLinked,
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!isOpen) return;
      setIsLoading(true);
      try {
        const [transactions, mapping] = await Promise.all([
          DataService.getTransactions(),
          DonateurService.loadTransactionMapping(),
        ]);
        setAllTransactions(transactions);
        const linked = new Set<string>();
        for (const [txId, dId] of Object.entries(mapping)) {
          if (dId === donateurId) linked.add(txId);
        }
        setLinkedIds(linked);
      } catch (error) {
        console.error('Erreur chargement transactions:', error);
        setAllTransactions([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isOpen, donateurId]);

  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const lower = searchTerm.toLowerCase().trim();
    return allTransactions
      .filter((tx) => {
        if (tx.amount <= 0) return false;
        const desc = (tx.description || '').toLowerCase();
        const acc = (tx.accountCode || '').toLowerCase();
        const amt = Math.abs(tx.amount).toString();
        return desc.includes(lower) || acc.includes(lower) || amt.includes(lower);
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 25);
  }, [searchTerm, allTransactions]);

  const handleLink = async (transaction: Transaction) => {
    try {
      await DonateurService.linkTransactionToDonateur(transaction.id, donateurId);
      setLinkedIds((prev) => new Set(prev).add(transaction.id));
      onLinked();
    } catch (error) {
      console.error('Erreur liaison transaction:', error);
    }
  };

  const handleUnlink = async (transactionId: string) => {
    try {
      await DonateurService.unlinkTransaction(transactionId);
      setLinkedIds((prev) => {
        const next = new Set(prev);
        next.delete(transactionId);
        return next;
      });
      onLinked();
    } catch (error) {
      console.error('Erreur déliaison:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {t('association.gestion.linkTransaction')}
        </h2>
        <div className="mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('association.gestion.searchTransactionPlaceholder')}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">{t('common.loading')}</div>
          ) : searchTerm.trim() === '' ? (
            <div className="text-center py-8 text-gray-500">
              {t('association.gestion.searchTransactionPlaceholder')}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {t('association.gestion.noTransactionResults')}
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const isLinked = linkedIds.has(tx.id);
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 border rounded-lg border-gray-300 dark:border-gray-600"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{tx.description}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(tx.date)} • {tx.accountCode}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(tx.amount)}
                    </span>
                    {isLinked ? (
                      <button
                        type="button"
                        className="text-sm text-red-600 hover:underline"
                        onClick={() => handleUnlink(tx.id)}
                      >
                        {t('association.gestion.unlink')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="primary text-sm py-1 px-2"
                        onClick={() => handleLink(tx)}
                      >
                        {t('association.gestion.link')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="flex justify-end pt-4 mt-4 border-t border-gray-300 dark:border-gray-600">
          <button className="secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
