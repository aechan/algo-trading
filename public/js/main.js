(function main() {
    fetch('/stocks')
        .then((response) => response.json())
        .then((datas) => {
            for (const data of datas) {
                const text = document.createTextNode(`Symbol ${data.ticker}, Quantity ${data.tradeAmt}, smaSmall ${data.smaSmallVal}, smaLarge ${data.smaLargeVal}`);
                document.getElementById("tracked_stocks").appendChild(text);
                document.getElementById("tracked_stocks").appendChild(document.createElement('br'));
            }
        });
    setInterval(() => {
        fetch('/trades')
            .then((response) => response.json())
            .then((datas) => {
                document.getElementById("trades").innerHTML = "";
                for (const data of datas) {
                    const text = document.createTextNode(`[${new Date(data.date).toLocaleString()}]\t${data.side}\t${data.tradeAmt}\t${data.ticker}\t@ $${data.price}`);
                    document.getElementById("trades").prepend(document.createElement("br"));

                    document.getElementById("trades").prepend(text);
                }
            });

        fetch('/hours')
        .then((response) => response.json())
        .then((data) => {
            document.getElementById("open").innerHTML = `⏰ Markets are currently ${data.currently_open ? 'open' : 'closed'}`;
            document.getElementById("next").innerHTML = `Next ${data.currently_open ? "closing at " + new Date(data.closing_at).toLocaleString() : "opening at " + new Date(data.reopening_at).toLocaleString()}`;
        });

        fetch('/value')
        .then((response) => response.json())
        .then((data) => {
            document.getElementById("equity").innerHTML = `Equity: $${data.equity}`;
            document.getElementById("buying_power").innerHTML = `Buying Power: $${data.buying_power}`;
            document.getElementById("gain_loss_pct").innerHTML = `Gain/Loss: ${data.gain_loss_pct}%`;
        });
    }, 500);
})();