const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = 5000;

// Tell Express to serve everything in the 'public' folder as static files
app.use(express.static(path.join(__dirname, 'public')));

// The Scraping Endpoint
app.get('/api/news', async (req, res) => {
    try {
        const { data } = await axios.get('https://news.ycombinator.com/');
        const $ = cheerio.load(data);
        const articles = [];

        $('.athing').each((i, el) => {
            if (i < 15) { // Get top 15 items
                const title = $(el).find('.titleline > a').text();
                const url = $(el).find('.titleline > a').attr('href');
                articles.push({ title, url });
            }
        });

        res.json(articles);
    } catch (err) {
        res.status(500).json({ error: "Failed to scrape data" });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running! Open http://localhost:${PORT} in your browser.`);
});