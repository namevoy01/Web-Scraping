const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");

puppeteer.use(StealthPlugin());

// ✏️ ข้อมูลล็อกอิน Facebook
const EMAIL = "test.face112@gmail.com";
const PASSWORD = "passW@rd";

// ✏️ คำค้นหา
const SEARCH_QUERY = "เบียร์";

async function searchFacebookGroups() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  console.log("🔹 กำลังเข้าสู่ระบบ Facebook...");
  await page.goto("https://www.facebook.com/login", { waitUntil: "networkidle2" });

  await page.type("#email", EMAIL, { delay: 50 });
  await page.type("#pass", PASSWORD, { delay: 50 });

  await Promise.all([
    page.click('button[name="login"]'),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);

  console.log("✅ เข้าสู่ระบบสำเร็จ!");

  const searchUrl = `https://www.facebook.com/search/groups/?q=${encodeURIComponent(
    SEARCH_QUERY
  )}`;
  console.log(`🔎 กำลังค้นหากลุ่มที่มีคำว่า "${SEARCH_QUERY}"...`);
  await page.goto(searchUrl, { waitUntil: "networkidle2" });

  // รอให้ผลการค้นหาปรากฏ
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Scroll ลงเพื่อโหลดข้อมูลเพิ่มเติม
  console.log("📜 กำลังเลื่อนหน้าเพื่อโหลดกลุ่มเพิ่มเติม...");
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log("📦 กำลังดึงข้อมูลกลุ่ม...");
  const groups = await page.evaluate(() => {
    const results = [];
    const anchors = document.querySelectorAll('a[href*="/groups/"]');

    anchors.forEach((a) => {
      const href = a.getAttribute("href");
      const name = a.innerText?.trim();

      // ตรวจสอบให้แน่ใจว่าเป็นลิงก์กลุ่มจริง
      if (
        href &&
        name &&
        href.includes("/groups/") &&
        !href.includes("invite") &&
        !href.includes("create") &&
        !href.includes("join")
      ) {
        const url = href.startsWith("http") ? href : `https://www.facebook.com${href}`;
        results.push({
          name,
          url: url.split("?")[0],
        });
      }
    });

    // กรองซ้ำ
    const unique = [];
    const seen = new Set();
    for (const g of results) {
      if (!seen.has(g.url)) {
        seen.add(g.url);
        unique.push(g);
      }
    }
    return unique;
  });

  console.log(`✅ พบกลุ่มทั้งหมด ${groups.length} กลุ่ม`);
  console.table(groups.slice(0, 10));

  // บันทึกลงไฟล์
  fs.writeFileSync("groups.json", JSON.stringify(groups, null, 2), "utf8");
  console.log("💾 บันทึกข้อมูลเรียบร้อยที่ไฟล์ groups.json");

  await browser.close();
}

searchFacebookGroups().catch(console.error);
