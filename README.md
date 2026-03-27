# pptform-automator

Puppeteer-based automation service that fills out passport forms at pptform.state.gov and captures the official PDF with the State Department's 2DB barcode.

## Deploy to Railway

1. Push this folder to a GitHub repo
2. Connect the repo to [Railway](https://railway.app)
3. Set environment variables in Railway:
   - `API_SECRET` — shared secret for authenticating requests from your Lovable app
4. Deploy — Railway will build using the Dockerfile automatically

## API

### `GET /health`
Health check endpoint.

### `POST /generate`
Generate a filled passport form PDF.

**Headers:**
- `Authorization: Bearer <API_SECRET>`
- `Content-Type: application/json`

**Body:**
```json
{
  "formType": "DS-11",
  "lastName": "DOE",
  "firstName": "JOHN",
  "middleName": "MICHAEL",
  "dateOfBirth": "01/15/1990",
  "dobMonth": "01",
  "dobDay": "15",
  "dobYear": "1990",
  "sex": "M",
  "placeOfBirth": "NEW YORK",
  "birthState": "NY",
  "ssn": "123-45-6789",
  "email": "john@example.com",
  "phone": "555-123-4567",
  "mailingAddress": "123 MAIN ST",
  "addressLine2": "APT 4B",
  "city": "NEW YORK",
  "state": "NY",
  "zipCode": "10001",
  "country": "US",
  "height": "5'10\"",
  "hairColor": "BROWN",
  "eyeColor": "BLUE",
  "fatherLastName": "DOE",
  "fatherFirstName": "JAMES",
  "motherLastName": "DOE",
  "motherFirstName": "JANE",
  "emergencyName": "JANE DOE",
  "emergencyPhone": "555-987-6543",
  "previousPassportNumber": "123456789",
  "previousIssueDate": "01/01/2015"
}
```

**Response:**
```json
{
  "success": true,
  "pdf": "<base64-encoded-pdf>",
  "generatedAt": "2026-03-27T00:00:00.000Z",
  "elapsedSeconds": 45.2
}
```

## Important Notes

- The State Department site (pptform.state.gov) may change its HTML structure at any time. If form filling breaks, update the selectors in `src/form-filler.js`.
- Random delays are built in to mimic human behavior (800ms-2500ms between fields, 50ms-150ms per keystroke).
- The service uses `@sparticuz/chromium` for a lightweight Chromium binary suitable for containerized environments.
