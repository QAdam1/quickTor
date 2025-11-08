import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as https from 'https';

interface BookingConfig {
  mobile: string;
  serviceTypeId?: number; // Default: 3928 (Men's haircut)
  schedulerId?: number; // Default: 6132 (Saul)
  date?: string; // Format: YYYY-MM-DD
  time?: string; // Format: HH:MM
  branchId?: number; // Default: 0
}

interface BookingResult {
  success: boolean;
  message?: string;
  appointmentId?: string;
  date?: string;
  time?: string;
}

class ApiBarberBooker {
  private client: AxiosInstance;
  private baseUrl = 'https://mentor.tormahir.co.il';
  private sessionCookies: string[] = [];

  constructor() {
    // Create axios instance with cookie support
    this.client = axios.create({
      baseURL: this.baseUrl,
      withCredentials: true,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false // Allow self-signed certificates if needed
      }),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    // Intercept responses to capture cookies
    this.client.interceptors.response.use((response) => {
      const setCookieHeaders = response.headers['set-cookie'];
      if (setCookieHeaders) {
        // Extract just the cookie name=value pairs (ignore attributes like expires, path, etc.)
        const cookieMap = new Map<string, string>();
        setCookieHeaders.forEach((cookieHeader: string) => {
          // Split by semicolon and take the first part (name=value)
          const cookiePart = cookieHeader.split(';')[0].trim();
          if (cookiePart) {
            const [name, ...valueParts] = cookiePart.split('=');
            if (name && valueParts.length > 0) {
              cookieMap.set(name.trim(), valueParts.join('='));
            }
          }
        });
        // Convert map to array of name=value strings
        this.sessionCookies = Array.from(cookieMap.entries()).map(([name, value]) => `${name}=${value}`);
      }
      return response;
    });

    // Intercept requests to add cookies
    this.client.interceptors.request.use((config) => {
      if (this.sessionCookies.length > 0) {
        config.headers['Cookie'] = this.sessionCookies.join('; ');
      }
      return config;
    });
  }

