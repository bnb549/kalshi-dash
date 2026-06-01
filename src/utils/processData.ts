import { parse } from 'papaparse';
import { toDate } from 'date-fns-tz';

// ============ CSV FORMAT DETECTION ============

export type CsvFormat = 'legacy' | 'new';

// New format columns (2025+)
const NEW_FORMAT_COLUMNS = ['type', 'quantity', 'market_ticker', 'side', 'entry_price_cents', 'exit_price_cents', 'open_fees_cents', 'close_fees_cents', 'realized_pnl_without_fees_cents', 'realized_pnl_with_fees_cents', 'close_timestamp', 'open_timestamp'];

// Legacy format columns
const LEGACY_FORMAT_COLUMNS = ['Ticker', 'Type', 'Direction', 'Contracts', 'Average_Price', 'Created'];

export const detectCsvFormat = (headers: string[]): CsvFormat => {
  const hasNewFormat = NEW_FORMAT_COLUMNS.every(col => headers.includes(col));
  if (hasNewFormat) return 'new';
  const hasLegacyFormat = LEGACY_FORMAT_COLUMNS.every(col => headers.includes(col));
  if (hasLegacyFormat) return 'legacy';
  throw new Error(`Unrecognized CSV format. Expected columns for either new format (${NEW_FORMAT_COLUMNS.slice(0, 3).join(', ')}...) or legacy format (${LEGACY_FORMAT_COLUMNS.join(', ')})`);
};

// ============ INTERFACES ============

export interface Trade {
  Ticker: string;
  Type: string;
  Direction: string;
  Contracts: number;
  Average_Price: number;
  Realized_Revenue: number;
  Realized_Cost: number;
  Realized_Profit: number;
  Fees: number;
  Created: string;
  Date: Date;
  Trade_Cost: number;
}

export interface MatchedTrade {
  Ticker: string;
  Entry_Date: Date;
  Exit_Date: Date;
  Entry_Direction: string;
  Exit_Type: string;
  Contracts: number;
  Entry_Cost: number;
  Realized_Profit: number;
  Net_Profit: number;
  Holding_Period_Days: number;
  ROI?: number;
  Entry_Fee: number;
  Exit_Fee: number;
  Total_Fees: number;
  Entry_Price: number;
  Exit_Price: number;
}

interface Position {
  ticker: string;
  direction: string;
  contracts: number;
  avg_price: number;
  entry_date: Date;
  entry_fee: number;
  cost: number;
  is_closed: boolean;
}

export interface ProcessedData {
  originalData: any[];
  trades: Trade[];
  matchedTrades: MatchedTrade[];
  basicStats: {
    uniqueTickers: number;
    totalTrades: number;
    yesNoBreakdown: { Yes: number; No: number };
    totalFees: number;
    totalProfit: number;
    avgContractPurchasePrice: number;
    avgContractFinalPrice: number;
    weightedHoldingPeriod: number;
    winRate: number;
    settledWinRate: number;
  };
}

export interface TickerComponents {
  series: string;
  event: string;
  market: string;
}

export interface SeriesStats {
  series: string;
  pnl: number;
  eventsTraded: Set<string>;
  marketsTraded: Set<string>;
  totalCost: number;
  tradesCount: number;
  winCount: number;
}

// ============ TICKER/SERIES UTILITIES ============

export const parseTickerComponents = (ticker: string): TickerComponents => {
  const parts = ticker.split('-');
  if (parts.length >= 3) return { series: parts[0], event: parts[1], market: parts.slice(2).join('-') };
  if (parts.length === 2) return { series: parts[0], event: '', market: parts[1] };
  return { series: ticker, event: '', market: '' };
};

export const calculateSeriesStatsFromMatched = (matchedTrades: MatchedTrade[]): Map<string, SeriesStats> => {
  const seriesMap = new Map<string, SeriesStats>();
  matchedTrades.forEach(trade => {
    const { series, event, market } = parseTickerComponents(trade.Ticker);
    if (!seriesMap.has(series)) {
      seriesMap.set(series, { series, pnl: 0, eventsTraded: new Set(), marketsTraded: new Set(), totalCost: 0, tradesCount: 0, winCount: 0 });
    }
    const stats = seriesMap.get(series)!;
    stats.pnl += trade.Net_Profit;
    if (event) stats.eventsTraded.add(event);
    if (market) stats.marketsTraded.add(market);
    stats.totalCost += trade.Entry_Cost;
    stats.tradesCount++;
    if (trade.Net_Profit > 0) stats.winCount++;
  });
  return seriesMap;
};

