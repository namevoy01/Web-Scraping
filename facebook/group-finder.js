const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker");
const fs = require("fs");

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

// ข้อมูลล็อกอิน Facebook
const EMAIL = "test.face112@gmail.com";
const PASSWORD = "passW@rd";

async function searchFacebookGroups(searchQuery, maxGroups = 50) {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1366,768",
      "--lang=th-TH,th",
      "--disable-blink-features=AutomationControlled",
      "--disable-gpu",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      `--user-data-dir=/app/chrome-profile`,
    ],
  });

  const page = await browser.newPage();
  const cookiesPath = "./cookies.json";
  
  // ตั้งค่า encoding และ viewport
  await page.setViewport({ width: 1366, height: 768 });
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'th-TH,th;q=0.9,en;q=0.8'
  });

  try {
    // ✅ โหลด cookies ถ้ามี
    if (fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
      await page.setCookie(...cookies);
      console.log("🍪 โหลด cookies เดิมสำเร็จ — ข้ามขั้นตอนล็อกอิน");
    }

    console.log("🌐 เปิดหน้า Facebook...");
    await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded" });
    await new Promise(r => setTimeout(r, 3000));

    // ✅ ตรวจว่าล็อกอินอยู่หรือไม่
    const loggedIn = await page.evaluate(() => {
      return !!document.querySelector('a[href*="logout"], [aria-label*="บัญชี"], [aria-label*="profile"]');
    });

    if (!loggedIn) {
      console.log("🔐 ยังไม่ได้ล็อกอิน — เริ่มล็อกอินใหม่...");
      await page.goto("https://www.facebook.com/login", { waitUntil: "domcontentloaded" });

      await page.waitForSelector("#email", { timeout: 20000 });
      await page.type("#email", EMAIL, { delay: 100 });
      await page.type("#pass", PASSWORD, { delay: 100 });

      await Promise.allSettled([
        page.click('button[name="login"]'),
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }),
      ]);

      console.log("✅ เข้าสู่ระบบสำเร็จ!");
      const cookies = await page.cookies();
      fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
      console.log("💾 บันทึก cookies.json เรียบร้อย");
    } else {
      console.log("✅ พบว่าเข้าสู่ระบบอยู่แล้ว (ใช้ session เดิม)");
    }

    // ไปหน้าค้นหากลุ่ม
    const searchUrl = `https://www.facebook.com/search/groups/?q=${encodeURIComponent(searchQuery)}`;
    console.log(`🔎 กำลังค้นหากลุ่มที่มีคำว่า "${searchQuery}"...`);
    console.log(`🔗 URL: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "networkidle2" });
    
    // รอให้หน้าโหลดเสร็จ
    await new Promise(r => setTimeout(r, 3000));

    // รอโหลดผล
    await new Promise(r => setTimeout(r, 5000));

    console.log("📜 กำลังเลื่อนหน้าเพื่อโหลดกลุ่มเพิ่มเติม...");
    let previousGroupCount = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 20; // เพิ่มจำนวนการ scroll
    
    while (scrollAttempts < maxScrollAttempts) {
      // Scroll ลงไปที่ด้านล่างของหน้า
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // รอให้ Facebook โหลดข้อมูลเพิ่มเติม
      await new Promise(r => setTimeout(r, 3000));
      
      // Scroll เพิ่มเติมเพื่อให้แน่ใจว่าโหลดข้อมูลครบ
      await page.evaluate(() => {
        window.scrollBy(0, 1000);
      });
      
      await new Promise(r => setTimeout(r, 2000));
      
      // รอให้มี loading indicator หายไป (ถ้ามี)
      try {
        await page.waitForFunction(() => {
          const loadingElements = document.querySelectorAll('[data-testid="loading"], .loading, [aria-label*="Loading"]');
          return loadingElements.length === 0;
        }, { timeout: 5000 });
      } catch (e) {
        // ไม่มี loading indicator หรือหมดเวลา
      }
      
      // นับจำนวนกลุ่มปัจจุบัน
      const currentGroupCount = await page.evaluate(() => {
        return document.querySelectorAll('a[href*="/groups/"]').length;
      });
      
      console.log(`📊 Scroll ${scrollAttempts + 1}/${maxScrollAttempts} - พบลิงก์กลุ่ม: ${currentGroupCount} ลิงก์`);
      
      // ถ้าจำนวนกลุ่มไม่เพิ่มขึ้น 3 ครั้งติดต่อกัน ให้หยุด
      if (currentGroupCount === previousGroupCount) {
        console.log("⏹️ ไม่พบกลุ่มใหม่ - หยุดการ scroll");
        break;
      }
      
      previousGroupCount = currentGroupCount;
      scrollAttempts++;
      
      // ถ้าได้กลุ่มมากกว่า maxGroups กลุ่มแล้ว ให้หยุด
      if (currentGroupCount > maxGroups) {
        console.log(`✅ ได้กลุ่มมากกว่า ${maxGroups} กลุ่มแล้ว - หยุดการ scroll`);
        break;
      }
    }

    console.log("📦 กำลังดึงข้อมูลกลุ่ม...");
    const groups = await page.evaluate(() => {
      const results = [];
      
      // หาเฉพาะลิงก์กลุ่มที่อยู่ในผลการค้นหา
      // ใช้ selector ที่เฉพาะเจาะจงมากขึ้น
      const selectors = [
        'div[role="main"] a[href*="/groups/"]',
        'div[data-pagelet="SearchResults"] a[href*="/groups/"]',
        'div[role="article"] a[href*="/groups/"]'
      ];
      
      let groupLinks = [];
      selectors.forEach(selector => {
        const links = document.querySelectorAll(selector);
        groupLinks = groupLinks.concat(Array.from(links));
      });
      
      // ลบซ้ำ
      groupLinks = [...new Set(groupLinks)];
      
      groupLinks.forEach((a) => {
        const href = a.getAttribute("href");
        const name = a.innerText?.trim();
        
        // กรองแบบผ่อนคลาย - กันลิงก์ที่ชัดเจนว่าไม่ใช่กลุ่ม/ปุ่มระบบ เท่านั้น
        if (
          href &&
          name &&
          href.includes("/groups/") &&
          !href.includes("invite") &&
          !href.includes("create") &&
          !href.includes("join") &&
          !href.includes("search/groups") &&
          !href.includes("browse") &&
          !href.includes("discover") &&
          !href.includes("events") &&
          !name.includes("See all") &&
          !name.includes("View all") &&
          name.replace(/\s/g, '').length > 1 // อย่างน้อยมีตัวอักษรจริง > 1
        ) {
          const url = href.startsWith("http") ? href : `https://www.facebook.com${href}`;
          results.push({ 
            name: name, 
            url: url.split("?")[0] 
          });
        }
      });
      
      // ลบซ้ำและเรียงลำดับ
      const unique = Array.from(new Map(results.map((g) => [g.url, g])).values());
      return unique;
    });

    console.log(`✅ พบกลุ่มทั้งหมด ${groups.length} กลุ่ม`);
    
    if (groups.length > 0) {
      console.log("\n📋 ตัวอย่างกลุ่มที่พบ (10 กลุ่มแรก):");
      console.table(groups.slice(0, 10));
      
      if (groups.length > 10) {
        console.log(`\n📊 สถิติ:`);
        console.log(`   - จำนวนกลุ่มทั้งหมด: ${groups.length} กลุ่ม`);
        console.log(`   - กลุ่มที่มีชื่อภาษาไทย: ${groups.filter(g => /[\u0E00-\u0E7F]/.test(g.name)).length} กลุ่ม`);
        console.log(`   - กลุ่มที่มีชื่อภาษาอังกฤษ: ${groups.filter(g => /[a-zA-Z]/.test(g.name) && !/[\u0E00-\u0E7F]/.test(g.name)).length} กลุ่ม`);
      }
    } else {
      console.log("❌ ไม่พบกลุ่มที่ตรงตามเงื่อนไข");
    }

    // บันทึกลงไฟล์ (optional) - บันทึกเฉพาะเมื่อเรียกใช้โดยตรง
    if (require.main === module) {
      fs.writeFileSync("groups.json", JSON.stringify(groups, null, 2), "utf8");
      console.log("💾 บันทึกข้อมูลเรียบร้อยที่ไฟล์ groups.json");
    }
    
    return groups;

  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาด:", err.message);
    throw err;
  } finally {
    await browser.close();
    console.log("✅ ปิดเบราว์เซอร์เรียบร้อย");
  }
}

