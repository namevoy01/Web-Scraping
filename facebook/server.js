const express = require('express');
const { searchFacebookGroups, searchMultipleQueries } = require('./group-finder');
const fs = require('fs');
const path = require('path');

// สร้าง Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json({ charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));

// ตั้งค่า encoding สำหรับ response
app.use((req, res, next) => {
  res.charset = 'utf-8';
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Request logging (start/end, duration, status)
app.use((req, res, next) => {
  const start = Date.now();
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
  const ua = (req.headers['user-agent'] || '').toString();
  console.log(`➡️  ${req.method} ${req.originalUrl} | ip=${ip} | ua=${ua}`);
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`⬅️  ${req.method} ${req.originalUrl} | status=${res.statusCode} | ${ms}ms`);
  });
  next();
});

// ✅ Serve static files so you can GET /app/groups.json
app.use("/app", express.static(__dirname + "/"));

// ✅ Simple test endpoint (keeps existing root docs unchanged)
app.get('/app-test', (req, res) => {
  res.send('🚀 JSON static server enabled. Try GET /app/groups.json');
});

// API Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Facebook Groups Scraper API',
    version: '1.0.0',
    endpoints: {
      'GET /search': 'Search Facebook groups by query parameter',
      'GET /search?q=<query>': 'Example: /search?q=ร้านอาหาร',
      'GET /search-multiple': 'Search with multiple queries',
      'GET /search-multiple?queries=<q1>,<q2>': 'Example: /search-multiple?queries=ร้านอาหาร,เครื่องดื่ม'
    },
    usage: {
      method: 'GET',
      url: '/search',
      parameters: {
        q: 'Search query (required)'
      },
      example: 'http://localhost:3001/search?q=<query>'
    }
  });
});

// กำหนดพาธไฟล์ผลลัพธ์ โดยอ่านจาก ENV ถ้ามี (เช่นใน Docker)
const getOutputPath = () => {
  const envPath = process.env.GROUPS_OUTPUT_PATH;
  if (envPath && typeof envPath === 'string' && envPath.trim().length > 0) {
    return envPath;
  }
  return path.resolve('groups.json');
};

// เขียนค่าเริ่มต้นเป็น [] เมื่อแอพรันใหม่
const initializeOutputFile = () => {
  try {
    const outputPath = getOutputPath();
    const outDir = path.dirname(outputPath);
    try { fs.mkdirSync(outDir, { recursive: true }); } catch (_) {}
    fs.writeFileSync(outputPath, '[]', 'utf8');
    console.log(`🧹 รีเซ็ตไฟล์ผลลัพธ์ -> ${outputPath} เป็น []`);
  } catch (e) {
    console.error('⚠️ รีเซ็ตไฟล์ผลลัพธ์ไม่สำเร็จ:', e.message);
  }
};

app.get('/search', async (req, res) => {
  try {
    const { q, maxGroups = 50 } = req.query;
    
    // ตรวจสอบ parameter
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Missing query parameter "q"',
        example: '/search?q=เบียร์'
      });
    }

    console.log(`🔍 API Request: Searching for "${q}" (max: ${maxGroups})`);
    
    // เรียกใช้ function จาก group-finder.js
    const t0 = Date.now();
    const groups = await searchFacebookGroups(q, parseInt(maxGroups));

    // สร้าง payload ตรงกับ response
    const payload = {
      success: true,
      query: q,
      total_groups: groups.length,
      groups: groups
    };
    
    // เขียนทับไฟล์ด้วย payload เดียวกับที่ส่งออก
    try {
      const outputPath = getOutputPath();
      const outDir = path.dirname(outputPath);
      try { fs.mkdirSync(outDir, { recursive: true }); } catch (_) {}
      fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
      console.log(`💾 เขียนไฟล์ผลลัพธ์ (overwrite) สำเร็จ -> ${outputPath}`);
      // Log details summary
      const ms = Date.now() - t0;
      console.log(`📊 Summary | q="${q}" | total=${payload.total_groups} | wrote=${outputPath} | ${ms}ms`);
      if (Array.isArray(groups) && groups.length) {
        console.log('📋 ตัวอย่าง 10 รายการแรก:');
        console.table(groups.slice(0, 10));
      }
    } catch (e) {
      console.error('❌ เขียนไฟล์ groups.json ล้มเหลว:', e.message);
    }
    
    res.json(payload);

  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// เพิ่ม endpoint สำหรับค้นหาด้วยคำค้นหาหลายคำ
app.get('/search-multiple', async (req, res) => {
  try {
    const { queries, maxGroupsPerQuery = 15 } = req.query;
    
    // ตรวจสอบ parameter
    if (!queries) {
      return res.status(400).json({
        success: false,
        error: 'Missing query parameter "queries"',
        example: '/search-multiple?queries=เบียร์,beer,คราฟเบียร์'
      });
    }

    const queryList = queries.split(',').map(q => q.trim());
    console.log(`🔍 API Request: Searching with multiple queries: ${queryList.join(', ')}`);
    
    // เรียกใช้ function จาก group-finder.js
    const t0 = Date.now();
    const groups = await searchMultipleQueries(queryList, parseInt(maxGroupsPerQuery));

    // สร้าง payload ตรงกับ response
    const payload = {
      success: true,
      queries: queryList,
      total_groups: groups.length,
      groups: groups
    };

    // เขียนทับไฟล์ด้วย payload เดียวกับที่ส่งออก
    try {
      const outputPath = getOutputPath();
      const outDir = path.dirname(outputPath);
      try { fs.mkdirSync(outDir, { recursive: true }); } catch (_) {}
      fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
      console.log(`💾 เขียนไฟล์ผลลัพธ์ (overwrite) สำเร็จ -> ${outputPath}`);
      const ms = Date.now() - t0;
      console.log(`📊 Summary | queries=[${queryList.join(', ')}] | total=${payload.total_groups} | wrote=${outputPath} | ${ms}ms`);
      if (Array.isArray(groups) && groups.length) {
        console.log('📋 ตัวอย่าง 10 รายการแรก:');
        console.table(groups.slice(0, 10));
      }
    } catch (e) {
      console.error('❌ เขียนไฟล์ groups.json ล้มเหลว:', e.message);
    }
    
    res.json(payload);

  } catch (error) {
    console.error('❌ API Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server with error handling
// รีเซ็ตไฟล์ก่อนเริ่มรับคำขอ
initializeOutputFile();

const server = app.listen(PORT, () => {
  console.log(`🚀 Facebook Groups Scraper API is running on port ${PORT}`);
  console.log(`📡 Try: http://localhost:${PORT}/search?q=<query>`);
  console.log(`📖 Documentation: http://localhost:${PORT}/`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`❌ Port ${PORT} is already in use. Trying port ${PORT + 1}...`);
    const newPort = PORT + 1;
    const newServer = app.listen(newPort, () => {
      console.log(`🚀 Facebook Groups Scraper API is running on port ${newPort}`);
      console.log(`📡 Try: http://localhost:${newPort}/search?q=<query>`);
      console.log(`📖 Documentation: http://localhost:${newPort}/`);
    });
  } else {
    console.error('❌ Server error:', err);
  }
});

module.exports = app;
