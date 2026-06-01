'use client';

import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface PnlChartProps {
  trades: any[];
}

interface TradeDetail {
  ticker: string;
  profit: number;
  type: string;
  direction: string;
  contracts: number;
  price: number;
}

export default function PnlChart({ trades }: PnlChartProps) {
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    if (!trades || trades.length === 0) { setChartData(null); return; }

    const sorted = [...trades].sort((a, b) => a.Date.getTime() - b.Date.getTime());
    const firstDate = new Date(sorted[0].Date);
    const startTs = new Date(firstDate.setDate(firstDate.getDate() - 1)).getTime();

    const points: { x: number; y: number; trades: TradeDetail[] }[] = [{ x: startTs, y: 0, trades: [] }];
    let cum = 0;

    sorted.forEach(trade => {
      cum += trade.Realized_Profit;
      const last = points[points.length - 1];
      const detail: TradeDetail = {
        ticker: trade.Ticker,
        profit: trade.Realized_Profit,
        type: trade.Type,
        direction: trade.Direction,
        contracts: trade.Contracts,
        price: trade.Average_Price,
      };
      if (last && last.x === trade.Date.getTime()) {
        last.y = cum;
        last.trades.push(detail);
      } else {
        points.push({ x: trade.Date.getTime(), y: cum, trades: [detail] });
      }
    });

    setChartData({
      datasets: [{
        label: 'Cumulative PNL',
        data: points,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.1,
      }],
    });
  }, [trades]);

  if (!chartData) return <div className="text-center text-gray-500 py-8">No trade data available</div>;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { type: 'time' as const, time: { unit: 'day' as const }, title: { display: true, text: 'Date' } },
      y: {
        title: { display: true, text: 'Cumulative PNL ($)' },
        ticks: {
          callback: (v: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v),
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items: any[]) => new Date(items[0].parsed.x).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          label: (item: any) => {
            const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);
            const lines = [`Cumulative PNL: ${fmt(item.parsed.y)}`];
            const pt = item.raw as { trades: TradeDetail[] };
            if (pt.trades?.length) {
              lines.push('', 'Trades:');
              pt.trades.forEach(t => lines.push(`  ${t.ticker} (${t.direction}): ${fmt(t.profit)}`));
            }
            return lines;
          },
        },
      },
    },
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <div style={{ height: '400px' }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
