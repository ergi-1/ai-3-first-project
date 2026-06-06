/**
 * EpiSim-ABM Dashboard & UI Controller
 * Manages HTML5 Canvas rendering, custom vector SVG charts,
 * control buttons, dynamic intervention forms, and experiment analytics.
 */

// Global engine and runner instances
let simEngine;
let expRunner;
let animationFrameId;

document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize core simulator
  const canvas = document.getElementById("sim-canvas");
  simEngine = new SimulationEngine(canvas.width, canvas.height, drawSimulation);
  simEngine.setupPopulation(1000);

  // Initialize background scenario processor
  expRunner = new ExperimentRunner(canvas.width, canvas.height);

  // 2. Bind control events
  setupControlListeners();

  // 3. Initial draw sweep
  drawSimulation();
  updateStatsPanel();
});

/**
 * Connects DOM inputs (buttons, sliders, toggles) to engine parameters.
 */
function setupControlListeners() {
  // Speed slider
  const speedInput = document.getElementById("input-sim-speed");
  speedInput.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    document.getElementById("label-sim-speed").innerText = `${val}x`;
    simEngine.speedMultiplier = val;
  });

  // Slider adjustments
  const transInput = document.getElementById("param-trans");
  transInput.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    document.getElementById("val-trans").innerText = `${val}%`;
    simEngine.transmissionProb = val / 100;
  });

  const radiusInput = document.getElementById("param-radius");
  radiusInput.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    document.getElementById("val-radius").innerText = `${val}px`;
    simEngine.transmissionRadius = val;
  });

  const asymInput = document.getElementById("param-asym-ratio");
  asymInput.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    document.getElementById("val-asym-ratio").innerText = `${val}%`;
    simEngine.asymptomaticRatio = val / 100;
  });

  // Checkbox policy toggles
  const maskToggle = document.getElementById("policy-mask");
  maskToggle.addEventListener("change", (e) => {
    simEngine.maskMandate = e.target.checked;
  });

  const lockToggle = document.getElementById("policy-lockdown");
  lockToggle.addEventListener("change", (e) => {
    simEngine.lockdownProtocol = e.target.checked;
  });

  const vaccineToggle = document.getElementById("policy-vaccine");
  const vacRateContainer = document.getElementById("vaccine-rate-container");
  vaccineToggle.addEventListener("change", (e) => {
    simEngine.vaccinationCampaign = e.target.checked;
    if (e.target.checked) {
      vacRateContainer.classList.add("visible");
    } else {
      vacRateContainer.classList.remove("visible");
    }
  });

  const vacRateInput = document.getElementById("param-vac-rate");
  vacRateInput.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    document.getElementById("val-vac-rate").innerText = `${val} / Day`;
    simEngine.vaccinationRate = val;
  });
}

/**
 * Resets sliders back to baseline configuration
 */
function resetSliders() {
  document.getElementById("param-trans").value = 8;
  document.getElementById("param-radius").value = 12;
  document.getElementById("param-asym-ratio").value = 30;
  document.getElementById("val-trans").innerText = "8%";
  document.getElementById("val-radius").innerText = "12px";
  document.getElementById("val-asym-ratio").innerText = "30%";

  simEngine.transmissionProb = 0.08;
  simEngine.transmissionRadius = 12;
  simEngine.asymptomaticRatio = 0.30;
}

/**
 * Play/Pause engine trigger
 */
function togglePlay() {
  const playBtn = document.getElementById("btn-play-pause");
  const engineStateLabel = document.getElementById("label-engine-state");
  const statusIndicator = document.querySelector(".status-indicator");

  if (simEngine.isPaused) {
    // Start running
    simEngine.isPaused = false;
    playBtn.innerHTML = `<i class="fa-solid fa-pause"></i> <span>Pause</span>`;
    playBtn.classList.remove("btn-primary");
    playBtn.classList.add("btn-secondary");
    engineStateLabel.innerText = "Engine Running";
    statusIndicator.className = "status-indicator running";
    
    // Launch game loop sequence
    runLoop();
  } else {
    // Pause running
    simEngine.isPaused = true;
    playBtn.innerHTML = `<i class="fa-solid fa-play"></i> <span>Play</span>`;
    playBtn.classList.remove("btn-secondary");
    playBtn.classList.add("btn-primary");
    engineStateLabel.innerText = "Engine Paused";
    statusIndicator.className = "status-indicator live";
    cancelAnimationFrame(animationFrameId);
  }
}

