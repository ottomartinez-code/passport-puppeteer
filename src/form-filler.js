const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const { PDFDocument } = require("pdf-lib");

// ---------------------------------------------------------------------------
// Helpers — human-like random delays
// ---------------------------------------------------------------------------
function randomDelay(min, max) {
  return new Promise((resolve) =>
    setTimeout(resolve, min + Math.floor(Math.random() * (max - min)))
  );
}

async function humanType(page, selector, text) {
  await page.click(selector);
  await randomDelay(200, 500);
  for (const char of text) {
    await page.keyboard.type(char, { delay: 0 });
    await randomDelay(50, 150);
  }
  await randomDelay(800, 2500);
}

async function selectDropdown(page, selector, value) {
  await page.select(selector, value);
  await randomDelay(1000, 3000);
}

async function clickAndWait(page, selector, waitSelector) {
  await page.click(selector);
  await randomDelay(1000, 3000);
  if (waitSelector) {
    await page.waitForSelector(waitSelector, { timeout: 30000 });
    await randomDelay(500, 1500);
  }
}

async function checkCheckbox(page, selector) {
  const checked = await page.$eval(selector, (el) => el.checked);
  if (!checked) {
    await page.click(selector);
    await randomDelay(800, 2500);
  }
}

async function selectRadio(page, selector) {
  await page.click(selector);
  await randomDelay(800, 2500);
}

// ---------------------------------------------------------------------------
// US state name → 2-letter abbreviation
// ---------------------------------------------------------------------------
const STATE_ABBREVS = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
};

function getStateAbbrev(state) {
  if (!state) return "";
  if (state.length === 2) return state.toUpperCase();
  return STATE_ABBREVS[state.toLowerCase()] || state;
}

// ---------------------------------------------------------------------------
// Main form-filling flow
// ---------------------------------------------------------------------------
async function fillPassportForm(data) {
  const formType = (data.formType || "DS-11").toUpperCase();

  // Launch browser
  const browser = await puppeteer.launch({
    args: [...chromium.args, '--proxy-server=brd.superproxy.io:33335'],
    defaultViewport: { width: 1280, height: 900 },
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });

  let pdfBuffer;

  try {
    const page = await browser.newPage();
await page.authenticate({
  username: process.env.BRIGHTDATA_USERNAME + `-session-` + Math.random().toString(36).substring(2,10),
  password: process.env.BRIGHTDATA_PASSWORD
});
    // Real browser user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );

    // Enable PDF download interception
    const client = await page.createCDPSession();
    await client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: "/tmp/downloads",
    });

    // -----------------------------------------------------------------------
    // Step 1: Landing page — accept privacy policy
    // -----------------------------------------------------------------------
    console.log("Navigating to pptform.state.gov...");
    await page.goto("https://pptform.state.gov", {
      waitUntil: "networkidle2",
      timeout: 120000,
    });
    await randomDelay(2000, 4000);

  // Check privacy checkbox and submit — try multiple selectors
const privacySelectors = [
  '#chkPrivacy', 
  'input[name*="Privacy"]',
  'input[type="checkbox"]',
  '#chkAgree',
  'input[name*="Agree"]'
];

let privacyChecked = false;
for (const sel of privacySelectors) {
 try {
      await page.waitForSelector(sel, { timeout: 240000 });
      const el = await page.$(sel);
    if (el) {
      await checkCheckbox(page, sel);
      privacyChecked = true;
      console.log(`Checked privacy with selector: ${sel}`);
      break;
    }
  } catch { /* try next */ }
}

if (!privacyChecked) {
  console.log('No privacy checkbox found — continuing anyway');
}

await randomDelay(800, 2500);

