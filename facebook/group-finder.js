// group-finder.js (Program 2 - hardened)
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

// ===== Configuration =====
const EMAIL = 'test.face112@gmail.com';
const PASSWORD = 'passW@rd';

// ถ้าตั้ง env นี้จะใช้ user-data-dir แทน cookies.json
const PROFILE_DIR = process.env.FB_PROFILE_DIR || ''; // e.g. "C:\\chrome-profile" หรือ "/app/chrome-profile"
const USE_PROFILE = !!PROFILE_DIR;
const COOKIES_PATH = path.resolve('./cookies.json');

// ===== Helpers =====
async function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function isLoggedInByCookie(page) {
  // ตรวจด้วยคุกกี้ของ fb (ทนกว่าเช็ค DOM)
  return page.evaluate(() => document.cookie.includes('c_user='));
}

async function closeCommonPopups(page) {
  try {
    await page.evaluate(() => {
      document
        .querySelectorAll('[aria-label="ปิด"], [aria-label="Close"], [data-testid="cookie-policy-dialog-accept-button"]')
        .forEach((b) => b.click());
    });
  } catch {}
}

async function ensureLoggedIn(page) {
  // เปิดหน้า m.facebook เบา/เสถียรกว่า
  await page.goto('https://m.facebook.com/', { waitUntil: 'domcontentloaded' });
  if (await isLoggedInByCookie(page)) return true;

  // ไปหน้า login โดยตรง
  await page.goto('https://m.facebook.com/login.php', { waitUntil: 'domcontentloaded' });

  // selector แบบยืดหยุ่น
  await page.waitForSelector('input[name="email"]', { timeout: 20000 });
  await page.type('input[name="email"]', EMAIL, { delay: 60 });
  await page.type('input[name="pass"]', PASSWORD, { delay: 60 });

  await Promise.allSettled([
    page.click('button[name="login"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
  ]);

  await closeCommonPopups(page);

  // ยืนยันได้คุกกี้ session จริง
  await page.waitForFunction(() => document.cookie.includes('c_user='), { timeout: 30000 });

  // บันทึก cookies เฉพาะโหมด cookies
  if (!USE_PROFILE) {
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log('💾 saved cookies.json');
  }

  return true;
}

async function loadCookiesIfAny(page) {
  if (USE_PROFILE) return; // โหมดโปรไฟล์ไม่ใช้ cookies.json
  if (fs.existsSync(COOKIES_PATH)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
      if (Array.isArray(cookies) && cookies.length) {
        await page.setCookie(...cookies);
        console.log('🍪 loaded cookies.json');
      }
    } catch (e) {
      console.warn('⚠️ failed to load cookies.json:', e.message);
    }
  }
}

