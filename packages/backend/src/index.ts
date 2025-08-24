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

app.get("/", (req, res) => {
  res.send("Backend is running!");
});

app.get("/api/dealers", async (req, res) => {
  try {
    const { brand, city, postalCode, radius, lng, lat } = req.query;
    const db = client.db(dbName);
    let dealers;
    if(brand === 'Kia'){
      dealers = db.collection("dealers");
    } else {
      dealers = db.collection("opelDealers");
    }

    let query: any = {};

    if(brand) {
      query.source = { $regex: `^${brand}$`, $options: 'i' }
    }

    if (city) {
      // Case-insensitive exact match for city
      query.city = { $regex: new RegExp(`^${city}$`, "i") };
    } else if (postalCode) {
      const radiusNum = Number(radius) || 5;

      const coords = await geocodePostalCode(postalCode as string);
      if (!coords) return res.status(404).json({ error: "Invalid postal code" });

      query.location = {
        $geoWithin: {
          $centerSphere: [[coords.longitude, coords.latitude], radiusNum / 6378.1],
        },
      };
    }
    const results = await dealers.find(query).toArray();
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

async function geocodePostalCode(postalCode: string) {
  const query = encodeURIComponent(`${postalCode}, Germany`);
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${postalCode}&country=Germany&format=json&limit=1`;

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

// import cors from "cors";
// import express from "express";

// const app = express();
// app.use(cors());
// app.use(express.json());

// const PORT = 3000;

// app.get("/", (req, res) => {
//   res.send("Backend is running!");
// });

// app.listen(PORT, () => {
//   console.log(`Backend server running at http://localhost:${PORT}`);
// });
