'use client';

import React, { useState } from 'react';
import { MatchedTrade } from '@/utils/processData';

interface RiskAdjustedReturnsProps {
  matchedTrades: MatchedTrade[];
}

interface RiskMetrics {
  totalReturn: number;
  standardDeviation: number;
  annualizedSharpe: number;
  tradingDays: number;
  avgDailyReturn: number;
  annualizedReturn: number;
  annualizedVolatility: number;
  initialCapital: number;
}

const calculateRiskMetrics = (matchedTrades: MatchedTrade[], initialCapital: number): RiskMetrics => {
  if (matchedTrades.length === 0 || initialCapital <= 0) {
    return { totalReturn: 0, standardDeviation: 0, annualizedSharpe: 0, tradingDays: 0, avgDailyReturn: 0, annualizedReturn: 0, annualizedVolatility: 0, initialCapital };
  }

  const startDate = new Date(Math.min(...matchedTrades.map(t => t.Entry_Date.getTime())));
  const endDate = new Date(Math.max(...matchedTrades.map(t => t.Exit_Date.getTime())));

  const portfolioValues: { [key: string]: number } = {};
  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate <= endDate) {
    const key = currentDate.toISOString().split('T')[0];
    portfolioValues[key] = initialCapital;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  let runningPnl = 0;
  const sortedTrades = [...matchedTrades].sort((a, b) => a.Exit_Date.getTime() - b.Exit_Date.getTime());

  sortedTrades.forEach(trade => {
    const exitKey = trade.Exit_Date.toISOString().split('T')[0];
    runningPnl += trade.Net_Profit;
    const exitIndex = Object.keys(portfolioValues).indexOf(exitKey);
    if (exitIndex >= 0) {
      Object.keys(portfolioValues).slice(exitIndex).forEach(k => {
        portfolioValues[k] = initialCapital + runningPnl;
      });
    }
  });

  const values = Object.values(portfolioValues);
  const dailyReturns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) dailyReturns.push((values[i] - values[i - 1]) / values[i - 1]);
  }

  const avgDailyReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const variance = dailyReturns.length > 1
    ? dailyReturns.reduce((acc, r) => acc + Math.pow(r - avgDailyReturn, 2), 0) / (dailyReturns.length - 1)
    : 0;
  const stdDev = Math.sqrt(variance);
  const annualizedReturn = avgDailyReturn * 252;
  const annualizedVolatility = stdDev * Math.sqrt(252);
  const annualizedSharpe = annualizedVolatility > 0 ? annualizedReturn / annualizedVolatility : 0;
  const totalReturn = (values[values.length - 1] - initialCapital) / initialCapital;

  return { totalReturn, standardDeviation: stdDev, annualizedSharpe, tradingDays: dailyReturns.length, avgDailyReturn, annualizedReturn, annualizedVolatility, initialCapital };
};

export default function RiskAdjustedReturns({ matchedTrades }: RiskAdjustedReturnsProps) {
  const [capitalInput, setCapitalInput] = useState('1000');
  const [capital, setCapital] = useState(1000);

  const metrics = calculateRiskMetrics(matchedTrades, capital);

  const fmt% = (v: number) => new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  const fmt2 = (v: number) => v.toFixed(2);

  const MetricCard = ({ title, value, tooltip, highlight = false }: { title: string; value: string; tooltip: string; highlight?: boolean }) => (
    <div className={`bg-white shadow rounded-lg p-4 relative group ${highlight ? 'border-l-4 border-blue-500' : ''}`}>
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded p-2 z-10 w-64 -top-2 left-1/2 transform -translate-x-1/2 -translate-y-full">
        {tooltip}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-800"></div>
      </div>
    </div>
  );

  return (
    <div className="mt-6">
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-xl font-semibold">Risk-Adjusted Returns</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Initial Capital ($):</label>
          <input
            type="number"
            value={capitalInput}
            onChange={e => setCapitalInput(e.target.value)}
            onBlur={() => {
              const v = parseFloat(capitalInput);
              if (!isNaN(v) && v > 0) setCapital(v);
            }}
            className="border border-gray-300 rounded px-2 py-1 w-28 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Sharpe Ratio" value={fmt2(metrics.annualizedSharpe)} tooltip="Annualized Sharpe ratio (return / volatility, 252 trading days). &gt;1 is good, &gt;2 is great." highlight />
        <MetricCard title="Total Return" value={fmt%(metrics.totalReturn)} tooltip="Total portfolio return over the trading period based on your initial capital." />
        <MetricCard title="Annualized Return" value={fmt%(metrics.annualizedReturn)} tooltip="Average daily return scaled to 252 trading days." />
        <MetricCard title="Annualized Volatility" value={fmt%(metrics.annualizedVolatility)} tooltip="Standard deviation of daily returns scaled to 252 trading days." />
        <MetricCard title="Avg Daily Return" value={fmt%(metrics.avgDailyReturn)} tooltip="Average daily portfolio return across all trading days." />
        <MetricCard title="Daily Volatility" value={fmt%(metrics.standardDeviation)} tooltip="Standard deviation of daily portfolio returns." />
        <MetricCard title="Trading Days" value={String(metrics.tradingDays)} tooltip="Number of calendar days between your first and last trade." />
        <MetricCard title="Capital Used" value={`$${capital.toLocaleString()}`} tooltip="The initial capital figure used to calculate portfolio returns. Adjust this to match your actual starting balance." />
      </div>
    </div>
  );
}
