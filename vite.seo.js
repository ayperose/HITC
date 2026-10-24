// Search and sharing markup, added to every built page, plus robots.txt and sitemap.xml.
//
// SITE_URL (set in vite.config.js, or as an environment variable when building) is the address the site will
// live at, for example https://www.example.ph with no slash at the end. While it is empty the build leaves out
// everything that needs the address: sitemap.xml, canonical links, og:url, og:image and the Twitter card.
// Once it is set, one `npm run build` writes them all.
//
// The business facts in the structured data below come from the client and must match the contact page.
const BUSINESS = {
  name: 'HITC, Inc. (Headstart Information Technology & Consultancy Inc.)',
  alternateName: 'HITC',
  foundingDate: '2006',
  email: 'info@hitc.ph',
  telephone: ['+63783771337', '+639120827092'],
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'HITC Bldg., #154 Tuliao St., Caritan Norte',
    addressLocality: 'Tuguegarao City',
    addressRegion: 'Cagayan',
    postalCode: '3500',
    addressCountry: 'PH',
  },
  geo: { '@type': 'GeoCoordinates', latitude: 17.6334385, longitude: 121.7179993 },
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:00', closes: '17:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: '08:00', closes: '12:00' },
  ],
};
const LD_PAGES = ['index', 'contact']; // pages that carry the business details

const attr = (s) => s.replace(/&amp;/g, '&').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const text = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\u003c')}</script>`;

export default function seo({ siteUrl = '' } = {}) {
  const site = siteUrl.replace(/\/+$/, '');
  return {
    name: 'seo',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const page = ctx.filename.split(/[\\/]/).pop().replace(/\.html$/, '');
        const url = site && `${site}/${page === 'index' ? '' : `${page}.html`}`;
        const title = /<title>([\s\S]*?)<\/title>/.exec(html)?.[1].trim() ?? '';
        const desc = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '';
        const has = (p) => html.includes(`property="${p}"`);
        const out = [];
        if (url) out.push(`<link rel="canonical" href="${url}" />`);
        if (!has('og:title')) out.push(`<meta property="og:title" content="${attr(title)}" />`);
        if (!has('og:description') && desc) out.push(`<meta property="og:description" content="${attr(desc)}" />`);
        if (!has('og:type')) out.push('<meta property="og:type" content="website" />');
        out.push('<meta property="og:site_name" content="HITC, Inc." />', '<meta property="og:locale" content="en_PH" />');
        if (url) {
          out.push(
            `<meta property="og:url" content="${url}" />`,
            `<meta property="og:image" content="${site}/og-image.jpg" />`,
            '<meta property="og:image:width" content="1200" />',
            '<meta property="og:image:height" content="630" />',
            '<meta property="og:image:alt" content="Students tap their school ID at an HITC eCash terminal in a school canteen" />',
            '<meta name="twitter:card" content="summary_large_image" />',
          );
        }
        if (LD_PAGES.includes(page)) {
          out.push(ld({ '@context': 'https://schema.org', '@type': 'LocalBusiness', ...BUSINESS, ...(url && { url: site + '/' }) }));
        }
        if (page === 'contact') {
          const faq = [...html.matchAll(/<details class="qa"><summary>([\s\S]*?)<i[\s\S]*?<\/summary><p>([\s\S]*?)<\/p><\/details>/g)];
          if (faq.length) {
            out.push(ld({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faq.map(([, q, a]) => ({ '@type': 'Question', name: text(q), acceptedAnswer: { '@type': 'Answer', text: text(a) } })),
            }));
          }
        }
        return html.replace('</head>', `${out.join('\n')}\n</head>`);
      },
    },
    generateBundle: {
      order: 'post', // after Vite has added the pages to the bundle
      handler(_, bundle) {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n${site ? `\nSitemap: ${site}/sitemap.xml\n` : ''}`,
      });
      if (!site) return;
      const urls = Object.keys(bundle).filter((f) => /^[^/]+\.html$/.test(f)).map((f) => f.slice(0, -5)).sort().map((p) => `  <url><loc>${site}/${p === 'index' ? '' : `${p}.html`}</loc></url>`);
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
      });
      },
    },
  };
}
