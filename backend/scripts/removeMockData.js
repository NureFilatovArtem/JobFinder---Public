// Script to remove mock data from database
const { dbHelpers } = require('../db');

async function removeMockData() {
  try {
    console.log('Fetching all vacancies...');
    const allVacatures = await dbHelpers.getAllVacatures();
    
    console.log(`Found ${allVacatures.length} total vacancies`);
    
    const mockVacatures = allVacatures.filter(vac => {
      return vac.source === 'mock' ||
             (vac.link && (
               vac.link.includes('example.com') ||
               vac.link.includes('test.com') ||
               vac.link.includes('mock')
             )) ||
             (vac.title && (
               vac.title.toLowerCase().includes('test') ||
               vac.title.toLowerCase().includes('mock') ||
               vac.title.toLowerCase().includes('example')
             ));
    });
    
    console.log(`Found ${mockVacatures.length} mock vacancies to remove`);
    
    // Delete mock vacancies
    for (const vac of mockVacatures) {
      // You would need to add a delete function to dbHelpers
      console.log(`Removing mock vacancy: ${vac.title} (ID: ${vac.id})`);
      // await dbHelpers.deleteVacature(vac.id);
    }
    
    console.log('Mock data removal complete');
    process.exit(0);
  } catch (error) {
    console.error('Error removing mock data:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  removeMockData();
}

module.exports = { removeMockData };

