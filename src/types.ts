import { SMA } from "technicalindicators";

export type CSVData = {Symbol: string, Quantity: number};
export type Resolution = '1Sec' | '1Min' | '1Hour' | '1Day';
export interface TrackedStock {
    ticker: string;
    tradeAmt: number;
    smaResolution: Resolution;
    smaLargeVal: number;
    smaSmallVal: number;
    smaSmall: SMA;
    smaLarge: SMA;
    lastOrder: 'BUY' | 'SELL';
}
export interface Trade {
    ticker: string;
    tradeAmt: number;
    price: number;
    date: Date;
    side: 'BOUGHT' | 'SOLD';
}
