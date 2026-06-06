/**
 * EpiSim-ABM Agent Module
 * Models individual agents as autonomous entities with demographic details,
 * state machine loops (SEIRD), daily schedules, and movement mechanics.
 */

class Agent {
  constructor(id, env, traits = {}) {
    this.id = id;
    this.env = env;

    // 1. Demographics & Traits Assignment
    this.age = traits.age || this.rollAge();
    this.demographic = this.getDemographicGroup();
    
    // Assign specific behaviors
    this.maskCompliant = traits.maskCompliant !== undefined ? traits.maskCompliant : Math.random() < 0.45; // 45% wear masks
    this.lockdownCompliant = traits.lockdownCompliant !== undefined ? traits.lockdownCompliant : Math.random() < 0.80; // 80% adhere to lockdown
    this.vaccineHesitancy = Math.random(); // Hesitancy index between 0 (highly willing) and 1 (fully hesitant)
    this.mobilityIndex = 0.4 + Math.random() * 0.6; // Speed/activity modifier

    // 2. Spatial Setup
    this.home = env.getRandomHome();
    this.workplace = env.assignWorkplace(this.id);
    this.school = env.assignSchool(this.id);

    // Initial position at Home
    this.x = this.home.x + this.home.width / 2 + (Math.random() - 0.5) * 5;
    this.y = this.home.y + this.home.height / 2 + (Math.random() - 0.5) * 5;
    
    // Velocity & Target Navigation variables
    this.vx = 0;
    this.vy = 0;
    this.speed = 1.8 * this.mobilityIndex;
    this.activityTarget = { x: this.x, y: this.y };
    this.currentZoneType = "home"; // "home", "work", "school", "park", "clinic", "hospital"

    // 3. Health & Compartmental State
    this.healthState = "S"; // S, E, I_A, I_S, R, D
    this.isVaccinated = false;
    this.isHospitalized = false;
    this.isQuarantined = false;

    // Infection clocks (tracked in hours)
    this.hoursExposed = 0;
    this.hoursInfected = 0;
    this.incubationPeriod = 24 * (3 + Math.floor(Math.random() * 4)); // 3-6 days incubation
    this.infectionDuration = 24 * (9 + Math.floor(Math.random() * 4)); // 9-12 days infection duration
    
    // Hospital and Death risk factors based on Age
    this.hospitalRisk = this.evaluateHospitalRisk();
    this.mortalityRisk = this.evaluateMortalityRisk();
  }

  /**
   * Helper: Roll representative age based on standard demography
   */
  rollAge() {
    const roll = Math.random();
    if (roll < 0.25) {
      return Math.floor(Math.random() * 18); // 25% Youth
    } else if (roll < 0.85) {
      return 18 + Math.floor(Math.random() * 47); // 60% Adults (18-64)
    } else {
      return 65 + Math.floor(Math.random() * 25); // 15% Elderly (65-90)
    }
  }

  getDemographicGroup() {
    if (this.age < 18) return "youth";
    if (this.age < 65) return "adult";
    return "elderly";
  }

  evaluateHospitalRisk() {
    // Severe cases scale with age
    if (this.demographic === "elderly") return 0.28; // 28% elderly need hospital
    if (this.demographic === "adult") return 0.08;   // 8% adults need hospital
    return 0.01;                                    // 1% youth need hospital
  }

  evaluateMortalityRisk() {
    // Mortality is highly age-dependent
    if (this.demographic === "elderly") return 0.15; // 15% conditional death rate in ICU
    if (this.demographic === "adult") return 0.02;   // 2% conditional death rate in ICU
    return 0.001;                                   // 0.1% youth
  }

