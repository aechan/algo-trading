import { AlpacaClient, AlpacaStream, Bar } from '@master-chief/alpaca'
import { SMA } from "technicalindicators";
import parse from "csv-parse/lib/sync";
import fs from "fs";
import { CSVData, Resolution, TrackedStock, Trade } from "./types";
import dotenv from "dotenv";
import express from "express";
import path from "path";

const app = express();
dotenv.config();
const trades: Trade[] = [
];

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
const SMA_SMALL = parseFloat(process.env.SMA_SMALL || "") || 3;
const SMA_LARGE = parseFloat(process.env.SMA_LARGE || "") || 5;

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
    const endDate = new Date(getCurrentTime().getTime()-3.6e6);
    const initialData = await alpaca.getBars({
        end: endDate,
        start: new Date(endDate.getTime() - getMsForResolution(smaLargeVal, resolution)),
        symbol: tickerName,
        timeframe: resolution
    });
    const closeValues = initialData.bars.map((bar) => bar.c);

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

const buy = async (stock: TrackedStock, bar: Bar) => {
    const order = await alpaca.placeOrder({
        symbol: stock.ticker,
        qty: stock.tradeAmt,
        side: 'buy',
        type: 'market',
        time_in_force: 'day'
    });
    stock.lastOrder = 'BUY';
    console.log(`[${getCurrentTime().toISOString()}] BOUGHT ${stock.tradeAmt} ${stock.ticker}`);
    trades.push({
        ticker: stock.ticker,
        side: 'BOUGHT',
        date: new Date(),
        price: bar.c,
        tradeAmt: stock.tradeAmt
    });
};

const sell = async (stock: TrackedStock, bar: Bar) => {
    const order = await alpaca.placeOrder({
        symbol: stock.ticker,
        qty: stock.tradeAmt,
        side: 'sell',
        type: 'market',
        time_in_force: 'day'
    });
    stock.lastOrder = 'SELL';
    console.log(`[${getCurrentTime().toISOString()}] SOLD ${stock.tradeAmt} ${stock.ticker}`);
    trades.push({
        ticker: stock.ticker,
        side: 'SOLD',
        date: new Date(),
        price: bar.c,
        tradeAmt: stock.tradeAmt
    });
};

const runModel = async (stock: TrackedStock, bar: Bar) => {
    const clock = await alpaca.getClock();
    if (!clock.is_open) {
        return;
    }
    const nextValue = bar.c;
    const nextSmall = stock.smaSmall.nextValue(nextValue);
    const nextLarge = stock.smaLarge.nextValue(nextValue);
    if (!nextSmall || !nextLarge) {
        return;
    }

    if (nextSmall > nextLarge && stock.lastOrder !== 'BUY') {
        await buy(stock, bar);
    } else if (nextSmall < nextLarge && stock.lastOrder !== 'SELL') {
        await sell(stock, bar);
    }
};

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
    
    console.log(`[INFO] Starting sytem from date ${new Date().toLocaleString()}`);
    const stocks = await initializeData();

    app.use(express.static(path.join(__dirname, '..', 'public')));
    app.get('/trades', (req, res) => {
        res.json(trades);
    });

    app.get('/stocks', (req, res) => {
        res.json(stocks);
    });

    app.get('/value', async (req, res) => {
        const val = await alpaca.getAccount();
        
        res.json({
            equity: val.equity,
            buying_power: val.buying_power,
            gain_loss_pct: ((val.equity-100000)/100000)*100
        });
    });
    
    app.get('/hours', async (req, res) => {
        const clock = await alpaca.getClock();

        res.json({
            currently_open: clock.is_open,
            reopening_at: clock.next_open,
            closing_at: clock.next_close
        });
    });
    const port = process.env.PORT || 8080;
    app.listen(port, () => {
        console.log(`app listening at http://localhost:${port}`)
    });
    subscribeToTrades(stocks);
    const stream = new AlpacaStream({
        credentials: {
          key: process.env.ALPACA_KEY as string,
          secret: process.env.ALPACA_SECRET as string,
          paper: true,
        },
        type: 'market_data', // or "account"
        source: 'iex', // or "sip" depending on your subscription
    });
    stream.once('authenticated', () => {
        stream.subscribe('bars', stocks.map(s => s.ticker));
        stream.on('bar', (bar) => {
            const found = stocks.find((s) => s.ticker.toLowerCase() === bar.S.toLowerCase());
            if (!found) {
                return;
            }
            runModel(found, bar);
        });
    });
}

main().catch(err => console.error(err));