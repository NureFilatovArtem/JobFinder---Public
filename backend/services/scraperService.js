// Web scraping service for job sites
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const crypto = require('crypto');
const { BELGIAN_CITIES, TOP_CITIES, FRENCH_CITY_NAMES, getSearchCities } = require('../config/belgianCities');
const { normalizeUrl, buildVacancyDedupKey } = require('./vacancyNormalizer');
// Legacy gate — controls whether Indeed/LinkedIn are included in searchAllSites()
const legacyConfig = require('../config/ingestionSources').legacy;

// Legacy - kept for backward compatibility
const ANTWERP_POSTCODES = ['2000', '2018', '2060', '2600', '2100', '2140'];

// Default cities for multi-city search (top 20 by population)
const DEFAULT_SEARCH_CITIES = TOP_CITIES;

class ScraperService {
  constructor() {
    this.browser = null;
    this.browserInitializing = false;
  }

  async initBrowser() {
    // Prevent multiple simultaneous initialization attempts
    if (this.browserInitializing) {
      // Wait for initialization to complete
      while (this.browserInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.browser;
    }

    if (!this.browser) {
      this.browserInitializing = true;
      try {
        this.browser = await puppeteer.launch({
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-web-security'
          ],
          timeout: 30000,
          protocolTimeout: 60000
        });
        console.log('Browser initialized successfully');
      } catch (error) {
        console.error('Failed to launch browser:', error.message);
        this.browser = null;
        throw error;
      } finally {
        this.browserInitializing = false;
      }
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.error('Error closing browser:', error.message);
      }
      this.browser = null;
    }
  }

  async createPage() {
    const browser = await this.initBrowser();
    const page = await browser.newPage();

    // Set realistic browser headers
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    return page;
  }

  async scrapeIndeed(keywords, regions = [], country = 'BE') {
    let page;
    const jobs = [];

    try {
      page = await this.createPage();

      // Build search URL - search in both Dutch and English
      const searchQuery = encodeURIComponent(keywords);
      const location = regions.length > 0 ? regions[0] : (country === 'BE' ? 'Antwerpen' : country === 'NL' ? 'Amsterdam' : 'Berlin');

      // Determine domain based on country
      const domain = country === 'NL' ? 'nl.indeed.com' : country === 'DE' ? 'de.indeed.com' : 'be.indeed.com';
      const url = `https://${domain}/jobs?q=${searchQuery}&l=${encodeURIComponent(location)}`;

      console.log(`Scraping Indeed: ${url}`);

      // Navigate with better error handling
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get page content
      const content = await page.content();
      const $ = cheerio.load(content);

      // Extract jobs
      $('[data-jk], .job_seen_beacon, .jobsearch-SerpJobCard, .tapItem').each((i, elem) => {
        try {
          const $card = $(elem);
          const titleEl = $card.find('h2.jobTitle a, h2 a[data-jk], a.jobTitle, h2 span[title]').first();
          const title = titleEl.text().trim() || titleEl.attr('title') || '';

          if (!title) return;

          const companyEl = $card.find('.companyName, [data-testid="company-name"], .companyName a').first();
          const locationEl = $card.find('.companyLocation, [data-testid="text-location"], .companyLocation').first();

          // Extract link
          let link = '';
          const linkEl = titleEl.closest('a').length ? titleEl.closest('a') : $card.find('a[href*="/viewjob"], a[href*="/jobs/view"]').first();
          if (linkEl.length) {
            const href = linkEl.attr('href');
            if (href) {
              link = href.startsWith('http') ? href : `https://${domain}${href}`;
            }
          }

          // Extract company and location first (needed for description extraction)
          const location = locationEl.text().trim() || '';
          const company = companyEl.text().trim() || '';

          // Extract description - try multiple selectors
          let description = '';
          const descSelectors = [
            '.job-snippet',
            '.summary',
            '[class*="summary"]',
            '[class*="snippet"]',
            '[class*="job-snippet"]',
            '[data-testid="job-snippet"]',
            '.job-snippet-container',
            '.jobsearch-JobComponent-description',
            '[id*="jobDescriptionText"]'
          ];
          for (const selector of descSelectors) {
            const descEl = $card.find(selector).first();
            if (descEl.length) {
              const text = descEl.text().trim();
              if (text.length > description.length) {
                description = text;
              }
              if (description.length > 200) break;
            }
          }

          // If no description found in card, try to get from full page (if link is available)
          if (!description || description.length < 50) {
            // Try to get more context from the card itself
            const cardText = $card.text().trim();
            const titleIndex = cardText.indexOf(title);
            if (titleIndex !== -1) {
              const afterTitle = cardText.substring(titleIndex + title.length);
              if (company) {
                const companyIndex = afterTitle.indexOf(company);
                if (companyIndex !== -1) {
                  const potentialDesc = afterTitle.substring(companyIndex + company.length).trim();
                  if (potentialDesc.length > description.length && potentialDesc.length < 500) {
                    description = potentialDesc;
                  }
                }
              }
            }
          }

          // Check if location matches Antwerp postcodes
          const matchesRegion = !regions.length || regions.some(code => location.includes(code)) || location.toLowerCase().includes('antwerpen');

          if (matchesRegion && title) {
            // Extract postcode
            let postcode = '';
            const postcodeMatch = location.match(/\b(2000|2018|2060|2600|2100|2140)\b/);
            if (postcodeMatch) {
              postcode = postcodeMatch[1];
            }

            // Clean description - ensure it's meaningful
            description = description.replace(/\s+/g, ' ').trim();
            // Remove very short descriptions that are likely not real descriptions
            if (description.length < 20) {
              description = ''; // Set to empty if too short
            }
            if (description.length > 1500) {
              description = description.substring(0, 1500) + '...';
            }

            // Only add jobs with valid links (no mock data)
            if (link && link.length > 0 && !link.includes('example.com') && !link.includes('test.com')) {
              // Generate deterministic source_id from cleaned URL
              const sourceId = 'url_' + crypto.createHash('md5').update(normalizeUrl(link)).digest('hex').substring(0, 16);
              jobs.push({
                title: title,
                company: company,
                location: location,
                description: description,
                link: link,
                source: 'indeed',
                source_id: sourceId,
                postcode: postcode,
                status: 'gevonden'
              });
            }
          }
        } catch (error) {
          console.error('Error parsing Indeed job:', error.message);
        }
      });

      console.log(`Found ${jobs.length} jobs on Indeed`);
    } catch (error) {
      console.error('Error scraping Indeed:', error.message || error);
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (err) {
          console.error('Error closing page:', err.message);
        }
      }
    }

    return jobs;
  }

  async scrapeVdab(keywords, regions = []) {
    let page;
    const jobs = [];

    try {
      page = await this.createPage();

      // VDAB supports both Dutch and English searches
      const searchQuery = encodeURIComponent(keywords);
      const url = `https://www.vdab.be/vindeenjob/vacatures?trefwoord=${searchQuery}`;

      console.log(`Scraping VDAB: ${url}`);

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const content = await page.content();
      const $ = cheerio.load(content);

      // VDAB uses li.c-vacature for job cards (updated 2026)
      $('li.c-vacature').each((i, elem) => {
        try {
          const $card = $(elem);

          // Title is usually in an <a> tag within the job card
          const titleEl = $card.find('a[href*="/vacature"], h3 a, h2 a, a.c-vacature__title').first();
          const title = titleEl.text().trim();

          if (!title) return;

          // Company name - look for company-related classes
          const companyEl = $card.find('.c-vacature__employer, .c-company, [class*="employer"], [class*="company"]').first();

          // Location - look for location-related classes
          const locationEl = $card.find('.c-vacature__location, .c-location, [class*="location"], [class*="gemeente"]').first();

          let link = '';
          if (titleEl.length) {
            const href = titleEl.attr('href');
            if (href) {
              link = href.startsWith('http') ? href : `https://www.vdab.be${href}`;
            }
          }

          // Extract description - try multiple selectors
          let description = '';
          const descSelectors = [
            '.description',
            '.job-description',
            '[class*="description"]',
            '[class*="summary"]',
            '.vacancy-description',
            '.job-summary',
            'p',
            '[data-testid="job-description"]'
          ];
          for (const selector of descSelectors) {
            const descEl = $card.find(selector).first();
            if (descEl.length) {
              const text = descEl.text().trim();
              if (text.length > description.length) {
                description = text;
              }
              if (description.length > 200) break;
            }
          }

          // If still no description, try getting text from the card
          if (!description || description.length < 50) {
            const cardText = $card.text().trim();
            if (cardText.length > 100) {
              // Try to extract meaningful text excluding title and company
              const lines = cardText.split('\n').filter(line => line.trim().length > 20);
              if (lines.length > 2) {
                description = lines.slice(2).join(' ').trim();
              }
            }
          }

          const location = locationEl.text().trim() || '';
          const company = companyEl.text().trim() || '';

          const matchesRegion = !regions.length || regions.some(code => location.includes(code)) || location.toLowerCase().includes('antwerpen');

          if (matchesRegion) {
            let postcode = '';
            const postcodeMatch = location.match(/\b(2000|2018|2060|2600|2100|2140)\b/);
            if (postcodeMatch) {
              postcode = postcodeMatch[1];
            }

            // Clean description - ensure it's meaningful
            description = description.replace(/\s+/g, ' ').trim();
            // Remove very short descriptions that are likely not real descriptions
            if (description.length < 20) {
              description = ''; // Set to empty if too short
            }
            if (description.length > 1500) {
              description = description.substring(0, 1500) + '...';
            }

            // Only add jobs with valid links (no mock data)
            if (link && link.length > 0 && !link.includes('example.com') && !link.includes('test.com')) {
              const sourceId = 'url_' + crypto.createHash('md5').update(normalizeUrl(link)).digest('hex').substring(0, 16);
              jobs.push({
                title: title,
                company: company,
                location: location,
                description: description,
                link: link,
                source: 'vdab',
                source_id: sourceId,
                postcode: postcode,
                status: 'gevonden'
              });
            }
          }
        } catch (error) {
          console.error('Error parsing VDAB job:', error.message);
        }
      });

      console.log(`Found ${jobs.length} jobs on VDAB`);
    } catch (error) {
      console.error('Error scraping VDAB:', error.message || error);
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (err) {
          console.error('Error closing page:', err.message);
        }
      }
    }

    return jobs;
  }

  async scrapeStepstone(keywords, regions = [], country = 'BE') {
    let page;
    const jobs = [];

    try {
      page = await this.createPage();

      // StepStone supports both Dutch and English searches
      const searchQuery = encodeURIComponent(keywords);
      const location = regions.length > 0 ? regions[0] : (country === 'BE' ? 'Antwerpen' : country === 'NL' ? 'Amsterdam' : 'Berlin');

      const domain = country === 'NL' ? 'www.stepstone.nl' : country === 'DE' ? 'www.stepstone.de' : 'www.stepstone.be';
      const url = `https://${domain}/jobs/search.html?qs=${searchQuery}&locations=${encodeURIComponent(location)}`;

      console.log(`Scraping StepStone: ${url}`);

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const content = await page.content();
      const $ = cheerio.load(content);

      $('[data-at="job-item"], .job-item, article[class*="JobItem"]').each((i, elem) => {
        try {
          const $card = $(elem);
          const titleEl = $card.find('h2 a, h3 a, [data-at="job-item-title"]').first();
          const title = titleEl.text().trim();

          if (!title) return;

          const companyEl = $card.find('[data-at="job-item-company-name"], .company-name').first();
          const locationEl = $card.find('[data-at="job-item-location"], .location').first();

          let link = '';
          if (titleEl.length) {
            const href = titleEl.attr('href');
            if (href) {
              link = href.startsWith('http') ? href : `https://${domain}${href}`;
            }
          }

          // Extract description - try multiple selectors
          let description = '';
          const descSelectors = [
            '[data-at="job-item-summary"]',
            '.summary',
            '[class*="summary"]',
            '[class*="description"]',
            '[data-testid="job-summary"]',
            '.job-summary',
            '[data-id="job-summary"]'
          ];
          for (const selector of descSelectors) {
            const descEl = $card.find(selector).first();
            if (descEl.length) {
              const text = descEl.text().trim();
              if (text.length > description.length) {
                description = text;
              }
              if (description.length > 200) break;
            }
          }

          // If still no description, try getting meaningful text from card
          if (!description || description.length < 50) {
            const cardText = $card.text().trim();
            if (cardText.length > 100) {
              const lines = cardText.split('\n').filter(line => line.trim().length > 20);
              if (lines.length > 2) {
                description = lines.slice(2).join(' ').trim();
              }
            }
          }

          const location = locationEl.text().trim() || '';
          const company = companyEl.text().trim() || '';

          const matchesRegion = !regions.length || regions.some(code => location.includes(code)) || location.toLowerCase().includes('antwerpen');

          if (matchesRegion) {
            let postcode = '';
            const postcodeMatch = location.match(/\b(2000|2018|2060|2600|2100|2140)\b/);
            if (postcodeMatch) {
              postcode = postcodeMatch[1];
            }

            // Clean description - ensure it's meaningful
            description = description.replace(/\s+/g, ' ').trim();
            // Remove very short descriptions that are likely not real descriptions
            if (description.length < 20) {
              description = ''; // Set to empty if too short
            }
            if (description.length > 1500) {
              description = description.substring(0, 1500) + '...';
            }

            // Only add jobs with valid links (no mock data)
            if (link && link.length > 0 && !link.includes('example.com') && !link.includes('test.com')) {
              const sourceId = 'url_' + crypto.createHash('md5').update(normalizeUrl(link)).digest('hex').substring(0, 16);
              jobs.push({
                title: title,
                company: company,
                location: location,
                description: description,
                link: link,
                source: 'stepstone',
                source_id: sourceId,
                postcode: postcode,
                status: 'gevonden'
              });
            }
          }
        } catch (error) {
          console.error('Error parsing StepStone job:', error.message);
        }
      });

      console.log(`Found ${jobs.length} jobs on StepStone`);
    } catch (error) {
      console.error('Error scraping StepStone:', error.message || error);
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (err) {
          console.error('Error closing page:', err.message);
        }
      }
    }

    return jobs;
  }

  async scrapeAntwerpen(keywords, regions = []) {
    let page;
    const jobs = [];

    try {
      page = await this.createPage();

      // Antwerpen.be supports both Dutch and English (nl/en pages)
      const searchQuery = encodeURIComponent(keywords);
      // Try both Dutch and English pages
      const url = `https://www.antwerpen.be/nl/jobs?q=${searchQuery}`;
      // Note: English page would be /en/jobs but most jobs are posted in Dutch

      console.log(`Scraping Antwerpen: ${url}`);

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const content = await page.content();
      const $ = cheerio.load(content);

      $('.vacancy-item, .job-item, article[class*="vacancy"], [class*="job-card"]').each((i, elem) => {
        try {
          const $card = $(elem);
          const titleEl = $card.find('h2 a, h3 a, .vacancy-title, a[href*="/jobs/"]').first();
          const title = titleEl.text().trim();

          if (!title) return;

          const companyEl = $card.find('.employer, .organization').first();
          const locationEl = $card.find('.location, .city').first();

          let link = '';
          if (titleEl.length) {
            const href = titleEl.attr('href');
            if (href) {
              link = href.startsWith('http') ? href : `https://www.antwerpen.be${href}`;
            }
          }

          // Extract description - try multiple selectors
          let description = '';
          const descSelectors = [
            '.description',
            '.vacancy-description',
            '[class*="description"]',
            '[class*="summary"]',
            '.job-description',
            '.summary',
            'p'
          ];
          for (const selector of descSelectors) {
            const descEl = $card.find(selector).first();
            if (descEl.length) {
              const text = descEl.text().trim();
              if (text.length > description.length) {
                description = text;
              }
              if (description.length > 200) break;
            }
          }

          // If still no description, try getting text from the card
          if (!description || description.length < 50) {
            const cardText = $card.text().trim();
            if (cardText.length > 100) {
              const lines = cardText.split('\n').filter(line => line.trim().length > 20);
              if (lines.length > 2) {
                description = lines.slice(2).join(' ').trim();
              }
            }
          }

          const location = locationEl.text().trim() || 'Antwerpen';
          const company = companyEl.text().trim() || 'Stad Antwerpen';

          const matchesRegion = !regions.length || regions.some(code => location.includes(code)) || location.toLowerCase().includes('antwerpen');

          if (matchesRegion) {
            let postcode = '';
            const postcodeMatch = location.match(/\b(2000|2018|2060|2600|2100|2140)\b/);
            if (postcodeMatch) {
              postcode = postcodeMatch[1];
            }

            // Clean description - ensure it's meaningful
            description = description.replace(/\s+/g, ' ').trim();
            // Remove very short descriptions that are likely not real descriptions
            if (description.length < 20) {
              description = ''; // Set to empty if too short
            }
            if (description.length > 1500) {
              description = description.substring(0, 1500) + '...';
            }

            // Only add jobs with valid links (no mock data)
            if (link && link.length > 0 && !link.includes('example.com') && !link.includes('test.com')) {
              const sourceId = 'url_' + crypto.createHash('md5').update(normalizeUrl(link)).digest('hex').substring(0, 16);
              jobs.push({
                title: title,
                company: company,
                location: location,
                description: description,
                link: link,
                source: 'antwerpen',
                source_id: sourceId,
                postcode: postcode,
                status: 'gevonden'
              });
            }
          }
        } catch (error) {
          console.error('Error parsing Antwerpen job:', error.message);
        }
      });

      console.log(`Found ${jobs.length} jobs on Antwerpen`);
    } catch (error) {
      console.error('Error scraping Antwerpen:', error.message || error);
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (err) {
          console.error('Error closing page:', err.message);
        }
      }
    }

    return jobs;
  }

  /**
   * Scrape LinkedIn jobs using the public guest API
   * This endpoint doesn't require authentication
   * @param {string} keywords - Search keywords
   * @param {string[]} regions - Regions to search in
   * @param {string} country - Country code (BE, NL, DE)
   * @returns {Promise<Array>} Array of job objects
   */
  async scrapeLinkedIn(keywords, regions = [], country = 'BE') {
    let page;
    const jobs = [];

    try {
      page = await this.createPage();

      // LinkedIn geoIds for countries
      const geoIds = {
        'BE': '100565514',  // Belgium
        'NL': '102890719',  // Netherlands
        'DE': '101282230'   // Germany
      };

      const geoId = geoIds[country] || geoIds['BE'];
      const searchQuery = encodeURIComponent(keywords);
      const location = regions.length > 0 ? encodeURIComponent(regions[0]) :
        (country === 'BE' ? 'Belgium' : country === 'NL' ? 'Netherlands' : 'Germany');

      // Use the public guest API - this works without login
      // f_TPR=r604800 = past week, f_TPR=r86400 = past 24 hours
      // Scrape two pages for more results
      for (const startOffset of [0, 25]) {
        const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${searchQuery}&location=${location}&geoId=${geoId}&start=${startOffset}&f_TPR=r604800`;

        console.log(`Scraping LinkedIn (start=${startOffset}): ${url}`);

        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 20000
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        const content = await page.content();
        const $ = cheerio.load(content);

        // LinkedIn guest API returns HTML with job cards
        // Selectors for public LinkedIn job listings
        $('li, .base-card, .base-search-card, .job-search-card').each((i, elem) => {
          try {
            const $card = $(elem);

            // Title selectors
            const titleEl = $card.find('.base-search-card__title, h3.base-search-card__title, .job-search-card__title, h3 a').first();
            const title = titleEl.text().trim();

            if (!title || title.length < 3) return;

            // Company selectors
            const companyEl = $card.find('.base-search-card__subtitle, h4.base-search-card__subtitle, .job-search-card__subtitle, a[data-tracking-control-name*="company"]').first();
            const company = companyEl.text().trim();

            // Location selectors
            const locationEl = $card.find('.job-search-card__location, .base-search-card__metadata span').first();
            const locationText = locationEl.text().trim();

            // Link - look for the main job link
            let link = '';
            const linkEl = $card.find('a.base-card__full-link, a[href*="/jobs/view/"], a[data-tracking-control-name*="job"]').first();
            if (linkEl.length) {
              link = linkEl.attr('href') || '';
              if (link && !link.startsWith('http')) {
                link = `https://www.linkedin.com${link}`;
              }
            }

            // Try to get description snippet
            let description = '';
            const descEl = $card.find('.job-search-card__snippet, .base-search-card__snippet, .job-posting-card__description').first();
            if (descEl.length) {
              description = descEl.text().trim();
            }

            // Clean the description
            description = description.replace(/\s+/g, ' ').trim();
            if (description.length > 1000) {
              description = description.substring(0, 1000) + '...';
            }

            // Only add jobs with valid data
            if (title && link && link.includes('linkedin.com')) {
              // Extract LinkedIn job ID from URL for deduplication (source-native ID)
              const jobIdMatch = link.match(/\/view\/(\d+)/);
              const linkedinJobId = jobIdMatch ? jobIdMatch[1] : null;

              jobs.push({
                title: title,
                company: company || 'Unknown Company',
                location: locationText || location,
                description: description,
                link: link,
                source: 'linkedin',
                source_id: linkedinJobId ? `li_${linkedinJobId}` : 'url_' + crypto.createHash('md5').update(normalizeUrl(link)).digest('hex').substring(0, 16),
                postcode: '',
                status: 'gevonden',
                linkedin_job_id: linkedinJobId
              });
            }
          } catch (error) {
            console.error('Error parsing LinkedIn job:', error.message);
          }
        });

        // Delay between pages
        if (startOffset === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`Found ${jobs.length} jobs on LinkedIn`);
    } catch (error) {
      console.error('Error scraping LinkedIn:', error.message || error);
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (err) {
          console.error('Error closing page:', err.message);
        }
      }
    }

    return jobs;
  }

  async searchAllSites(keywords, regions = [], jobTypes = [], maxResults = 50, country = 'BE') {
    const allJobs = [];
    const searchEnhancer = require('./searchEnhancer');

    // Generate all search queries (with synonyms, combinations, and English variations)
    const searchQueries = searchEnhancer.generateAllSearchQueries(keywords);

    // Use provided regions, or default to top Belgian cities for broader coverage
    const searchRegions = regions.length > 0
      ? regions
      : (country === 'BE' ? DEFAULT_SEARCH_CITIES.slice(0, 5) : []); // Top 5 cities for broad search

    console.log(`Generated ${searchQueries.length} search queries from "${keywords}"`);
    console.log(`Searching in ${searchRegions.length > 0 ? searchRegions.join(', ') : 'default locations'}...`);

    // Search on all sites with error handling
    // Indeed and LinkedIn are LEGACY — disabled by default to avoid TOS risk.
    // Re-enable by setting LEGACY_INDEED_ENABLED=true / LEGACY_LINKEDIN_ENABLED=true in .env
    const sites = [
      { name: 'stepstone', scraper: (k, r) => this.scrapeStepstone(k, r, country) },
    ];

    if (legacyConfig.indeed) {
      sites.push({ name: 'indeed', scraper: (k, r) => this.scrapeIndeed(k, r, country) });
    }

    if (legacyConfig.linkedin) {
      sites.push({ name: 'linkedin', scraper: (k, r) => this.scrapeLinkedIn(k, r, country) });
    }

    // Add country-specific sites
    if (country === 'BE') {
      if (legacyConfig.vdab)      sites.push({ name: 'vdab',      scraper: this.scrapeVdab.bind(this) });
      if (legacyConfig.antwerpen) sites.push({ name: 'antwerpen', scraper: this.scrapeAntwerpen.bind(this) });
    }
    // Add other country specific sites here in future
    // if (country === 'NL') sites.push(...)

    // Process sites in PARALLEL for much faster scraping! 🚀
    // For each search query, search all sites at once
    let queryCount = 0;
    for (const searchQuery of searchQueries) {
      if (!searchQuery || searchQuery.trim().length === 0) continue;

      queryCount++;
      console.log(`\n[${queryCount}/${searchQueries.length}] Processing search query: "${searchQuery}"`);

      // Run all sites in PARALLEL
      const sitePromises = sites.map(async (site) => {
        try {
          // Set a per-site timeout
          const scrapePromise = site.scraper(searchQuery, regions);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${site.name} timeout`)), 20000)
          );

          const jobs = await Promise.race([scrapePromise, timeoutPromise]).catch(err => {
            console.log(`  ⚠️  ${site.name}: ${err.message}`);
            return [];
          });

          if (jobs && Array.isArray(jobs) && jobs.length > 0) {
            console.log(`  ✅ ${site.name}: Found ${jobs.length} jobs for "${searchQuery}"`);
            return jobs;
          } else {
            console.log(`  ⏭️  ${site.name}: No jobs found for "${searchQuery}"`);
            return [];
          }
        } catch (error) {
          console.error(`  ❌ Error searching ${site.name} for "${searchQuery}":`, error.message || error);
          return [];
        }
      });

      // Wait for all sites to finish
      const siteResults = await Promise.all(sitePromises);
      siteResults.forEach(jobs => {
        if (jobs && jobs.length > 0) {
          allJobs.push(...jobs);
        }
      });

      // Small delay between query batches
      await new Promise(resolve => setTimeout(resolve, 1000));

      // If we have enough results, stop early
      if (allJobs.length >= maxResults * 3) {
        console.log(`\n✅ Found ${allJobs.length} jobs total, stopping early`);
        break;
      }
    }

    // Remove in-memory duplicates using shared canonicalization
    const uniqueJobs = this.removeDuplicates(allJobs);

    // Telemetry: in-memory dedup
    console.log(`[Dedup] Scraped: ${allJobs.length} → In-memory dedup: ${uniqueJobs.length} (removed ${allJobs.length - uniqueJobs.length})`);
    console.log(`Total unique jobs found: ${uniqueJobs.length}`);

    // Filter by job types if specified (optional - hard to extract from listings)
    let filteredJobs = uniqueJobs;

    // Filter out any mock/test data
    const realJobs = filteredJobs.filter(job => {
      // Remove jobs with mock/test URLs
      if (job.link && (
        job.link.includes('example.com') ||
        job.link.includes('test.com') ||
        job.link.includes('mock') ||
        job.source === 'mock'
      )) {
        return false;
      }
      // Remove jobs with obviously fake data
      if (job.title && (
        job.title.toLowerCase().includes('test') ||
        job.title.toLowerCase().includes('mock') ||
        job.title.toLowerCase().includes('example')
      )) {
        return false;
      }
      return true;
    });

    console.log(`Filtered out ${filteredJobs.length - realJobs.length} mock/test jobs`);

    // Interleave results by source (2 from each source in rotation)
    const interleaved = this.interleaveResults(realJobs, 2);

    // Return more results (up to maxResults)
    return interleaved.slice(0, maxResults);
  }

  interleaveResults(jobs, groupSize = 2) {
    // Group jobs by source
    const buckets = {};
    for (const job of jobs) {
      const src = job.source || 'unknown';
      if (!buckets[src]) buckets[src] = [];
      buckets[src].push(job);
    }

    const sources = Object.keys(buckets);
    if (sources.length <= 1) return jobs;

    const result = [];
    const indices = {};
    sources.forEach(s => { indices[s] = 0; });

    // Round-robin: take groupSize from each source in turn
    let exhaustedCount = 0;
    while (exhaustedCount < sources.length) {
      for (const source of sources) {
        const bucket = buckets[source];
        const idx = indices[source];
        if (idx >= bucket.length) continue;

        const end = Math.min(idx + groupSize, bucket.length);
        for (let i = idx; i < end; i++) {
          result.push(bucket[i]);
        }
        indices[source] = end;
      }
      exhaustedCount = sources.filter(s => indices[s] >= buckets[s].length).length;
    }

    return result;
  }

  /**
   * Remove duplicate jobs using the same canonicalization as the database.
   * Uses shared vacancyNormalizer to ensure in-memory dedup matches DB dedup.
   */
  removeDuplicates(jobs) {
    const seen = new Set();
    const unique = [];

    for (const job of jobs) {
      if (!job.title) continue;
      // Use the same canonical key as the database uses for dedup_key
      const key = buildVacancyDedupKey(job);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(job);
      }
    }

    return unique;
  }
}

module.exports = new ScraperService();
