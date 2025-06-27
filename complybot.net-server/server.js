require("dotenv").config();

const express = require("express");
const puppeteer = require("puppeteer");
const axeCore = require("axe-core");
const nodemailer = require("nodemailer");
const path = require("path");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ Free Scan Route
app.post("/scan", async (req, res) => {
  const { url, email } = req.body;
  console.log(`🚀 Scanning ${url} for ${email}`);

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox"]
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });
    await page.addScriptTag({ path: require.resolve("axe-core") });
    const results = await page.evaluate(async () => await axe.run());
    await browser.close();

    const summary = `ComplyBot Scan Summary for ${url}\n\n` +
      (results.violations.length === 0
        ? `🎉 No critical issues found.`
        : `⚠️ ${results.violations.length} accessibility issues found.`) +
      `\n\nUpgrade for $29 to receive a full report, fixes, certificate & more.`;

    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: `Your ComplyBot Quick Scan for ${url}`,
      text: summary,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Summary emailed to ${email}`);
    res.redirect("/results.html");
  } catch (err) {
    console.error("💥 Scan Error:", err);
    res.status(500).send("Scan failed.");
  }
});

// ✅ Stripe Checkout Session with Metadata
app.post("/create-checkout-session", async (req, res) => {
  const { email, url } = req.body;
  console.log(`🚀 Creating Stripe session for ${email} - ${url}`);

  if (!email || !url) {
    return res.status(400).send("Missing email or url");
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      metadata: { email, url },
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: "ComplyBot Full Accessibility Fix Plan",
            description: "Detailed report, fixes, cert, monitoring"
          },
          unit_amount: 2900,
        },
        quantity: 1
      }],
      success_url: "https://complybot.net/success.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://complybot.net/cancel.html"
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("💥 Stripe Error:", err);
    res.status(500).send("Stripe session creation failed.");
  }
});

// ✅ Deliver Full Report (uses Stripe metadata)
app.post("/deliver-full-report", async (req, res) => {
  const { session_id } = req.body;

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return res.status(403).send("Payment not verified.");
    }

    const email = session.metadata?.email;
    const url = session.metadata?.url;

    if (!email || !url) {
      return res.status(400).send("Missing metadata.");
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox"]
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });
    await page.addScriptTag({ path: require.resolve("axe-core") });
    const results = await page.evaluate(async () => await axe.run());
    await browser.close();

    const fullReport = `ComplyBot FULL Report for ${url}\n\nIssues Found: ${
      results.violations.length
    }\n\n${JSON.stringify(results, null, 2)}`;

    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: `Your FULL Accessibility Report - ${url}`,
      text: fullReport,
    });

    console.log(`✅ Full report sent to ${email}`);
    res.send("✅ Full report sent.");
  } catch (err) {
    console.error("💥 Full Report Error:", err);
    res.status(500).send("Failed to deliver full report.");
  }
});

// ✅ Static Pages
app.get("/results.html", (req, res) => {
  res.sendFile(path.resolve(__dirname, "public", "results.html"));
});

app.get("/success.html", (req, res) => {
  res.send(`
    <h1>✅ Payment Successful</h1>
    <p>Your full report is being emailed...</p>
    <script>
      const session_id = new URLSearchParams(window.location.search).get('session_id');
      fetch('/deliver-full-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id })
      });
    </script>
  `);
});

app.get("/cancel.html", (req, res) => {
  res.send("<h1>❌ Payment Cancelled</h1><p>You can try again anytime.</p>");
});

// ✅ Serve Homepage
app.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "public", "index.html"));
});

// ✅ Start Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server live at http://localhost:${PORT}`);
});
