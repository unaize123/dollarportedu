const express = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs/promises');
const path = require('path');

const router = express.Router();
const HR_EMAIL = process.env.HR_EMAIL || 'hr.dollarport@gmail.com';
const LEAD_STORE_PATH = path.join(__dirname, '..', 'data', 'leads.ndjson');
const VALID_LEAD_TYPES = new Set([
  'course_enrollment',
  'mentorship_call',
  'demo_class',
  'tool_access',
  'community_join',
  'general_inquiry'
]);

const wantsJsonResponse = (req) => (
  req.get('x-requested-with') === 'XMLHttpRequest' ||
  (typeof req.get('accept') === 'string' && req.get('accept').includes('application/json'))
);

const normalizeLeadType = (value, fallback = 'general_inquiry') => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (VALID_LEAD_TYPES.has(normalized)) {
    return normalized;
  }
  return fallback;
};

const normalizeText = (value, maxLen = 500) =>
  String(value || '')
    .trim()
    .slice(0, maxLen);

const createLeadPayload = (req, defaultLeadType = 'general_inquiry') => {
  const name = normalizeText(req.body.name, 120);
  const email = normalizeText(req.body.email, 180);
  const phone = normalizeText(req.body.phone, 40);

  if (!name || !phone) {
    const error = new Error('Name and phone are required.');
    error.statusCode = 400;
    throw error;
  }

  return {
    leadId: `LD-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    leadType: normalizeLeadType(req.body.leadType || req.body.lead_type, defaultLeadType),
    name,
    email,
    phone,
    courseInterest: normalizeText(req.body.courseInterest, 160),
    experienceLevel: normalizeText(req.body.experienceLevel, 80),
    budgetRange: normalizeText(req.body.budgetRange, 80),
    message: normalizeText(req.body.message, 1000),
    sourcePage: normalizeText(req.body.sourcePage, 200) || normalizeText(req.get('referer'), 400) || req.path,
    utmSource: normalizeText(req.body.utmSource || req.body.utm_source, 120),
    utmMedium: normalizeText(req.body.utmMedium || req.body.utm_medium, 120),
    utmCampaign: normalizeText(req.body.utmCampaign || req.body.utm_campaign, 150),
    createdAt: new Date().toISOString()
  };
};

const persistLead = async (lead) => {
  const dir = path.dirname(LEAD_STORE_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(LEAD_STORE_PATH, `${JSON.stringify(lead)}\n`, 'utf8');
};

const sendLeadEmail = async (lead) => {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    return { sent: false, reason: 'mail_credentials_missing' };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });

  const submittedAt = new Date(lead.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  await transporter.sendMail({
    from: `"DollarPort Edu Lead" <${process.env.MAIL_USER}>`,
    to: HR_EMAIL,
    subject: `New Lead: ${lead.name} (${lead.leadType})`,
    replyTo: lead.email || undefined,
    text: [
      'New lead captured from DollarPort Edu website:',
      `Lead ID: ${lead.leadId}`,
      `Lead Type: ${lead.leadType}`,
      `Name: ${lead.name}`,
      `Email: ${lead.email || '-'}`,
      `Phone: ${lead.phone}`,
      `Course Interest: ${lead.courseInterest || '-'}`,
      `Experience Level: ${lead.experienceLevel || '-'}`,
      `Budget Range: ${lead.budgetRange || '-'}`,
      `Message: ${lead.message || '-'}`,
      `Source Page: ${lead.sourcePage || '-'}`,
      `UTM Source: ${lead.utmSource || '-'}`,
      `UTM Medium: ${lead.utmMedium || '-'}`,
      `UTM Campaign: ${lead.utmCampaign || '-'}`,
      `Submitted At: ${submittedAt}`
    ].join('\n')
  });

  return { sent: true };
};

const sendLeadToGoogleSheets = async (lead) => {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) {
    return { sent: false, reason: 'google_sheets_webhook_missing' };
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      leadId: lead.leadId,
      leadType: lead.leadType,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      courseInterest: lead.courseInterest,
      experienceLevel: lead.experienceLevel,
      budgetRange: lead.budgetRange,
      message: lead.message,
      sourcePage: lead.sourcePage,
      utmSource: lead.utmSource,
      utmMedium: lead.utmMedium,
      utmCampaign: lead.utmCampaign,
      createdAt: lead.createdAt
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Sheets sync failed: ${response.status} ${errorText}`);
  }

  return { sent: true };
};

