
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
        const interestingLocations = [
            { lat: 25.276987, lon: 55.296249 }, // Dubai - desert, hot
            { lat: 60.1699, lon: 24.9384 },     // Helsinki - snow, fog
            { lat: -33.8688, lon: 151.2093 },   // Sydney - coastal, thunderstorms
            { lat: 64.9631, lon: -19.0208 },    // Iceland - snow, cold
            { lat: 35.6895, lon: 139.6917 },    // Tokyo - rainy season
            { lat: 19.0760, lon: 72.8777 },     // Mumbai - heavy monsoon
            { lat: 51.5072, lon: -0.1276 },     // London - fog, rain
            { lat: 40.7128, lon: -74.0060 },    // New York - varied seasons
            { lat: -23.5505, lon: -46.6333 },   // São Paulo - tropical, warm
            { lat: 55.7558, lon: 37.6173 },     // Moscow - cold winters
            { lat: 37.7749, lon: -122.4194 },   // San Francisco - coastal fog
            { lat: 1.3521, lon: 103.8198 },     // Singapore - humid, thunderstorms
            { lat: -34.6037, lon: -58.3816 },   // Buenos Aires - temperate
            { lat: 48.8566, lon: 2.3522 },      // Paris - mild, cloudy
            { lat: 41.9028, lon: 12.4964 },     // Rome - Mediterranean
            { lat: -1.2921, lon: 36.8219 },     // Nairobi - highland climate
            { lat: 39.9042, lon: 116.4074 },    // Beijing - pollution haze, cold winters
            { lat: 24.7136, lon: 46.6753 },     // Riyadh - desert, extreme heat
            { lat: 35.6762, lon: 139.6503 },    // Tokyo (urban center)
            { lat: 13.7563, lon: 100.5018 },    // Bangkok - hot, humid, thunderstorms
        ];


        const { lat, lon } = Phaser.Utils.Array.GetRandom(interestingLocations);
        // -180 to +180

        try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
            const data = await res.json();
            this.weatherData = data.current_weather;
            console.log(`🌍 Random Weather (${lat}, ${lon}):`, this.weatherData);
        } catch (e) {
            console.error("Failed to fetch random weather:", e);
            this.weatherData = { temperature: 25, windspeed: 0, weathercode: 0 };
        }
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