# 🌐 Geo & Timezone Changer

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-2563eb?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Browsers](https://img.shields.io/badge/Chrome%20%7C%20Edge%20%7C%20Brave-Compatible-10b981?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](LICENSE)

افزونه سبک و قدرتمند مبتنی بر **Manifest V3** برای شبیه‌سازی موقعیت جغرافیایی GPS و منطقه زمانی (Timezone) در تمام وب‌سایت‌ها و اپلیکیشن‌های وب.

---

## ✨ قابلیت‌ها

- 📍 **جعل موقعیت GPS:** بازنویسی بومی `navigator.geolocation` (`getCurrentPosition` و `watchPosition`) با مختصات دلخواه.
- ⏰ **تغییر منطقه زمانی:** تنظیم دقیق IANA Timezone بر روی کلاس `Intl.DateTimeFormat` و متدهای اصلی `Date.prototype`.
- 🏙️ **انتخاب سریع شهرها:** شامل لیست آماده از شهرهای مهم دنیا (تهران، نیویورک، آمستردام، برلین، توکیو و...) به همراه امکان درج مختصات دستی.
- ⚡ **اعمال بدون وقفه:** دکمه رفرش آنی برگه برای مشاهده فوری تغییرات در سایت هدف.
- 🔒 **حفظ حریم خصوصی:** اجرای ۱۰۰٪ محلی در مرورگر بدون ارسال داده به سرور خارجی.

---

## 🚀 راهنمای نصب (کمتر از ۱ دقیقه)

1. مخزن را کلون کنید یا فایل‌های پروژه را دانلود نمایید:
   ```bash
   git clone https://github.com/AlefAhmadi/Geo-Timezone-Extension.git
   ```
2. مرورگر خود (Chrome / Edge / Brave) را باز کرده و به آدرس `chrome://extensions` بروید.
3. در گوشه بالا سمت راست، گزینه **Developer mode** را فعال کنید.
4. روی دکمه **Load unpacked** کلیک کرده و پوشه پروژه را انتخاب کنید.

---

## 🎯 نحوه استفاده

1. روی آیکون افزونه در نوار ابزار کلیک کنید.
2. شهر دلخواه را انتخاب کرده یا مختصات (Lat / Lng) و Timezone مورد نظر را وارد نمایید.
3. دکمه **ذخیره و اعمال در مرورگر** و سپس **اعمال فوری و رفرش این صفحه 🔄** را بزنید.

---

## 📁 ساختار فایل‌ها

- `manifest.json`: مشخصات و کانفیگ اکستنشن (Manifest V3)
- `inject.js`: هوک Native برای بازنویسی APIهای Geolocation و Intl در World اصلی صفحه
- `content.js`: ارتباط بین حافظه اکستنشن و اسکریپت تزریق‌شده
- `background.js`: سرویس‌ورکر پس‌زمینه برای مدیریت وضعیت و Badge
- `popup.html` و `popup.js`: رابط کاربری پاپ‌آپ و انتخابگر شهرها

---

## 👤 توسعه‌دهنده

توسعه‌داده‌شده توسط [Alef Ahmadi](https://github.com/AlefAhmadi).
