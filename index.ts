import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import { promises as fs } from 'fs';
import { Browser, Page } from 'puppeteer';

// Apply the stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

(async () => {
    const pdfUrl: string = "https://rbidocs.rbi.org.in/rdocs/notification/PDFs/NT978AB28DBE30F440049F0EEC7EEEE9D3C5.PDF";
    const filename: string = path.basename(pdfUrl);
    const outputPath: string = path.join(__dirname, filename);

    let browser: Browser | null = null;

    try {
        console.log('Launching browser...');
        browser = await puppeteer.launch({
            // When deploying to a server, it's best to let Puppeteer use the
            // compatible Chromium version it downloads automatically.
            // The 'executablePath' is removed for this reason.
            headless: "shell",
            // '--no-sandbox' is often required in Linux/Docker environments.
            args: ['--disable-web-security', '--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page: Page = await browser.newPage();

        console.log('Navigating to RBI homepage to simulate human behavior...');
        await page.goto('https://www.rbi.org.in/', { waitUntil: 'networkidle0' });

        console.log(`Fetching PDF content from ${pdfUrl}...`);

        // Use page.evaluate to run fetch in the browser's context
        const pdfBufferAsArray: number[] = await page.evaluate(async (url) => {
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            // Convert ArrayBuffer to a plain array of numbers to be sent back to Node.js
            return Array.from(new Uint8Array(buffer));
        }, pdfUrl);

        if (pdfBufferAsArray && pdfBufferAsArray.length > 0) {
            console.log('PDF content received. Saving file...');
            // Convert the array of numbers back to a Buffer and save it
            await fs.writeFile(outputPath, Buffer.from(pdfBufferAsArray));
            console.log(`\n✅ PDF saved successfully to: ${outputPath}`);
        } else {
            console.error('❌ Failed to fetch PDF content.');
        }
    } catch (error) {
        console.error('❌ An error occurred:', error);
    } finally {
        await browser?.close();
        console.log('Browser closed.');
    }
})();
