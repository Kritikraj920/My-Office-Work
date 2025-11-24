import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, install, getInstalledBrowsers } from '@puppeteer/browsers';
import * as path from 'node:path';
import { promises as fs } from 'node:fs'; // Keep this import for file system operations
import { Page, LaunchOptions, Browser as PuppeteerBrowser } from 'puppeteer';

// Apply the stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

async function getBrowserExecutablePath(browserType: string): Promise<string> {
    const desiredBrowser = browserType === 'edge' ? Browser.CHROME : Browser.CHROME; // @puppeteer/browsers uses CHROME for Edge
    const cacheDir = path.join(__dirname, '.browser-cache');
    
    // Check if the browser is already installed by puppeteer
    const installedBrowsers = await getInstalledBrowsers({ cacheDir });
    const installedBrowser = installedBrowsers.find(b => b.browser === desiredBrowser);

    if (installedBrowser) {
        console.log(`${browserType} is already installed at ${installedBrowser.path}`);
        return installedBrowser.executablePath;
    }

    console.log(`Downloading ${browserType}... This might take a moment.`);
    const newBrowser = await install({ browser: desiredBrowser, buildId: '126.0.6478.126', cacheDir });
    console.log(`${browserType} downloaded successfully to ${newBrowser.path}`);
    return newBrowser.executablePath;
}

(async () => {
    const pdfUrl: string = "https://rbidocs.rbi.org.in/rdocs/notification/PDFs/NT978AB28DBE30F440049F0EEC7EEEE9D3C5.PDF";
    const filename: string = path.basename(pdfUrl);
    const outputPath: string = path.join(__dirname, filename);

    let browser: PuppeteerBrowser | null = null;

    // Read browser choice from environment variable, defaulting to 'edge' (Microsoft Edge)
    const browserType = process.env.PUPPETEER_BROWSER || 'edge';

    try {
        console.log(`Launching ${browserType}...`);

        const launchOptions: LaunchOptions = {
            headless: "shell",
            args: ['--disable-web-security', '--no-sandbox', '--disable-setuid-sandbox'],
        };
        let executablePath: string | undefined = undefined;

        switch (browserType) {
            case 'firefox':
                (launchOptions as any).product = 'firefox'; // Cast to any to allow product property
                // Firefox doesn't support headless: "shell", so we use the new headless mode.
                // Also remove Chrome-specific '--disable-setuid-sandbox' argument.
                launchOptions.headless = true; // Use boolean true for the new headless mode in Firefox
                launchOptions.args = ['--disable-web-security', '--no-sandbox'];
                break;
            case 'edge': // Fallthrough to default is intentional
            default: // 'chrome'
                executablePath = await getBrowserExecutablePath(browserType);
                break;
        }

        browser = await puppeteer.launch({ ...launchOptions, executablePath });
        const page: Page = await (browser as any).newPage(); // Cast to any to access newPage

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