// ===== Core =====
async function searchFacebookGroups(searchQuery, maxGroups = 50) {
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1366,768',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',
    '--lang=th-TH,th;q=0.9,en;q=0.8',
  ];

  if (USE_PROFILE) {
    launchArgs.push(`--user-data-dir=${PROFILE_DIR}`);
    console.log(`👤 Using Chrome profile: ${PROFILE_DIR}`);
  }

  const browser = await puppeteer.launch({
    headless: true, // แทน "new"
    // ไม่บังคับ executablePath ให้ puppeteer จัดการเอง เว้นแต่คุณตั้งเองจริง ๆ
    args: launchArgs,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'th-TH,th;q=0.9,en;q=0.8' });

  try {
    // 1) โหลด cookies (ถ้าใช้โหมด cookies)
    await loadCookiesIfAny(page);

    // 2) ยืนยันเข้าสู่ระบบ
    console.log('🔐 ensuring login…');
    await ensureLoggedIn(page);
    console.log('✅ logged in');

    // 3) เปิดหน้าค้นหากลุ่มบนเว็บหลัก (ผลค้นหาเยอะกว่า m.)
    const searchUrl = `https://www.facebook.com/search/groups/?q=${encodeURIComponent(searchQuery)}`;
    console.log(`🔎 search: "${searchQuery}"`);
    console.log(`🔗 ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
    await delay(3000);
    await closeCommonPopups(page);

    // 4) Scroll โหลดผลลัพธ์
    console.log('📜 scrolling…');
    let previousCount = 0;
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(2500);
      await page.evaluate(() => window.scrollBy(0, 1000));
      await delay(1500);

      const currentCount = await page.evaluate(
        () => document.querySelectorAll('a[href*="/groups/"]').length
      );
      console.log(`   • pass ${i + 1}/20 — links: ${currentCount}`);

      if (currentCount >= maxGroups) {
        console.log(`✅ reached target (${maxGroups})`);
        break;
      }
      if (currentCount === previousCount) {
        console.log('⏹️ no more new results');
        break;
      }
      previousCount = currentCount;
    }

    // 5) ดึงข้อมูลกลุ่ม
    console.log('📦 extracting…');
    const groups = await page.evaluate(() => {
      const results = [];
      const selectors = [
        'div[role="main"] a[href*="/groups/"]',
        'div[data-pagelet="SearchResults"] a[href*="/groups/"]',
        'div[role="article"] a[href*="/groups/"]',
      ];

      let links = [];
      selectors.forEach((sel) => (links = links.concat(Array.from(document.querySelectorAll(sel)))));

      // unique
      links = [...new Set(links)];

      links.forEach((a) => {
        const href = a.getAttribute('href');
        const name = a.innerText?.trim();
        if (
          href &&
          name &&
          href.includes('/groups/') &&
          !href.includes('invite') &&
          !href.includes('create') &&
          !href.includes('join') &&
          !href.includes('search/groups') &&
          !href.includes('browse') &&
          !href.includes('discover') &&
          !href.includes('events') &&
          name.replace(/\s/g, '').length > 1
        ) {
          const url = href.startsWith('http') ? href : `https://www.facebook.com${href}`;
          results.push({ name, url: url.split('?')[0] });
        }
      });

      return Array.from(new Map(results.map((g) => [g.url, g])).values());
    });

    console.log(`✅ found ${groups.length} groups`);
    if (groups.length > 0) {
      console.table(groups.slice(0, 10));
    } else {
      console.log('❌ no groups found');
    }

    // 6) บันทึกเฉพาะเมื่อรันไฟล์นี้ตรง ๆ
    if (require.main === module) {
      fs.writeFileSync('groups.json', JSON.stringify(groups, null, 2), 'utf8');
      console.log('💾 saved groups.json');
    }

    return groups;
  } catch (err) {
    console.error('❌ error:', err.message);
    throw err;
  } finally {
    await browser.close();
    console.log('✅ browser closed');
  }
}

// ค้นหาหลายคำแล้วรวมผลแบบ unique
async function searchMultipleQueries(queries, maxGroupsPerQuery = 20) {
  const allGroups = [];
  const seen = new Set();

  for (const q of queries) {
    console.log(`\n🔍 query: "${q}"`);
    try {
      const gs = await searchFacebookGroups(q, maxGroupsPerQuery);
      for (const g of gs) {
        if (!seen.has(g.url)) {
          seen.add(g.url);
          allGroups.push(g);
        }
      }
      console.log(`✅ added ${gs.length}; total ${allGroups.length}`);
      if (allGroups.length >= 50) {
        console.log('🎯 reached 50 groups');
        break;
      }
    } catch (e) {
      console.error(`❌ query failed "${q}":`, e.message);
    }
  }

  return allGroups;
}

module.exports = { searchFacebookGroups, searchMultipleQueries };

// CLI usage
if (require.main === module) {
  const userQuery = process.argv.slice(2).join(' ');
  if (!userQuery) {
    console.log('ℹ️ ใช้งานแบบ:\n   node group-finder.js "<คำค้นหา>"');
    process.exit(0);
  }
  console.log(`🚀 search "${userQuery}"`);
  searchFacebookGroups(userQuery, 50)
    .then((groups) => {
      fs.writeFileSync('groups.json', JSON.stringify(groups, null, 2), 'utf8');
      console.log('💾 saved groups.json');
    })
    .catch(console.error);
}