function runLoop() {
  if (simEngine.isPaused) return;
  simEngine.tick();
  animationFrameId = requestAnimationFrame(runLoop);
}

/**
 * Progresses simulation by single clock tick
 */
function stepSimulation() {
  if (!simEngine.isPaused) togglePlay(); // Force pause
  simEngine.tick();
}

/**
 * Resets populations and timelines
 */
function restartSimulation() {
  if (!simEngine.isPaused) togglePlay();
  simEngine.setupPopulation(1000);
  
  // Uncheck policy DOM components
  document.getElementById("policy-mask").checked = false;
  document.getElementById("policy-lockdown").checked = false;
  document.getElementById("policy-vaccine").checked = false;
  document.getElementById("vaccine-rate-container").classList.remove("visible");
  simEngine.resetPolicies();

  drawSimulation();
  updateStatsPanel();
  plotLineCurves();
}

/**
 * Inject infection outbreak seeds
 */
function triggerOutbreak() {
  simEngine.injectInfections(5);
  drawSimulation();
  updateStatsPanel();
}

/**
 * Main draw pipeline. Handles background elements, circles mapping,
 * zones outline bounds, and glowing effects.
 */
function drawSimulation() {
  const canvas = document.getElementById("sim-canvas");
  const ctx = canvas.getContext("2d");
  const env = simEngine.env;

  // Clear Canvas
  ctx.fillStyle = "#080c14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Grid Lines (Subtle spatial lines)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.015)";
  ctx.lineWidth = 1;
  const gridSpacing = 25;
  for (let x = 0; x < canvas.width; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // 1. Draw Attraction Zones
  
  // A. Parks (Circular emerald halos)
  env.parks.forEach(park => {
    ctx.beginPath();
    ctx.arc(park.x, park.y, park.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(16, 185, 129, 0.06)";
    ctx.fill();
    ctx.strokeStyle = "rgba(16, 185, 129, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Text Label
    ctx.fillStyle = "rgba(16, 185, 129, 0.6)";
    ctx.font = "8px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(park.name.split(" ")[0], park.x, park.y - 2);
  });

  // B. Households / Suburb bounds (Subtle gray squares)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  env.homes.forEach(home => {
    ctx.strokeRect(home.x, home.y, home.width, home.height);
  });

  // C. Workplaces / Office blocks (Neon blue blocks)
  env.workplaces.forEach(work => {
    ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
    ctx.fillRect(work.x, work.y, work.width, work.height);
    ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(work.x, work.y, work.width, work.height);
  });

  // D. Schools (Neon purple blocks)
  env.schools.forEach(school => {
    ctx.fillStyle = "rgba(139, 92, 246, 0.1)";
    ctx.fillRect(school.x, school.y, school.width, school.height);
    ctx.strokeStyle = "rgba(139, 92, 246, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(school.x, school.y, school.width, school.height);
  });

  // E. Vaccination Clinic (White border box with medical cross)
  env.clinics.forEach(clinic => {
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.fillRect(clinic.x, clinic.y, clinic.width, clinic.height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(clinic.x, clinic.y, clinic.width, clinic.height);
    
    // Draw small green cross icon
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    // Horizontal line
    ctx.moveTo(clinic.x + clinic.width/2 - 6, clinic.y + clinic.height/2);
    ctx.lineTo(clinic.x + clinic.width/2 + 6, clinic.y + clinic.height/2);
    // Vertical line
    ctx.moveTo(clinic.x + clinic.width/2, clinic.y + clinic.height/2 - 6);
    ctx.lineTo(clinic.x + clinic.width/2, clinic.y + clinic.height/2 + 6);
    ctx.stroke();
  });

  // F. Hospital Zone ICU (Neon Red bounding box)
  const hosp = env.hospital;
  ctx.fillStyle = "rgba(239, 68, 68, 0.05)";
  ctx.fillRect(hosp.x, hosp.y, hosp.width, hosp.height);
  ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(hosp.x, hosp.y, hosp.width, hosp.height);
  // Label Hospital
  ctx.fillStyle = "rgba(239, 68, 68, 0.7)";
  ctx.font = "8px 'Outfit', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ICU", hosp.x + hosp.width/2, hosp.y + hosp.height/2 + 3);

  // 2. Draw Moving Agents
  simEngine.agents.forEach(agent => {
    if (agent.healthState === "D") return; // Dead agents are parked off-canvas

    // Set colors depending on SEIRD states
    let color;
    let radius = 2.5;
    let isSymptomatic = false;

    if (agent.isVaccinated && agent.healthState === "R") {
      color = "#10b981"; // Bright recovered green
    } else {
      switch (agent.healthState) {
        case "S": color = "#a1a1aa"; break; // Susceptible (gray)
        case "E": color = "#eab308"; break; // Exposed (yellow)
        case "I_A": color = "#f97316"; break; // Asymptomatic (orange)
        case "I_S": 
          color = "#ef4444"; // Symptomatic (red)
          isSymptomatic = true;
          radius = 3.5;
          break; 
        case "R": color = "#10b981"; break; // Recovered (emerald green)
      }
    }

    // A. Draw local target route paths for symptomatic quarantined agents
    if (agent.isQuarantined || agent.isHospitalized) {
      ctx.strokeStyle = "rgba(239, 68, 68, 0.05)";
      ctx.beginPath();
      ctx.moveTo(agent.x, agent.y);
      ctx.lineTo(agent.activityTarget.x, agent.activityTarget.y);
      ctx.stroke();
    }

    // B. Draw agent particles
    ctx.beginPath();
    ctx.arc(agent.x, agent.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // C. Glowing thermal halos for active symptomatic spreaders
    if (isSymptomatic && !agent.isQuarantined && !agent.isHospitalized) {
      ctx.beginPath();
      ctx.arc(agent.x, agent.y, simEngine.transmissionRadius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(239, 68, 68, 0.06)";
      ctx.fill();
    }
  });

  // Call telemetry updates
  updateStatsPanel();
}

/**
 * Wire real-time counters, clock formats, and gauges to DOM.
 */
function updateStatsPanel() {
  document.getElementById("stat-day").innerText = simEngine.day;
  
  // Format simulated Hour/minute string
  const padHour = String(simEngine.hour).padStart(2, "0");
  const padMin = String(simEngine.minute).padStart(2, "0");
  document.getElementById("stat-hour").innerText = `${padHour}:${padMin}`;

  // Update clock progress fill bar
  const clockFill = document.getElementById("clock-progress-fill");
  const percentComplete = ((simEngine.hour * 60 + simEngine.minute) / (24 * 60)) * 100;
  clockFill.style.width = `${percentComplete}%`;

  // Count compartment sets
  let sus = 0, exp = 0, infAsym = 0, infSym = 0, rec = 0, dec = 0;
  simEngine.agents.forEach(agent => {
    switch (agent.healthState) {
      case "S": sus++; break;
      case "E": exp++; break;
      case "I_A": infAsym++; break;
      case "I_S": infSym++; break;
      case "R": rec++; break;
      case "D": dec++; break;
    }
  });

  // Render counters
  document.getElementById("count-sus").innerText = sus.toLocaleString();
  document.getElementById("count-exp").innerText = exp.toLocaleString();
  document.getElementById("count-inf-asym").innerText = infAsym.toLocaleString();
  document.getElementById("count-inf-sym").innerText = infSym.toLocaleString();
  document.getElementById("count-rec").innerText = rec.toLocaleString();
  document.getElementById("count-dec").innerText = dec.toLocaleString();

  // Healthcare ICU occupancies
  const icuPercent = Math.round((simEngine.activeIcuCount / simEngine.icuCapacity) * 100);
  document.getElementById("stat-icu-percent").innerText = `${icuPercent}%`;
  
  const gaugeFill = document.getElementById("icu-gauge-fill");
  gaugeFill.style.width = `${Math.min(100, icuPercent)}%`;

  // Dynamic hospital status cards
  const hospCard = document.getElementById("hospital-status-card");
  if (icuPercent >= 100) {
    hospCard.className = "status-card danger";
    hospCard.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation"></i>
      <div>
        <h4>Healthcare Overloaded!</h4>
        <p>ICU capacity exceeded. Fatality risk increased 3x due to emergency triage.</p>
      </div>
    `;
  } else if (icuPercent >= 75) {
    hospCard.className = "status-card danger";
    hospCard.innerHTML = `
      <i class="fa-solid fa-circle-exclamation"></i>
      <div>
        <h4>Critical Load</h4>
        <p>Beds saturation exceeding safe bounds. Prepare lockdown interventions.</p>
      </div>
    `;
  } else {
    hospCard.className = "status-card secure";
    hospCard.innerHTML = `
      <i class="fa-solid fa-circle-check"></i>
      <div>
        <h4>Capacity Secure</h4>
        <p>Hospitals are operating normally with ${simEngine.icuCapacity - simEngine.activeIcuCount} open ICU beds.</p>
      </div>
    `;
  }

  // Active plot curves redraws
  plotLineCurves();
}

/**
 * Draws dynamic vector lines in pure SVG based on simEngine.statsHistory.
 * Resolves absolute standalone performance with high styling match.
 */
function plotLineCurves() {
  const svg = document.getElementById("live-curve-svg");
  const noDataLabel = document.getElementById("chart-no-data");
  const history = simEngine.statsHistory;

  if (history.length < 2) {
    noDataLabel.classList.remove("hidden");
    // Clear paths
    svg.innerHTML = "";
    return;
  }

  noDataLabel.classList.add("hidden");
  svg.innerHTML = ""; // Clear existing drawings

  const w = 400;
  const h = 150;
  const padding = 10;
  const graphW = w - padding * 2;
  const graphH = h - padding * 2;

  const totalPoints = history.length;
  const maxAgents = 1000;

  // Render hospital bed threshold lines
  const thresholdY = padding + graphH - (simEngine.icuCapacity / maxAgents) * graphH;
  const thresholdPath = document.createElementNS("http://www.w3.org/2000/svg", "line");
  thresholdPath.setAttribute("x1", padding);
  thresholdPath.setAttribute("y1", thresholdY);
  thresholdPath.setAttribute("x2", padding + graphW);
  thresholdPath.setAttribute("y2", thresholdY);
  thresholdPath.setAttribute("stroke", "rgba(239, 68, 68, 0.4)");
  thresholdPath.setAttribute("stroke-width", "1");
  thresholdPath.setAttribute("stroke-dasharray", "3,3");
  svg.appendChild(thresholdPath);

  // Compute point arrays
  let susPoints = "", infPoints = "", recPoints = "", decPoints = "";

  history.forEach((dayStats, idx) => {
    const x = padding + (idx / (totalPoints - 1)) * graphW;
    
    // Compartment heights (inverse because SVG 0,0 is top-left!)
    const susY = padding + graphH - (dayStats.sus / maxAgents) * graphH;
    const infY = padding + graphH - ((dayStats.exp + dayStats.infAsym + dayStats.infSym) / maxAgents) * graphH;
    const recY = padding + graphH - (dayStats.rec / maxAgents) * graphH;
    const decY = padding + graphH - (dayStats.dec / maxAgents) * graphH;

    susPoints += `${x},${susY} `;
    infPoints += `${x},${infY} `;
    recPoints += `${x},${recY} `;
    decPoints += `${x},${decY} `;
  });

  // Helper function to append Polyline paths
  function addPolyline(points, color, width = 2) {
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", color);
    poly.setAttribute("stroke-width", width);
    poly.setAttribute("points", points.trim());
    svg.appendChild(poly);
  }

  // Plot pathways
  addPolyline(susPoints, "#a1a1aa"); // Susceptible (gray)
  addPolyline(infPoints, "#ef4444"); // Active Infections (red)
  addPolyline(recPoints, "#10b981"); // Recovered (green)
  addPolyline(decPoints, "#3f3f46"); // Deceased (charcoal)
}


/**
 * Runs Scenario A, B, and C in fast-forward sequence,
 * and plots comparison graphs side-by-side.
 */
function runComparativeExperiment() {
  const runBtn = document.getElementById("btn-run-experiment");
  const loading = document.getElementById("experiment-loading");
  const compPanel = document.getElementById("comparison-analysis-panel");

  // Show loading indicator
  runBtn.disabled = true;
  loading.classList.remove("hidden");
  compPanel.classList.add("hidden");

  // Delay execution slightly to allow UI loading spinner render
  setTimeout(() => {
    // Run the Suite!
    const results = expRunner.runComparativeSuite();

    // Hide spinner
    runBtn.disabled = false;
    loading.classList.add("hidden");
    compPanel.classList.remove("hidden");

    // 1. Populate individual scenario metrics
    populateScenarioCard("scen-a", results.scenarioA, "#card-scen-free", "A", "#ef4444");
    populateScenarioCard("scen-b", results.scenarioB, "#card-scen-lock", "B", "#f59e0b");
    populateScenarioCard("scen-c", results.scenarioC, "#card-scen-vacc", "C", "#10b981");

    // 2. Populate Comparison Bar Charts
    const maxDeaths = Math.max(results.scenarioA.totalDeceased, results.scenarioB.totalDeceased, results.scenarioC.totalDeceased, 1);
    
    animateBarWidth("bar-death-a", (results.scenarioA.totalDeceased / maxDeaths) * 100);
    animateBarWidth("bar-death-b", (results.scenarioB.totalDeceased / maxDeaths) * 100);
    animateBarWidth("bar-death-c", (results.scenarioC.totalDeceased / maxDeaths) * 100);

    document.getElementById("bar-val-death-a").innerText = results.scenarioA.totalDeceased;
    document.getElementById("bar-val-death-b").innerText = results.scenarioB.totalDeceased;
    document.getElementById("bar-val-death-c").innerText = results.scenarioC.totalDeceased;

    // 3. Populate Findings text analysis
    const findingsP = document.getElementById("experiment-findings-p");
    findingsP.innerHTML = `
      Under <strong>Scenario A (Free Spread)</strong>, the absence of containment triggers a sharp, high-density infection peak of <strong>${results.scenarioA.peakActiveRate}%</strong>, overloading hospital networks for <strong>${results.scenarioA.gridlockDays} days</strong> and causing <strong>${results.scenarioA.totalDeceased} deaths</strong>. 
      <br><br>
      Implementing threshold-based lockdowns in <strong>Scenario B</strong> flattens the peak active infection down to <strong>${results.scenarioB.peakActiveRate}%</strong> and cuts deaths to <strong>${results.scenarioB.totalDeceased}</strong>. However, lockdown extensions are necessary to completely exhaust transmission chains. 
      <br><br>
      Proactive targeted vaccination campaigns in <strong>Scenario C</strong> yield the absolute best outcomes: break-point immunity suppresses secondary infections quickly, keeping peak infection at just <strong>${results.scenarioC.peakActiveRate}%</strong> and leading to a negligible <strong>${results.scenarioC.totalDeceased} deaths</strong>, entirely shielding ICU capacities.
    `;

    // 4. Save results to window state for dynamic slideshow population!
    window.recentExperimentResults = {
      scenarioA: results.scenarioA,
      scenarioB: results.scenarioB,
      scenarioC: results.scenarioC
    };

  }, 100);
}

function populateScenarioCard(scenId, result, cardSelector, scenTag, curveColor) {
  // Populate metrics labels
  document.getElementById(`${scenId}-peak`).innerText = `${result.peakActiveRate}%`;
  document.getElementById(`${scenId}-death`).innerText = result.totalDeceased;
  document.getElementById(`${scenId}-exhaust`).innerText = result.gridlockDays > 0 ? `${result.gridlockDays} Days` : "None";

  // Plot miniature SVG infection curves
  const svg = document.getElementById(`${scenId}-svg`);
  svg.innerHTML = ""; // Clear existing

  const w = 200;
  const h = 80;
  const padding = 5;
  const graphW = w - padding * 2;
  const graphH = h - padding * 2;

  const maxAgents = 1000;
  const history = result.history;
  const totalPoints = history.length;

  let pathPoints = "";
  history.forEach((dayStats, idx) => {
    const x = padding + (idx / (totalPoints - 1)) * graphW;
    const activeInfections = dayStats.exp + dayStats.infAsym + dayStats.infSym;
    const y = padding + graphH - (activeInfections / maxAgents) * graphH;
    pathPoints += `${x},${y} `;
  });

  const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  poly.setAttribute("fill", "none");
  poly.setAttribute("stroke", curveColor);
  poly.setAttribute("stroke-width", "1.5");
  poly.setAttribute("points", pathPoints.trim());
  svg.appendChild(poly);
}

function animateBarWidth(barId, targetPercent) {
  const bar = document.getElementById(barId);
  bar.style.width = "0%";
  setTimeout(() => {
    bar.style.width = `${targetPercent}%`;
  }, 50);
}