export const calculateSeriesStats = (trades: Trade[]): Map<string, SeriesStats> => {
  const seriesMap = new Map<string, SeriesStats>();
  trades.forEach(trade => {
    const { series, event, market } = parseTickerComponents(trade.Ticker);
    if (!seriesMap.has(series)) {
      seriesMap.set(series, { series, pnl: 0, eventsTraded: new Set(), marketsTraded: new Set(), totalCost: 0, tradesCount: 0, winCount: 0 });
    }
    const stats = seriesMap.get(series)!;
    stats.pnl += trade.Realized_Profit;
    if (event) stats.eventsTraded.add(event);
    if (market) stats.marketsTraded.add(market);
    if (trade.Type === 'settlement' || trade.Realized_Revenue > 0) {
      if (trade.Type === 'settlement') stats.totalCost += Math.abs(trade.Realized_Cost);
      else stats.totalCost += Math.abs(trade.Realized_Cost) - (trade.Average_Price * trade.Realized_Revenue / 100);
      stats.tradesCount++;
      if (trade.Realized_Profit > 0) stats.winCount++;
    }
  });
  return seriesMap;
};

export const filterTradesBySeries = (trades: Trade[], series: string): Trade[] =>
  trades.filter(trade => parseTickerComponents(trade.Ticker).series === series);

// ============ DATE PARSING ============

const parseDate = (dateStr: string): Date => {
  try {
    const kalshiPattern = /(\w+ \d+, \d+) at (\d+:\d+) ?([AP]M) ([A-Z]{2,4})/i;
    const kalshiMatch = dateStr.match(kalshiPattern);
    if (kalshiMatch) {
      const timezoneOffsets: Record<string, string> = {
        'PST': '-08:00', 'PDT': '-07:00', 'PT': '-08:00',
        'MST': '-07:00', 'MDT': '-06:00', 'MT': '-07:00',
        'CST': '-06:00', 'CDT': '-05:00', 'CT': '-06:00',
        'EST': '-05:00', 'EDT': '-04:00', 'ET': '-05:00',
        'AKST': '-09:00', 'AKDT': '-08:00', 'AKT': '-09:00',
        'HST': '-10:00', 'HDT': '-09:00', 'HT': '-10:00',
        'AST': '-04:00', 'ADT': '-03:00', 'AT': '-04:00',
        'UTC': '+00:00', 'GMT': '+00:00', 'Z': '+00:00',
      };
      const [, datePart, timeStr, ampm, timeZone] = kalshiMatch;
      const offset = timezoneOffsets[timeZone.toUpperCase()] || '-08:00';
      const dateMatch = datePart.match(/(\w+) (\d+), (\d+)/);
      if (dateMatch) {
        const [, monthName, day, year] = dateMatch;
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const monthIndex = monthNames.indexOf(monthName);
        if (monthIndex !== -1) {
          const month = String(monthIndex + 1).padStart(2, '0');
          const dayPadded = day.padStart(2, '0');
          const [hours, minutes] = timeStr.split(':');
          let hour24 = parseInt(hours);
          if (ampm.toUpperCase() === 'PM' && hour24 !== 12) hour24 += 12;
          else if (ampm.toUpperCase() === 'AM' && hour24 === 12) hour24 = 0;
          const isoFormat = `${year}-${month}-${dayPadded}T${String(hour24).padStart(2,'0')}:${minutes}:00${offset}`;
          const parsed = toDate(isoFormat);
          if (!isNaN(parsed.getTime())) return parsed;
        }
      }
    }
    const fallback = new Date(dateStr);
    if (!isNaN(fallback.getTime())) return fallback;
    console.error('Failed to parse date:', dateStr);
    return new Date();
  } catch (error) {
    console.error('Error parsing date:', dateStr, error);
    return new Date();
  }
};

