const https = require('https');
const http = require('http');
const fs = require('fs');

const URLS = [
  "https://www.facebook.com/share/p/1BuiGHTZFU/?mibextid=wwXIfr",
  "https://camr.online/cheesy-hamburger-potato-soup-%F0%9F%A7%80%F0%9F%A5%94%F0%9F%8D%B2/",
  "https://camr.online/cinnamon-roll-honeybun-cheesecake/"
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function fetchWithDetails(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = urlObj.protocol === 'https:' ? https : http;
    
    const startTime = Date.now();
    let redirectCount = 0;
    
    const requestOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 10000,
    };
    
    function makeRequest(currentUrl, redirects) {
      const req = lib.request(currentUrl, requestOptions, (res) => {
        const chunks = [];
        let bytesReceived = 0;
        
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          redirectCount++;
          if (redirects < 10) {
            const redirectUrl = new URL(res.headers.location, currentUrl).toString();
            makeRequest(redirectUrl, redirects + 1);
            return;
          }
        }
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
          bytesReceived += chunk.length;
          // Only collect first 1024 bytes for sample
          if (bytesReceived > 1024) {
            res.destroy();
          }
        });
        
        res.on('end', () => {
          const endTime = Date.now();
          const buffer = Buffer.concat(chunks);
          const bodySample = buffer.slice(0, 1024).toString('base64');
          
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            contentType: res.headers['content-type'],
            contentLength: res.headers['content-length'] || bytesReceived,
            redirectCount,
            duration: endTime - startTime,
            bodySample,
            error: null
          });
        });
      });
      
      req.on('error', (error) => {
        resolve({
          statusCode: null,
          headers: {},
          contentType: null,
          contentLength: 0,
          redirectCount,
          duration: Date.now() - startTime,
          bodySample: null,
          error: error.message
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({
          statusCode: null,
          headers: {},
          contentType: null,
          contentLength: 0,
          redirectCount,
          duration: Date.now() - startTime,
          bodySample: null,
          error: 'Request timeout'
        });
      });
      
      req.end();
    }
    
    makeRequest(url, 0);
  });
}

function extractImageUrls(html, baseUrl) {
  const candidates = [];
  
  // og:image
  const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  if (ogImageMatch) {
    candidates.push({ source: 'og:image', url: ogImageMatch[1] });
  }
  
  // twitter:image
  const twitterImageMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
  if (twitterImageMatch) {
    candidates.push({ source: 'twitter:image', url: twitterImageMatch[1] });
  }
  
  // JSON-LD
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatches) {
    jsonLdMatches.forEach((match) => {
      try {
        const jsonContent = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        const data = JSON.parse(jsonContent);
        if (data.image) {
          const imageUrl = typeof data.image === 'string' ? data.image : data.image.url || data.image[0];
          if (imageUrl) {
            candidates.push({ source: 'json-ld', url: imageUrl });
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
  }
  
  // link rel="image_src"
  const imageSrcMatch = html.match(/<link\s+rel=["']image_src["']\s+href=["']([^"']+)["']/i);
  if (imageSrcMatch) {
    candidates.push({ source: 'image_src', url: imageSrcMatch[1] });
  }
  
  // img tags with srcset
  const srcsetMatches = html.match(/<img[^>]+srcset=["']([^"']+)["']/gi);
  if (srcsetMatches) {
    srcsetMatches.forEach((match) => {
      const srcsetAttr = match.match(/srcset=["']([^"']+)["']/i);
      if (srcsetAttr) {
        const sources = srcsetAttr[1].split(',').map(s => s.trim().split(' ')[0]);
        if (sources.length > 0) {
          candidates.push({ source: 'srcset', url: sources[sources.length - 1] });
        }
      }
    });
  }
  
  // Regular img tags
  const imgMatches = html.match(/<img[^>]+src=["']([^"']+)["']/gi);
  if (imgMatches) {
    imgMatches.slice(0, 5).forEach((match) => { // Limit to first 5
      const srcAttr = match.match(/src=["']([^"']+)["']/i);
      if (srcAttr) {
        candidates.push({ source: 'img-src', url: srcAttr[1] });
      }
    });
  }
  
  // data-src attributes
  const dataSrcMatches = html.match(/<img[^>]+data-src=["']([^"']+)["']/gi);
  if (dataSrcMatches) {
    dataSrcMatches.slice(0, 5).forEach((match) => {
      const dataSrcAttr = match.match(/data-src=["']([^"']+)["']/i);
      if (dataSrcAttr) {
        candidates.push({ source: 'data-src', url: dataSrcAttr[1] });
      }
    });
  }
  
  // Convert relative URLs to absolute
  return candidates.map(c => ({
    ...c,
    url: c.url.startsWith('http') ? c.url : new URL(c.url, baseUrl).toString()
  }));
}

async function diagnosePage(recipeUrl) {
  console.log(`\n=== Diagnosing: ${recipeUrl} ===\n`);
  
  const result = {
    recipe_url: recipeUrl,
    timestamp: new Date().toISOString(),
    page_fetch: null,
    image_candidates: [],
    image_tests: []
  };
  
  // Fetch the recipe page
  console.log('Fetching recipe page...');
  const pageResult = await fetchWithDetails(recipeUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html'
    }
  });
  
  result.page_fetch = {
    status_code: pageResult.statusCode,
    content_type: pageResult.contentType,
    duration_ms: pageResult.duration,
    error: pageResult.error
  };
  
  if (pageResult.error || pageResult.statusCode !== 200) {
    console.log(`Failed to fetch page: ${pageResult.error || pageResult.statusCode}`);
    return result;
  }
  
  // Extract images from HTML
  const html = Buffer.from(pageResult.bodySample, 'base64').toString('utf-8');
  const imageCandidates = extractImageUrls(html, recipeUrl);
  
  console.log(`Found ${imageCandidates.length} image candidates`);
  result.image_candidates = imageCandidates.map(c => ({ source: c.source, url: c.url }));
  
  // Test each image URL
  for (const candidate of imageCandidates) {
    console.log(`Testing ${candidate.source}: ${candidate.url.substring(0, 80)}...`);
    
    const imageResult = await fetchWithDetails(candidate.url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': recipeUrl,
        'Accept': 'image/*'
      }
    });
    
    result.image_tests.push({
      source: candidate.source,
      image_url: candidate.url,
      http_status: imageResult.statusCode,
      content_type: imageResult.contentType,
      content_length: imageResult.contentLength,
      redirect_count: imageResult.redirectCount,
      duration_ms: imageResult.duration,
      user_agent: USER_AGENT,
      referer: recipeUrl,
      response_headers: imageResult.headers,
      error: imageResult.error,
      body_sample_base64: imageResult.bodySample
    });
    
    console.log(`  → Status: ${imageResult.statusCode || 'ERROR'}, Type: ${imageResult.contentType || 'N/A'}, Error: ${imageResult.error || 'None'}`);
  }
  
  return result;
}

async function main() {
  const allResults = [];
  
  for (const url of URLS) {
    const result = await diagnosePage(url);
    allResults.push(result);
  }
  
  const timestamp = Date.now();
  const filename = `/tmp/image_diagnostic_${timestamp}.json`;
  const output = JSON.stringify(allResults, null, 2);
  
  fs.writeFileSync(filename, output);
  console.log(`\n\n=== FULL DIAGNOSTIC OUTPUT ===`);
  console.log(output);
  console.log(`\n\n=== Saved to ${filename} ===`);
}

main().catch(console.error);
