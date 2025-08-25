import cron from "node-cron";
import { scrapeKIA } from "../scraper/kiaScraper";

// Prevent overlapping scrapes
let isRunning = false;

// Schedule: every 60 minutes for testing
cron.schedule("*/60 * * * *", async () => {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    await scrapeKIA();
  } catch (err) {
    console.error("Error during KIA scraping:", err);
  } finally {
    isRunning = false;
  }
});

// Keep Node running
setInterval(() => {}, 8000 * 60 * 60); // 8 hours interval, just to locally keep the process alive