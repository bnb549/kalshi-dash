'use client';

import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { MatchedTrade } from '@/utils/processData';

ChartJS.register(ArcElement, Tooltip, Legend);

interface MakerTakerPieProps {
  matchedTrades: MatchedTrade[];
}

export default function MakerTakerPie({ matchedTrades }: MakerTakerPieProps) {
  // Classify trades: entry fee > 0 means taker (crossed spread), entry fee = 0 means maker (provided liquidity)
  const takerCount = matchedTrades.filter(t => t.Entry_Fee > 0).length;
  const makerCount = matchedTrades.filter(t => t.Entry_Fee === 0).length;

  const takerFees = matchedTrades.filter(t => t.Entry_Fee > 0).reduce((sum, t) => sum + t.Total_Fees, 0);
  const makerFees = matchedTrades.filter(t => t.Entry_Fee === 0).reduce((sum, t) => sum + t.Total_Fees, 0);

  const data = {
    labels: ['Taker', 'Maker'],
    datasets: [
      {
        data: [takerCount, makerCount],
        backgroundColor: ['rgba(249, 115, 22, 0.7)', 'rgba(20, 184, 166, 0.7)'],
        borderColor: ['rgb(249, 115, 22)', 'rgb(20, 184, 166)'],
        borderWidth: 1,
      },
    ],
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h3 className="text-lg font-medium text-gray-700 mb-3 text-center">Maker / Taker</h3>
      <div className="h-48">
        <Pie data={data} options={{ maintainAspectRatio: false }} />
      </div>
      <div className="mt-2 text-sm text-gray-600 text-center">
        <span className="text-orange-500">Taker fees: {formatCurrency(takerFees)}</span> · <span className="text-teal-600">Maker fees: {formatCurrency(makerFees)}</span>
      </div>
    </div>
  );
}