// ============ TRADE COST CALCULATION ============

const calculateTradeCost = (row: Trade): number => {
  if (row.Type === 'settlement' || (row.Type === 'trade' && row.Realized_Profit !== 0)) {
    return Math.abs(row.Realized_Cost);
  } else if (row.Type === 'trade' && row.Realized_Profit === 0) {
    return row.Contracts * (row.Average_Price / 100);
  }
  return 0;
};

// ============ FIFO MATCHING ============

const matchTradesFifo = (trades: Trade[]): MatchedTrade[] => {
  const sorted = [...trades].sort((a, b) => a.Date.getTime() - b.Date.getTime());
  sorted.forEach(t => { t.Trade_Cost = calculateTradeCost(t); });

  const openPositions: Record<string, Position[]> = {};
  const completed: MatchedTrade[] = [];

  sorted.forEach(trade => {
    const key = `${trade.Ticker}-${trade.Direction}`;
    if (!openPositions[key]) openPositions[key] = [];

    const isEntry = trade.Type === 'trade' && trade.Realized_Profit === 0 && trade.Realized_Revenue === 0;
    const isExit = trade.Type === 'settlement' || (trade.Type === 'trade' && (trade.Realized_Profit !== 0 || trade.Realized_Revenue !== 0));

    if (isEntry) {
      openPositions[key].push({
        ticker: trade.Ticker,
        direction: trade.Direction,
        contracts: trade.Contracts,
        avg_price: trade.Average_Price,
        entry_date: trade.Date,
        entry_fee: trade.Fees,
        cost: trade.Trade_Cost,
        is_closed: false,
      });
    } else if (isExit && openPositions[key].length > 0) {
      let remaining = trade.Contracts;
      const exitPrice = trade.Type === 'settlement'
        ? (trade.Realized_Revenue > 0 ? 100 : 0)
        : Math.round((trade.Realized_Revenue / trade.Contracts) * 100);

      while (remaining > 0 && openPositions[key].length > 0) {
        const pos = openPositions[key][0];
        const matchQty = Math.min(remaining, pos.contracts);
        const entryCost = (matchQty / pos.contracts) * pos.cost;
        const entryFee = (matchQty / pos.contracts) * pos.entry_fee;
        const exitFee = trade.Fees > 0 ? (matchQty / trade.Contracts) * trade.Fees : 0;
        const totalFees = entryFee + exitFee;

        let realizedProfit: number;
        let netProfit: number;
        if (trade.Type === 'settlement') {
          realizedProfit = trade.Realized_Revenue > 0 ? matchQty - entryCost : -entryCost;
          netProfit = realizedProfit - totalFees;
        } else {
          const proratedProfit = (matchQty / trade.Contracts) * trade.Realized_Profit;
          netProfit = proratedProfit;
          realizedProfit = netProfit + totalFees;
        }

        const holdDays = (trade.Date.getTime() - pos.entry_date.getTime()) / (24 * 3600 * 1000);

        completed.push({
          Ticker: trade.Ticker,
          Entry_Date: pos.entry_date,
          Exit_Date: trade.Date,
          Entry_Direction: trade.Direction,
          Exit_Type: trade.Type,
          Contracts: matchQty,
          Entry_Cost: entryCost,
          Realized_Profit: realizedProfit,
          Net_Profit: netProfit,
          Holding_Period_Days: holdDays,
          ROI: entryCost > 0 ? netProfit / entryCost : 0,
          Entry_Fee: entryFee,
          Exit_Fee: exitFee,
          Total_Fees: totalFees,
          Entry_Price: pos.avg_price,
          Exit_Price: exitPrice,
        });

        remaining -= matchQty;
        pos.contracts -= matchQty;
        if (pos.contracts <= 0) openPositions[key].shift();
      }
    }
  });

  return completed;
};

// ============ BASIC STATS (LEGACY) ============

