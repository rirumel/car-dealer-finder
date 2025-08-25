import { MongoClient, Db } from "mongodb";

export interface Dealer {
  name?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  distance?: string;
  phone?: string;
  email?: string;
  website?: string;
  services?: string[];
}

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const client = new MongoClient(uri);

let db: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (!db) {
    await client.connect();
    db = client.db("carScraper");
  }
  return db;
}

/**
 * Save dealers into DB for a given source (e.g. "kia", "seat").
 * Deduplicates both within scraped data and against existing DB entries.
 */
export async function saveDealers(
  source: string,
  dealers: Dealer[],
  collectionName = "dealers"
) {
  const database = await connectDB();
  const collection = database.collection(collectionName);

  if (!dealers.length) {
    return;
  }

  // Deduplicate scraped dealers
  const normalizedMap = new Map<string, Dealer>();
  for (const dealer of dealers) {
    if (!dealer.name || !dealer.postalCode) continue; // skip invalid entries

    const key = [
      dealer.name.trim().toLowerCase(),
      dealer.street?.trim().toLowerCase() || "",
      dealer.postalCode.trim(),
    ].join("-");

    if (!normalizedMap.has(key)) {
      normalizedMap.set(key, dealer);
    }
  }

  const uniqueDealers = Array.from(normalizedMap.values());

  // Ensure unique index in MongoDB
  await collection.createIndex(
    { source: 1, name: 1, street: 1, postalCode: 1 },
    { unique: true }
  );

  // Fetch existing dealers for this source
  const existingDealers = await collection
    .find({ source }, { projection: { name: 1, street: 1, postalCode: 1 } })
    .toArray();

  const existingKeys = new Set(
    existingDealers.map(d => `${d.name}-${d.street}-${d.postalCode}`)
  );
  const scrapedKeys = new Set(
    uniqueDealers.map(d => `${d.name}-${d.street}-${d.postalCode}`)
  );

  // Mark old dealers as inactive (Not applicable for first time scrapping)
  // const inactiveOps = Array.from(existingKeys)
  //   .filter(key => !scrapedKeys.has(key))
  //   .map(key => {
  //     const [name, street, postalCode] = key.split("-");
  //     return {
  //       updateOne: {
  //         filter: { source, name, street, postalCode },
  //         update: { $set: { inactive: true } },
  //       },
  //     };
  //   });

  // Upsert new/updated dealers
  const upsertOps = uniqueDealers.map(dealer => ({
    updateOne: {
      filter: { source, name: dealer.name, street: dealer.street, postalCode: dealer.postalCode },
      update: { $set: { ...dealer, source } },
      upsert: true,
    },
  }));

  const bulkOps = [...upsertOps];

  if (bulkOps.length > 0) {
    const result = await collection.bulkWrite(bulkOps);
  }
}

/**
 * Store last scrape timestamp for a given source.
 */
export async function updateLastScrapeTime(source: string) {
  const database = await connectDB();
  const collection = database.collection("scrapeInfo");

  await collection.updateOne(
    { source },
    { $set: { lastUpdated: new Date() } },
    { upsert: true }
  );
}

/**
 * Fetch last scrape time for a given source.
 */
export async function getLastScrapeTime(source: string) {
  const database = await connectDB();
  const collection = database.collection("scrapeInfo");

  const info = await collection.findOne({ source });
  return info?.lastUpdated || null;
}
