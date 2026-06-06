/**
 * EpiSim-ABM Slide Deck Controller Module
 * Handles animations, keyboard events, dot indicators,
 * and dynamically injects the latest active simulation stats into slide content.
 */

let currentSlideIdx = 1;
const totalSlides = 5;

document.addEventListener("DOMContentLoaded", () => {
  // Bind Keyboard Navigation for Presentation
  document.addEventListener("keydown", (e) => {
    // Only intercept keys if the presentation tab is currently active
    const presentationTab = document.getElementById("tab-slides");
    if (presentationTab && presentationTab.classList.contains("active")) {
      if (e.key === "ArrowRight" || e.key === "Space") {
        nextSlide();
      } else if (e.key === "ArrowLeft") {
        prevSlide();
      }
    }
  });

  // Perform initial telemetry inject
  updatePresentationStats();
});

/**
 * Slide navigation commands
 */
function nextSlide() {
  if (currentSlideIdx < totalSlides) {
    jumpToSlide(currentSlideIdx + 1);
  } else {
    // Wrap around to start
    jumpToSlide(1);
  }
}

function prevSlide() {
  if (currentSlideIdx > 1) {
    jumpToSlide(currentSlideIdx - 1);
  } else {
    // Wrap around to end
    jumpToSlide(totalSlides);
  }
}

/**
 * Jump to a specific slide number (1-indexed) and manage class animations
 */
function jumpToSlide(slideIdx) {
  if (slideIdx < 1 || slideIdx > totalSlides) return;

  // Track previous active slide for out-transitions
  const oldActive = document.querySelector(`.slide-card.active`);
  if (oldActive) {
    oldActive.classList.remove("active");
    // Add temporary class to fade left if transitioning forwards
    if (slideIdx > currentSlideIdx) {
      oldActive.classList.add("prev");
    } else {
      oldActive.classList.remove("prev");
    }
  }

  // Remove prev states from all cards
  document.querySelectorAll(".slide-card").forEach((card, index) => {
    const cardNum = index + 1;
    if (cardNum !== slideIdx && cardNum !== currentSlideIdx) {
      card.classList.remove("prev");
    }
  });

  // Activate new slide
  const newActive = document.getElementById(`slide-${slideIdx}`);
  if (newActive) {
    newActive.classList.remove("prev");
    newActive.classList.add("active");
  }

  // Update dots indicator
  const dots = document.querySelectorAll(".slide-indicator .dot");
  dots.forEach((dot, index) => {
    if (index + 1 === slideIdx) {
      dot.classList.add("active");
    } else {
      dot.classList.remove("active");
    }
  });

  currentSlideIdx = slideIdx;

  // Special Action: Update slide stats whenever Slide 4 becomes active
  if (slideIdx === 4) {
    updatePresentationStats();
  }
}

/**
 * TELEMETRY INJECTION METHOD
 * Grabs the exact results from the live simulation engine (or background experiments)
 * and writes them natively into Slide 4.
 */
function updatePresentationStats() {
  const daysBox = document.getElementById("slide-stat-days");
  const attackBox = document.getElementById("slide-stat-attack");
  const peakBox = document.getElementById("slide-stat-peak");
  const mortalityBox = document.getElementById("slide-stat-mortality");

  // Safety checks if engine isn't initialized yet
  if (!simEngine) return;

  // Retrieve current active stats from simEngine
  const dayCount = simEngine.day;
  const history = simEngine.statsHistory;

  if (history && history.length > 0) {
    const finalDay = history[history.length - 1];
    
    // 1. Total Days simulated
    daysBox.innerText = `${dayCount} Days`;

    // 2. Attack Rate: Percentage of population exposed / infected
    // Ratio = (1 - (Susceptible / TotalPopulation)) * 100
    const attackRate = Math.round((1 - (finalDay.sus / 1000)) * 100);
    attackBox.innerText = `${attackRate}%`;

    // 3. Peak active infections (Exp + infAsym + infSym)
    let maxInfections = 0;
    history.forEach(day => {
      const active = day.exp + day.infAsym + day.infSym;
      if (active > maxInfections) maxInfections = active;
    });
    const peakRate = Math.round((maxInfections / 1000) * 100);
    peakBox.innerText = `${peakRate}%`;

    // 4. Mortality Rate: Percentage of deceased agents relative to total population
    const mortRate = Math.round((finalDay.dec / 1000) * 100);
    mortalityBox.innerText = `${mortRate}%`;
  } else {
    // If simulation hasn't run, load placeholders
    daysBox.innerText = "Day 1";
    attackBox.innerText = "0.1%";
    peakBox.innerText = "0.1%";
    mortalityBox.innerText = "0%";
  }
}
