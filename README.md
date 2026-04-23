# Vorbestell Plattform (MVP)

Monorepo für eine Vorbestell-Plattform für Bäckerei und Metzgerei. Mitarbeiter bestellen am Vortag, Anbieter sehen täglich um 04:00 Uhr (Europe/Berlin) automatisch erzeugte Sammellisten.

**Struktur**
- `apps/api` – Express + Prisma + PostgreSQL + Cronjob
- `apps/web` – Next.js + Tailwind UI
- `apps/mobile` – Expo (React Native)
- `packages/shared` – gemeinsame Typen

**Voraussetzungen**
- Node.js 18+
- Docker + Docker Compose

**Setup**
1. `docker compose up -d`
2. `apps/api/.env.example` kopieren und als `apps/api/.env` anpassen (DB + JWT)
3. `npm install`
4. `npm run build:shared`
5. `npm run prisma:migrate -w apps/api`
6. `npm run prisma:seed -w apps/api`

**API starten**
- `npm run dev -w apps/api`

**Web starten**
- `npm run dev -w apps/web`
- Optional: `apps/web/.env.example` nach `apps/web/.env` kopieren (`NEXT_PUBLIC_API_URL`)

**Mobile starten**
- `npm run dev -w apps/mobile`
- Für echtes Gerät: `EXPO_PUBLIC_API_URL` setzen (z.B. Rechner-IP)

**Tests**
- `npm run test -w apps/api`
- Erwartet eine zweite DB `vorbestell_test` in Postgres (oder URL im `apps/api/vitest.config.ts` ändern).

**E2E (Playwright)**
- Einmalig Browser installieren: `npm run e2e:install`
- API starten: `npm run dev:api`
- Web starten: `npm run dev:web`
- E2E laufen lassen: `npm run e2e`
- Mit sichtbarem Browser: `npm run e2e:headed`
- UI-Modus: `npm run e2e:ui`
- Details: `e2e/README.md`

**Seed Daten**
- Neutraler Admin: `admin@example.com` / `Password123`
- Firma (Admin): `firma@example.com` / `Password123`
- Firmen-Code: `FIRMA-XY`
- Mitarbeiter: `mitarbeiter@example.com` / `Password123` (Login mit Firmen-Code)
- Bäcker: `baecker@example.com` / `Password123`
- Metzger: `metzger@example.com` / `Password123`
- Hinweis: Firmen-Verbindungen sind **nicht** vorab gesetzt (Test-Flow: Bäcker → Anfrage → neutraler Admin bestätigt).

**Login**
- Mitarbeiter: `/login` (E-Mail + Passwort + Firmen-Code)
- Lieferant: `/login/vendor`
- Firma: `/login/company`
- Neutraler Admin: `/login/admin`

**Registrierung**
- Mitarbeiter: `/register` mit Firmen-Code
- Anbieter: `/register` → Anbieter auswählen
- Firma: wird vom neutralen Admin im Admin-Dashboard angelegt (inkl. Firmen-Admin + Firmen-Code)

**Cronjob**
- Läuft standardmäßig um 04:00 Uhr Europe/Berlin.
- Deaktivieren mit `CRON_ENABLED=false` in `.env`.

**Wichtige Endpoints (MVP)**
- `POST /auth/register` (Mitarbeiter mit Firmen-Code)
- `POST /auth/register-vendor` (Anbieter)
- `POST /auth/login` (Mitarbeiter, Lieferant)
- `POST /auth/company/login` (Firma)
- `POST /auth/admin/login` (neutraler Admin)
- `GET /admin/dashboard` (zentrale Übersicht Firmen, Lieferanten, Verbindungen)
- `POST /admin/companies` (Firma + Firmen-Admin anlegen)
- `POST /admin/companies/:companyId/regenerate-code` (neuen Firmen-Code erzeugen)
- `GET /admin/vendors` (Lieferantenliste)
- `GET /admin/links` (alle Firma↔Lieferant Verbindungen)
- `POST /admin/links` (Firma↔Lieferant direkt freigeben)
- `DELETE /admin/links/:vendorId/:companyId` (Verbindung trennen)
- `GET /company/dashboard`
- `POST /company/employees` (Mitarbeiter-Zugangsdaten erstellen)
- `POST /company/employees/credentials-pdf` (PDF für Mitarbeiter-Zugangsdaten erzeugen)
- `GET /company/orders`
- `GET /company/orders/export`
- `GET /company/invoices/received` (empfangene Lieferanten-Rechnungen pro Monat)
- `GET /company/invoices/received/:id/download` (Rechnungs-PDF herunterladen)
- `GET /company/invoices/employees` (Monatsübersicht je Mitarbeiter inkl. Summen)
- `GET /company/invoices/employees/:employeeId/download` (Mitarbeiter-Rechnung als PDF für einen Monat)
- `GET /admin/vendor-requests`
- `POST /admin/vendor-requests/:vendorId/:companyId/approve`
- `DELETE /admin/vendor-requests/:vendorId/:companyId`
- `GET /vendors/public`
- `GET /vendors/company` (Mitarbeiter)
- `GET /vendors/:id`
- `POST /orders`
- `GET /orders`
- `GET /vendor/:id/batch/today`
- `GET /restaurants/:id/menus`
- `POST /restaurants/:id/orders`
- `POST /restaurants/:id/reservations`
- `GET /vendor/menus`
- `POST /vendor/menus`
- `GET /vendor/companies`
- `POST /vendor/companies`
- `GET /vendor/products/menu-uploads` (hochgeladene Menü-Dateien)
- `POST /vendor/products/menu-upload` (PDF/Bild-Menü hochladen)
- `GET /orders/vendor` (inkl. Gruppierung nach Firma)
- `GET /orders/vendor/invoices/export-pdf` (Lieferanten-Rechnungs-PDF)
- `GET /orders/vendor/invoices/sent` (gesendete Firmenrechnungen pro Monat)
- `POST /orders/vendor/invoices/send` (Firmenrechnung erzeugen + ins Portal senden)
- `GET /orders/vendor/invoices/:id/download` (gesendete Rechnung herunterladen)
