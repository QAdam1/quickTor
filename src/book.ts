import { ApiBarberBooker, BookingConfig } from './api-booker';

async function main() {
  const booker = new ApiBarberBooker();

  // Configuration - update these values
  const config: BookingConfig = {
    mobile: process.env.MOBILE || '0544458876',
    serviceTypeId: 37331, // Men's haircut - can be changed
    schedulerId: 6132, // Saul - can be changed
    date: process.env.DATE, // Format: YYYY-MM-DD (e.g., '2025-11-16')
    time: process.env.TIME, // Format: HH:MM (e.g., '10:00')
    branchId: 0
  };

  console.log('🚀 Starting API-based booking...\n');
  console.log('Configuration:');
  console.log(`  Mobile: ${config.mobile}`);
  console.log(`  Service Type ID: ${config.serviceTypeId}`);
  console.log(`  Scheduler ID: ${config.schedulerId}`);
  if (config.date && config.time) {
    console.log(`  Date: ${config.date}`);
    console.log(`  Time: ${config.time}`);
  } else {
    console.log('  ⚠️  No date/time specified - will only login and check availability');
  }
  console.log('');

  try {
    const result = await booker.completeBooking(config);

    if (result.success) {
      console.log('\n✅ SUCCESS!');
      console.log(`   ${result.message}`);
      if (result.date && result.time) {
        console.log(`   Appointment: ${result.date} at ${result.time}`);
      }
    } else {
      console.log('\n❌ FAILED');
      console.log(`   ${result.message || 'Unknown error'}`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

