import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);
const dbName = "carScraper";

app.get("/api/dealers", async (req, res) => {
  try {
    const { brand, city, postalCode, radius, lng, lat } = req.query;
    const db = client.db(dbName);
    const dealers = db.collection("dealers");

    let query: any = { brand };

    if (postalCode) {
      const radiusNum = Number(radius) || 5;
      console.log("Incoming query params:", req.query);
      console.log("About to call geocodePostalCode with", postalCode);
      const coords = await geocodePostalCode(postalCode as string);
      console.log("Geocode result:", coords);
      if (!coords) return res.status(404).json({ error: "Invalid postal code / city" });

      query.location = {
        $geoWithin: {
          $centerSphere: [[coords.longitude, coords.latitude], radiusNum / 6378.1],
        },
      };
    } else if (city) {
      // Case-insensitive exact match for city
      query.city = { $regex: new RegExp(`^${city}$`, "i") };
    }
    const results = await dealers.find(query).toArray();
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

async function geocodePostalCode(postalCode: string) {
  // const query = encodeURIComponent(`${postalCode} Germany`);
  console.log("I am inside GeoCOdePostalCode.........");
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${postalCode}&country=Germany&format=json&limit=1`;
  console.log("JSON received using Postal Code and Germany", url);

  try {
    const response = await fetch(url, { headers: { "User-Agent": "CarDealersApp/1.0" } });
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

async function startServer() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    app.listen(3000, () => {
      console.log("Server running on http://localhost:3000");
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();