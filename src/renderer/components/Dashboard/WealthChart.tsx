import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { MonthlyStats } from '../../types/Transaction';
import { formatCurrency } from '../../utils/format';

interface WealthChartProps {
  data: MonthlyStats[];
}

const WealthChart: React.FC<WealthChartProps> = ({ data }) => {
  const chartData = data.map(stat => ({
    month: stat.month,
    solde: stat.balance,
    revenus: stat.income,
    dépenses: stat.expenses,
  }));

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-600" />
          <XAxis 
            dataKey="month" 
            className="text-gray-600 dark:text-gray-400"
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            className="text-gray-600 dark:text-gray-400"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip 
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="solde" 
            stroke="#0ea5e9" 
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="Solde"
          />
          <Line 
            type="monotone" 
            dataKey="revenus" 
            stroke="#10b981" 
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Revenus"
          />
          <Line 
            type="monotone" 
            dataKey="dépenses" 
            stroke="#ef4444" 
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Dépenses"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WealthChart;

