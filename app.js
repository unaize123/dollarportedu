const express = require('express');
const path = require('path');
const fs = require('fs');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
const DEFAULT_META_DESCRIPTION = 'DollarPort Edu offers forex trading course in Calicut, Kerala with online and offline classes, Malayalam support, mentorship, and practical market training.';
const DEFAULT_META_KEYWORDS = [
  'forex trading course in Calicut',
  'forex training in Calicut',
  'forex classes in Calicut',
  'forex course in Calicut',
  'best forex mentor in Calicut',
  'forex trading course in Kerala',
  'forex training institute in Kerala',
  'forex course in Malayalam',
  'free forex webinar Calicut'
].join(', ');

const buildBreadcrumbSchema = (siteUrl, currentPath) => {
  const safePath = currentPath || '/';
  const paths = safePath === '/' ? ['/'] : ['/', ...safePath.split('/').filter(Boolean).map((_, idx, arr) => `/${arr.slice(0, idx + 1).join('/')}`)];
  const itemListElement = paths.map((crumbPath, index) => {
    const name = crumbPath === '/'
      ? 'Home'
      : crumbPath
        .split('/')
        .filter(Boolean)
        .slice(-1)[0]
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: `${siteUrl}${crumbPath}`
    };
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement
  };
};

const loadEnvFile = () => {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

loadEnvFile();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const resolvedSiteUrl = SITE_URL || `${req.protocol}://${req.get('host')}`;
  const currentPath = req.path || '/';

  res.locals.siteUrl = resolvedSiteUrl;
  res.locals.currentPath = currentPath;
  res.locals.defaultMetaDescription = DEFAULT_META_DESCRIPTION;
  res.locals.defaultMetaKeywords = DEFAULT_META_KEYWORDS;
  res.locals.defaultSeoJsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'EducationalOrganization',
      name: 'DollarPort Edu',
      url: resolvedSiteUrl,
      logo: `${resolvedSiteUrl}/images/dollarport-logo.png`,
      description: DEFAULT_META_DESCRIPTION,
      email: 'hr.dollarport@gmail.com',
      telephone: '+91 99471 89040',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Near HP Petrol Pump, Palazhi',
        addressLocality: 'Calicut',
        addressRegion: 'Kerala',
        postalCode: '673014',
        addressCountry: 'IN'
      },
      areaServed: ['Calicut', 'Calicut', 'Kerala', 'India'],
      sameAs: ['https://www.thedollarport.com']
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'DollarPort Edu',
      url: resolvedSiteUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${resolvedSiteUrl}/insights`,
        'query-input': 'required name=search_term_string'
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'DollarPort Edu',
      url: resolvedSiteUrl,
      image: `${resolvedSiteUrl}/images/dollarport-logo.png`,
      email: 'hr.dollarport@gmail.com',
      telephone: '+91 99471 89040',
      description: 'Forex training institute in Calicut, Kerala offering online and offline forex classes with Malayalam support.',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Near HP Petrol Pump, Palazhi',
        addressLocality: 'Calicut',
        addressRegion: 'Kerala',
        postalCode: '673014',
        addressCountry: 'IN'
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 11.2588,
        longitude: 75.7804
      },
      priceRange: '$$'
    }
  ];
  res.locals.defaultSeoJsonLd.push(buildBreadcrumbSchema(resolvedSiteUrl, currentPath));

  next();
});

app.get('/robots.txt', (req, res) => {
  const resolvedSiteUrl = SITE_URL || `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send([
    'User-agent: *',
    'Allow: /',
    `Sitemap: ${resolvedSiteUrl}/sitemap.xml`
  ].join('\n'));
});

app.get('/sitemap.xml', (req, res) => {
  const resolvedSiteUrl = SITE_URL || `${req.protocol}://${req.get('host')}`;
  const today = new Date().toISOString().slice(0, 10);
  const paths = [
    '/',
    '/forex-market',
    '/courses',
    '/simulation',
    '/tools',
    '/insights',
    '/broker-guide',
    '/community',
    '/contact',
    '/forex-course-calicut'
  ];

  const urlsXml = paths.map((routePath) => [
    '<url>',
    `<loc>${resolvedSiteUrl}${routePath}</loc>`,
    `<lastmod>${today}</lastmod>`,
    '</url>'
  ].join('')).join('');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlsXml,
    '</urlset>'
  ].join('');

  res.type('application/xml').send(xml);
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);

app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found | DollarPort Edu',
    page: '404',
    noIndex: true,
    metaDescription: 'The requested page could not be found on DollarPort Edu.'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`DollarPort Edu running on http://0.0.0.0:${PORT}`);
});


