/**
 * EpiSim-ABM Experiment Runner Module
 * Executes fast-forward, background trials of the simulation engine
 * to allow direct comparison of different public health policy strategies.
 */

class ExperimentRunner {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  /**
   * Runs the simulation in background mode without drawing overhead
   * and yields full stats history and summary metrics.
   */
  runScenario(config = {}) {
    // Instantiate clean background engine
    const engine = new SimulationEngine(this.width, this.height, null);
    
    // Wire custom parameters
    engine.transmissionProb = config.transmissionProb !== undefined ? config.transmissionProb : 0.08;
    engine.transmissionRadius = config.transmissionRadius !== undefined ? config.transmissionRadius : 12;
    engine.setupPopulation(1000); // Standard population scale

    // Apply baseline policy states
    engine.maskMandate = config.maskMandate || false;
    engine.vaccinationCampaign = config.vaccinationCampaign || false;
    engine.vaccinationRate = config.vaccinationRate || 5;
    
    // Custom dynamic lockdown tracker
    const useDynamicLockdown = config.useDynamicLockdown || false;

    // Run ticks until 35 days are fully simulated
    const maxDays = 35;
    const ticksPerHour = 6; // 10 min steps
    const totalTicks = maxDays * 24 * ticksPerHour;

    let hospitalGridlockHours = 0;

    for (let t = 0; t < totalTicks; t++) {
      // Execute simulated tick
      engine.minute += engine.tickMinutes;
      
      if (engine.minute >= 60) {
        engine.minute = 0;
        engine.hour++;
        
        if (engine.hour >= 24) {
          engine.hour = 0;
          engine.day++;
          engine.recordDailyStats();
        }

        // Evaluate dynamic lockdown trigger if enabled
        if (useDynamicLockdown) {
          const activeSymptomatic = engine.agents.filter(a => a.healthState === "I_S").length;
          // Trigger lockdown if active cases exceed 4.5% (45 agents)
          if (activeSymptomatic >= 45) {
            engine.lockdownProtocol = true;
          }
          // Lift lockdown if active cases fall below 1.5% (15 agents)
          if (activeSymptomatic < 15) {
            engine.lockdownProtocol = false;
          }
        } else {
          engine.lockdownProtocol = config.lockdownProtocol || false;
        }

        // Standard hourly health progressions & routine schedules
        const icuOverloaded = engine.activeIcuCount >= engine.icuCapacity;
        if (icuOverloaded) {
          hospitalGridlockHours++;
        }

        engine.agents.forEach(agent => {
          agent.updateDailyRoutine(engine.hour, engine.lockdownProtocol, engine.vaccinationCampaign);
          agent.tickHealthState(icuOverloaded);
        });
      }

      // Movement updates
      const simDt = 0.05;
      engine.agents.forEach(agent => agent.move(simDt));

      // Proximity transmissions
      engine.computeTransmissions();
      engine.activeIcuCount = engine.agents.filter(a => a.isHospitalized && a.healthState !== "D").length;
    }

    // Extract summary analytics
    const peakActiveInfections = Math.max(...engine.statsHistory.map(day => day.infSym + day.infAsym));
    const finalDeceased = engine.statsHistory[engine.statsHistory.length - 1].dec;
    const totalExposedRatio = 1 - (engine.statsHistory[engine.statsHistory.length - 1].sus / 1000);
    const gridlockDays = Math.round((hospitalGridlockHours / 24) * 10) / 10;

    return {
      history: engine.statsHistory,
      peakActiveRate: Math.round((peakActiveInfections / 1000) * 100),
      totalDeceased: finalDeceased,
      attackRate: Math.round(totalExposedRatio * 100),
      gridlockDays: gridlockDays
    };
  }

  /**
   * Compares Scenario A (Free Spread), Scenario B (Dynamic Lockdown),
   * and Scenario C (Vaccination Campaign) in chronological sequence.
   */
  runComparativeSuite() {
    // 1. Scenario A: Free Spread
    const resA = this.runScenario({
      transmissionProb: 0.08,
      transmissionRadius: 12,
      maskMandate: false,
      useDynamicLockdown: false,
      vaccinationCampaign: false
    });

    // 2. Scenario B: Dynamic Lockdown
    const resB = this.runScenario({
      transmissionProb: 0.08,
      transmissionRadius: 12,
      maskMandate: true, // Includes mask mandate support in locks
      useDynamicLockdown: true,
      vaccinationCampaign: false
    });

    // 3. Scenario C: Vaccination Campaign
    const resC = this.runScenario({
      transmissionProb: 0.08,
      transmissionRadius: 12,
      maskMandate: false,
      useDynamicLockdown: false,
      vaccinationCampaign: true,
      vaccinationRate: 6 // Fast vaccination clinics
    });

    return {
      scenarioA: resA,
      scenarioB: resB,
      scenarioC: resC
    };
  }
}