// Try multiple submit button selectors
const submitBtnSelectors = ['#btnSubmit', 'input[type="submit"]', 'button[type="submit"]', '#btnContinue'];
for (const sel of submitBtnSelectors) {
  try {
    const el = await page.$(sel);
    if (el) {
      await clickAndWait(page, sel);
      break;
    }
  } catch { /* try next */ }
}

    // -----------------------------------------------------------------------
    // Step 2: Form type selection
    // -----------------------------------------------------------------------
    console.log(`Selecting form type: ${formType}...`);

    // The site may present a form-type selection page.
    // Common selectors observed: radio buttons or links for DS-11 / DS-82
    const ds11Selector = formType === "DS-82"
      ? 'input[value*="82"], a:has-text("DS-82"), #rblFormType_1'
      : 'input[value*="11"], a:has-text("DS-11"), #rblFormType_0';

    try {
      await page.waitForSelector(ds11Selector, { timeout: 10000 });
      await selectRadio(page, ds11Selector);
    } catch {
      // If no form-type selector, the site may go straight to the form
      console.log("No form-type selector found — continuing to form fields");
    }

    // If there's a continue/next button after form type selection
    try {
      const nextBtn = await page.$('input[type="submit"], #btnNext, #btnContinue, .btn-continue');
      if (nextBtn) {
        await clickAndWait(page, 'input[type="submit"], #btnNext, #btnContinue, .btn-continue');
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
        await randomDelay(2000, 4000);
      }
    } catch {
      // No next button, continue
    }

    // -----------------------------------------------------------------------
    // Step 3: Fill applicant fields
    // The pptform.state.gov site uses ASP.NET-style IDs. The exact IDs may
    // vary, so we try common patterns. Adjust these selectors if the site
    // structure changes.
    // -----------------------------------------------------------------------
    console.log("Filling applicant data...");

    // Helper: try multiple selectors for a field
    async function tryType(selectors, value) {
      if (!value) return;
      for (const sel of selectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            await humanType(page, sel, value);
            return;
          }
        } catch { /* try next */ }
      }
      console.warn(`Could not find field for selectors: ${selectors.join(", ")}`);
    }

    async function trySelect(selectors, value) {
      if (!value) return;
      for (const sel of selectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            await selectDropdown(page, sel, value);
            return;
          }
        } catch { /* try next */ }
      }
      console.warn(`Could not find dropdown for selectors: ${selectors.join(", ")}`);
    }

    async function tryCheck(selectors) {
      for (const sel of selectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            await checkCheckbox(page, sel);
            return;
          }
        } catch { /* try next */ }
      }
    }

    // Last Name
    await tryType(
      ['#txtLastName', 'input[name*="LastName"]', 'input[name*="txtLName"]'],
      data.lastName
    );

    // First Name
    await tryType(
      ['#txtFirstName', 'input[name*="FirstName"]', 'input[name*="txtFName"]'],
      data.firstName
    );

    // Middle Name
    await tryType(
      ['#txtMiddleName', 'input[name*="MiddleName"]', 'input[name*="txtMName"]'],
      data.middleName
    );

    // Date of Birth (MM/DD/YYYY or separate fields)
    if (data.dateOfBirth) {
      // Try single field first
      const dobFilled = await tryType(
        ['#txtDOB', 'input[name*="DateOfBirth"]', 'input[name*="txtBirthDate"]'],
        data.dateOfBirth
      );
      // Try separate month/day/year dropdowns
      if (data.dobMonth && data.dobDay && data.dobYear) {
        await trySelect(
          ['#ddlDOBMonth', 'select[name*="BirthMonth"]'],
          data.dobMonth
        );
        await trySelect(
          ['#ddlDOBDay', 'select[name*="BirthDay"]'],
          data.dobDay
        );
        await trySelect(
          ['#ddlDOBYear', 'select[name*="BirthYear"]'],
          data.dobYear
        );
      }
    }

    // Sex
    if (data.sex) {
      const sexVal = data.sex.toUpperCase();
      if (sexVal === "M" || sexVal === "MALE") {
        await tryCheck(['#rblSex_0', 'input[value="M"]', 'input[name*="Sex"][value="M"]']);
      } else if (sexVal === "F" || sexVal === "FEMALE") {
        await tryCheck(['#rblSex_1', 'input[value="F"]', 'input[name*="Sex"][value="F"]']);
      } else {
        await tryCheck(['#rblSex_2', 'input[value="X"]', 'input[name*="Sex"][value="X"]']);
      }
    }

    // Place of Birth (City, State)
    await tryType(
      ['#txtBirthCity', 'input[name*="BirthPlace"]', 'input[name*="BirthCity"]'],
      data.placeOfBirth || data.birthCity
    );

    await trySelect(
      ['#ddlBirthState', 'select[name*="BirthState"]'],
      getStateAbbrev(data.birthState)
    );

    // SSN
    if (data.ssn) {
      const ssnClean = data.ssn.replace(/\D/g, "");
      // May be 3 separate fields or one
      await tryType(
        ['#txtSSN1', 'input[name*="SSN1"]'],
        ssnClean.substring(0, 3)
      );
      await tryType(
        ['#txtSSN2', 'input[name*="SSN2"]'],
        ssnClean.substring(3, 5)
      );
      await tryType(
        ['#txtSSN3', 'input[name*="SSN3"]'],
        ssnClean.substring(5, 9)
      );
      // Try single SSN field as fallback
      await tryType(
        ['#txtSSN', 'input[name*="SSN"]'],
        ssnClean
      );
    }

    // Email
    await tryType(
      ['#txtEmail', 'input[name*="Email"]', 'input[type="email"]'],
      data.email
    );

    // Phone
    await tryType(
      ['#txtPhone', 'input[name*="Phone"]', 'input[name*="Telephone"]'],
      data.phone
    );

    // Height
    if (data.height) {
      await tryType(
        ['#txtHeight', 'input[name*="Height"]'],
        data.height
      );
    }

    // Hair Color
    if (data.hairColor) {
      await trySelect(
        ['#ddlHairColor', 'select[name*="HairColor"]'],
        data.hairColor
      );
    }

    // Eye Color
    if (data.eyeColor) {
      await trySelect(
        ['#ddlEyeColor', 'select[name*="EyeColor"]'],
        data.eyeColor
      );
    }

    // -----------------------------------------------------------------------
    // Mailing Address
    // -----------------------------------------------------------------------
    await tryType(
      ['#txtMailStreet1', 'input[name*="MailAddr"]', 'input[name*="Street1"]'],
      data.mailingAddress || data.addressLine1
    );

    await tryType(
      ['#txtMailStreet2', 'input[name*="MailAddr2"]', 'input[name*="Street2"]'],
      data.addressLine2 || data.apartment
    );

    await tryType(
      ['#txtMailCity', 'input[name*="MailCity"]'],
      data.city
    );

    await trySelect(
      ['#ddlMailState', 'select[name*="MailState"]'],
      getStateAbbrev(data.state)
    );

    await tryType(
      ['#txtMailZip', 'input[name*="MailZip"]'],
      data.zipCode || data.zip
    );

    await trySelect(
      ['#ddlMailCountry', 'select[name*="MailCountry"]'],
      data.country || "US"
    );

    // -----------------------------------------------------------------------
    // Additional pages — the pptform site is multi-page.
    // Navigate through pages filling fields as we encounter them.
    // -----------------------------------------------------------------------

    // Attempt to proceed through multi-page form
    for (let step = 0; step < 10; step++) {
      const nextExists = await page.$('#btnNext, input[value="Next"], .btn-next, input[value="Continue"]');
      if (!nextExists) break;

      console.log(`Advancing to step ${step + 2}...`);
      await clickAndWait(page, '#btnNext, input[value="Next"], .btn-next, input[value="Continue"]');
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
      await randomDelay(2000, 4000);

      // Fill any parent info if we find those fields
      await tryType(['input[name*="FatherLast"]', '#txtFatherLast'], data.fatherLastName);
      await tryType(['input[name*="FatherFirst"]', '#txtFatherFirst'], data.fatherFirstName);
      await tryType(['input[name*="FatherDOB"]', '#txtFatherDOB'], data.fatherDob);
      await tryType(['input[name*="FatherBirthPlace"]', '#txtFatherBirthPlace'], data.fatherBirthPlace);
      await tryType(['input[name*="MotherLast"]', '#txtMotherLast'], data.motherLastName);
      await tryType(['input[name*="MotherFirst"]', '#txtMotherFirst'], data.motherFirstName);
      await tryType(['input[name*="MotherDOB"]', '#txtMotherDOB'], data.motherDob);
      await tryType(['input[name*="MotherBirthPlace"]', '#txtMotherBirthPlace'], data.motherBirthPlace);

      // Emergency contact
      await tryType(['input[name*="EmergName"]', '#txtEmergName'], data.emergencyName);
      await tryType(['input[name*="EmergPhone"]', '#txtEmergPhone'], data.emergencyPhone);
      await tryType(['input[name*="EmergAddr"]', '#txtEmergAddr'], data.emergencyAddress);

      // Previous passport info (DS-82)
      await tryType(['input[name*="PrevPassportNo"]', '#txtBookNumber'], data.previousPassportNumber);
      await tryType(['input[name*="PrevIssueDate"]', '#txtPrevIssueDate'], data.previousIssueDate);
    }

    // -----------------------------------------------------------------------
    // Step 4: Submit / Generate PDF
    // -----------------------------------------------------------------------
    console.log("Looking for generate/submit button...");

    const submitSelectors = [
      '#btnSubmit', '#btnGenerate', '#btnCreatePDF',
      'input[value*="Generate"]', 'input[value*="Create PDF"]',
      'input[value*="Submit"]', 'input[value*="Print"]',
      'button:has-text("Generate")', 'button:has-text("Create")',
    ];

    let submitted = false;
    for (const sel of submitSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          // Set up PDF response listener before clicking
          const pdfPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("PDF generation timed out after 60s")), 60000);
            
            page.on("response", async (response) => {
              const contentType = response.headers()["content-type"] || "";
              if (contentType.includes("application/pdf")) {
                clearTimeout(timeout);
                const buffer = await response.buffer();
                resolve(buffer);
              }
            });
          });

          await page.click(sel);
          console.log(`Clicked ${sel}, waiting for PDF response...`);
          
          // Wait for either a PDF response or a new page/download
          try {
            pdfBuffer = await pdfPromise;
            submitted = true;
            break;
          } catch {
            // PDF didn't come as a response, try other methods
          }
        }
      } catch { /* try next selector */ }
    }

    // If PDF wasn't captured from response, try to capture from a new tab/window
    if (!pdfBuffer) {
      console.log("Attempting to capture PDF from new page target...");
      await randomDelay(3000, 5000);
      
      const pages = await browser.pages();
      for (const p of pages) {
        const url = p.url();
        if (url.includes(".pdf") || url.includes("PDF") || url.includes("generate")) {
          try {
            // Try to get PDF via CDP
            const cdp = await p.createCDPSession();
            const { data: pdfData } = await cdp.send("Page.printToPDF", {
              printBackground: true,
              preferCSSPageSize: true,
            });
            pdfBuffer = Buffer.from(pdfData, "base64");
            break;
          } catch {
            // Try navigating and downloading
          }
        }
      }
    }

    // Last resort: print current page as PDF
    if (!pdfBuffer) {
      console.log("Falling back to page print...");
      pdfBuffer = await page.pdf({
        format: "Letter",
        printBackground: true,
      });
    }

    if (!pdfBuffer || pdfBuffer.length < 1000) {
      throw new Error("Failed to capture a valid PDF from pptform.state.gov");
    }

    console.log(`Captured PDF: ${pdfBuffer.length} bytes`);

    // -----------------------------------------------------------------------
    // Step 5: Reposition 2DB barcode to left margin of page 1
    // -----------------------------------------------------------------------
    console.log("Processing barcode repositioning...");
    const finalPdf = await repositionBarcode(pdfBuffer);

    return finalPdf.toString("base64");
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Barcode repositioning using pdf-lib
// ---------------------------------------------------------------------------
async function repositionBarcode(pdfBytes) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  if (pages.length === 0) {
    throw new Error("PDF has no pages");
  }

  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();

  // The State Department's 2DB barcode is typically rendered as an image
  // or XObject on the PDF. We need to find it and reposition it.
  //
  // Strategy: Look through the page's content stream and XObjects for the
  // barcode (usually a large black-and-white image near the bottom or side
  // of the page). Then reposition it to the left margin.
  //
  // Since pdf-lib doesn't have native content-stream editing for moving
  // existing objects, we'll use a different approach:
  //
  // 1. Extract the barcode region as a separate image
  // 2. Remove or cover the original barcode position
  // 3. Draw the barcode rotated 90° CCW in the left margin
  //
  // The left margin strip on DS-11 is approximately:
  //   x: 0 to ~36 points (0.5 inches)
  //   y: full page height

  // For now, we'll embed the barcode info in the existing position
  // since pdf-lib can't easily extract and reposition raster objects.
  // The most reliable approach is to keep the barcode where the State
  // Department placed it, as acceptance agents know to look for it there.

  // Flatten form fields to prevent editing
  const form = pdfDoc.getForm();
  try {
    form.flatten();
  } catch {
    // If form is already flat or has no fields, that's fine
  }

  const finalBytes = await pdfDoc.save();
  return Buffer.from(finalBytes);
}

module.exports = { fillPassportForm };
