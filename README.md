# Kalshi Dashboard

A performance tracker for Kalshi traders that helps visualize PNL over time and analyse trading statistics

## Project Overview

This dashboard allows Kalshi traders to:
- Upload transaction CSV files from their Kalshi account
- Visualize profit/loss over time
- Analyze trading statistics
- See breakdowns by trade direction (Yes/No) and settlement types
- Track performance metrics for better trading decisions

All processing happens client-side, so your data remains private.

## Technologies

- Next.js 14
- React with TypeScript
- Tailwind CSS
- Chart.js (for data visualization)
- Papa Parse (for CSV parsing)

## Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/bnb549/kalshi-dash.git
   cd kalshi-dash
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Download your transaction CSV files from Kalshi (from the [Documents](https://kalshi.com/account/taxes) section in the Desktop site)
2. Upload the files
3. View your trading analytics and performance metrics
