import React from 'react';
import { Transaction } from '../../../types/Transaction';
import { formatCurrency, formatDate } from '../../../utils/format';

interface TransactionRowProps {
  transaction: Transaction;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({ transaction }) => {
  return (
    <div className="invoicing-list-item invoicing-nested-item">
      <div className="name">{transaction.description}</div>
      <div className="meta">
        {formatDate(transaction.date)} • {transaction.accountCode}
      </div>
      <div className="meta">{formatCurrency(transaction.amount)}</div>
    </div>
  );
};
