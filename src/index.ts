import { chromium, Browser, Page, Request, Response } from 'playwright';

interface AppointmentConfig {
  barberUrl: string;
  preferredDate?: string;
  preferredTime?: string;
  name: string;
  email: string;
  phone: string;
}

interface NetworkRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  timestamp: number;
}

interface NetworkResponse {
  url: string;
  status: number;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
}

class BarberAppointmentBooker {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private networkRequests: NetworkRequest[] = [];
  private networkResponses: NetworkResponse[] = [];

  async initialize(): Promise<void> {
    console.log('Launching browser...');
    this.browser = await chromium.launch({ 
      headless: false, // Set to true for headless mode
      slowMo: 500 // Slow down operations by 500ms for visibility
    });
    this.page = await this.browser.newPage();
    
    // Set up network request monitoring
    this.setupNetworkMonitoring();
    
    console.log('Browser launched successfully');
    console.log('📡 Network monitoring enabled - all requests will be logged\n');
  }

  private setupNetworkMonitoring(): void {
    if (!this.page) return;

    // Monitor all requests
    this.page.on('request', (request: Request) => {
      const url = request.url();
      const method = request.method();
      
      // Only log API-like requests (filter out static assets)
      if (this.isApiRequest(url)) {
        const headers = request.headers();
        const postData = request.postData();
        
        const networkReq: NetworkRequest = {
          url,
          method,
          headers,
          postData: postData || undefined,
          timestamp: Date.now()
        };
        
        this.networkRequests.push(networkReq);
        
        console.log(`\n🔵 REQUEST [${method}]`);
        console.log(`   URL: ${url}`);
        if (postData) {
          try {
            const jsonData = JSON.parse(postData);
            console.log(`   Body: ${JSON.stringify(jsonData, null, 2)}`);
          } catch {
            console.log(`   Body: ${postData.substring(0, 200)}${postData.length > 200 ? '...' : ''}`);
          }
        }
        console.log(`   Headers: ${JSON.stringify(headers, null, 2)}`);
      }
    });

    // Monitor all responses
    this.page.on('response', async (response: Response) => {
      const url = response.url();
      const status = response.status();
      
      // Only log API-like responses
      if (this.isApiRequest(url)) {
        const headers = response.headers();
        let body: string | undefined;
        
        try {
          // Try to get response body (may fail for binary data)
          const contentType = headers['content-type'] || '';
          if (contentType.includes('application/json') || contentType.includes('text/')) {
            body = await response.text();
          }
        } catch (e) {
          // Ignore errors reading body
        }
        
        const networkRes: NetworkResponse = {
          url,
          status,
          headers,
          body: body ? body.substring(0, 500) : undefined, // Limit body size for logging
          timestamp: Date.now()
        };
        
        this.networkResponses.push(networkRes);
        
        const statusEmoji = status >= 200 && status < 300 ? '✅' : status >= 400 ? '❌' : '⚠️';
        console.log(`\n${statusEmoji} RESPONSE [${status}]`);
        console.log(`   URL: ${url}`);
        if (body) {
          try {
            const jsonData = JSON.parse(body);
            console.log(`   Body: ${JSON.stringify(jsonData, null, 2)}`);
          } catch {
            console.log(`   Body: ${body.substring(0, 200)}${body.length > 200 ? '...' : ''}`);
          }
        }
      }
    });
  }

  private isApiRequest(url: string): boolean {
    // Filter out static assets, focus on API calls
    const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
    const hasStaticExtension = staticExtensions.some(ext => url.toLowerCase().includes(ext));
    
    // Include API-like URLs (containing /api/, /graphql, or common API patterns)
    const isApiPattern = /\/api\//i.test(url) || 
                        /\/graphql/i.test(url) ||
                        /\/rest\//i.test(url) ||
                        /\/v\d+\//i.test(url) ||
                        url.includes('ajax') ||
                        url.includes('xhr');
    
    return !hasStaticExtension && (isApiPattern || url.match(/\.(json|xml)$/i) !== null);
  }

  getNetworkRequests(): NetworkRequest[] {
    return this.networkRequests;
  }

  getNetworkResponses(): NetworkResponse[] {
    return this.networkResponses;
  }