  /**
   * Sets the agent's target coordinates according to the time of day and status.
   */
  updateDailyRoutine(hour, isLockdownActive, isVaccinationActive) {
    if (this.healthState === "D") {
      this.activityTarget = { x: -100, y: -100 }; // Dead agents are parked off-screen
      return;
    }

    if (this.isHospitalized) {
      // Direct routing inside the Hospital zone bounds
      this.activityTarget = {
        x: this.env.hospital.x + 10 + Math.random() * (this.env.hospital.width - 20),
        y: this.env.hospital.y + 10 + Math.random() * (this.env.hospital.height - 20)
      };
      this.currentZoneType = "hospital";
      return;
    }

    // Symptomatic agents stay home (quarantine) if compliant
    if (this.healthState === "I_S" && (this.lockdownCompliant || Math.random() < 0.7)) {
      this.isQuarantined = true;
      this.activityTarget = {
        x: this.home.x + 4 + Math.random() * (this.home.width - 8),
        y: this.home.y + 4 + Math.random() * (this.home.height - 8)
      };
      this.currentZoneType = "home";
      return;
    }

    // Active vaccination campaign: susceptible/exposed willing agents visit clinic
    if (isVaccinationActive && !this.isVaccinated && (this.healthState === "S" || this.healthState === "E")) {
      // Vaccine acceptance depends on dynamic vaccine hesitancy thresholds
      if (this.vaccineHesitancy < 0.75 && Math.random() < 0.03 && hour >= 9 && hour <= 17) {
        const clinic = this.env.clinics[0];
        this.activityTarget = {
          x: clinic.x + 5 + Math.random() * (clinic.width - 10),
          y: clinic.y + 5 + Math.random() * (clinic.height - 10)
        };
        this.currentZoneType = "clinic";
        return;
      }
    }

    // Default Diurnal Clock Schedule Logic:
    
    // A. NIGHT (20:00 - 08:00): Homebound
    if (hour >= 20 || hour < 8) {
      this.isQuarantined = false;
      this.activityTarget = {
        x: this.home.x + 4 + Math.random() * (this.home.width - 8),
        y: this.home.y + 4 + Math.random() * (this.home.height - 8)
      };
      this.currentZoneType = "home";
      return;
    }

    // B. DAYTIME COMMUTE (08:00 - 16:00): Work, School, or stay home
    if (hour >= 8 && hour < 16) {
      if (isLockdownActive && this.lockdownCompliant) {
        // Telecommuting / Lockdown compliance
        this.activityTarget = {
          x: this.home.x + 4 + Math.random() * (this.home.width - 8),
          y: this.home.y + 4 + Math.random() * (this.home.height - 8)
        };
        this.currentZoneType = "home";
        return;
      }

      if (this.demographic === "adult") {
        this.activityTarget = {
          x: this.workplace.x + 5 + Math.random() * (this.workplace.width - 10),
          y: this.workplace.y + 5 + Math.random() * (this.workplace.height - 10)
        };
        this.currentZoneType = "work";
      } else if (this.demographic === "youth") {
        this.activityTarget = {
          x: this.school.x + 5 + Math.random() * (this.school.width - 10),
          y: this.school.y + 5 + Math.random() * (this.school.height - 10)
        };
        this.currentZoneType = "school";
      } else {
        // Elderly stay home/local neighborhood
        this.activityTarget = {
          x: this.home.x + 4 + Math.random() * (this.home.width - 8),
          y: this.home.y + 4 + Math.random() * (this.home.height - 8)
        };
        this.currentZoneType = "home";
      }
      return;
    }

    // C. EVENING LEISURE (16:00 - 20:00): Optional Socializing at Parks
    if (hour >= 16 && hour < 20) {
      if (isLockdownActive && this.lockdownCompliant) {
        // Recreation centers closed, stay home
        this.activityTarget = {
          x: this.home.x + 4 + Math.random() * (this.home.width - 8),
          y: this.home.y + 4 + Math.random() * (this.home.height - 8)
        };
        this.currentZoneType = "home";
        return;
      }

      // Socializing probability scales with mobility level
      if (Math.random() < 0.4 * this.mobilityIndex) {
        const park = this.env.getRandomPark();
        // Parks are circular zones
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * park.r;
        this.activityTarget = {
          x: park.x + Math.cos(angle) * dist,
          y: park.y + Math.sin(angle) * dist
        };
        this.currentZoneType = "park";
      } else {
        this.activityTarget = {
          x: this.home.x + 4 + Math.random() * (this.home.width - 8),
          y: this.home.y + 4 + Math.random() * (this.home.height - 8)
        };
        this.currentZoneType = "home";
      }
    }
  }

