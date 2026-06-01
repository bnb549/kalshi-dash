'use client';

import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface TradeDirectionPieProps {
  yesNoBreakdown: { Yes: number; No: number };
}

export default function TradeDirectionPie({ yesNoBreakdown }: TradeDirectionPieProps) {
  const data = {
    labels: ['Yes', 'No'],
    datasets: [
      {
        data: [yesNoBreakdown.Yes, yesNoBreakdown.No],
        backgroundColor: ['rgba(34, 197, 94, 0.7)', 'rgba(239, 68, 68, 0.7)'],
        borderColor: ['rgb(34, 197, 94)', 'rgb(239, 68, 68)'],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h3 className="text-lg font-medium text-gray-700 mb-3 text-center">Trade Direction</h3>
      <div className="h-48">
        <Pie data={data} options={{ maintainAspectRatio: false }} />
      </div>
    </div>
  );
}
