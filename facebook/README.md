# Facebook Groups Scraper API

API สำหรับค้นหา Facebook Groups โดยใช้ Puppeteer

## โครงสร้างไฟล์

```
facebook/
├── server.js          # Express.js API Server
├── group-finder.js    # Facebook Groups Scraper Module
├── package.json       # Dependencies และ Scripts
├── cookies.json       # Facebook Login Cookies (auto-generated)
├── groups.json        # ผลลัพธ์การค้นหา (auto-generated)
└── README.md          # เอกสารนี้
```

## การติดตั้ง

```bash
npm install
```

## การใช้งาน

### 1. เริ่ม API Server

```bash
npm start
# หรือ
node server.js
```

Server จะรันที่ `http://localhost:3001`

### 2. ใช้ Scraper โดยตรง (ไม่ผ่าน API)

```bash
npm run scraper
# หรือ
node group-finder.js
```

## API Endpoints

### GET /

แสดงข้อมูล API และวิธีการใช้งาน

**Response:**
```json
{
  "message": "Facebook Groups Scraper API",
  "version": "1.0.0",
  "endpoints": {
    "GET /search": "Search Facebook groups by query parameter",
    "GET /search?q=เบียร์": "Example: Search for groups with 'เบียร์'"
  }
}
```

### GET /search?q={query}

ค้นหา Facebook Groups ตามคำค้นหา

**Parameters:**
- `q` (required): คำค้นหา

**Example:**
```bash
curl "http://localhost:3001/search?q=เบียร์"
```

**Response:**
```json
{
  "success": true,
  "query": "เบียร์",
  "total_groups": 8,
  "groups": [
    {
      "name": "คนรักกระป๋องเบียร์ไทย-นอก และอื่นๆ",
      "url": "https://www.facebook.com/groups/899243496833153/"
    }
  ]
}
```

## การตั้งค่า

แก้ไขข้อมูลล็อกอินใน `group-finder.js`:

```javascript
const EMAIL = "your-email@example.com";
const PASSWORD = "your-password";
```

## หมายเหตุ

- ระบบจะบันทึก cookies ไว้ใน `cookies.json` เพื่อไม่ต้องล็อกอินใหม่ทุกครั้ง
- ผลลัพธ์จะถูกบันทึกลง `groups.json` ด้วย
- ใช้ Puppeteer Stealth Plugin เพื่อหลีกเลี่ยงการตรวจจับ
