import React from 'react';
import { formatCurrency } from '../../utils/format';

interface CategoryAverage {
  categoryCode: string;
  categoryName: string;
  color: string;
  averageAmount: number;
}

interface MiniCategoryCardsProps {
  categories: CategoryAverage[];
}

const MiniCategoryCards: React.FC<MiniCategoryCardsProps> = ({ categories }) => {

  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="account-cards">
      {/* Cartes individuelles des catégories */}
      {categories.map((category) => {
        const isPositive = category.averageAmount >= 0;
        return (
          <div 
            key={category.categoryCode} 
            className="mini-card"
            style={{ borderLeftColor: category.color }}
          >
            <div className="mini-card-body">
              <span className="account-name">{category.categoryName}</span>
              <span 
                className="account-balance"
                style={{
                  color: isPositive 
                    ? 'var(--dashboard-success)' 
                    : 'var(--dashboard-danger)'
                }}
              >
                {formatCurrency(category.averageAmount)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MiniCategoryCards;
