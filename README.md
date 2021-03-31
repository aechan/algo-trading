## Example
https://algo-trading.azurewebsites.net/

## Setup

### Install packages:

```bash
npm install
```

### Setup data file:

`data/data.csv` is a csv file with a list of stock symbols and the corresponding quantities at which we are going to trade them. Whenever our model triggers a buy or sell event, an order will be placed to buy or sell the given quantity at market price.

### Setup env vars:

This script uses dotenv to load variables into `process.env`. Create a `.env` file at the project root and populate it with:

```
ALPACA_KEY="your key"
ALPACA_SECRET="your secret"
# optional
SMA_LARGE=50
SMA_SMALL=20
RESOLUTION=1Min
```

This `.env` file sets up our Alpaca authentication as well as the small and large time values to compare for our Simple Moving Average (SMA) model and the time resolution (`1Min | 1Hour | 1Day`). So here we are going to compare the SMA for the last 20 minutes vs the last 50 minutes for each given stock.

## Model

Currently this script only uses the Simple Moving Average (SMA) indicator in our model. We compare the SMA of two configurable time periods and watch for crossovers to determine when to trigger buy or sell orders.

<img src="https://cdn-amiji.nitrocdn.com/IEZIUgrNRbYQggDlmHBLkLYuABZyJyOL/assets/static/optimized/rev-2999a43/wp-content/uploads/technical-analysis/MASimple50200SPY.gif">
