// server.js

require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const axeCore = require('axe-core');
const nodemailer = require('nodemailer');
const path = require('path');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const sitePath = path.resolve(__dirname, '../complybot.net');
console.log("STATIC PATH:", sitePath);

app.use(express.static(sitePath));

// ✅ FREE scan - summary only
app.post('/scan', async (req, res) => {
  const { url, email } = req.body;
  console.log(`🚀 Free scan for ${email} on ${url}`);

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });
    await page.addScriptTag({ path: require.resolve('axe-core') });
    const results = await page.evaluate(async () => await axe.run());
    await browser.close();

    const issueCount = results.violations.length;

    let summary = `✅ ComplyBot Quick Scan Summary for ${url}\n\n`;
    if (issueCount === 0) {
      summary += `🎉 Good news! No critical issues found. Great job!\n`;
    } else {
      summary += `⚠️ We found **${issueCount} accessibility issues**.\n`;
    }
    summary += `👉 Upgrade for $29 to get the detailed report, auto-fixes, compliance certificate & 24/7 monitoring.\n`;

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: 465,
      secure: true,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: `Your ComplyBot Quick Scan for ${url}`,
      text: summary
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Summary emailed to ${email}`);

    res.redirect('/results.html');

  } catch (err) {
    console.error('💥 FREE SCAN ERROR:', err);
    res.status(500).send('Scan failed.');
  }
});

// ✅ Create Stripe Checkout
app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'ComplyBot Full Accessibility Fix Plan',
            description: 'Detailed report, auto-fixes, certificate, 24/7 monitoring'
          },
          unit_amount: 2900,
        },
        quantity: 1
      }],
      success_url: 'http://localhost:3000/success.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://localhost:3000/cancel.html'
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).send('Stripe session creation failed.');
  }
});

// ✅ Deliver full report *only if paid*
app.post('/deliver-full-report', async (req, res) => {
  const { email, session_id, url } = req.body;
  console.log(`🔒 Deliver full report for session ${session_id}`);

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      return res.status(403).send('Payment not verified.');
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });
    await page.addScriptTag({ path: require.resolve('axe-core') });
    const results = await page.evaluate(async () => await axe.run());
    await browser.close();

    const issueCount = results.violations.length;

    let fullReport = `✅ ComplyBot FULL Accessibility Report for ${url}\n\n`;
    fullReport += `Found ${issueCount} issues.\n\n`;
    fullReport += `Detailed JSON:\n\n${JSON.stringify(results, null, 2)}`;

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: 465,
      secure: true,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: `Your FULL ComplyBot Report for ${url}`,
      text: fullReport
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Full report emailed to ${email}`);

    res.send('Full report sent!');

  } catch (err) {
    console.error('💥 FULL REPORT ERROR:', err);
    res.status(500).send('Failed to deliver full report.');
  }
});

// ✅ Fallback routes
app.get('/results.html', (req, res) => {
  res.sendFile(path.resolve(sitePath, 'results.html'));
});

app.get('/success.html', (req, res) => {
  res.send(`
    <h1>✅ Payment Successful</h1>
    <p>Your payment was received. Sending your full report now...</p>
    <script>
      const email = localStorage.getItem('email');
      const url = localStorage.getItem('url');
      const session_id = new URLSearchParams(window.location.search).get('session_id');

      fetch('/deliver-full-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, session_id, url })
      })
      .then(() => {
        document.body.innerHTML += '<p>✅ Full report sent to ' + email + '</p>';
      })
      .catch(() => {
        document.body.innerHTML += '<p>❌ Error sending full report.</p>';
      });
    </script>
  `);
});

app.get('/cancel.html', (req, res) => {
  res.send('<h1>❌ Payment Cancelled</h1><p>You can retry anytime.</p>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
