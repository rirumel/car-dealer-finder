import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer, { Browser, Page } from "puppeteer";
import { scrapeOpel } from "../scraper/opelScraper";
import { saveDealers, updateLastScrapeTime } from "../services/db";

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
    // Load cities from JSON or array
    const citiesPath = path.join(__dirname, "../assets/cities.json");
    const cities: string[] = JSON.parse(fs.readFileSync(citiesPath, "utf-8"));
    // const cities = ["Saarbrücken", "Berlin", "Hamburg"]; // Example for big run

    // Launch browser once
    const browser: Browser = await puppeteer.launch({
        headless: "new" as any,
        defaultViewport: null,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1920,1080"],
    });

    // Create a single page
    const page: Page = await browser.newPage();

    try {
        for (const city of cities) {
            console.log(`\n🌍 Scraping dealers for city: ${city}`);
            try {
                const dealers: Dealer[] = await scrapeOpel(city, page);

                if (dealers?.length) {
                    await saveDealers("opel", dealers, "opelDealers");
                    console.log(`✅ ${dealers.length} dealers saved for ${city}`);
                } else {
                    console.log(`⚠️ No dealers found for ${city}`);
                }

                // Small delay between requests
                await new Promise((res) => setTimeout(res, 3000));
            } catch (err) {
                console.error(`❌ Error scraping ${city}:`, err);
            }
        }

        await updateLastScrapeTime("opel");
        console.log("🎯 All cities processed successfully!");
    } catch (err) {
        console.error("❌ Unexpected error during scraping:", err);
    } finally {
        await browser.close();
        process.exit(0);
    }
}

runAllCities();