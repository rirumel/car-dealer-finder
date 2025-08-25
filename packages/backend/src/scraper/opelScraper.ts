import puppeteer, { Page } from "puppeteer";
import fetch from "node-fetch";
import { updateLastScrapeTime } from "../services/db";

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

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleOpelCookies(page: any) {
    try {
        const maxAttempts = 10;
        let clicked = false;
        let attempt = 0;

        while (attempt < maxAttempts && !clicked) {
            clicked = await page.evaluate(() => {
                const refuseBtn = document.querySelector<HTMLAnchorElement>('#_psaihm_refuse_all');
                if (refuseBtn) {
                    refuseBtn.click();
                    return true;
                }
                return false;
            });

            if (!clicked) {
                await page.waitForTimeout(1000); // wait for the button to appear
            }

            attempt++;
        }
    } catch (error) {
        console.error("Error handling Opel cookies:", error);
    }
}

// To calculate the latitude and longitude of the postal code and city
async function geocodePostalCode(postalCode: string): Promise<{ latitude: number; longitude: number } | null> {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${postalCode}&country=Germany&format=json&limit=1`;

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

// Store to DB
async function run(allDealers: any) {
    try {
        // await saveDealers("opel", allDealers, "opelDealers");
        await updateLastScrapeTime("opel");
    } catch (error) {
        console.error("Error:", error);
    }
}

export async function scrapeOpel(city: string, page: Page): Promise<Dealer[]> {
    const allDealers: Dealer[] = [];

    try {
        // 1. Visit SEAT dealer finder
        await page.goto("https://www.opel.de/tools/haendlersuche.html", {
            waitUntil: "networkidle2",
        });
        await delay(5000);

        // 2. Dismiss the cookies pop-up:
        await handleOpelCookies(page);

        // ------------------- CLEAR INPUT IF NEEDED -------------------
        const clearBtnSelector = ".clear-searchbox";
        const clearBtn = await page.$(clearBtnSelector);
        if (clearBtn) {
            await clearBtn.click(); // Click the close icon to empty the input
            await delay(500);       // small delay to ensure input is cleared
        }

        // 3. Wait a little to ensure page is ready
        await delay(4000);

        // 4. Type "Saarbrücken" in the search input
        const searchInputSelector = "#dealerSearchBox";
        await page.waitForSelector(searchInputSelector, { visible: true });
        await page.focus(searchInputSelector);
        await page.keyboard.type(city, { delay: 100 });

        // 5. Wait for the suggestions list and click the first item
        const firstSuggestionSelector = ".localities-container .localities-item:first-child";
        await page.waitForSelector(firstSuggestionSelector, { visible: true });
        await page.click(firstSuggestionSelector);

        // 6. Click the search button
        const searchBtnSelector = ".dealer-search-button.stat-search-submit";
        await page.waitForSelector(searchBtnSelector, { visible: true });
        await page.click(searchBtnSelector);

        // 7. Wait for 5 seconds
        await delay(5000);

        //8. Click "Mehr" until all dealers are loaded
        let mehrVisible = true;
        while (mehrVisible) {
            try {
                const mehrBtn = await page.$("a.q-button.expand");
                if (!mehrBtn) break;

                await mehrBtn.click();
                await delay(2000); // wait for more dealers to load
            } catch {
                mehrVisible = false;
            }
        }

        // 9. Extract dealer cards
        await page.waitForSelector("li.q-dealer-info h5.q-dealer-name", { visible: true, timeout: 15000 });

        type RawDealer = {
            name: string | undefined;
            street: string | undefined;
            formatted: string | undefined;
            phone?: string | undefined;
            website?: string | undefined;
        };

        const rawDealers: RawDealer[] = await page.$$eval("li.q-dealer-info", (items) =>
            items.map((li) => {
                const getText = (sel: string) => {
                    const el = li.querySelector<HTMLElement>(sel);
                    return el ? el.textContent!.trim() : "";
                };

                const getAttr = (sel: string, attr: string) => {
                    const el = li.querySelector<Element>(sel);
                    return el ? el.getAttribute(attr) || undefined : undefined;
                };

                const name = getText("h5.q-dealer-name");
                const street = getText("p[ng-if*='addressLine1']");
                const formatted = getText("p[ng-if*='formattedAddress']");

                // Clean up phone text (double spaces etc.)
                const phoneTxt = getText("a.phone").replace(/\s+/g, " ").trim();
                const phone = phoneTxt || undefined;

                // Prefer href; ng-href may also exist but href is present after Angular binds
                const website = getAttr("a.web", "href");

                return { name, street, formatted, phone, website };
            })
        );

        // 10. Normalize & geocode, then build Dealer objects
        for (const rd of rawDealers) {
            if (!rd.name) continue; // extra safety

            let city: string | undefined;
            let postalCode: string | undefined;

            if (rd.formatted) {
                const parts = rd.formatted.split(",").map((s) => s.trim());
                if (parts.length >= 2) {
                    city = parts[0];
                    postalCode = parts[1];
                }
            }

            let latitude: number | undefined;
            let longitude: number | undefined;

            if (postalCode && city) {
                const coords = await geocodePostalCode(postalCode);
                if (coords) {
                    latitude = coords.latitude;
                    longitude = coords.longitude;
                }
                await delay(1000);
            }

            const dealer: Dealer = {
                ...(rd.name ? { name: rd.name } : {}),
                ...(rd.street ? { street: rd.street } : {}),
                ...(postalCode ? { postalCode } : {}),
                ...(city ? { city } : {}),
                ...(rd.phone ? { phone: rd.phone } : {}),
                ...(rd.website ? { website: rd.website } : {}),
                ...(latitude !== undefined && longitude !== undefined
                    ? { latitude, longitude, location: { type: "Point", coordinates: [longitude, latitude] } }
                    : {}),
            };

            allDealers.push(dealer);
        }
        await run(allDealers); //save dealers to DB //opelDealers
    } catch (error) {
        console.error("Error in Seat scraper test:", error);
    }
    return allDealers;
}