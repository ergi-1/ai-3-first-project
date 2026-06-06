/**
 * EpiSim-ABM Environment Module
 * Defines spatial locations, zones (homes, workspaces, parks, clinics, hospital),
 * and spatial properties of the simulated world grid.
 */

class SimulationEnvironment {
  constructor(width, height) {
    this.width = width;
    this.height = height;

    // Coordinate Zones list
    this.homes = [];
    this.workplaces = [];
    this.schools = [];
    this.parks = [];
    this.clinics = [];
    this.hospital = null;

    this.generateMap();
  }

  /**
   * Procedurally generates the layout of the city
   */
  generateMap() {
    const w = this.width;
    const h = this.height;

    // 1. HOSPITAL: Dedicated zone at the bottom-right corner
    this.hospital = {
      x: w - 80,
      y: h - 80,
      width: 60,
      height: 60,
      name: "City Medical Center ICU"
    };

    // 2. CLINIC: Near center top for vaccination clinic
    this.clinics.push({
      x: w / 2 - 20,
      y: 60,
      width: 40,
      height: 40,
      name: "Public Health Clinic"
    });

    // 3. WORKPLACES: Clustered in the downtown center region
    const numWorkplaces = 8;
    const centerX = w / 2;
    const centerY = h / 2 + 10;
    for (let i = 0; i < numWorkplaces; i++) {
      // Place in a circle around the center
      const angle = (i / numWorkplaces) * Math.PI * 2;
      const dist = 50 + Math.random() * 40;
      this.workplaces.push({
        x: centerX + Math.cos(angle) * dist - 15,
        y: centerY + Math.sin(angle) * dist - 15,
        width: 30,
        height: 30,
        name: `Office Tower ${i + 1}`
      });
    }

    // 4. SCHOOLS: 2 school zones flanking the downtown
    this.schools.push({
      x: w * 0.3 - 20,
      y: h * 0.4 - 20,
      width: 40,
      height: 40,
      name: "West District Academy"
    });
    this.schools.push({
      x: w * 0.7 - 20,
      y: h * 0.4 - 20,
      width: 40,
      height: 40,
      name: "East District High"
    });

    // 5. PUBLIC RECREATIONAL PARKS: Scattered around outer margins
    const parkLocations = [
      { x: w * 0.2, y: h * 0.2, r: 35, name: "Sunset Meadows Park" },
      { x: w * 0.8, y: h * 0.2, r: 35, name: "Lakeside Reserve" },
      { x: w * 0.2, y: h * 0.75, r: 35, name: "Greenwood Forest" },
      { x: w * 0.5, y: h * 0.85, r: 40, name: "Central Civic Plaza" }
    ];
    this.parks = parkLocations;

    // 6. HOMES: 150 unique houses scattered around the outer residential suburbs
    const numHomes = 150;
    // Suburbs are located away from the center
    let homesGenerated = 0;
    let attempts = 0;
    
    while (homesGenerated < numHomes && attempts < 1000) {
      attempts++;
      const rx = 30 + Math.random() * (w - 60);
      const ry = 30 + Math.random() * (h - 60);
      
      // Calculate distance to center
      const dx = rx - centerX;
      const dy = ry - centerY;
      const distToCenter = Math.sqrt(dx * dx + dy * dy);

      // Keep homes in suburbs (not too close to center, not in hospital/clinics)
      const inHospital = rx > w - 150 && ry > h - 150;
      const inClinic = rx > w/2 - 80 && rx < w/2 + 80 && ry < 120;
      
      if (distToCenter > 110 && !inHospital && !inClinic) {
        this.homes.push({
          x: rx - 8,
          y: ry - 8,
          width: 16,
          height: 16,
          id: homesGenerated
        });
        homesGenerated++;
      }
    }
  }

  /**
   * Helper: Get random home for agent initialization
   */
  getRandomHome() {
    const idx = Math.floor(Math.random() * this.homes.length);
    return this.homes[idx];
  }

  /**
   * Helper: Get workplace for agent assignment based on index
   */
  assignWorkplace(idx) {
    const officeIdx = idx % this.workplaces.length;
    return this.workplaces[officeIdx];
  }

  /**
   * Helper: Get school for youth assignment
   */
  assignSchool(idx) {
    const schoolIdx = idx % this.schools.length;
    return this.schools[schoolIdx];
  }

  /**
   * Helper: Get random recreational park
   */
  getRandomPark() {
    const idx = Math.floor(Math.random() * this.parks.length);
    return this.parks[idx];
  }
}
