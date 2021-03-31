(function main() {
    setInterval(() => {
        fetch('/trades')
            .then((response) => response.json())
            .then((datas) => {
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
    }, 500);
})();