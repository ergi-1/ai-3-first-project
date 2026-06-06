/**
 * EpiSim-ABM Simulation Engine Module
 * Orchestrates the central clock loop, spatial partitioning bucket arrays,
 * transmission mechanics, active policies, and statistical telemetry.
 */

class SimulationEngine {
  constructor(width, height, onTickCallback) {
    this.width = width;
    this.height = height;
    this.onTick = onTickCallback;

    // Core references
    this.env = new SimulationEnvironment(width, height);
    this.agents = [];

    // Clocks
    this.day = 1;
    this.hour = 8; // Start at morning commute
    this.minute = 0;
    this.tickMinutes = 10; // 10 simulated minutes per tick
    
    // Engine states
    this.isPaused = true;
    this.speedMultiplier = 1;
    this.totalDaysLimit = 35; // Maximum timeline for tracking

    // Healthcare infrastructure
    this.icuCapacity = 100;
    this.activeIcuCount = 0;
    this.statsHistory = []; // Array of daily stat snapshots for lines plotting

    // Global Adjustable Intervention Variables (linked to dashboard sliders/toggles)
    this.transmissionProb = 0.08; // 8% baseline transmission per contact
    this.transmissionRadius = 12; // 12 pixels proximity radius
    this.asymptomaticRatio = 0.30;
    
    this.maskMandate = false;
    this.lockdownProtocol = false;
    this.vaccinationCampaign = false;
    this.vaccinationRate = 5; // 5 agents seek vaccines per day

    // Internal spatial partition structure cell scale
    this.cellSize = 25; // Pixel size for spatial partitioning buckets
  }

  /**
   * Initializes the agent population. Instantiates N agents,
   * assigns homes/workplaces, and seeds 1 initial infected patient.
   */
  setupPopulation(count = 1000) {
    this.agents = [];
    this.day = 1;
    this.hour = 8;
    this.minute = 0;
    this.statsHistory = [];
    this.activeIcuCount = 0;

    // Build population
    for (let i = 0; i < count; i++) {
      const agent = new Agent(i, this.env);
      this.agents.push(agent);
    }

    // Seed Initial Outbreak: Infect a single random agent
    const patientZeroIdx = Math.floor(Math.random() * count);
    const patientZero = this.agents[patientZeroIdx];
    patientZero.healthState = "I_A"; // Start as asymptomatic vector
    patientZero.hoursInfected = 12; // Pre-infect slightly to hasten progress

    // Capture initial Day 1 statistics
    this.recordDailyStats();
  }

  /**
   * Main Engine Tick. Called recursively by the animation loop.
   * Runs multiple steps if speedMultiplier is elevated.
   */
  tick(dt = 0.016) {
    if (this.isPaused) return;

    // Run ticks according to speed scale
    for (let s = 0; s < this.speedMultiplier; s++) {
      this.minute += this.tickMinutes;
      
      if (this.minute >= 60) {
        this.minute = 0;
        this.hour++;
        
        // Dynamic Hour-Boundary updates (routine schedules & clinical progression)
        if (this.hour >= 24) {
          this.hour = 0;
          this.day++;
          this.recordDailyStats();
        }
        
        // Execute hourly agent behaviors and state machines
        const icuOverloaded = this.activeIcuCount >= this.icuCapacity;
        this.agents.forEach(agent => {
          agent.updateDailyRoutine(this.hour, this.lockdownProtocol, this.vaccinationCampaign);
          agent.tickHealthState(icuOverloaded);
        });
      }

      // 1. Physics: Move agents
      const simDt = 0.05; // Fixed delta step for movement stability
      this.agents.forEach(agent => agent.move(simDt));

      // 2. Spatial Partitioning & Virus Transmission Exposure
      this.computeTransmissions();
    }

    // Count hospitalized active beds
    this.activeIcuCount = this.agents.filter(a => a.isHospitalized && a.healthState !== "D").length;

    // Trigger redraw callback
    if (this.onTick) this.onTick();
  }