const submitLead = async (req, defaultLeadType = 'general_inquiry') => {
  const lead = createLeadPayload(req, defaultLeadType);
  await persistLead(lead);

  let emailResult = { sent: false };
  let sheetsResult = { sent: false };
  try {
    emailResult = await sendLeadEmail(lead);
  } catch (error) {
    console.error('Lead email send failed:', error.message);
    emailResult = { sent: false, reason: 'mail_send_failed' };
  }

  try {
    sheetsResult = await sendLeadToGoogleSheets(lead);
  } catch (error) {
    console.error('Google Sheets sync failed:', error.message);
    sheetsResult = { sent: false, reason: 'google_sheets_sync_failed' };
  }

  return { lead, emailResult, sheetsResult };
};

const handleLeadSubmission = async (req, res, options = {}) => {
  const defaultLeadType = options.defaultLeadType || 'general_inquiry';
  const successRedirect = options.successRedirect || '/contact?success=1';
  const failedRedirect = options.failedRedirect || '/contact?failed=1';

  try {
    const { lead, emailResult, sheetsResult } = await submitLead(req, defaultLeadType);

    if (wantsJsonResponse(req)) {
      return res.json({
        ok: true,
        leadId: lead.leadId,
        stored: true,
        emailSent: Boolean(emailResult.sent),
        sheetsSynced: Boolean(sheetsResult.sent)
      });
    }
    return res.redirect(successRedirect);
  } catch (error) {
    console.error('Lead submission failed:', error.message);
    if (wantsJsonResponse(req)) {
      return res.status(error.statusCode || 500).json({
        ok: false,
        message: error.statusCode === 400 ? error.message : 'Lead submission failed'
      });
    }
    return res.redirect(failedRedirect);
  }
};

const courses = [
  {
    title: 'Online Session',
    description: 'Structured online forex program covering foundation, analysis, execution, and discipline modules.',
    duration: 'Multi-Module Program',
    level: 'Beginner to Advanced',
    outline: [
      'Orientation class',
      'Basics of forex market',
      'Terminologies',
      'Market analysis',
      'Candles and chart pattern psychology',
      'Market structure mapping',
      'SNR, SND & OTE',
      'Blocks & inefficiencies',
      'Advanced liquidity concepts',
      'Session models',
      'Top-down analysis & entry module',
      'Risk & psychology management'
    ]
  },
  {
    title: 'Residential Campus',
    description: '10-day immersive campus training with practical market observation, execution, and performance review.',
    duration: '10 Days',
    level: 'Intensive Program',
    outline: [
      'Day 1 - Orientation, reality check & trader mindset',
      'Day 2 - Market & forex basics (foundation day)',
      'Day 3 - Market structure (how price behaves)',
      'Day 4 - Trade setup logic',
      'Day 5 - Risk management',
      'Day 6 - Trading psychology & discipline',
      'Day 7 - Live market observation (experience day)',
      'Day 8 - Trading & execution',
      'Day 9 - Journaling & performance review',
      'Day 10 - Personal roadmap & exit clarity'
    ]
  }
];

const insights = [
  {
    category: 'Daily Analysis',
    title: 'USD Momentum Watch: Key Reversal Zones for Major Pairs',
    excerpt: 'A breakdown of intraday structure and likely continuation levels across EURUSD and GBPUSD.'
  },
  {
    category: 'Pair Setups',
    title: 'GBPJPY Pullback Opportunity with Risk-Controlled Entries',
    excerpt: 'Session-based setup plan with confirmation triggers and invalidation areas.'
  },
  {
    category: 'Forex News',
    title: 'Macro Events Reshaping FX Volatility This Week',
    excerpt: 'How policy signals and CPI expectations are changing short-term liquidity behavior.'
  },
  {
    category: 'Weekly Outlook',
    title: 'Weekly Map: High-Probability Zones for Swing Traders',
    excerpt: 'Top directional biases and caution zones for the upcoming global market sessions.'
  }
];

router.get('/', (req, res) => {
  res.render('home', {
    title: 'Best Forex Trading Course in Calicut, Kerala | DollarPort Edu',
    page: 'home',
    metaDescription: 'Join the best forex trading course in Calicut, Kerala at DollarPort Edu with online and offline classes, mentorship, and Malayalam support.',
    metaKeywords: 'forex trading course in Calicut, forex training in Calicut, forex classes in Calicut, forex trading course in Kerala'
  });
});

router.get('/forex-market', (req, res) => {
  res.render('forex-market', {
    title: 'Forex Market Training in Calicut, Kerala | DollarPort Edu',
    page: 'forex-market',
    metaDescription: 'Learn forex market structure, sessions, and liquidity with forex training in Calicut, Kerala from DollarPort Edu mentors.',
    metaKeywords: 'forex training in Calicut, forex classes in Calicut, forex trading course in Kerala'
  });
});

