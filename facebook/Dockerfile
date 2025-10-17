# ✅ Base image
FROM node:22-slim

# ✅ ติดตั้ง dependencies ที่ Chromium ต้องใช้
RUN apt-get update && apt-get install -y \
  wget \
  gnupg \
  ca-certificates \
  fonts-liberation \
  fonts-thai-tlwg \
  libasound2 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  locales \
  tzdata \
  chromium \
  xvfb \
  && rm -rf /var/lib/apt/lists/*

# ✅ ตั้งค่า locale และ timezone ให้เหมือนเครื่องจริง
RUN locale-gen th_TH.UTF-8
ENV LANG=th_TH.UTF-8
ENV LANGUAGE=th_TH:th
ENV LC_ALL=th_TH.UTF-8
ENV TZ=Asia/Bangkok

# ✅ Working directory
WORKDIR /app

# ✅ คัดลอก dependencies
COPY package*.json ./

# ✅ ติดตั้ง dependencies
RUN npm ci --only=production || npm install --production

# ✅ ติดตั้ง puppeteer-extra และปลั๊กอิน (เผื่อไม่ได้ lock ไว้)
RUN npm install puppeteer-extra puppeteer-extra-plugin-stealth puppeteer-extra-plugin-adblocker

# ✅ คัดลอก source code ทั้งหมด
COPY . .

# ✅ ตั้ง environment variables
ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV GROUPS_OUTPUT_PATH=/var/tmp/groups.json

# ✅ เปิดสิทธิ์สำหรับโฟลเดอร์เก็บ session
RUN mkdir -p /app/chrome-profile && chmod -R 777 /app/chrome-profile

# ✅ เปิดพอร์ต API
EXPOSE 3001

# ✅ รันสคริปต์หลัก (server.js)
CMD ["node", "server.js"]


