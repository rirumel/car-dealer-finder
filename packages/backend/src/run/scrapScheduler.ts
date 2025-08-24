import cron from "node-cron";
import { scrapeKIA } from "../scraper/kiaScraper";

// Prevent overlapping scrapes
let isRunning = false;

// Schedule: every 60 minutes for testing
cron.schedule("*/60 * * * *", async () => {
  if (isRunning) {
    console.log("Previous scrape still running. Skipping this run...");
    return;
  }

  console.log("Starting KIA scraper at", new Date().toLocaleString());
  isRunning = true;

  try {
    await scrapeKIA();
    console.log("KIA scraping finished at", new Date().toLocaleString());
  } catch (err) {
    console.error("Error during KIA scraping:", err);
  } finally {
    isRunning = false;
  }
});

// Keep Node running
console.log("KIA scraper scheduler running...");
setInterval(() => {}, 8000 * 60 * 60); // 8 hours interval, just to locally keep the process alive