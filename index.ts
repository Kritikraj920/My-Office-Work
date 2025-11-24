import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, install, getInstalledBrowsers, resolveBuildId, detectBrowserPlatform } from '@puppeteer/browsers';
import * as path from 'node:path';
import { promises as fs } from 'node:fs'; // Keep this import for file system operations
import { Page, LaunchOptions, Browser as PuppeteerBrowser } from 'puppeteer';

// Apply the stealth plugin to puppeteer-extra
puppeteer.use(StealthPlugin());

async function getBrowserExecutablePath(browserType: string): Promise<string> {
    // Determine the correct browser type for @puppeteer/browsers
    const desiredBrowser = browserType === 'firefox' ? Browser.FIREFOX : Browser.CHROME;
    const cacheDir = path.join(__dirname, '.browser-cache');
    
    // Check if the browser is already installed by our script
    const installedBrowsers = await getInstalledBrowsers({ cacheDir });
    // Find a browser of the desired type that has a valid executable path
    const installedBrowser = installedBrowsers.find(b => b.browser === desiredBrowser && b.executablePath);

    if (installedBrowser) {
        return installedBrowser.executablePath;
    }

    console.log(`Downloading a compatible browser... This is a one-time setup per environment.`);
    
    // For Firefox, resolve the latest available build ID. For Chrome, use a known-good one.
    const platform = detectBrowserPlatform();
    if (!platform) {
        throw new Error('Could not detect browser platform.');
    }

    const buildId = desiredBrowser === Browser.FIREFOX 
        ? await resolveBuildId(Browser.FIREFOX, platform, 'latest') 
        : '126.0.6478.126';

    const newBrowser = await install({ browser: desiredBrowser, buildId, cacheDir });
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
            args: [
                '--disable-web-security', 
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--dns-server=8.8.8.8' // Use Google's public DNS server
            ],
        };

        switch (browserType) {
            case 'firefox':
            case 'edge': // Fallthrough is intentional as both use Chromium
            case 'chrome':
            default:
                // This guarantees a browser is available, making the script portable.
                const executablePath = await getBrowserExecutablePath(browserType);                
                browser = await puppeteer.launch({ ...launchOptions, executablePath });
                break;
        }
        const page: Page = await (browser as any).newPage(); // Cast to any to access newPage

        console.log('Navigating to RBI homepage to simulate human behavior...');
        await page.goto('https://www.rbi.org.in/', { 
            waitUntil: 'domcontentloaded', // Wait for the main document to load, not all resources
            timeout: 60000 // Increase timeout to 60 seconds for more resilience
        });

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