const calculateBasicStats = (trades: Trade[], matchedTrades: MatchedTrade[]): ProcessedData['basicStats'] => {
  const exitTrades = trades.filter(t => t.Type === 'settlement' || (t.Type === 'trade' && t.Realized_Profit !== 0));
  const uniqueTickers = new Set(trades.map(t => t.Ticker)).size;

  const yesNoBreakdown = exitTrades.reduce((acc, t) => {
    acc[t.Direction] = (acc[t.Direction] || 0) + t.Contracts;
    return acc;
  }, {} as Record<string, number>);

  const totalFees = trades.reduce((s, t) => s + (t.Fees || 0), 0);
  const totalProfit = exitTrades.reduce((s, t) => s + t.Realized_Profit, 0);

  const allTrades = trades.filter(t => t.Type === 'trade');
  const entryTrades = allTrades.filter(t => t.Realized_Profit === 0 && t.Realized_Revenue === 0);
  const totalWeightedEntryPrice = entryTrades.reduce((s, t) => s + t.Average_Price * t.Contracts, 0);
  const totalEntryContracts = entryTrades.reduce((s, t) => s + t.Contracts, 0);
  const avgContractPurchasePrice = totalEntryContracts > 0 ? totalWeightedEntryPrice / totalEntryContracts : 0;

  const settledTrades = trades.filter(t => t.Type === 'settlement');
  const totalWeightedExitPrice = settledTrades.reduce((s, t) => s + (t.Realized_Revenue > 0 ? 100 : 0) * t.Contracts, 0);
  const totalExitContracts = settledTrades.reduce((s, t) => s + t.Contracts, 0);
  const avgContractFinalPrice = totalExitContracts > 0 ? totalWeightedExitPrice / totalExitContracts : 0;

  const totalTradeValue = matchedTrades.reduce((s, t) => s + t.Entry_Cost, 0);
  const weightedHoldingPeriod = totalTradeValue > 0
    ? matchedTrades.reduce((s, t) => s + t.Holding_Period_Days * t.Entry_Cost / totalTradeValue, 0)
    : 0;

  const profitable = matchedTrades.filter(t => t.Net_Profit > 0);
  const settled = matchedTrades.filter(t => t.Exit_Type === 'settlement');
  const profitableSettled = settled.filter(t => t.Net_Profit > 0);
  const winRate = matchedTrades.length > 0 ? profitable.length / matchedTrades.length : 0;
  const settledWinRate = settled.length > 0 ? profitableSettled.length / settled.length : 0;

  return {
    uniqueTickers,
    totalTrades: matchedTrades.length,
    yesNoBreakdown: { Yes: yesNoBreakdown['Yes'] || 0, No: yesNoBreakdown['No'] || 0 },
    totalFees,
    totalProfit,
    avgContractPurchasePrice,
    avgContractFinalPrice,
    weightedHoldingPeriod,
    winRate,
    settledWinRate,
  };
};

// ============ NEW FORMAT (2025+) ============

interface NewFormatRow {
  type: string;
  quantity: string;
  market_ticker: string;
  side: string;
  entry_price_cents: string;
  exit_price_cents: string;
  open_fees_cents: string;
  close_fees_cents: string;
  realized_pnl_without_fees_cents: string;
  realized_pnl_with_fees_cents: string;
  close_timestamp: string;
  open_timestamp: string;
}

