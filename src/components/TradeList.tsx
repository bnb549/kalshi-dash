'use client';

import React from 'react';
import { MatchedTrade } from '@/utils/processData';

interface TradeListProps {
  trades: MatchedTrade[];
}

export default function TradeList({ trades }: TradeListProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);

  const formatPercent = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);

  const sorted = [...trades].sort((a, b) => b.Exit_Date.getTime() - a.Exit_Date.getTime());

  if (sorted.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold mb-4">Trade History</h2>
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Ticker','Direction','Contracts','Entry','Exit','Entry Price','Exit Price','Fees','Net P&L','ROI','Hold (days)','Exit Type'].map(h => (
                  <th key={h} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sorted.map((trade, i) => {
                const roi = trade.Entry_Cost > 0 ? trade.Net_Profit / trade.Entry_Cost : 0;
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{trade.Ticker}</td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${trade.Entry_Direction === 'Yes' ? 'text-green-600' : 'text-red-600'}`}>{trade.Entry_Direction}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{trade.Contracts}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(trade.Entry_Date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(trade.Exit_Date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{(trade.Entry_Price / 100).toFixed(2)}¢</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{(trade.Exit_Price / 100).toFixed(2)}¢</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-red-500">{formatCurrency(trade.Total_Fees)}</td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${trade.Net_Profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(trade.Net_Profit)}</td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(roi)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{trade.Holding_Period_Days.toFixed(1)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 capitalize">{trade.Exit_Type}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
