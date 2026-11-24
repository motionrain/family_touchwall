# 🖥️ HR Touchwall — Family Touchwall & Touchwall Pocket


## Copyright & License

**Copyright © 2026 Hans Richter. All rights reserved.**

This software (**HR Family TouchWall / HR Familien Touchwall**), including all source codes, scripts, interfaces, configuration files, designs, graphics, and documentation, is **strictly proprietary and protected by copyright**. It is expressly **not open-source software**.

Without a prior, express, and **written license agreement** from the Author, any use is prohibited. In particular, the following actions are prohibited:

* installing, executing, or productively operating the software (whether privately or commercially),
* copying, distributing, publishing, sharing, or sublicensing (even in part),
* selling, renting, or passing on the software in any form to third parties or competitors,
* modifying, rewriting, forking, replicating, or removing copyright notices,
* using the source code or documentation to train AI systems.

Technical access to the repository, installation files, or a running system alone does **not confer any usage or ownership rights**. Violations will be prosecuted under civil and criminal law (Sections 97, 106 German Copyright Act – UrhG).

The complete, binding terms can be found in the file [`LICENSE.md`](./LICENSE.md).


[![Next.js](https://img.shields.io/badge/Next.js-App%20Router-000000?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18%2F19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-UI-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%26%20Realtime-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Android%20%26%20iOS%2FiPadOS-4F46E5)](#pwa-installation-android-iphone--ipad)

**HR Touchwall** is a self-hosted family organizer for wall-mounted touchscreens (e.g., wall-mounted TV with an IR touch overlay, tablet, or mini-PC), including the mobile companion app **Touchwall Pocket** (`/pocket`) for Android, iPhone, and iPad.

Calendar, tasks, shopping lists, pantry with best-before date (BBD) monitoring, AI barcode/date scanner, regional supermarket offers, meal planner, school timetables, and a gamified **Skill Board** synchronize in real time across all devices.

---

## 📑 Table of Contents

1. [Highlights & Features](#-highlights--features)
2. [Tech Stack & Architecture](#-tech-stack--architecture)
3. [Prerequisites](#-prerequisites)
4. [Installation (Step by Step)](#-installation-step-by-step)
   - [1. Clone Repository & Install Dependencies](#1-clone-repository--install-dependencies)
   - [2. Set Up Supabase (Database & Permissions)](#2-set-up-supabase-database--permissions)
   - [3. Configure Environment Variables (.env.local)](#3-configure-environment-variables-envlocal)
   - [4. Start Locally](#4-start-locally)
5. [Deployment on Vercel (incl. Daily Offers Cron)](#-deployment-on-vercel-incl-daily-offers-cron)
6. [PWA Installation (Android, iPhone & iPad)](#-pwa-installation-android-iphone--ipad)
7. [Wall Display / Kiosk Mode (Linux & iPad)](#-wall-display--kiosk-mode-linux--ipad)
8. [Project Structure](#-project-structure)
9. [Troubleshooting](#-troubleshooting)

---

## ✨ Highlights & Features

### 🖥️ Two Tailored User Interfaces
* **Main Touchwall (`/`):** Optimized for large wall-mounted monitors, touchscreens, and iPads in landscape mode with tile, table, and weekly views.
* **Touchwall Pocket (`/pocket`):** Mobile PWA for on-the-go use featuring an offline buffer, smooth swipe gestures between categories, a floating category carousel, a compact 2-button dock (*Category* + *Scanner*), and safe-area support for iPhone notch / Dynamic Island and home indicator bar.

### 🔐 Unified Login System, Roles & Live Online Status
* **3-Field Login:** Sign in using **Family ID**, personal **Username**, and **Password or PIN** per family member.
* **Parent & Child Permissions:** Parent accounts have full admin privileges. Protected actions (editing/copying/deleting events, removing parent tasks, modifying accounts & Skill Board ranks) are locked in child or guest mode and require parent confirmation.
* **Automatic Guest Mode (Wall) vs. Persistent Login (Mobile):** The wall Touchwall automatically reverts to a secure view-only guest mode after 5 minutes of inactivity; personal smartphones stay permanently logged in.
* **Live Presence (Real-Time):** Via Supabase Realtime Presence, you can see who is currently online in the header bar at any time—including device indicators (`🖥️` Wall / `📱` Pocket) and quick user switching via password/PIN.

### 📅 Family Calendar
* Shared family calendar as well as individual person filters with color coding and avatars (profile photo, emoji, or initials).
* Create, edit, duplicate (copy to other days/people), and delete events—including reminder times.
* Supports cloud calendars as well as optional integration of external calendars (Google / Outlook OAuth).

### ✅ Tasks & 🛒 Shopping List (with 2-Way Todoist Sync)
* Family tasks per person with due date, time, priority, description, push reminder, and optional one-click transfer to the calendar.
* Shared shopping list plus additional freely configurable note tiles.
* **2-Way Synchronization with Todoist:** Automatic detection of projects and collaborators, protected merging with tombstone protection against reappearing deleted tasks.
* Completed shopping items can be moved directly into the pantry individually or all at once with a single click.

### 🥫 Pantry, BBD Guardian & Anti-Food-Waste Trash Bin
* **Three Views on the Touchwall:**
  1. **Excel-Style Master Table:** Column sorting as well as inline editing of quantity (`-`/`+`), storage location, category, and gluten-free status directly in the row.
  2. **Category Groups:** Clean lists grouped by food categories.
  3. **Tile View:** Uniform image grid (`200 × 200 px`) with product photos and color coding based on remaining shelf life.
* **Storage Locations & Categories:** 6 storage locations (*Fridge, Freezer, Pantry Cabinet, Cellar/Storeroom, Kitchen, Pet Food*) and 7 food categories.
* **Smart Product Helpers:** Automatic name shortening (`Product / Brand`), automatic storage location/category assignment, and **Gluten-Free Detection (`🌾✓ GF`)** with quick filter.
* **BBD Guardian (Expiration Monitor):**
  * Early warning **1–2 days before expiration** and final warning **on the expiration date** (banner, audio alert, push notification, and optional Todoist task).
  * Expired products are automatically moved to the **Trash Bin** on the following day.
* **Trash Bin & Restock Flow:** Displays the sustainability ratio (*% consumed vs. discarded*), allows restoring items, and offers 1-click transfer to the shopping list or direct deal search.

### 📷 Turbo Scanner (Pocket App — 3 Modes)
1. **2-Phase Barcode & BBD Scanner:**
   * Reads **13+ 1D & 2D formats** (EAN-13/8, UPC, Code 128/39, QR, GS1, DataMatrix, PDF417, etc.). Uses the native `BarcodeDetector` API on Android and automatically switches to a high-resolution **ZXing Turbo Mode (960×540)** on iPhone/iPad.
   * Multi-tier product recognition: local barcode memory → custom Supabase product database (`/api/products`) → OpenFoodFacts / OpenPetFoodFacts / OpenProductsFacts (including product photo & nutrition/allergen info).
   * **2-Hour Check-Out Protection:** When scanning a product that has already been in stock for ≥ 2 hours, the scanner automatically asks whether to check it out, reduce quantity by `-1`, or add new stock (including a shopping list prompt).
   * **AI Vision + Local 4-Pass BBD OCR:** Recognizes even difficult prints by combining **Gemini 2.5 Flash Vision** (`/api/mhd-ai`) with local **4-Pass Tesseract OCR** (Max-RGB Adaptive for red/colorful boxes, dot-matrix filter for inkjet printing on patterned lids, bread clips without a year such as `02.12. C2`, and spelled-out months like `Juli 2029`). Also includes a **BBD Photo** button for sharp smartphone macro autofocus and a **Label Scan** for name, brand, quantity & BBD.
2. **🍎 Freshness AI (No Barcode Required):**
   * Camera-based object recognition (TensorFlow.js / MobileNet) plus a quick-select database for fresh fruit, vegetables, and fresh meat with automatic shelf-life estimation.
3. **🧾 Receipt Scanner:**
   * Photograph entire shopping receipts, parse them via OCR, and import them as a batch into the shopping cart with pre-filled storage locations and BBD suggestions.
* **Shopping Cart Buffer:** Scanned items first land in the mobile shopping cart and are transferred into pantry inventory with a single tap after shopping or unpacking.

### 🏷️ Live Offers Radar (`/api/offers`)
* Daily updated regional supermarket deals by **postal code** for **Kaufland, Netto, Lidl, ALDI SÜD, REWE, Hieber/EDEKA, NORMA, PENNY, dm & Rossmann/Müller**.
* **10 Categories** including **Household & Cleaning** (laundry detergent, dishwasher tabs, toilet paper, cleaners), **Homeware & Non-Food** (pans, bedding, tools), **Drugstore & Personal Care**, groceries, and pet supplies.
* Automatic **daily caching in Supabase** (`tw_offers_cache`) as well as direct **live search** for any product or store.
* Intelligent **deal matching** against consumed items in the trash bin, open shopping list items, and current pantry stock—with **1-click transfer including store & price to the shopping list**.

### 🍽️ Meal Planner & Smart Recipes
* Shared weekly meal plan directly linked to pantry stock.
* Recipe suggestions tailored to available (and soon-to-expire) ingredients; missing ingredients can be added to the shopping list with one click.

### 🎓 School & Timetables
* Individual timetables per child showing subject, room, and status (*Regular, Exam/Test, Substitution, Canceled*).
* Direct creation of homework and exams as tasks or calendar events.

### ⚔️ Skill Board (Gamification)
* Playful **Quest, XP, Level, Rank, and Streak system** for the whole family.
* Directly linked to the logged-in family member—completing tasks earns points toward shared or personal goals and rewards.

### 🎨 Design, Real-Time Sync & Backup
* Multiple themes (including Dark Metal), customizable family logo, individual member colors, and profile photos.
* Instant synchronization between the wall Touchwall and all smartphones via **Supabase Realtime**.
* Full **JSON Export & Import** for local data backups as well as built-in diagnostics.

---

## 🛠️ Tech Stack & Architecture

| Area | Technology |
| :--- | :--- |
| **Framework** | Next.js (App Router), React, TypeScript / JSX |
| **Styling & Icons** | Tailwind CSS, Lucide React |
| **Database & Realtime** | Supabase (PostgreSQL, Row Level Security, Realtime Broadcast & Presence) |
| **AI & Image Recognition** | Google Gemini 2.5 Flash Vision (`/api/mhd-ai`), Tesseract.js (4-Pass OCR), TensorFlow.js / MobileNet, Native `BarcodeDetector` + ZXing |
| **External Integrations** | Todoist REST API, OpenFoodFacts / OpenPetFoodFacts, Marktguru Live Offers (`/api/offers`), optional Google & Microsoft OAuth |
| **Hosting & PWA** | Vercel (incl. optional cron job), Service Worker (`/sw.js`), Web App Manifest (`/manifest.json`) |

---

## 📋 Prerequisites

* **Node.js** `v18.18+` or `v20 LTS`
* **Git**
* Free **Supabase** project ([supabase.com](https://supabase.com))
* Optional for AI BBD & label recognition: **Google Gemini API Key** ([aistudio.google.com](https://aistudio.google.com))
* Optional for 2-way task & shopping sync: **Todoist API Token**
* Optional for hosting: **Vercel** account ([vercel.com](https://vercel.com))

---

## 🚀 Installation (Step by Step)

### 1. Clone Repository & Install Dependencies

```bash
git clone [https://github.com/motionrain/familien-touchwall.git](https://github.com/motionrain/familien-touchwall.git)
cd familien-touchwall
npm install
