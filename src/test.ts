import { AlpacaClient } from '@master-chief/alpaca'

const client = new AlpacaClient({
  credentials: {
    key: 'PKAL6W4HFXCE543HFU8X',
    secret: 'mBJgBHOuMepzQEisZvFdgKNSPIkNYpGhqs0IJfBF',
  },
})
const endDate = new Date(Date.now() - 3.6e6);

client
  .getBars({
        end: endDate,
        start: new Date(endDate.getTime() - 4.32e8),
        symbol: 'AAPL',
        timeframe: "1Min"
    })
  .then((assets) => console.log(assets))
  .catch((err) => console.error(err));