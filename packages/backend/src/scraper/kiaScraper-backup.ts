import puppeteer, { Page } from "puppeteer";

export interface Dealer {
    name: string;
    street: string;
    postalCode: string;
    city: string;
    distance?: string;
    phone?: string | undefined;
    email?: string | undefined;
    website?: string | undefined;
    services?: string[];
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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
                console.log("DEBUG: Closed initial popup");
                return;
            }
        }
        await delay(interval);
    }
}

async function acceptCookiesIfPresent(page: Page, timeout = 5000) {
    const interval = 200;
    const maxChecks = Math.ceil(timeout / interval);

    for (let i = 0; i < maxChecks; i++) {
        const cookieBtn = await page.$("#onetrust-accept-btn-handler");
        if (cookieBtn) {
            await cookieBtn.evaluate(el => (el as HTMLElement).click());
            await delay(500);
            console.log("DEBUG: Accepted cookies");
            return;
        }
        await delay(interval);
    }
}

function isDealerValid(dealer: Dealer): boolean {
  // Check if at least one important field has a value
  return !!(
    dealer.name?.trim() ||
    dealer.street?.trim() ||
    dealer.postalCode?.trim() ||
    dealer.city?.trim() ||
    dealer.phone?.trim() ||
    dealer.email?.trim() ||
    dealer.website?.trim()
  );
}

export async function scrapeKIA(location: string): Promise<Dealer[]> {
    const browser = await puppeteer.launch({ 
        headless: "new" as any, 
        defaultViewport: null,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-features=IsolateOrigins,site-per-process",
            "--window-size=1920,1080"
        ] 
    });
    const page = await browser.newPage();

    try {
        await page.goto("https://www.kia.com/de/haendlersuche/#/", { waitUntil: "networkidle2" });
        await delay(3000);
        
        //page shows cookies pop up and that disables the whole page from interaction
        //therefore we have to make sure that the cookies pop up is disabled
        await acceptCookiesIfPresent(page);

        //Once the website is loaded there is a popup appears at the same position
        //of the website, each time the scrap happens. It's also better to dismiss it
        await closePopupIfPresent(page);
        
        //allow sometime to load the HTML elements as dismissing pop ups sometimes load the page again
        await page.waitForSelector("#search_input", { timeout: 15000 });
        
        //Type in the search field
        await page.type("#search_input", location, { delay: 100 });
        
        //optional but it confirms about the input event to the website
        await page.$eval("#search_input", el => el.dispatchEvent(new Event("input", { bubbles: true })));

        //we wait for the autocomplete/suggestion to show
        await page.waitForFunction(
            () => document.querySelectorAll("#myInputautocomplete-list div").length > 0,
            { timeout: 15000 }
        );

        const suggestions = await page.$$eval("#myInputautocomplete-list div", els =>
            els.map(el => el.textContent?.trim() || "")
        );
        console.log("DEBUG: Found suggestions:", suggestions);

        if (!suggestions.length) throw new Error(`No suggestions found for "${location}"`);

        const firstSuggestion = (await page.$$("#myInputautocomplete-list div"))[0];
        if (firstSuggestion) {
            await firstSuggestion.click();
            await delay(1500);
        } else {
            throw new Error("Failed to click the first suggestion.");
        }

        await page.waitForSelector("ul.eut_simply_result_list li a p.ng-binding", { timeout: 15000 });
        const dealerElements = await page.$$("ul.eut_simply_result_list li");

        const dealers: Dealer[] = [];
        const seenDealers = new Set<string>();

        for (let i = 0; i < dealerElements.length; i++) {
            const el = (await page.$$("ul.eut_simply_result_list li"))[i];
            if (!el) continue;

            const name = await el.$eval("p.ng-binding", e => e.textContent?.trim()).catch(() => "");
            const street = await el.$$eval("p.small.ng-binding", els => els[0]?.textContent?.trim()).catch(() => "");
            const postalCityRaw = await el.$$eval("p.small.ng-binding", els => els[1]?.textContent?.trim()).catch(() => "");
            const postalCode = postalCityRaw?.split(" ")[0] || "";
            const city = postalCityRaw?.split(" ").slice(1).join(" ") || "";
            const distance = await el.$eval("span.distance", e => e.textContent?.trim()).catch(() => undefined);

            const dealerId = `${name}-${street}`;
            if (seenDealers.has(dealerId)) {
                console.log(`DEBUG: Skipping duplicate dealer ${dealerId}`);
                continue;
            }
            seenDealers.add(dealerId);

            // base dealer object
            const dealer: Dealer = {
                name: name || "",
                street: street || "",
                postalCode,
                city,
                ...(distance ? { distance } : {}),
            };

            // enrich with popup info
            const link = await el.$("a");
            if (link) {
                console.log(`DEBUG: Scrolling dealer link into view: ${name}`);
                await link.evaluate(el => (el as HTMLElement).scrollIntoView({ block: "center" }));
                await delay(300);

                try {
                    console.log(`DEBUG: Clicking dealer link: ${name}`);
                    await link.evaluate(el =>
                        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
                    );

                    const popup = await page.waitForSelector(".eut_find_a_dealer_popup", { timeout: 4000 });
                    if (popup) {
                        console.log(`DEBUG: Popup appeared successfully for ${name}`);

                        dealer.phone = await popup
                            .$eval("li.etu_com_enter a[href^='tel:']", e => e.textContent?.trim())
                            .catch(() => undefined);
                        dealer.email = await popup
                            .$eval("li.etu_com_enter a[href^='mailto:']", e => e.textContent?.trim())
                            .catch(() => undefined);
                        dealer.website = await popup
                            .$eval("a.dealer_website_link", e => e.getAttribute("href") || undefined)
                            .catch(() => undefined);
                        dealer.services = await popup
                            .$$eval(".blt_list li", els => els.map(e => e.textContent?.trim() || ""))
                            .catch(() => []);

                        console.log("DEBUG: Scraped contact info:", {
                            phone: dealer.phone,
                            email: dealer.email,
                            website: dealer.website,
                            services: dealer.services,
                        });

                        const closeBtn = await popup.$("a.close");
                        if (closeBtn) await closeBtn.click();
                        await delay(500);
                    } else {
                        console.log(`DEBUG: Popup did not appear for ${name}`);
                    }
                } catch (err) {
                    console.log(`DEBUG: Error opening popup for ${name}:`, (err as Error).message);
                }
            }

            // Push only if the dealer is a valid object
            if (isDealerValid(dealer)) {
                dealers.push(dealer);
            }

        }
        console.log("Total dealers found", dealers.length);
        await browser.close();
        return dealers;
    } catch (err) {
        await browser.close();
        throw err;
    }
}