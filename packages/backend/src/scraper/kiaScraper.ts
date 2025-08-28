import puppeteer, { Page } from "puppeteer";
import { saveDealers, updateLastScrapeTime } from "../services/db.ts";
import fetch from "node-fetch";

export interface Dealer {
    name: string;
    street: string;
    postalCode: string;
    city: string;
    phone?: string | undefined;
    website?: string | undefined;
    services?: string[];
    latitude?: number | undefined;
    longitude?: number | undefined;
    location?: {
        type: "Point";
        coordinates: [number | undefined, number | undefined]; // [longitude, latitude]
    };
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// close the popup
async function closePopupIfPresent(page: Page, timeout = 5000) {
    const interval = 200;
    const maxChecks = Math.ceil(timeout / interval);
    for (let i = 0; i < maxChecks; i++) {
        const popupContainer = await page.$(".bbapp-global-popup__container");
        if (popupContainer) {
            const closeButton = await popupContainer.$(".bbapp-global-popup__close");
            if (closeButton) {
                await closeButton.evaluate(el => (el as HTMLElement).click());
                await delay(500);
                return;
            }
        }
        await delay(interval);
    }
}

//close the cookies (accepting the cookies)
async function acceptCookiesIfPresent(page: Page, timeout = 5000) {
    const interval = 200;
    const maxChecks = Math.ceil(timeout / interval);
    for (let i = 0; i < maxChecks; i++) {
        const cookieBtn = await page.$("#onetrust-accept-btn-handler");
        if (cookieBtn) {
            await cookieBtn.evaluate(el => (el as HTMLElement).click());
            await delay(500);
            return;
        }
        await delay(interval);
    }
}

// To calculate the latitude and longitude of the postal code and city
async function geocodePostalCode(postalCode: string, city: string): Promise<{ latitude: number; longitude: number } | null> {
    const query = encodeURIComponent(`${postalCode} ${city}, Germany`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

    try {
        const response = await fetch(url, { headers: { "User-Agent": "KIA-Scraper/1.0" } });
        const data: any = await response.json();
        if (data && data[0]) {
            return {
                latitude: parseFloat(data[0].lat),
                longitude: parseFloat(data[0].lon),
            };
        }
    } catch (error) {
        console.error("Geocoding error:", error);
    }
    return null;
}

//save the dealers in the database
async function run(allDealers: any) {
    try {
        await saveDealers("kia", allDealers, "kiaDealers");
        await updateLastScrapeTime("kia");
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

export async function scrapeKIA(): Promise<Dealer[]> {
    const browser = await puppeteer.launch({
        headless: "new" as any,
        defaultViewport: null,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1920,1080"]
    });

    const page = await browser.newPage();
    const allDealers: Dealer[] = [];

    try {
        await page.goto("https://www.kia.com/de/haendlersuche/#/", { waitUntil: "networkidle2" });
        await delay(3000);

        await acceptCookiesIfPresent(page);
        await closePopupIfPresent(page);

        // Switch to List View
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll("button"));
            const listViewBtn = buttons.find(btn => btn.textContent?.includes("Listenansicht"));
            if (listViewBtn) (listViewBtn as HTMLElement).click();
        });
        await delay(3000);

        let hasNext = true;

        while (hasNext) {
            // Wait for dealers to render
            await page.waitForSelector("li.dealers-list-item", { timeout: 15000 });

            // Scrape current page dealers
            const dealerElements = await page.$$("li.dealers-list-item");
            for (const el of dealerElements) {
                const name = await el.$eval("div.title", e => e.textContent?.trim() || "");
                const addressDDs = await el.$$eval("dl.eut_info_area dd.ng-binding", els =>
                    els.map(e => e.textContent?.trim() || "")
                );
                const street = addressDDs[0] || "";
                const postalCity = addressDDs[1] || "";
                const postalCode = postalCity.split(" ")[0] || "";
                const city = postalCity.split(" ").slice(1).join(" ") || "";

                const phone = await el.$eval(
                    "dl.bdnone dd div.ng-binding",
                    e => e.textContent?.replace("Telefon:", "").trim() || undefined
                ).catch(() => undefined);

                const website = await el.$eval(
                    "ul.right_area a.dealer_website_link",
                    e => e.getAttribute("href") || undefined
                ).catch(() => undefined);

                const services = await el.$$eval(
                    "div.vertical_line ul.blt_list li",
                    els => els.map(li => li.textContent?.trim() || "")
                ).catch(() => []);

                // Get coordinates
                const coords = await geocodePostalCode(postalCode, city);
                const latitude = coords?.latitude;
                const longitude = coords?.longitude;

                allDealers.push({
                    name, street, postalCode, city, phone, website, services, latitude, longitude,
                    ...(latitude !== undefined && longitude !== undefined
                        ? { location: { type: "Point", coordinates: [longitude, latitude] } }
                        : {})
                });
            }

            // Check if "next" button is active
            const nextBtnDisabled = await page.$eval(
                "ul.eut_pagination li.next a",
                el => el.classList.contains("disabled")
            );

            if (nextBtnDisabled) {
                hasNext = false;
            } else {
                // Click next
                await page.evaluate(() => {
                    const next = document.querySelector("ul.eut_pagination li.next a") as HTMLElement;
                    if (next) next.click();
                });
                await delay(3000); // wait for next page to render
            }
        }

        await browser.close();
        await run(allDealers);
        return allDealers;

    } catch (error) {
        await browser.close();
        throw error;
    }
}

//execute the scrapper
scrapeKIA()

