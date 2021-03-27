import { AlpacaClient, AlpacaStream } from '@master-chief/alpaca'
import { SMA } from "technicalindicators";
import parse from "csv-parse/lib/sync";
import fs from "fs";
import { CSVData, Resolution, TrackedStock } from "./types";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.ALPACA_KEY || !process.env.ALPACA_SECRET) {
    console.error("Alpaca keys are not set in .env. Aborting!");
    process.exit(-1);
}

const alpaca = new AlpacaClient({
    credentials: {
        key: process.env.ALPACA_KEY as string,
        secret: process.env.ALPACA_SECRET as string,
        paper: true,
    },
    rate_limit: true,
});

// configurable constants
const RESOLUTION: Resolution = process.env.RESOLUTION as Resolution || "1Min";
const SMA_SMALL = process.env.SMA_SMALL || 20;
const SMA_LARGE = process.env.SMA_LARGE || 50;

const getCurrentTime = () => {
    return new Date();
}

const getMsForResolution = (smaLarge: number, resolution: Resolution) => {
    if (resolution === "1Day") {
        return smaLarge * 8.64e7;
    } else if (resolution === "1Hour") {
        return smaLarge * 3.6e6;
    } else if (resolution === "1Min") {
        return smaLarge * 1000 * 60;
    } else {// (resolution === "1Sec") {
        return smaLarge * 1000;
    }
}
const initializeAverages = async (tickerName: string, resolution: Resolution, smaLargeVal: number, smaSmallVal: number) => {
    const endDate = getCurrentTime();
    const initialData = await alpaca.getBars({
        end: endDate,
        start: new Date(endDate.getTime() - getMsForResolution(smaLargeVal, resolution)),
        symbol: tickerName,
        timeframe: resolution
    });
    const closeValues = initialData.bars.map((bar) => bar.c));

    const smaSmall = new SMA({ period: smaSmallVal, values: closeValues });
    const smaLarge = new SMA({ period: smaLargeVal, values: closeValues });
    return [smaSmall, smaLarge];
};

const initializeData = async () => {
    // load ticker data
    const tickerData: CSVData[] = [];
    try {
        const csvData = fs.readFileSync('./data/data.csv', 'utf8');
        const records = parse(csvData, {
            columns: true,
            skip_empty_lines: true
        });
        for (const record of records) {
            tickerData.push({Symbol: record.Symbol, Quantity: parseInt(record.Quantity)})
        }
    } catch (err) {
        console.error("Failed to parse CSV data. Aborting.");
        console.error(err);
        process.exit(-1);
    }
    
    const stocks: TrackedStock[] = [];
    for (const data of tickerData) {
        const [smaSmall, smaLarge] = await initializeAverages(data.Symbol, RESOLUTION, SMA_LARGE, SMA_SMALL);
        stocks.push({
            ticker: data.Symbol,
            tradeAmt: data.Quantity,
            smaLargeVal: SMA_LARGE,
            smaSmallVal: SMA_SMALL,
            smaResolution: RESOLUTION,
            smaSmall,
            smaLarge,
            lastOrder: 'SELL'
        });
        console.log(`[${new Date().toISOString()}] Initialized ${data.Symbol}, Quantity ${data.Quantity}, smaSmall ${SMA_SMALL}, smaLarge ${SMA_LARGE}`);
    }

    return stocks;
};

const buy = async (stock: TrackedStock) => {
    const order = await alpaca.placeOrder({
        symbol: stock.ticker,
        qty: stock.tradeAmt,
        side: 'buy',
        type: 'market',
        time_in_force: 'day'
    });
    stock.lastOrder = 'BUY';
    console.log(`[${getCurrentTime().toISOString()}] BOUGHT ${stock.tradeAmt} ${stock.ticker}`);
};

const sell = async (stock: TrackedStock) => {
    const order = await alpaca.placeOrder({
        symbol: stock.ticker,
        qty: stock.tradeAmt,
        side: 'sell',
        type: 'market',
        time_in_force: 'day'
    });
    stock.lastOrder = 'SELL';
    console.log(`[${getCurrentTime().toISOString()}] SOLD ${stock.tradeAmt} ${stock.ticker}`);
};

const subscribeToAggUpdates = (stock: TrackedStock, freq: number, resolution: Resolution) => {
    console.log(`[INFO] Subscribing to ${freq} * ${resolution} updates for ${stock.ticker}`);
    setInterval(async () => {
        try {
            // for testing end date needs to be 1 hr ago
            const endDate = getCurrentTime();
            const data = await alpaca.getBars({
                end: endDate,
                start: new Date(endDate.getTime() - 15000),
                symbol: stock.ticker,
                timeframe: stock.smaResolution
            });
            if (data.bars.length === 0) {
                return;
            }
            const nextValue = data.bars[0].c;
            const nextSmall = stock.smaSmall.nextValue(nextValue);
            const nextLarge = stock.smaLarge.nextValue(nextValue);
            if (!nextSmall || !nextLarge) {
                return;
            }

            if (nextSmall > nextLarge && stock.lastOrder !== 'BUY') {
                await buy(stock);
            } else if (nextSmall < nextLarge && stock.lastOrder !== 'SELL') {
                await sell(stock);
            }
        } catch (err) {
            console.error(err);
        }

    }, getMsForResolution(freq, resolution));
    
}

const subscribeToTrades = (stocks: TrackedStock[]) => {
    const stream = new AlpacaStream({
        credentials: {
          key: process.env.ALPACA_KEY as string,
          secret: process.env.ALPACA_SECRET as string,
          paper: true,
        },
        type: 'account', // or "account"
        source: 'iex', // or "sip" depending on your subscription
      });
    
    stream.once('authenticated', () => {
        stream.subscribe('trades', stocks.map((s) => s.ticker));
        stream.on('trade_updates', (trade) => console.log(`[${new Date(trade.timestamp).toISOString()}] ${trade.event} ${trade.position_qty} ${trade.order.symbol} @ ${trade.price}`));
    });
}

async function main() {
    const clock = await alpaca.getClock();
    if (!clock.is_open) {
        console.log(`[ERROR] Markets are currently closed. Aborting.`);
        process.exit(-1);
    }
    console.log(`[INFO] Starting sytem from date ${new Date().toLocaleString()}`);
    const stocks = await initializeData();
    subscribeToTrades(stocks);
    for (const stock of stocks) {
        subscribeToAggUpdates(stock, 30, "1Sec");
    }
}

main().catch(err => console.error(err));