  printNetworkSummary(): void {
    console.log('\n\n📊 NETWORK SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total API Requests: ${this.networkRequests.length}`);
    console.log(`Total API Responses: ${this.networkResponses.length}\n`);
    
    if (this.networkRequests.length > 0) {
      console.log('🔵 API REQUESTS:');
      this.networkRequests.forEach((req, index) => {
        console.log(`\n${index + 1}. [${req.method}] ${req.url}`);
        if (req.postData) {
          try {
            const json = JSON.parse(req.postData);
            console.log(`   Payload: ${JSON.stringify(json, null, 2)}`);
          } catch {
            console.log(`   Payload: ${req.postData.substring(0, 100)}...`);
          }
        }
      });
    }
    
    if (this.networkResponses.length > 0) {
      console.log('\n\n✅ API RESPONSES:');
      this.networkResponses.forEach((res, index) => {
        const statusEmoji = res.status >= 200 && res.status < 300 ? '✅' : res.status >= 400 ? '❌' : '⚠️';
        console.log(`\n${index + 1}. ${statusEmoji} [${res.status}] ${res.url}`);
        if (res.body) {
          try {
            const json = JSON.parse(res.body);
            console.log(`   Response: ${JSON.stringify(json, null, 2)}`);
          } catch {
            console.log(`   Response: ${res.body.substring(0, 100)}...`);
          }
        }
      });
    }
    console.log('='.repeat(60));
  }

  async exploreSite(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized. Call initialize() first.');
    }

    console.log(`\n🌐 Navigating to ${url}...`);
    console.log('   Browser will stay open for exploration...');
    console.log('   All network requests will be logged below.\n');
    
    await this.page.goto(url, { waitUntil: 'networkidle' });
    
    console.log('\n✅ Page loaded! You can now interact with the page.');
    console.log('   Network requests are being monitored in real-time.');
    console.log('   Press Ctrl+C in the terminal to close and see summary.\n');
  }

  async bookAppointment(config: AppointmentConfig): Promise<boolean> {
    if (!this.page) {
      throw new Error('Page not initialized. Call initialize() first.');
    }

    try {
      console.log(`Navigating to ${config.barberUrl}...`);
      await this.page.goto(config.barberUrl, { waitUntil: 'networkidle' });

      // TODO: Add your specific booking logic here
      // Example steps:
      // 1. Find and click the appointment booking button/link
      // 2. Select date and time
      // 3. Fill in personal information
      // 4. Submit the form
      
      console.log('Appointment booking logic to be implemented...');
      
      // Placeholder for booking logic
      // await this.page.click('button[data-testid="book-appointment"]');
      // await this.page.fill('input[name="name"]', config.name);
      // await this.page.fill('input[name="email"]', config.email);
      // await this.page.fill('input[name="phone"]', config.phone);
      // await this.page.click('button[type="submit"]');

      console.log('Appointment booking completed successfully!');
      return true;
    } catch (error) {
      console.error('Error booking appointment:', error);
      return false;
    }
  }

  async waitForExploration(timeoutMs: number = 300000): Promise<void> {
    // Wait for user to explore (default 5 minutes)
    console.log(`\n⏳ Waiting up to ${timeoutMs / 1000} seconds for exploration...`);
    await new Promise(resolve => setTimeout(resolve, timeoutMs));
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log('Browser closed');
    }
  }
}

async function main() {
  const booker = new BarberAppointmentBooker();

  try {
    // Get URL from command line argument or environment variable
    const barberUrl = process.argv[2] || process.env.BARBER_URL;
    
    if (!barberUrl) {
      console.error('❌ Error: Please provide the barber booking URL');
      console.log('\nUsage:');
      console.log('  npm run dev <URL>');
      console.log('  or');
      console.log('  BARBER_URL=<URL> npm run dev');
      console.log('\nExample:');
      console.log('  npm run dev https://example-barber-site.com/book');
      process.exit(1);
    }

    await booker.initialize();
    
    // Exploration mode - navigate and monitor network
    await booker.exploreSite(barberUrl);
    
    // Wait for exploration (5 minutes default, or until Ctrl+C)
    await booker.waitForExploration(300000); // 5 minutes
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('SIGINT')) {
      console.log('\n\n⚠️  Interrupted by user');
    } else {
      console.error('Fatal error:', error);
    }
  } finally {
    // Print network summary before closing
    booker.printNetworkSummary();
    
    console.log('\n\n💡 TIP: Review the network requests above to identify API endpoints.');
    console.log('   You can use these endpoints to create a direct API-based booking script.\n');
    
    await booker.close();
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { BarberAppointmentBooker, AppointmentConfig };

