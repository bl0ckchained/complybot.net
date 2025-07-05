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
app.use(express.static(path.join(__dirname, "public"))); // ✅ Serve static HTML & assets

// 🧠 Summarize Accessibility Issues
function summarizeIssues(violations) {
  if (!violations || violations.length === 0) {
    return "✅ No major accessibility issues were found. Your site looks great!";
  }

  const summary = violations.map((v) => {
    const nodeCount = v.nodes.length;
    return `⚠️ ${v.help} (${nodeCount} instance${nodeCount > 1 ? 's' : ''}) — ${v.description}`;
  });

  return summary.join('\n');
}

// ✅ Free Scan Route
app.post("/scan", async (req, res) => {
  const { url, email } = req.body;
  console.log(`🚀 Free Scan: ${url} for ${email}`);

  try {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
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

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: `Your ComplyBot Quick Scan for ${url}`,
      text: summary,
    });

    console.log(`✅ Summary emailed to ${email}`);
    res.redirect("/results.html");
  } catch (err) {
    console.error("💥 Scan Error:", err);
    res.status(500).send("Scan failed.");
  }
});

// ✅ Stripe Checkout (no email/URL upfront)
app.post("/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
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

// ✅ Full Report After Payment
app.post("/deliver-full-report", async (req, res) => {
  const { session_id, email, url } = req.body;
  console.log(`📩 Delivering full report for ${email} / ${url} (session: ${session_id})`);

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") {
      return res.status(403).send("❌ Payment not verified.");
    }

    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });
    await page.addScriptTag({ path: require.resolve("axe-core") });
    const results = await page.evaluate(async () => await axe.run());
    await browser.close();

    const plainSummary = summarizeIssues(results.violations);
    const fullReport = `ComplyBot FULL Report for ${url}\n\nIssues Found: ${
      results.violations.length
    }\n\n${JSON.stringify(results, null, 2)}`;

    const emailBody = `
Hi there,

Thanks for using ComplyBot! Here’s a simplified summary of your full accessibility scan for ${url}:

${plainSummary}

📄 A full developer report is included below for technical review.

Need help fixing these issues?
Click below to request a Fix Pack:
👉 https://complybot.net/fix-request.html

Thank you,
— The ComplyBot Team
`;

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
      text: `${emailBody}\n\n\n---\n\n${fullReport}`,
    });

    console.log(`✅ Full report sent to ${email}`);
    res.send("✅ Full report sent.");
  } catch (err) {
    console.error("💥 Full Report Error:", err);
    res.status(500).send("Failed to deliver full report.");
  }
});

// ✅ Redirects for legacy .html paths (optional)
app.get("/cancel.html", (req, res) => {
  res.send("<h1>❌ Payment Cancelled</h1><p>You can try again anytime.</p>");
});

// ✅ Favicon
app.get("/favicon.png", (req, res) => {
  res.sendFile(path.resolve(__dirname, "public", "favicon.png"));
});

// ✅ Start Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server live at http://localhost:${PORT}`);
});