// ฟังก์ชันค้นหาด้วยคำค้นหาหลายคำ
async function searchMultipleQueries(queries, maxGroupsPerQuery = 20) {
  const allGroups = [];
  const seenUrls = new Set();
  
  for (const query of queries) {
    console.log(`\n🔍 กำลังค้นหาด้วยคำ: "${query}"`);
    try {
      const groups = await searchFacebookGroups(query, maxGroupsPerQuery);
      
      // เพิ่มเฉพาะกลุ่มที่ยังไม่มี
      groups.forEach(group => {
        if (!seenUrls.has(group.url)) {
          seenUrls.add(group.url);
          allGroups.push(group);
        }
      });
      
      console.log(`✅ เพิ่ม ${groups.length} กลุ่มใหม่ (รวม: ${allGroups.length} กลุ่ม)`);
      
      // ถ้าได้กลุ่มครบแล้ว ให้หยุด
      if (allGroups.length >= 50) {
        console.log("🎯 ได้กลุ่มครบ 50 กลุ่มแล้ว!");
        break;
      }
      
    } catch (error) {
      console.error(`❌ เกิดข้อผิดพลาดในการค้นหา "${query}":`, error.message);
    }
  }
  
  return allGroups;
}

// Export function สำหรับใช้ในไฟล์อื่น
module.exports = {
  searchFacebookGroups,
  searchMultipleQueries
};

// ถ้าเรียกใช้ไฟล์นี้โดยตรง: รันก็ต่อเมื่อส่งคำค้นผ่าน argument เท่านั้น
if (require.main === module) {
  const userQuery = process.argv.slice(2).join(" ");
  if (!userQuery) {
    console.log("ℹ️ ไม่ได้ระบุคำค้นหา — รอให้เรียกใช้งานผ่าน API หรือรันแบบ:\n   node group-finder.js \"<คำค้นหา>\"");
    process.exit(0);
  }
  console.log(`🚀 เริ่มค้นหาด้วยคำ: "${userQuery}"`);
  searchFacebookGroups(userQuery, 50)
    .then(groups => {
      fs.writeFileSync("groups.json", JSON.stringify(groups, null, 2), "utf8");
      console.log("💾 บันทึกข้อมูลเรียบร้อยที่ไฟล์ groups.json");
    })
    .catch(console.error);
}