const processNewFormat = (rawData: NewFormatRow[]): { trades: Trade[], matchedTrades: MatchedTrade[] } => {
  const trades: Trade[] = [];
  const matchedTrades: MatchedTrade[] = [];
  let skippedRows = 0;

  rawData.forEach((row, index) => {
    try {
      if (!row.market_ticker || row.type !== 'trade') return;
      if (!row.open_timestamp || !row.close_timestamp) { skippedRows++; return; }

      const quantity = parseInt(row.quantity) || 0;
      if (quantity === 0) return;

      const entryPrice = parseInt(row.entry_price_cents) || 0;
      const exitPrice = parseInt(row.exit_price_cents) || 0;
      const openFees = (parseInt(row.open_fees_cents) || 0) / 100;
      const closeFees = (parseInt(row.close_fees_cents) || 0) / 100;
      const pnlWithFees = (parseInt(row.realized_pnl_with_fees_cents) || 0) / 100;
      const pnlWithoutFees = (parseInt(row.realized_pnl_without_fees_cents) || 0) / 100;
      const totalFees = openFees + closeFees;

      const entryDate = new Date(row.open_timestamp);
      const exitDate = new Date(row.close_timestamp);

      if (isNaN(entryDate.getTime()) || isNaN(exitDate.getTime())) {
        skippedRows++;
        console.warn(`Skipping row ${index}: Invalid date`);
        return;
      }

      const side = row.side?.toLowerCase();
      if (side !== 'yes' && side !== 'no') { skippedRows++; return; }
      const direction = side === 'yes' ? 'Yes' : 'No';
      const exitType = (exitPrice === 0 || exitPrice === 100) ? 'settlement' : 'trade';
      const entryCost = (quantity * entryPrice) / 100;

      const trade: Trade = {
        Ticker: row.market_ticker,
        Type: exitType,
        Direction: direction,
        Contracts: quantity,
        Average_Price: entryPrice,
        Realized_Revenue: exitType === 'settlement' ? (exitPrice === 100 ? quantity : 0) : quantity,
        Realized_Cost: entryCost,
        Realized_Profit: pnlWithFees,
        Fees: totalFees,
        Created: row.close_timestamp,
        Date: exitDate,
        Trade_Cost: entryCost,
      };
      trades.push(trade);

      const holdingDays = (exitDate.getTime() - entryDate.getTime()) / (24 * 3600 * 1000);
      matchedTrades.push({
        Ticker: row.market_ticker,
        Entry_Date: entryDate,
        Exit_Date: exitDate,
        Entry_Direction: direction,
        Exit_Type: exitType,
        Contracts: quantity,
        Entry_Cost: entryCost,
        Realized_Profit: pnlWithoutFees,
        Net_Profit: pnlWithFees,
        Holding_Period_Days: holdingDays,
        ROI: entryCost > 0 ? pnlWithFees / entryCost : 0,
        Entry_Fee: openFees,
        Exit_Fee: closeFees,
        Total_Fees: totalFees,
        Entry_Price: entryPrice,
        Exit_Price: exitPrice,
      });
    } catch (error) {
      console.error('Error processing new format row:', row, error);
      skippedRows++;
    }
  });

  console.log(`New format: ${matchedTrades.length} trades processed, ${skippedRows} rows skipped`);
  return { trades, matchedTrades };
};

const calculateBasicStatsFromMatchedTrades = (matchedTrades: MatchedTrade[]): ProcessedData['basicStats'] => {
  const uniqueTickers = new Set(matchedTrades.map(t => t.Ticker)).size;
  const yesNoBreakdown = matchedTrades.reduce((acc, t) => {
    acc[t.Entry_Direction] = (acc[t.Entry_Direction] || 0) + t.Contracts;
    return acc;
  }, {} as Record<string, number>);

  const totalFees = matchedTrades.reduce((s, t) => s + t.Total_Fees, 0);
  const totalProfit = matchedTrades.reduce((s, t) => s + t.Net_Profit, 0);

  let totalWeightedEntryPrice = 0, totalWeightedExitPrice = 0, totalContracts = 0;
  matchedTrades.forEach(t => {
    totalWeightedEntryPrice += t.Entry_Price * t.Contracts;
    totalWeightedExitPrice += t.Exit_Price * t.Contracts;
    totalContracts += t.Contracts;
  });

  const avgContractPurchasePrice = totalContracts > 0 ? totalWeightedEntryPrice / totalContracts : 0;
  const avgContractFinalPrice = totalContracts > 0 ? totalWeightedExitPrice / totalContracts : 0;

  const totalTradeValue = matchedTrades.reduce((s, t) => s + t.Entry_Cost, 0);
  const weightedHoldingPeriod = totalTradeValue > 0
    ? matchedTrades.reduce((s, t) => s + t.Holding_Period_Days * t.Entry_Cost / totalTradeValue, 0)
    : 0;

  const profitable = matchedTrades.filter(t => t.Net_Profit > 0);
  const settled = matchedTrades.filter(t => t.Exit_Type === 'settlement');
  const profitableSettled = settled.filter(t => t.Net_Profit > 0);

  return {
    uniqueTickers,
    totalTrades: matchedTrades.length,
    yesNoBreakdown: { Yes: yesNoBreakdown['Yes'] || 0, No: yesNoBreakdown['No'] || 0 },
    totalFees,
    totalProfit,
    avgContractPurchasePrice,
    avgContractFinalPrice,
    weightedHoldingPeriod,
    winRate: matchedTrades.length > 0 ? profitable.length / matchedTrades.length : 0,
    settledWinRate: settled.length > 0 ? profitableSettled.length / settled.length : 0,
  };
};