  /**
   * Physics Vector updates: drives agent coordinates toward targeted coordinates
   * with minor Brownian motion fluctuations inside destination nodes.
   */
  move(dt) {
    if (this.healthState === "D") return;

    const dx = this.activityTarget.x - this.x;
    const dy = this.activityTarget.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 5) {
      // Travel towards targets: linear drive vector
      const speedScale = this.healthState === "I_S" ? 0.3 : 1.0; // Symptomatic agents walk sluggishly
      this.vx = (dx / dist) * this.speed * speedScale;
      this.vy = (dy / dist) * this.speed * speedScale;

      this.x += this.vx * dt * 60;
      this.y += this.vy * dt * 60;
    } else {
      // Local wiggling (social mingling / office movements): small brownian oscillations
      const wiggleSpeed = 0.45;
      this.x += (Math.random() - 0.5) * wiggleSpeed;
      this.y += (Math.random() - 0.5) * wiggleSpeed;
    }

    // Hard Boundary checking to prevent clipping
    this.x = Math.max(8, Math.min(this.env.width - 8, this.x));
    this.y = Math.max(8, Math.min(this.env.height - 8, this.y));
  }

  /**
   * Transition loops representing viral biological increments. Called every simulated hour.
   */
  tickHealthState(icuCapacityOverloaded) {
    if (this.healthState === "D") return;

    // Vaccine logic: if visiting clinic, get immunized immediately
    if (this.currentZoneType === "clinic" && !this.isVaccinated) {
      this.isVaccinated = true;
      // 95% protection odds
      if (Math.random() < 0.95) {
        this.healthState = "R"; // Instantly moves to immune/recovered status
        this.hoursExposed = 0;
        this.hoursInfected = 0;
        this.isHospitalized = false;
        this.isQuarantined = false;
      }
    }

    // A. EXPOSED STATE (E) Incubation Progression
    if (this.healthState === "E") {
      this.hoursExposed++;
      if (this.hoursExposed >= this.incubationPeriod) {
        this.hoursExposed = 0;
        // 30% chance asymptomatic, 70% chance symptomatic
        if (Math.random() < 0.3) {
          this.healthState = "I_A";
        } else {
          this.healthState = "I_S";
        }
      }
    }

    // B. INFECTIOUS STATES (I_A or I_S) Progressing to Recovery or Severe Hospitalization
    if (this.healthState === "I_A" || this.healthState === "I_S") {
      this.hoursInfected++;
      
      // If symptomatic and not yet hospitalized, evaluate severe symptoms risk
      if (this.healthState === "I_S" && !this.isHospitalized) {
        // Risk check at peak infection (day 3 of symptoms)
        if (this.hoursInfected === 24 * 3) {
          if (Math.random() < this.hospitalRisk) {
            this.isHospitalized = true;
            this.isQuarantined = false;
          }
        }
      }

      // Infection duration threshold reached
      if (this.hoursInfected >= this.infectionDuration) {
        this.hoursInfected = 0;
        
        if (this.isHospitalized) {
          // If hospitalized in ICU, check survival odds
          // Excess risk: 3x death multiplier if ICU capacities are overloaded!
          const excessMultiplier = icuCapacityOverloaded ? 3.0 : 1.0;
          const fatalRisk = Math.min(0.95, this.mortalityRisk * excessMultiplier);

          if (Math.random() < fatalRisk) {
            this.healthState = "D"; // Deceased
            this.isHospitalized = false;
            this.isQuarantined = false;
          } else {
            this.healthState = "R"; // Recovered
            this.isHospitalized = false;
          }
        } else {
          // Standard home-recovery
          this.healthState = "R";
        }
      }
    }
  }

  /**
   * Expose agent: trigger transmission if susceptible
   */
  expose() {
    if (this.healthState === "S" && !this.isVaccinated) {
      this.healthState = "E";
      this.hoursExposed = 0;
    }
  }
}
