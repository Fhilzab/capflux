import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/tmp/commandcode-0/-root-workspace-capflux/17ca0ae1-02ed-4c25-bf29-56d241cc7fc6/scratchpad/mobileqa';
const CHROME_PATH = '/root/.cache/puppeteer/chrome/linux_arm-151.0.7922.77/chrome-linux64/chrome';

const widths = [320, 360, 375, 430];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });

  const pages = [
    { name: 'landing', url: 'http://localhost:5173/' },
    { name: 'auth', url: 'http://localhost:5173/auth?mode=login' },
  ];

  for (const page of pages) {
    for (const width of widths) {
      const height = width === 320 ? 568 : width === 360 ? 640 : width === 375 ? 667 : 932;
      const pageInstance = await browser.newPage();
      await pageInstance.setViewport({ width, height, deviceScaleFactor: 2 });
      
      await pageInstance.goto(page.url, { waitUntil: 'networkidle0', timeout: 15000 });
      await new Promise(r => setTimeout(r, 2000));
      
      const filename = `${page.name}_${width}.png`;
      await pageInstance.screenshot({
        path: path.join(SCREENSHOT_DIR, filename),
        fullPage: false
      });
      
      const scrollInfo = await pageInstance.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientHeight: document.documentElement.clientHeight,
        };
      });
      
      fs.appendFileSync(
        path.join(SCREENSHOT_DIR, 'overflow-check.txt'),
        `${page.name}_${width}: scrollWidth=${scrollInfo.scrollWidth} clientWidth=${scrollInfo.clientWidth} horizontalOverflow=${scrollInfo.scrollWidth > scrollInfo.clientWidth}\n`
      );
      
      console.log(`Captured ${filename}, overflow: ${scrollInfo.scrollWidth > scrollInfo.clientWidth}`);
      await pageInstance.close();
    }
  }

  await browser.close();
  console.log('Done!');
})().catch(e => { console.error(e); process.exit(1); });
