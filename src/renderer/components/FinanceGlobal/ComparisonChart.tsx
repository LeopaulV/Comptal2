import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { MonthlyStats } from '../../types/Transaction';
import { formatCurrency } from '../../utils/format';

interface ComparisonChartProps {
  data: MonthlyStats[];
}

const ComparisonChart: React.FC<ComparisonChartProps> = ({ data }) => {
  const chartData = data.map(stat => ({
    month: stat.month,
    revenus: stat.income,
    dépenses: stat.expenses,
    net: stat.net,
  }));

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
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
          <Bar dataKey="revenus" fill="#10b981" name="Revenus" />
          <Bar dataKey="dépenses" fill="#ef4444" name="Dépenses" />
          <Bar dataKey="net" fill="#0ea5e9" name="Net" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ComparisonChart;

