import puppeteer, { Browser, Frame, Page } from "puppeteer";

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

// ---------- Helper functions ----------
async function dismissCookiePopup(page: Page, selector: string, name: string) {
    try {
        await page.waitForSelector(selector, { visible: true, timeout: 5000 });
        await page.click(selector);
    } catch (error) {
        console.error(`${name} not found or already handled`, error);
    }
}

async function dismissIframeCookie(frame: Frame, selector: string, name: string) {
    try {
        const btn = await frame.waitForSelector(selector, { visible: true, timeout: 10000 });
        await btn?.click();
    } catch (error) {
        console.error(`${name} not found or already handled`, error);
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
    } catch (err) {
        console.error("Geocoding error:", err);
    }
    return null;
}

export async function seatScraper(city: string, page: Page): Promise<Dealer[]> {
    let browser: Browser | null = null;
    const allDealers: Dealer[] = [];

    try {
        // 1. Visit SEAT dealer finder
        await page.goto("https://www.seat.de/kontakt/haendlersuche", {
            waitUntil: "networkidle2",
        });
        // ---------- Dismiss first cookie popup ----------
        await dismissCookiePopup(page, "#onetrust-reject-all-handler", "First cookie popup");

        // Scroll down to iframe
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));

        await delay(3000); // wait for iframe

        // ---------- Refresh Page ----------
        await page.reload({ waitUntil: "domcontentloaded" });
        await delay(3000);

        // ---------- Handle iframe ----------
        const iframeElement = await page.waitForSelector("#iFrameResizer0", { timeout: 10000 });
        const frame = await iframeElement?.contentFrame();
        if (!frame) throw new Error("Failed to get iframe content");

        await dismissIframeCookie(frame, "#onetrust-accept-btn-handler", "Second cookie popup");

        // Accept map disclaimer inside iframe
        try {
            const acceptCookieBtn = await frame.waitForSelector("#acceptCookie", { timeout: 7000 });
            await acceptCookieBtn?.click();
        } catch (error) {
            console.error("Blurred map disclaimer not found inside iframe", error);
        }

        await delay(3000); // optional extra delay

        // ---------- Search for "Berlin" on main page ----------
        try {
            // Scroll to top
            await page.evaluate(() => window.scrollTo(0, 0));

            await delay(3000);

            // Wait for the filter input inside the iframe
            const filterInput = await frame.waitForSelector("#filter", { visible: true, timeout: 15000 });
            if (!filterInput) throw new Error("Filter input not found inside iframe");

            // Type city name
            await filterInput.type(city, { delay: 100 });
            await delay(1000); // wait for autocomplete suggestions

            // Click search button inside iframe
            const searchBtn = await frame.waitForSelector("#button-search", { visible: true, timeout: 5000 });
            await searchBtn?.click();

            await delay(10000); // wait for results
        } catch (error) {
            console.error("Error during city search:", (error as Error).message);
        }

        // ---------- Scrape dealers inside the iframe ----------

        const rawDealers = await frame.$$eval("div#dealerList > div.dealer", (dealers) => {
            return dealers.map((dealer) => {
                const dealerNameDiv = dealer.querySelector("div.dealerName");
                const name = (dealerNameDiv as HTMLElement)?.innerText.trim() || "";

                const dealerAddressDiv = dealer.querySelector("div.dealerAdress");
                let street = "";
                let postalCode = "";
                let city = "";

                if (dealerAddressDiv) {
                    const addressPs = dealerAddressDiv.querySelectorAll("p.mb-0");
                    const addressP = addressPs[addressPs.length - 1];
                    if (addressP) {
                        const parts = addressP.innerHTML.split("<br>");
                        street = parts[0]?.replace(/<[^>]+>/g, "").trim() ?? "";

                        const postalCity = parts[1]?.trim() ?? "";
                        const [pc = "", ...cityParts] = postalCity.split(/\s+/);
                        postalCode = pc;
                        city = cityParts.join(" ");
                    }
                }

                const dealerContactDiv = dealer.querySelector("div.dealerContact");
                const contactPs = dealerContactDiv?.querySelectorAll("p") ?? [];
                const phone = contactPs[0]?.querySelector("a")?.textContent?.trim() ?? "";
                const email = contactPs[1]?.querySelector("a")?.textContent?.trim() ?? "";
                const website = contactPs[2]?.querySelector("a")?.getAttribute("href") ?? "";

                const services = Array.from(dealer.querySelectorAll(".dealerFeatures img"))
                    .map((img) => img.getAttribute("title")?.trim() || "")
                    .filter(Boolean);

                return { name, street, postalCode, city, phone, email, website, services };
            });
        });

        // Now enrich with async geocoding in Node
        for (const rd of rawDealers) {
            let latitude: number | undefined;
            let longitude: number | undefined;

            if (rd.postalCode) {
                const coords = await geocodePostalCode(rd.postalCode);
                if (coords) {
                    latitude = coords.latitude;
                    longitude = coords.longitude;
                }
            }

            const dealer: Dealer = {
                ...(rd.name ? { name: rd.name } : {}),
                ...(rd.street ? { street: rd.street } : {}),
                ...(rd.postalCode ? { postalCode: rd.postalCode } : {}),
                ...(rd.city ? { city: rd.city } : {}),
                ...(rd.phone ? { phone: rd.phone } : {}),
                ...(rd.email ? { email: rd.email } : {}),
                ...(rd.website ? { website: rd.website } : {}),
                ...(rd.services?.length ? { services: rd.services } : {}),
                ...(latitude !== undefined && longitude !== undefined
                    ? { latitude, longitude, location: { type: "Point", coordinates: [longitude, latitude] } }
                    : {}),
            };

            allDealers.push(dealer);
        }
        console.log("Scraper finished successfully");
    } catch (error) {
        console.error("Error running Seat scraper:", (error as Error).message);
    }
    return allDealers;
}