// ============ LEGACY FORMAT PARSER ============

const processLegacyFormat = (rawData: any[]): { trades: Trade[], matchedTrades: MatchedTrade[] } => {
  const trades: Trade[] = rawData
    .filter(row => row && row.Ticker && row.Type !== 'credit')
    .map(row => {
      try {
        const cleanMoney = (val: string) => {
          if (!val) return 0;
          return parseFloat(val.replace('$', '').replace('+', '').trim()) || 0;
        };
        return {
          Ticker: row.Ticker,
          Type: row.Type,
          Direction: row.Direction,
          Contracts: parseFloat(row.Contracts) || 0,
          Average_Price: parseFloat(row.Average_Price) || 0,
          Realized_Revenue: cleanMoney(row.Realized_Revenue),
          Realized_Cost: cleanMoney(row.Realized_Cost),
          Realized_Profit: cleanMoney(row.Realized_Profit),
          Fees: row.Fees ? cleanMoney(row.Fees) : 0,
          Created: row.Created,
          Date: parseDate(row.Created),
          Trade_Cost: 0,
        } as Trade;
      } catch (e) {
        console.error('Error processing legacy row:', row, e);
        return null;
      }
    }).filter(Boolean) as Trade[];

  return { trades, matchedTrades: matchTradesFifo(trades) };
};

// ============ MAIN PROCESSING FUNCTION ============

export const processCSVData = (results: any): ProcessedData => {
  try {
    if (!results.data || !Array.isArray(results.data) || results.data.length === 0) {
      throw new Error('Invalid CSV format: No data found');
    }
    const headers = results.meta.fields || [];
    const format = detectCsvFormat(headers);
    const rawData = results.data as any[];
    console.log(`Detected CSV format: ${format}`);

    let trades: Trade[];
    let matchedTrades: MatchedTrade[];
    let basicStats: ProcessedData['basicStats'];

    if (format === 'new') {
      const processed = processNewFormat(rawData);
      trades = processed.trades;
      matchedTrades = processed.matchedTrades;
      basicStats = calculateBasicStatsFromMatchedTrades(matchedTrades);
    } else {
      const processed = processLegacyFormat(rawData);
      trades = processed.trades;
      matchedTrades = processed.matchedTrades;
      basicStats = calculateBasicStats(trades, matchedTrades);
    }

    if (trades.length === 0 && matchedTrades.length === 0) {
      throw new Error('No valid trades found in the CSV file');
    }

    return { originalData: rawData, trades, matchedTrades, basicStats };
  } catch (error) {
    console.error('Error processing CSV data:', error);
    throw error;
  }
};

export const combineProcessedData = (dataArray: ProcessedData[]): ProcessedData => {
  const allTrades = dataArray.reduce<Trade[]>((acc, d) => [...acc, ...d.trades], []);
  const allMatchedTrades = dataArray.reduce<MatchedTrade[]>((acc, d) => [...acc, ...d.matchedTrades], []);
  const sortedTrades = allTrades.sort((a, b) => a.Date.getTime() - b.Date.getTime());
  const sortedMatchedTrades = allMatchedTrades.sort((a, b) => a.Exit_Date.getTime() - b.Exit_Date.getTime());
  const basicStats = calculateBasicStatsFromMatchedTrades(sortedMatchedTrades);
  const originalData = dataArray.reduce<any[]>((acc, d) => [...acc, ...d.originalData], []);
  return { originalData, trades: sortedTrades, matchedTrades: sortedMatchedTrades, basicStats };
};
