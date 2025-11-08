# QuickTor - Barber Appointment Booking Script

An automated barber appointment booking script for mentor.tormahir.co.il using direct API calls (no browser automation needed).

## Features

- ✅ **API-based booking** - Direct HTTP requests (faster, more reliable)
- ✅ **Session management** - Automatic cookie handling
- ✅ **TypeScript** - Type-safe implementation
- ✅ **Network monitoring** - Browser-based exploration tool included

## Prerequisites

- Node.js (v16 or higher)
- npm

## Installation

1. Install dependencies:
```bash
npm install
```

2. (Optional) Install Playwright browsers for exploration:
```bash
npx playwright install chromium
```

## Configuration

### API-Based Booking (Recommended)

Edit `src/book.ts` or use environment variables:

```typescript
const config: BookingConfig = {
  mobile: '0544458876',        // Your mobile number
  serviceTypeId: 3928,         // Service type (3928 = Men's haircut)
  schedulerId: 6132,          // Barber ID (6132 = Saul)
  date: '2025-11-16',          // Format: YYYY-MM-DD
  time: '10:00',               // Format: HH:MM
  branchId: 0
};
```

Or use environment variables:
```bash
MOBILE=0544612246 DATE=2025-11-16 TIME=10:00 npm run book:api
```

## Usage

### API-Based Booking (Fast & Recommended)
```bash
npm run book:api
```

### Browser Exploration (For debugging/discovering endpoints)
```bash
npm run explore https://mentor.tormahir.co.il/
```

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

## Discovered API Endpoints

The following endpoints were discovered through network monitoring:

### Authentication
- `POST /Validate/Mobile` - Validates mobile number
- `POST /Account/LoginMobileClient` - Performs login

### Booking Flow
- `GET /Clients/TypeSelect/0` - Loads appointment type selection
- `POST /Clients/TypeSelectList` - Gets list of appointment types
- `GET /Clients/SchedulerSelect?ids={typeId}&id=0&Customers=&BranchID=0` - Gets service providers
- `GET /Clients/TimeSelect?ids={apptId}&id=0&Customers=&SchedulerID={schedulerId}&BranchID=0` - Loads time selection
- `POST /Clients/TimeSelectScheduler` - Gets available time slots
- `POST /Clients/TimeSelectScheduler2` - Gets next week's time slots
- `POST /Clients/AskAppointment?Length=7` - **Final booking endpoint** ⭐

### Known IDs
- Service Type ID `3928` = Men's haircut (תספורת גברים)
- Scheduler ID `6132` = Saul (סול)
- Appointment Type ID `37331` = Used in booking flow

## Project Structure

```
quickTor/
├── src/
│   ├── api-booker.ts    # API-based booking implementation
│   ├── book.ts          # Main API booking script
│   └── index.ts         # Browser exploration tool
├── dist/                # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

1. **Login**: Validates and logs in with mobile number
2. **Service Selection**: Selects service type (haircut, etc.)
3. **Provider Selection**: Chooses barber/service provider
4. **Time Selection**: Gets available time slots
5. **Booking**: Makes final booking request to `/Clients/AskAppointment`

## Important Notes

⚠️ **Rate Limiting**: The booking system may have rate limits. Use responsibly.

⚠️ **Session Management**: The script handles cookies automatically, but you may need to adjust the session handling based on the actual server behavior.

⚠️ **Request Verification Token**: The login flow requires extracting and sending an anti-forgery token from the login page.

## Troubleshooting

- **Login fails**: Check that your mobile number is correct and registered
- **No available times**: The time slots might be fully booked
- **Booking fails**: Verify that the appointment type IDs and scheduler IDs are correct
- **Session errors**: The server might require additional headers or cookies

## Development

To explore the booking flow and discover new endpoints:

```bash
npm run explore https://mentor.tormahir.co.il/
```

This opens a browser with network monitoring enabled. All API requests will be logged to the console.

## License

ISC