  /**
   * HIGH-PERFORMANCE SPATIAL PARTITIONING METHOD
   * Reduces the contact search from O(N^2) to linear O(N).
   * Maps agents into local grid buckets and executes localized collision sweeps.
   */
  computeTransmissions() {
    const grid = {};
    const cols = Math.ceil(this.width / this.cellSize);
    const rows = Math.ceil(this.height / this.cellSize);

    // Filter active infectious vectors (symptomatic / asymptomatic)
    const infectiousAgents = this.agents.filter(
      a => (a.healthState === "I_A" || a.healthState === "I_S") && !a.isHospitalized && !a.isQuarantined
    );

    if (infectiousAgents.length === 0) return;

    // Step A: Hash infectious vectors into grid coordinate buckets
    infectiousAgents.forEach(agent => {
      const colIdx = Math.floor(agent.x / this.cellSize);
      const rowIdx = Math.floor(agent.y / this.cellSize);
      const key = `${colIdx}_${rowIdx}`;
      
      if (!grid[key]) grid[key] = [];
      grid[key].push(agent);
    });

    // Step B: Filter susceptible cohort
    const susceptibleAgents = this.agents.filter(a => a.healthState === "S" && !a.isVaccinated);

    // Step C: Scan adjacent blocks for potential transmissions
    susceptibleAgents.forEach(sAgent => {
      const colIdx = Math.floor(sAgent.x / this.cellSize);
      const rowIdx = Math.floor(sAgent.y / this.cellSize);
      
      // Proximity limit values
      let maskFactor = 1.0;
      if (this.maskMandate) {
        // Reduces base spread probability if masks are active (scaled by individual agent compliance)
        const maskComplianceS = sAgent.maskCompliant ? 0.65 : 0.0;
        maskFactor *= (1.0 - maskComplianceS);
      }

      // Check all 9 neighboring grid cell buckets
      let transmissionOccurred = false;
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          const targetKey = `${colIdx + dc}_${rowIdx + dr}`;
          const cells = grid[targetKey];
          
          if (cells) {
            for (let i = 0; i < cells.length; i++) {
              const iAgent = cells[i];
              
              // Calculate literal Euclidean Distance
              const dx = sAgent.x - iAgent.x;
              const dy = sAgent.y - iAgent.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance <= this.transmissionRadius) {
                // Determine transmission scale including source mask variables
                let localTransmissionProb = this.transmissionProb;
                if (this.maskMandate) {
                  const maskComplianceI = iAgent.maskCompliant ? 0.65 : 0.0;
                  localTransmissionProb *= maskFactor * (1.0 - maskComplianceI);
                } else {
                  localTransmissionProb *= maskFactor;
                }

                // Stochastic roll
                if (Math.random() < localTransmissionProb) {
                  sAgent.expose();
                  transmissionOccurred = true;
                  break; // Break inner loop, agent exposed
                }
              }
            }
          }
          if (transmissionOccurred) break;
        }
        if (transmissionOccurred) break;
      }
    });
  }

  /**
   * Spawns infection on multiple random agents to accelerate outbreaks
   */
  injectInfections(count = 5) {
    let injected = 0;
    let attempts = 0;
    const maxAttempts = count * 20;

    while (injected < count && attempts < maxAttempts) {
      attempts++;
      const idx = Math.floor(Math.random() * this.agents.length);
      const agent = this.agents[idx];
      if (agent.healthState === "S" && !agent.isVaccinated) {
        agent.healthState = "E";
        agent.hoursExposed = 0;
        injected++;
      }
    }
  }

  /**
   * Takes a daily demographic snapshot of the agent states and saves it
   * to statsHistory for data viz lines drawing.
   */
  recordDailyStats() {
    const stats = {
      day: this.day,
      sus: 0,
      exp: 0,
      infAsym: 0,
      infSym: 0,
      rec: 0,
      dec: 0,
      hosp: 0,
      vac: 0
    };

    this.agents.forEach(agent => {
      if (agent.isVaccinated) stats.vac++;
      if (agent.isHospitalized) stats.hosp++;

      switch (agent.healthState) {
        case "S": stats.sus++; break;
        case "E": stats.exp++; break;
        case "I_A": stats.infAsym++; break;
        case "I_S": stats.infSym++; break;
        case "R": stats.rec++; break;
        case "D": stats.dec++; break;
      }
    });

    this.statsHistory.push(stats);
  }

  /**
   * Resets active policies to clean slates
   */
  resetPolicies() {
    this.maskMandate = false;
    this.lockdownProtocol = false;
    this.vaccinationCampaign = false;
  }
}
