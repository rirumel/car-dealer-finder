import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer, { Browser, Page } from "puppeteer";
import { seatScraper } from "../scraper/seatScraper.ts";
import { saveDealers, updateLastScrapeTime } from "../services/db.ts";

export interface Dealer {
    name?: string;
    street?: string;
    postalCode?: string;
    city?: string;
    phone?: string;
    website?: string;
    services?: string[];
    latitude?: number;
    longitude?: number;
    location?: {
        type: "Point";
        coordinates: [number, number];
    };
}

async function runAllCities() {
    // Convert import.meta.url to a __dirname equivalent
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Load cities from JSON
    const citiesPath = path.join(__dirname, "../assets/cities.json");
    const cities: string[] = JSON.parse(fs.readFileSync(citiesPath, "utf-8"));
    // const cities = ["Saarbrücken", "Berlin", "Hamburg"]; // Example for big run

    // Launch browser once
    const browser: Browser = await puppeteer.launch({
        headless: false,
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1920,1080"],
        defaultViewport: null,
    });

    // Create a single page
    const page: Page = await browser.newPage();

    try {
        for (const city of cities) {

            let dealers: Dealer[] = [];
            let attempts = 0;
            const maxAttempts = 2;

            while (attempts < maxAttempts && (!dealers || dealers.length === 0)) {
                attempts++;
                try {
                    // Your seatScraper needs to accept city & page now
                    dealers = await seatScraper(city, page);

                    if (dealers?.length) {
                        await saveDealers("seat", dealers, "seatDealers");
                    } else {
                        console.warn(`⚠️ No dealers found for ${city} (attempt ${attempts})`);
                        if (attempts < maxAttempts) {
                            await new Promise((res) => setTimeout(res, 3000)); // delay before retry
                        }
                    }
                } catch (err) {
                    if (attempts < maxAttempts) {
                        await new Promise((res) => setTimeout(res, 3000));
                    }
                }
            }
        }


        await updateLastScrapeTime("seat");
    } catch (error) {
        console.error("Unexpected error during scraping:", error);
    } finally {
        await browser.close();
        process.exit(0);
    }
}

runAllCities();