router.get('/courses', (req, res) => {
  res.render('courses', {
    title: 'Forex Trading Course in Calicut & Calicut | DollarPort Edu',
    page: 'courses',
    courses,
    metaDescription: 'Explore forex trading course in Calicut and forex course in Calicut with beginner to advanced modules, mentorship, and Malayalam support.',
    metaKeywords: 'forex trading course in Calicut, forex course in Calicut, forex course in Malayalam, best forex mentor in Calicut'
  });
});

router.get('/simulation', (req, res) => {
  res.render('simulation', {
    title: 'Forex Practice & Simulation in Calicut, Kerala | DollarPort Edu',
    page: 'simulation',
    metaDescription: 'Practice forex strategies with simulation modules from our forex training institute in Kerala, designed for learners in Calicut and Calicut.',
    metaKeywords: 'forex training institute in Kerala, forex training in Calicut, forex classes in Calicut'
  });
});

router.get('/tools', (req, res) => {
  res.render('tools', {
    title: 'Forex Trading Tools for Students in Calicut | DollarPort Edu',
    page: 'tools',
    metaDescription: 'Use forex calculators and planning tools from DollarPort Edu, supporting forex students in Calicut, Kerala and across India.',
    metaKeywords: 'forex classes in Calicut, forex trading course in Kerala, forex training in Calicut'
  });
});

router.get('/insights', (req, res) => {
  res.render('insights', {
    title: 'Forex Insights & Mentor Guidance in Calicut | DollarPort Edu',
    page: 'insights',
    insights,
    metaDescription: 'Read forex insights, setups, and mentor guidance from DollarPort Edu, known for forex training in Calicut and Kerala.',
    metaKeywords: 'best forex mentor in Calicut, forex training in Calicut, forex trading course in Kerala'
  });
});

router.get('/broker-guide', (req, res) => {
  res.render('broker-guide', {
    title: 'Broker Guide for Forex Students in Calicut | DollarPort Edu',
    page: 'broker-guide',
    metaDescription: 'Compare forex brokers and platforms with practical guidance from DollarPort Edu for learners in Calicut, Kerala.',
    metaKeywords: 'forex classes in Calicut, forex training institute in Kerala, forex course in Calicut'
  });
});

router.get('/community', (req, res) => {
  res.render('community', {
    title: 'Forex Community & Webinar Support in Calicut | DollarPort Edu',
    page: 'community',
    metaDescription: 'Join DollarPort Edu community for mentorship, webinars, and peer learning with support for traders in Calicut, Kerala.',
    metaKeywords: 'free forex webinar Calicut, forex training in Calicut, best forex mentor in Calicut'
  });
});

router.get('/contact', (req, res) => {
  const success = req.query.success === '1';
  const failed = req.query.failed === '1';
  const selectedCourse = typeof req.query.course === 'string' ? req.query.course : '';
  const selectedLeadType = normalizeLeadType(req.query.leadType, 'course_enrollment');
  const sourcePage = typeof req.query.sourcePage === 'string' ? req.query.sourcePage : '/contact';
  res.render('contact', {
    title: 'Contact Forex Mentor in Calicut, Kerala | DollarPort Edu',
    page: 'contact',
    success,
    failed,
    selectedCourse,
    selectedLeadType,
    sourcePage,
    metaDescription: 'Contact DollarPort Edu in Calicut, Kerala for forex course enrollment, mentorship, and Malayalam training support.',
    metaKeywords: 'best forex mentor in Calicut, forex trading course in Calicut, forex training institute in Kerala'
  });
});

router.get('/forex-course-calicut', (req, res) => {
  res.render('forex-course-calicut', {
    title: 'Forex Trading Course in Calicut, Kerala | DollarPort Edu',
    page: 'forex-course-calicut',
    metaDescription: 'Join forex trading course in Calicut with classroom and online training, Malayalam support, webinars, and mentor guidance at DollarPort Edu.',
    metaKeywords: 'forex trading course in Calicut, forex training in Calicut, forex course in Calicut, forex course in Malayalam, free forex webinar Calicut'
  });
});

router.post('/leads', async (req, res) => handleLeadSubmission(req, res, { defaultLeadType: 'general_inquiry' }));
router.post('/contact', async (req, res) => handleLeadSubmission(req, res, { defaultLeadType: 'course_enrollment' }));

module.exports = router;


