import React, { useState } from 'react';
import { Transaction } from '../../types/Transaction';
import { formatCurrency, formatDate } from '../../utils/format';
import { Edit2, Trash2, Save, X } from 'lucide-react';
import CategorySelector from './CategorySelector';

interface TransactionTableProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (transactionId: string) => void;
}

const TransactionTable: React.FC<TransactionTableProps> = ({ 
  transactions, 
  onEdit,
  onDelete 
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTransaction, setEditedTransaction] = useState<Transaction | null>(null);

  const handleStartEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setEditedTransaction({ ...transaction });
  };

  const handleSaveEdit = () => {
    if (editedTransaction) {
      onEdit(editedTransaction);
      setEditingId(null);
      setEditedTransaction(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditedTransaction(null);
  };

  const handleFieldChange = (field: keyof Transaction, value: any) => {
    if (editedTransaction) {
      // Empêcher la modification de la catégorie "X"
      if (field === 'category' && editedTransaction.category === 'X' && value !== 'X') {
        alert('La catégorie "X" ne peut pas être modifiée.');
        return;
      }
      setEditedTransaction({
        ...editedTransaction,
        [field]: value,
      });
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
          <tr>
            <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 font-semibold">
              Date
            </th>
            <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 font-semibold">
              Description
            </th>
            <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 font-semibold">
              Compte
            </th>
            <th className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 font-semibold">
              Montant
            </th>
            <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 font-semibold">
              Catégorie
            </th>
            <th className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 font-semibold">
              Solde
            </th>
            <th className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => {
            const isEditing = editingId === transaction.id;
            const displayTransaction = isEditing && editedTransaction ? editedTransaction : transaction;

            return (
              <tr 
                key={transaction.id}
                className="border-b border-gray-200 dark:border-gray-700 
                         hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <td className="px-4 py-3 text-gray-900 dark:text-white whitespace-nowrap">
                  {formatDate(displayTransaction.date)}
                </td>
                
                <td className="px-4 py-3 text-gray-900 dark:text-white max-w-md">
                  {isEditing ? (
                    <input
                      type="text"
                      value={displayTransaction.description}
                      onChange={(e) => handleFieldChange('description', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  ) : (
                    <span className="truncate block">{displayTransaction.description}</span>
                  )}
                </td>
                
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {displayTransaction.accountCode}
                </td>
                
                <td 
                  className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                    displayTransaction.amount > 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatCurrency(displayTransaction.amount)}
                </td>
                
                <td className="px-4 py-3">
                  {isEditing ? (
                    <CategorySelector
                      value={displayTransaction.category}
                      onChange={(cat) => handleFieldChange('category', cat)}
                    />
                  ) : (
                    <span className="text-gray-600 dark:text-gray-400">
                      {displayTransaction.category || '-'}
                    </span>
                  )}
                </td>
                
                <td className="px-4 py-3 text-right text-gray-900 dark:text-white whitespace-nowrap">
                  {displayTransaction.balance ? formatCurrency(displayTransaction.balance) : '-'}
                </td>
                
                <td className="px-4 py-3 text-right">
                  {isEditing ? (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                        title="Sauvegarder"
                      >
                        <Save size={16} />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Annuler"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleStartEdit(transaction)}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                        title="Éditer"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => onDelete(transaction.id)}
                        className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {transactions.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Aucune transaction trouvée
        </div>
      )}
    </div>
  );
};

export default TransactionTable;