  /**
   * Step 1: Validate mobile number
   */
  async validateMobile(mobile: string): Promise<boolean> {
    try {
      const response = await this.client.post('/Validate/Mobile', null, {
        params: { Mobile: mobile },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      return response.status === 200;
    } catch (error) {
      console.error('Mobile validation failed:', error);
      return false;
    }
  }

  /**
   * Step 2: Login with mobile number
   */
  async login(mobile: string): Promise<boolean> {
    try {
      // First validate
      const isValid = await this.validateMobile(mobile);
      if (!isValid) {
        console.error('Mobile number validation failed');
        return false;
      }

      // Get the login page to obtain anti-forgery token
      const loginPage = await this.client.get('/Account/LoginClients', {
        params: { CustomerID: 0, ReturnUrl: '/Clients/MakeAppoitment' }
      });

      // Extract __RequestVerificationToken from the HTML
      const tokenMatch = loginPage.data.match(/__RequestVerificationToken[^>]*value=["']([^"']+)["']/);
      if (!tokenMatch) {
        console.error('Could not extract verification token');
        return false;
      }
      const verificationToken = tokenMatch[1];

      // Perform login
      const response = await this.client.post('/Account/LoginMobileClient', 
        `Mobile=${encodeURIComponent(mobile)}&__RequestVerificationToken=${encodeURIComponent(verificationToken)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': `${this.baseUrl}/Account/LoginClients`
          },
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 400
        }
      );

      return response.status === 200 || response.status === 302;
    } catch (error: any) {
      // Login might redirect, which axios treats as error
      if (error.response?.status === 302 || error.response?.status === 200) {
        return true;
      }
      console.error('Login failed:', error.message);
      return false;
    }
  }

  /**
   * Step 3: Get available service types
   */
  async getServiceTypes(): Promise<any[]> {
    try {
      const response = await this.client.post('/Clients/TypeSelectList', null, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      return response.data || [];
    } catch (error) {
      console.error('Failed to get service types:', error);
      return [];
    }
  }

  /**
   * Step 4: Get available service providers for a service type
   */
  async getServiceProviders(serviceTypeIds: number[]): Promise<any[]> {
    try {
      const idsParam = serviceTypeIds.join(',');
      const response = await this.client.get('/Clients/SchedulerSelect', {
        params: {
          ids: idsParam,
          id: 0,
          Customers: '',
          BranchID: 0
        }
      });
      // Parse HTML response to extract provider information
      // This would need to be implemented based on the actual HTML structure
      return [];
    } catch (error) {
      console.error('Failed to get service providers:', error);
      return [];
    }
  }

  /**
   * Step 5: Get available time slots for a provider
   * Must follow the complete flow: TypeSelect -> SchedulerSelect -> TimeSelect
   */
  async getAvailableTimes(
    appointmentTypeIds: number[],
    schedulerId: number,
    branchId: number = 0
  ): Promise<any> {
    try {
      const idsParam = appointmentTypeIds[0];
      
      // Step 1: Navigate to TypeSelect to establish the booking session
      await this.client.get('/Clients/TypeSelect/0', {
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400
      });

      // Step 2: Navigate to SchedulerSelect to select the provider
      await this.client.get('/Clients/SchedulerSelect', {
        params: {
          ids: idsParam,
          id: 0,
          Customers: '',
          BranchID: branchId
        },
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400
      });

      // Step 3: Navigate to TimeSelect page to establish the time selection session
      await this.client.get('/Clients/TimeSelect', {
        params: {
          ids: idsParam,
          id: 0,
          Customers: '',
          SchedulerID: schedulerId,
          BranchID: branchId
        },
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400
      });

      // Step 4: Now call the scheduler endpoint to get available times
      const response = await this.client.post('/Clients/TimeSelectScheduler', null, {
        params: {
          ids: idsParam,
          id: 0,
          Customers: '',
          SchedulerID: schedulerId,
          BranchID: branchId
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `${this.baseUrl}/Clients/TimeSelect?ids=${idsParam}&id=0&Customers=&SchedulerID=${schedulerId}&BranchID=${branchId}`
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });
      
      console.log('✅ Successfully retrieved available times');
      return response.data;
    } catch (error: any) {
      // Check if it's a redirect (which might be expected)
      if (error.response?.status === 302) {
        console.log('⚠️  Got redirect, but continuing...');
        return error.response.data;
      }
      console.error('Failed to get available times:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      }
      return null;
    }
  }

  /**
   * Step 6: Get next week's time slots
   */
  async getNextWeekTimes(
    appointmentTypeIds: number[],
    schedulerId: number,
    branchId: number = 0
  ): Promise<any> {
    try {
      const idsParam = appointmentTypeIds.join(',');
      const response = await this.client.post('/Clients/TimeSelectScheduler2', null, {
        params: {
          ids: idsParam,
          id: 0,
          Customers: '',
          SchedulerID: schedulerId,
          BranchID: branchId
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get next week times:', error);
      return null;
    }
  }

  /**
   * Step 7: Book the appointment (THE CRITICAL ENDPOINT)
   */
  async bookAppointment(
    appointmentTypeIds: number[],
    schedulerId: number,
    date: string,
    time: string,
    length: number = 7
  ): Promise<BookingResult> {
    try {
      const idsParam = appointmentTypeIds.join(',');
      
      // First, we need to navigate to the time selection page to establish the session
      await this.client.get('/Clients/TimeSelect', {
        params: {
          ids: idsParam,
          id: 0,
          Customers: '',
          SchedulerID: schedulerId,
          BranchID: 0
        }
      });

      // Then make the booking request
      const response = await this.client.post('/Clients/AskAppointment', null, {
        params: { Length: length },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          // 'Referer': `${this.baseUrl}/Clients/TimeSelect?ids=${idsParam}&id=0&Customers=&SchedulerID=${schedulerId}&BranchID=0`
        }
      });

      // Parse response to determine success
      if (response.status === 200) {
        return {
          success: true,
          message: 'Appointment booked successfully',
          date,
          time
        };
      }

      return {
        success: false,
        message: 'Booking failed - unexpected response'
      };
    } catch (error: any) {
      console.error('Booking failed:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Unknown error'
      };
    }
  }

  /**
   * Complete booking flow
   */
  async completeBooking(config: BookingConfig): Promise<BookingResult> {
    try {
      console.log('🔐 Step 1: Logging in...');
      const loggedIn = await this.login(config.mobile);
      if (!loggedIn) {
        return { success: false, message: 'Login failed' };
      }
      console.log('✅ Login successful');

      const serviceTypeId = config.serviceTypeId || 3928; // Men's haircut
      const schedulerId = config.schedulerId || 6132; // Saul
      // The appointmentTypeIds should be the ID from the booking flow (37331)
      // This is different from serviceTypeId - it's the selected appointment type ID
      const appointmentTypeIds = config.serviceTypeId ? [config.serviceTypeId] : [37331];

      console.log('📅 Step 2: Getting available times...');
      const times = await this.getAvailableTimes(appointmentTypeIds, schedulerId);
      
      if (config.date && config.time) {
        console.log(`📝 Step 3: Booking appointment for ${config.date} at ${config.time}...`);
        const result = await this.bookAppointment(
          appointmentTypeIds,
          schedulerId,
          config.date,
          config.time
        );
        return result;
      }

      return {
        success: true,
        message: 'Logged in successfully. Use getAvailableTimes() to see available slots'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Booking failed'
      };
    }
  }
}

export { ApiBarberBooker, BookingConfig, BookingResult };

