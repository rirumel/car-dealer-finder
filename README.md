# 🚗 Car Dealer Finder

Car Dealer Finder is a full-stack project that scrapes and manages car dealer data (currently Opel, Seat, and Kia) and provides a frontend interface to search and export results.

This project demonstrates skills in web scraping, backend API design, geospatial queries, database optimization, and modern frontend development.

---

## ✨ Features

- 🔍 Dealer Search – Find car dealerships by brand, city, or postal code.
- 🌍 Geospatial Queries – Search dealers within a radius using MongoDB’s geospatial features.
- ⚡ Automated Scraping –
  - KIA dealers can be manually and/or auto-updated with a chosen time interval using the scrapScheduler (node-cron).
  - Opel dealers can be run manually or automated using opelRunner.
  - Seat dealers can also be updated manuallay or automated using seatRunner.ts
- 🗄️ Smart Database Sync – Deduplication, upserts, and inactive dealer marking ensure a clean, accurate database.
- 📊 Last Updated Tracking – Each scrape run logs a timestamp so data freshness is visible.
- 🌐 Frontend Integration – Vue.js frontend consumes the Express API for real-time dealer search. 

---

## 🚀 Tech Stack

**Backend (packages/backend)**
- Node.js + Express - REST API  
- TypeScript  
- Puppeteer (for web scraping)
- Cheerio – Fast HTML parsing for Kia scraping
- OpenStreetMap Nominatim API – Postal code → GPS geocoding  
- MongoDB (for storing dealer data)  
- Node-Cron (for scheduling scrapers)  

**Frontend (packages/frontend)**
- Vue 3  
- TailwindCSS v3
- Headless UI
- Axios  

---

## ⚙️ Backend Overview

### 🔹 KIA Scraper Scheduler (`/backend/src/run/kiaScheduler.ts`)

- Uses **node-cron** to run every 60 minutes(Test purpose). We can definitely change/adjust the scheduler.   
- Prevents overlapping runs with an `isRunning` flag.
- Calls the Kia scraper and updates the database collection for Kia dealers in 'dealers' collection.  
- Keeps Node process alive locally with a dummy `setInterval`.
- Locally needs to keep the process alive manually but in the production, it is possible to keep it alive forever.
- Doesn't write duplicate dealers in the database
- Re-running the scheduler can also mark inactive dealers while scrapping 

### 🔹 Opel Scraper Runner (`/backend/src/run/opelRunner.ts`)

- Loads **cities** from `assets/cities.json`.  
- Uses **Puppeteer** to scrape Opel dealers city by city.  
- Saves results into the MongoDB collection **`opelDealers`**.  
- Updates last scrape timestamp via `updateLastScrapeTime`.  
- Currently runs **manually**, but can be deployed for automatic execution.
- Doesn't write duplicate dealers in the database
- Re-running the scheduler can also mark inactive dealers while scrapping

### 🔹 Seat Scraper Runner (`/backend/src/run/opelRunner.ts`)

- Loads **cities** from `assets/cities.json`.  
- Uses **Puppeteer** to scrape Opel dealers city by city.  
- Saves results into the MongoDB collection **`seatDealers`**.  
- Updates last scrape timestamp via `updateLastScrapeTime`.  
- Currently runs **manually**, but can be deployed for automatic execution.
- Doesn't write duplicate dealers in the database
- Re-running the scheduler can also mark inactive dealers while scrapping

---

## 🎨 Frontend Overview

### 🔹 DealerFinder Page (`/frontend/src/pages/DealerFinder.vue`)

- Provides a user-friendly form to search for dealers.  
- Displays search results on the same page with lazy loader.  
- Supports export of results as **CSV** or **XLSX**.
- Renaming the file to be downloaded is possible within the app.
- Clean UI built with **TailwindCSS**
- Proper form validation e.g. In the Postal Code field you are not allowed to type alphabets
- Shows custom design using Headless UI for example the design of the autcomple of the "Brand" field and drop down options of the "Search by" field.

---

## 📊 Database

- MongoDB stores collections like:
  - `opelDealers`
  - `dealers`
  - `seatDealers`
- Each dealer document includes fields like:
  - `name`, `street`, `postalCode`, `city`
  - `phone`, `website`, `services`, `latitude`, `longitude`
  - GeoJSON `location` (with `latitude`, `longitude`)  

---

## 🚀 Getting Started

### 1️⃣ Clone Repo
```bash
git clone https://github.com/rirumel/car-dealer-finder.git
cd car-dealer-finder
```

### 2️⃣ Backend Setup
```bash
cd packages/backend
npm install
```
- Create a .env file in /packages/backend:
```bash
MONGODB_URI=mongodb://localhost:27017
```
- Run the Express server:
```bash
npm run dev
```
- Start Kia scraper scheduler:
```bash
npx ts-node src/run/scrapScheduler.ts
```
- Run Opel scraper manually:
```bash
npx ts-node src/run/opelRunner.ts
```
- Run Seat scraper manually:
```bash
npx ts-node src/run/seatRunner.ts
```

### 3️⃣ Frontend Setup
```bash
cd packages/frontend
npm install
npm run dev
```

### Visit 👉 localhost to check if your frontend and backend running successfully

## 🔮 Roadmap / Future Enhancements

- Add scrapers for additional car brands.
- Create a common runner for all brands 
- Enhance frontend with filters, maps, and dealer details.    
- Deploy backend as a persistent service with job scheduling.  

---
