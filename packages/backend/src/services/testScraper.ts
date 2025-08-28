import { scrapeKIA } from "../scraper/kiaScraper.ts";
import { scrapeOpel } from "../scraper/opelScraper.ts";
import puppeteer, { Browser, Page } from "puppeteer";

async function test() {
  //launch browser
  const browser: Browser = await puppeteer.launch({
    headless: "new" as any,
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1920,1080"],
  });

  // Create a single page
  const page: Page = await browser.newPage();

  //For KIA
  // try {
  //   const dealers = await scrapeKIA();
  // } catch (err) {
  //   console.error("Error scraping KIA:", err);
  // }

  //For Opel
  try {
    const dealers = await scrapeOpel("Berlin", page);
  } catch (err) {
    console.error("Error scraping KIA:", err);
  }
}

test();