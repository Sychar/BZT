# Playwright E2E

## 1) Voraussetzungen

1. API starten:
   - `npm run dev:api`
2. Web starten:
   - `npm run dev:web`
3. Falls Browser noch fehlen:
   - `npm run e2e:install`

Standard-URLs:
- Web: `http://localhost:3000`
- API: `http://localhost:4000`

## 2) Tests ausfuehren

- Alle E2E-Tests:
  - `npm run e2e`
- Mit sichtbarem Browser:
  - `npm run e2e:headed`
- Playwright UI:
  - `npm run e2e:ui`

## 3) Abgedeckte Flows

- UI Login:
  - Firma
  - Lieferant
  - Neutraler Admin
- API Smoke:
  - Mitarbeiter Login + `/orders`
  - Lieferant Login + `/orders/vendor`

## 4) Credentials/URLs per Env ueberschreiben

Optional vor dem Testlauf setzen:

- `E2E_BASE_URL`
- `E2E_API_URL`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_COMPANY_EMAIL`
- `E2E_COMPANY_PASSWORD`
- `E2E_COMPANY_CODE`
- `E2E_EMPLOYEE_EMAIL`
- `E2E_EMPLOYEE_PASSWORD`
- `E2E_VENDOR_EMAIL`
- `E2E_VENDOR_PASSWORD`

