// Configure external destinations only when real product URLs are available.
// Null keeps the corresponding in-page CTA; login is hidden until configured.
const PRISM_LINKS = Object.freeze({
  login: null,
  intermediate: null,
  final: null,
});

const HERO_PRISM_VIDEO = "./assets/prism-hero.mp4";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const saveData = navigator.connection?.saveData === true;
const desktop = window.matchMedia("(min-width: 921px)");
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function configureLinks() {
  document.querySelectorAll("[data-config-link]").forEach((link) => {
    const destination = PRISM_LINKS[link.dataset.configLink];
    if (!destination) return;
    link.href = destination;
    link.hidden = false;
  });
}

function initializeImages() {
  document.querySelectorAll("[data-approved-image]").forEach((image) => {
    const frame = image.closest("[data-image-frame]");
    if (!frame) return;
    const markMissing = () => frame.classList.add("is-missing");
    const markReady = () => frame.classList.remove("is-missing");
    image.addEventListener("error", markMissing);
    image.addEventListener("load", markReady);
    if (image.complete) {
      if (image.naturalWidth) markReady();
      else markMissing();
    }
  });
  document.querySelectorAll(".prism-poster, .final-media img, .brand-title").forEach((image) => {
    const markMissing = () => image.classList.add("asset-unavailable");
    image.addEventListener("error", markMissing);
    if (image.complete && !image.naturalWidth) markMissing();
  });
}

function renderHeroPrism() {
  const media = document.querySelector("[data-hero-prism-media]");
  if (!media || reducedMotion.matches || saveData) return;

  const video = document.createElement("video");
  video.className = "prism-video";
  Object.assign(video, { autoplay: true, muted: true, loop: true, playsInline: true, preload: "metadata" });
  video.setAttribute("aria-hidden", "true");
  const source = document.createElement("source");
  source.src = HERO_PRISM_VIDEO;
  source.type = "video/mp4";
  video.append(source);
  video.addEventListener("playing", () => media.classList.add("is-video-ready"), { once: true });
  video.addEventListener("error", () => { media.classList.remove("is-video-ready"); video.remove(); });
  source.addEventListener("error", () => { media.classList.remove("is-video-ready"); video.remove(); });
  media.append(video);
  video.play().catch(() => { /* The approved poster stays visible. */ });

  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) {
      video.pause();
      media.classList.remove("is-video-ready");
    } else video.play().catch(() => {});
  });
}

const workspaceNames = ["STRATEGY", "CREATIVES", "PIPELINE", "PERFORMANCE"];
const opening = document.querySelector(".opening");
const journey = document.querySelector(".workspace-journey");
const heroCopy = document.querySelector(".hero-copy");
const steps = [...document.querySelectorAll("[data-workspace-step]")];
const links = [...document.querySelectorAll("[data-select]")];
const panels = [...document.querySelectorAll("[data-panel]")];
const screenshots = [...document.querySelectorAll("[data-stage-image]")];
const counter = document.querySelector("[data-counter]");
const frameCounter = document.querySelector("[data-frame-counter]");
const stageName = document.querySelector("[data-stage-name]");
const progressFill = document.querySelector("[data-progress]");
let active = -1;
let queued = false;

function setWorkspace(index) {
  if (index === active) return;
  active = index;
  panels.forEach((panel, i) => {
    panel.classList.toggle("is-active", i === index);
    panel.setAttribute("aria-hidden", String(i !== index));
  });
  screenshots.forEach((screen, i) => {
    screen.classList.toggle("is-active", i === index);
    screen.setAttribute("aria-hidden", String(i !== index));
  });
  links.forEach((link, i) => {
    link.classList.toggle("is-active", i === index);
    if (i === index) link.setAttribute("aria-current", "step");
    else link.removeAttribute("aria-current");
  });
  const label = `${String(index + 1).padStart(2, "0")} / 04`;
  counter.textContent = label;
  frameCounter.textContent = label;
  stageName.textContent = `PRISM / ${workspaceNames[index]}`;
  progressFill.style.width = `${(index + 1) * 25}%`;
}

function updateScrollState() {
  queued = false;
  if (!desktop.matches || reducedMotion.matches) {
    opening.style.setProperty("--opening-progress", "0");
    opening.style.setProperty("--copy-opacity", "1");
    opening.style.setProperty("--copy-shift", "0px");
    opening.style.setProperty("--prism-opacity", "1");
    opening.style.setProperty("--emergence-opacity", "0");
    opening.style.setProperty("--emergence-shift", "54px");
    heroCopy.inert = false;
    setWorkspace(0);
    return;
  }
  const viewHeight = window.innerHeight;
  const openingRect = opening.getBoundingClientRect();
  const openingTravel = Math.max(1, opening.offsetHeight - viewHeight);
  const openingProgress = clamp(-openingRect.top / openingTravel);
  opening.style.setProperty("--opening-progress", openingProgress.toFixed(4));
  opening.style.setProperty("--copy-opacity", clamp(1 - openingProgress * 2.8).toFixed(3));
  opening.style.setProperty("--copy-shift", `${Math.round(-openingProgress * 55)}px`);
  opening.style.setProperty("--prism-opacity", clamp(1 - Math.max(0, openingProgress - .48) * 2.25).toFixed(3));
  opening.style.setProperty("--emergence-opacity", clamp((openingProgress - .22) * 1.75).toFixed(3));
  opening.style.setProperty("--emergence-shift", `${Math.round((1 - openingProgress) * 54)}px`);
  heroCopy.inert = openingProgress > .51;

  const journeyRect = journey.getBoundingClientRect();
  if (journeyRect.bottom < 0 || journeyRect.top > viewHeight) return;
  // The center of the viewport chooses the real scroll-region nearest it.
  // A selector merely scrolls to an anchor; no separate click-selection state.
  const center = viewHeight / 2;
  let closestIndex = 0;
  let closestDistance = Infinity;
  steps.forEach((step, index) => {
    const rect = step.getBoundingClientRect();
    const distance = Math.abs(rect.top + rect.height / 2 - center);
    if (distance < closestDistance) {
      closestIndex = index;
      closestDistance = distance;
    }
  });
  setWorkspace(closestIndex);
}

function requestScrollUpdate() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(updateScrollState);
}

function initializeReveals() {
  const items = [...document.querySelectorAll(".reveal-on-scroll")];
  if (reducedMotion.matches || !window.IntersectionObserver) return;
  document.documentElement.classList.add("motion-reveals");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  items.forEach((item) => observer.observe(item));
  reducedMotion.addEventListener("change", () => {
    if (!reducedMotion.matches) return;
    document.documentElement.classList.remove("motion-reveals");
    observer.disconnect();
  });
}

configureLinks();
initializeImages();
renderHeroPrism();
initializeReveals();
setWorkspace(0);
window.addEventListener("scroll", requestScrollUpdate, { passive: true });
window.addEventListener("resize", requestScrollUpdate, { passive: true });
desktop.addEventListener("change", requestScrollUpdate);
reducedMotion.addEventListener("change", requestScrollUpdate);
requestScrollUpdate();
