import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Transaction } from '../../types/Transaction';
import { formatCurrency } from '../../utils/format';

interface SortableTableProps {
  transactions: Transaction[];
}

type SortField = 'account' | 'date' | 'dateValue' | 'debit' | 'credit' | 'description' | 'balance' | 'category';
type SortDirection = 'asc' | 'desc' | null;

const SortableTable: React.FC<SortableTableProps> = ({ transactions }) => {
  const { t } = useTranslation();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Réinitialiser le tri quand les transactions changent
  useEffect(() => {
    setSortField(null);
    setSortDirection(null);
  }, [transactions.length]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedTransactions = useMemo(() => {
    // Log pour débogage
    console.log(`SortableTable: Recalcul avec ${transactions.length} transactions`);
    
    if (!sortField || !sortDirection) {
      return transactions;
    }

    return [...transactions].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'account':
          aValue = a.accountCode;
          bValue = b.accountCode;
          break;
        case 'date':
        case 'dateValue':
          aValue = a.date.getTime();
          bValue = b.date.getTime();
          break;
        case 'debit':
          aValue = a.amount < 0 ? Math.abs(a.amount) : 0;
          bValue = b.amount < 0 ? Math.abs(b.amount) : 0;
          break;
        case 'credit':
          aValue = a.amount > 0 ? a.amount : 0;
          bValue = b.amount > 0 ? b.amount : 0;
          break;
        case 'description':
          aValue = a.description.toLowerCase();
          bValue = b.description.toLowerCase();
          break;
        case 'balance':
          aValue = a.balance || 0;
          bValue = b.balance || 0;
          break;
        case 'category':
          aValue = a.category || '';
          bValue = b.category || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'desc' ? 1 : -1;
      return 0;
    });
  }, [transactions, transactions.length, sortField, sortDirection]);

  // Composants SVG pour les icônes de tri
  const SortIconNeutral = () => (
    <svg 
      className="sort-icon sort-icon-neutral" 
      role="img" 
      viewBox="0 0 384 512" 
      aria-hidden="true"
      style={{ display: 'inline-block', marginLeft: '6px' }}
    >
      <path 
        fill="currentColor" 
        d="M2.4 204.2c5 12 16.6 19.8 29.6 19.8l320 0c12.9 0 24.6-7.8 29.6-19.8s2.2-25.7-6.9-34.9l-160-160c-12.5-12.5-32.8-12.5-45.3 0l-160 160c-9.2 9.2-11.9 22.9-6.9 34.9zm0 103.5c-5 12-2.2 25.7 6.9 34.9l160 160c12.5 12.5 32.8 12.5 45.3 0l160-160c9.2-9.2 11.9-22.9 6.9-34.9S364.9 288 352 288L32 288c-12.9 0-24.6 7.8-29.6 19.8z"
      />
    </svg>
  );

  const SortIconAsc = () => (
    <svg 
      className="sort-icon sort-icon-asc" 
      role="img" 
      viewBox="0 0 384 512" 
      aria-hidden="true"
      style={{ display: 'inline-block', marginLeft: '6px' }}
    >
      <path 
        fill="currentColor" 
        d="M2.4 204.2c5 12 16.6 19.8 29.6 19.8l320 0c12.9 0 24.6-7.8 29.6-19.8s2.2-25.7-6.9-34.9l-160-160c-12.5-12.5-32.8-12.5-45.3 0l-160 160c-9.2 9.2-11.9 22.9-6.9 34.9z"
      />
    </svg>
  );

  const SortIconDesc = () => (
    <svg 
      className="sort-icon sort-icon-desc" 
      role="img" 
      viewBox="0 0 384 512" 
      aria-hidden="true"
      style={{ display: 'inline-block', marginLeft: '6px' }}
    >
      <path 
        fill="currentColor" 
        d="M2.4 307.7c-5 12-2.2 25.7 6.9 34.9l160 160c12.5 12.5 32.8 12.5 45.3 0l160-160c9.2-9.2 11.9-22.9 6.9-34.9S364.9 288 352 288L32 288c-12.9 0-24.6 7.8-29.6 19.8z"
      />
    </svg>
  );

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <SortIconNeutral />;
    }
    return sortDirection === 'asc' 
      ? <SortIconAsc />
      : <SortIconDesc />;
  };

  return (
    <div className="table-responsive">
      {/* Table fixe pour l'en-tête */}
      <div className="table-header-container">
        <table id="data-table-header" className="data-table-header">
          <thead>
            <tr>
              <th style={{ width: '10%' }} onClick={() => handleSort('account')}>
                {t('table.account')} {getSortIcon('account')}
              </th>
              <th style={{ width: '10%' }} onClick={() => handleSort('date')}>
                {t('table.date')} {getSortIcon('date')}
              </th>
              <th style={{ width: '10%' }} onClick={() => handleSort('dateValue')}>
                {t('table.dateValue')} {getSortIcon('dateValue')}
              </th>
              <th style={{ width: '10%' }} onClick={() => handleSort('debit')}>
                {t('table.debit')} {getSortIcon('debit')}
              </th>
              <th style={{ width: '10%' }} onClick={() => handleSort('credit')}>
                {t('table.credit')} {getSortIcon('credit')}
              </th>
              <th style={{ width: '25%' }} onClick={() => handleSort('description')}>
                {t('table.description')} {getSortIcon('description')}
              </th>
              <th style={{ width: '12%' }} onClick={() => handleSort('balance')}>
                {t('table.balance')} {getSortIcon('balance')}
              </th>
              <th style={{ width: '13%' }} onClick={() => handleSort('category')}>
                {t('table.category')} {getSortIcon('category')}
              </th>
            </tr>
          </thead>
        </table>
      </div>
      
      {/* Table scrollable pour le corps */}
      <div className="table-body-container">
        <table id="data-table-body" className="data-table-body">
          <tbody>
            {sortedTransactions.map((transaction, index) => (
              <tr key={`${transaction.id}-${index}`}>
                <td style={{ width: '10%' }}>{transaction.accountCode}</td>
                <td style={{ width: '10%' }}>{transaction.date.toLocaleDateString('fr-FR')}</td>
                <td style={{ width: '10%' }}>{transaction.date.toLocaleDateString('fr-FR')}</td>
                <td style={{ width: '10%' }} className="text-red-600">
                  {transaction.amount < 0 ? formatCurrency(Math.abs(transaction.amount)) : '0,00 €'}
                </td>
                <td style={{ width: '10%' }} className="text-green-600">
                  {transaction.amount > 0 ? formatCurrency(transaction.amount) : '0,00 €'}
                </td>
                <td style={{ width: '25%' }} className="max-w-xs truncate">{transaction.description}</td>
                <td style={{ width: '12%' }}>{transaction.balance ? formatCurrency(transaction.balance) : '-'}</td>
                <td style={{ width: '13%' }}>{transaction.category || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SortableTable;

