
// 58e0390fb0bcdde7b284f4e97e63f63d4cbcabea10959de3621711d32e2e0d34
export class ApiManager {
    constructor(scene) {
        this.scene = scene;
        this.apis = {
            btcPrice: "https://data-api.coindesk.com/index/cc/v1/latest/tick?market=ccix&instruments=BTC-USD&api_key=58e0390fb0bcdde7b284f4e97e63f63d4cbcabea10959de3621711d32e2e0d34",

            catFact: "https://catfact.ninja/fact",
            weather: "https://api.open-meteo.com/v1/forecast?latitude=35.6895&longitude=139.6917&current_weather=true",
            // https://api.tomorrow.io/v4/weather/forecast?location=42.3478,-71.0466&apikey=VrnY54H9V3mWTLK5WKblUAOzJK2a5Ner

        }
        this.data = {
            catFact: "",
            btcUSD: 30000,
        };

        this.weatherData = null;
    }

    async init() {
        // Fetch once at start
        this.fetchCatFact();
        this.fetchBtcPrice();
        await this.fetchWeather();
        this.scene.time.addEvent({
            delay: 30000,
            loop: true,
            callback: async () => {
                console.log("Refreshing API data...");
                await this.fetchCatFact();
                await this.fetchBtcPrice();
                await this.fetchWeather();
                this.scene.weatherEffects?.apply(); // re-apply effects after fetch
            }
        });

    }

    async fetchCatFact() {
        try {
            const res = await fetch(this.apis.catFact);
            const json = await res.json();
            this.data.catFact = json.fact;
            console.log("🐱 Cat Fact:", this.data.catFact);

            // Optional: show popup in game
            // this.scene.add.text(
            //     Phaser.Math.Between(50, 500),
            //     Phaser.Math.Between(50, 400),
            //     this.data.catFact,
            //     { fontSize: "16px", fill: "#fff", backgroundColor: "#222" }
            // ).setScrollFactor(0).setDepth(999).setAlpha(0.9);

        } catch (err) {
            console.warn("Failed to fetch cat fact", err);
        }
    }

    async fetchBtcPrice() {
        try {
            const res = await fetch(this.apis.btcPrice);
            const json = await res.json();
            console.log("Fetched BTC price data:", json);

            const value = json.Data?.["BTC-USD"]?.VALUE;
            if (value) {
                this.data.btcUSD = parseFloat(value);
                console.log("₿ BTC/USD:", this.data.btcUSD);
            } else {
                console.warn("BTC value not found in response.");
            }

        } catch (err) {
            console.warn("Failed to fetch BTC price", err);
        }
    }


    async fetchWeather() {
        function generateWeatherCode(level) {
            // Weighted weather roll
            const clearCodes = [0, 1, 2];
            const fogCodes = [45];
            const rainCodes = [51, 61, 63];
            const snowCodes = [75, 77];
            const stormCodes = [95, 99];
            const overcast = [3, 4, 5];

            if (level % 5 === 0) {
                return getRandom([0, 77, 95]); // clear, snow, storm on milestone levels
            }

            const options = [
                ...clearCodes, ...overcast,
                ...fogCodes, ...rainCodes,
                ...snowCodes, ...stormCodes
            ];

            return options[Math.floor(Math.random() * options.length)];
        }

        function getRandom(arr) {
            return arr[Math.floor(Math.random() * arr.length)];
        }

        this.weatherData = { temperature: 25, windspeed: 0, weathercode: generateWeatherCode(this.scene.level) }
    }


    getWeather() {
        return this.weatherData;
    }

    getTemperature() {
        return this.weatherData?.temperature ?? 25;
    }

    getWeatherCode() {
        return this.weatherData?.weathercode ?? 0;
    }


    isDaytime() {
        return this.weatherData?.is_day === 1;
    }

    getBitcoinPrice() {
        return this.data.btcUSD;
    }

    getCurrentCatFact() {
        return this.data.fact;
    }
}

/* const weather = this.apiManager.getWeather();
const temp = this.apiManager.getTemperature();
const weatherCode = this.apiManager.getWeatherCode();

console.log("🌤️ Weather:", weather);

// Example: Set camera tint or effect based on weather
if (weatherCode === 2) { // 2 = partly cloudy
  this.cameras.main.setBackgroundColor("#cccccc");
} else if (weatherCode === 3) { // 3 = overcast
  this.cameras.main.setBackgroundColor("#999999");
} else if (weatherCode === 61) { // light rain
  this.cameras.main.setBackgroundColor("#556677");
  this.player.speed *= 0.8; // rain slows the player
}
*/