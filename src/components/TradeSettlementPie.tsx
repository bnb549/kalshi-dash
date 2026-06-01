'use client';

import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { MatchedTrade } from '@/utils/processData';

ChartJS.register(ArcElement, Tooltip, Legend);

interface TradeSettlementPieProps {
  matchedTrades: MatchedTrade[];
}

export default function TradeSettlementPie({ matchedTrades }: TradeSettlementPieProps) {
  const settlementCount = matchedTrades.filter(t => t.Exit_Type === 'settlement').length;
  const tradeCount = matchedTrades.filter(t => t.Exit_Type === 'trade').length;

  const data = {
    labels: ['Settlement', 'Trade Exit'],
    datasets: [
      {
        data: [settlementCount, tradeCount],
        backgroundColor: ['rgba(59, 130, 246, 0.7)', 'rgba(168, 85, 247, 0.7)'],
        borderColor: ['rgb(59, 130, 246)', 'rgb(168, 85, 247)'],
        borderWidth: 1,
      },
    ],
  };

  const total = settlementCount + tradeCount;
  const settlementPct = total > 0 ? ((settlementCount / total) * 100).toFixed(1) : '0';
  const tradePct = total > 0 ? ((tradeCount / total) * 100).toFixed(1) : '0';

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h3 className="text-lg font-medium text-gray-700 mb-3 text-center">Exit Type</h3>
      <div className="h-48">
        <Pie data={data} options={{ maintainAspectRatio: false }} />
      </div>
      <div className="mt-2 text-sm text-gray-600 text-center">
        <span className="text-blue-600">{settlementPct}% settled</span> · <span className="text-purple-600">{tradePct}% traded out</span>
      </div>
    </div>
  );
}
