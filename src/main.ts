import QRCode from 'qrcode';

import { AquariumScene } from './aquarium-scene';
import { createQrSurface, QrCapacityError } from './qr-surface';
import {
  getRevealFrame,
  getReverseRevealFrame,
  REVEAL_DURATION_MS,
  type RevealFrame,
} from './reveal-timeline';
import { fromShareFragment, parseDestination, toShareFragment } from './url-state';
import './styles.css';

type View = 'reef' | 'qr';
type TransitionDirection = 'to-qr' | 'to-reef';

interface Transition {
  direction: TransitionDirection;
  startedAt: number;
}

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('a-que-ar could not find the application root.');
}

const root = app;

root.innerHTML = `
  <div class="experience" data-mode="creator">
    <canvas class="scene-canvas" aria-label="A low-poly underwater diorama with fish swimming over a mosaic seabed"></canvas>
    <canvas class="fallback-canvas" aria-label="Generated QR code" hidden></canvas>
    <div class="water-atmosphere" aria-hidden="true"></div>

    <header class="site-header">
      <a class="brand" href="./" aria-label="a-que-ar home">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span><b>A</b>·<b>Q</b>UE·A<b>R</b></span>
      </a>
      <p class="local-note"><span></span> Generated on this device</p>
    </header>

    <main>
      <section class="creator-card" aria-labelledby="creator-title">
        <p class="eyebrow">A LIVING LINK</p>
        <h1 id="creator-title">Send your link<br />through the deep.</h1>
        <p class="intro">Give a web destination a small ocean of its own. The reef lives in your browser and needs no account.</p>
        <form class="destination-form" novalidate>
          <label for="destination">Destination URL</label>
          <div class="input-row">
            <input id="destination" name="destination" type="url" inputmode="url" autocomplete="url" placeholder="https://your-place.com" spellcheck="false" required />
            <button class="create-button" type="submit"><span>Create reef</span><span aria-hidden="true">↗</span></button>
          </div>
          <p class="form-message" aria-live="polite"></p>
        </form>
        <p class="credit">
          Made by <a href="https://github.com/AndrewDongminYoo" target="_blank" rel="noopener noreferrer">Dongmin Yu (Andrew)</a>, a mobile developer.
          <a href="https://github.com/AndrewDongminYoo/aqua_icqr" target="_blank" rel="noopener noreferrer">Source on GitHub</a>
        </p>
      </section>

      <section class="reveal-status" aria-live="polite" hidden>
        <span class="status-pulse" aria-hidden="true"></span>
        <p></p>
      </section>

      <section class="experience-dock" aria-labelledby="dock-title" hidden>
        <div class="dock-summary">
          <p class="eyebrow">REEF READY</p>
          <h2 id="dock-title">The current found its course.</h2>
        </div>
        <div class="dock-form-slot"></div>
        <div class="dock-actions">
          <button class="primary-action view-toggle" type="button">Show QR</button>
          <a class="secondary-action open-link" href="#" target="_blank" rel="noopener noreferrer">Open destination</a>
          <button class="tertiary-action share-button" type="button">Share experience</button>
          <button class="tertiary-action replay-button" type="button">Replay</button>
        </div>
        <p class="fallback-notice" hidden>3D view is unavailable. Your QR still works.</p>
        <label class="share-fallback" hidden>
          Share URL
          <input type="text" readonly />
        </label>
        <p class="share-message" aria-live="polite"></p>
      </section>
    </main>

    <aside class="depth-marker" aria-hidden="true">
      <span>SURFACE</span><i></i><span>SEABED</span>
    </aside>

    <footer class="site-footer">
      <span>OPEN WATER / PRIVATE BY DEFAULT</span>
      <span class="coordinates">PELAGIC ZONE</span>
    </footer>
  </div>
`;

function requireElement<T extends Element>(selector: string): T {
  const element = root.querySelector<T>(selector);

  if (!element) {
    throw new Error(`a-que-ar could not find ${selector}.`);
  }

  return element;
}

const experience = requireElement<HTMLDivElement>('.experience');
const header = requireElement<HTMLElement>('.site-header');
const sceneCanvas = requireElement<HTMLCanvasElement>('.scene-canvas');
const fallbackCanvas = requireElement<HTMLCanvasElement>('.fallback-canvas');
const creatorCard = requireElement<HTMLElement>('.creator-card');
const dock = requireElement<HTMLElement>('.experience-dock');
const dockFormSlot = requireElement<HTMLElement>('.dock-form-slot');
const form = requireElement<HTMLFormElement>('.destination-form');
const destinationInput = requireElement<HTMLInputElement>('#destination');
const createButton = requireElement<HTMLButtonElement>('.create-button');
const formMessage = requireElement<HTMLParagraphElement>('.form-message');
const revealStatus = requireElement<HTMLElement>('.reveal-status');
const revealStatusText = requireElement<HTMLParagraphElement>('.reveal-status p');
const viewToggle = requireElement<HTMLButtonElement>('.view-toggle');
const shareButton = requireElement<HTMLButtonElement>('.share-button');
const replayButton = requireElement<HTMLButtonElement>('.replay-button');
const openLink = requireElement<HTMLAnchorElement>('.open-link');
const fallbackNotice = requireElement<HTMLParagraphElement>('.fallback-notice');
const shareFallback = requireElement<HTMLLabelElement>('.share-fallback');
const shareFallbackInput = requireElement<HTMLInputElement>('.share-fallback input');
const shareMessage = requireElement<HTMLParagraphElement>('.share-message');
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

let scene: AquariumScene | null = null;
let activeDestination: string | null = null;
let currentView: View = 'reef';
let transition: Transition | null = null;
let transitionTimer: number | null = null;
let animationFrame: number | null = null;
let layoutFrame: number | null = null;
let reducedMotion = motionQuery.matches;
let fallbackRender: { destination: string; size: number; pixelRatio: number } | null = null;

function supportsWebGL(): boolean {
  // three r185 requests webgl2 only and logs a console error before throwing when it is missing.
  const probe = document.createElement('canvas');
  const context = probe.getContext('webgl2');

  if (!context) return false;

  context.getExtension('WEBGL_lose_context')?.loseContext();
  return true;
}

if (supportsWebGL()) {
  try {
    scene = new AquariumScene(sceneCanvas);
    document.documentElement.dataset.renderer = 'webgl';
  } catch (error) {
    console.warn('a-que-ar could not initialize WebGL. The 2D QR fallback is active.', error);
    sceneCanvas.hidden = true;
    document.documentElement.dataset.renderer = 'fallback';
  }
} else {
  sceneCanvas.hidden = true;
  document.documentElement.dataset.renderer = 'fallback';
}

function setPhase(phase: string): void {
  document.documentElement.dataset.revealPhase = phase;
  experience.dataset.phase = phase;
}

function setCurrentView(view: View): void {
  currentView = view;
  document.documentElement.dataset.view = view;
  experience.dataset.view = view;
}

// The depth gauge beside the stage follows the camera: 0 sits at the seabed, 1 at the surface.
function applyRevealFrame(frame: RevealFrame): void {
  scene?.setRevealFrame(frame);
  experience.style.setProperty('--depth', frame.cameraProgress.toFixed(3));
}

function setSceneFrame(frame: RevealFrame, time = performance.now()): void {
  applyRevealFrame(frame);
  scene?.render(reducedMotion ? 0 : time / 1_000);
}

function getCurrentFrame(time = performance.now()): RevealFrame {
  if (transition) {
    const elapsed = time - transition.startedAt;
    return transition.direction === 'to-qr'
      ? getRevealFrame(elapsed, reducedMotion)
      : getReverseRevealFrame(elapsed, reducedMotion);
  }

  return currentView === 'qr'
    ? getRevealFrame(0, true)
    : getReverseRevealFrame(0, true);
}

function setCanvasDescription(): void {
  const canToggleView = Boolean(scene && activeDestination && !transition);

  if (canToggleView) {
    sceneCanvas.tabIndex = 0;
    sceneCanvas.setAttribute('role', 'button');
    sceneCanvas.setAttribute(
      'aria-label',
      currentView === 'reef'
        ? 'Living reef. Activate to show the QR code.'
        : 'QR code. Activate to return to the living reef.',
    );
    return;
  }

  sceneCanvas.removeAttribute('tabindex');
  sceneCanvas.removeAttribute('role');

  if (transition?.direction === 'to-qr') {
    sceneCanvas.setAttribute('aria-label', 'A living reef transforming into a QR mosaic');
  } else if (transition?.direction === 'to-reef') {
    sceneCanvas.setAttribute('aria-label', 'A QR mosaic returning to the living reef');
  } else {
    sceneCanvas.setAttribute('aria-label', 'A low-poly underwater diorama with fish swimming over a mosaic seabed');
  }
}

function renderControls(): void {
  const isReady = activeDestination !== null;
  const isFallback = scene === null;
  const isTransitioning = transition !== null;

  creatorCard.hidden = isReady;
  dock.hidden = !isReady;
  experience.dataset.mode = !isReady ? 'creator' : currentView;
  fallbackNotice.hidden = !isFallback;
  viewToggle.hidden = isFallback;
  viewToggle.disabled = !isReady || isTransitioning;
  viewToggle.textContent = currentView === 'reef' ? 'Show QR' : 'View reef';
  createButton.disabled = isTransitioning;
  replayButton.disabled = !isReady || isTransitioning;
  shareButton.disabled = !isReady || isTransitioning;
  openLink.hidden = !isReady;
  setCanvasDescription();
}

function getReservedSpace(): { top: number; bottom: number } {
  const headerRect = header.getBoundingClientRect();
  const controls = dock.hidden ? creatorCard : dock;
  const controlsRect = controls.getBoundingClientRect();
  const top = Math.max(0, Math.ceil(headerRect.bottom + 14));
  const bottom = Math.max(0, Math.ceil(window.innerHeight - controlsRect.top + 14));

  return { top, bottom };
}

function updateLayout(): void {
  layoutFrame = null;
  const insets = getReservedSpace();
  const availableHeight = Math.max(1, window.innerHeight - insets.top - insets.bottom);
  const fallbackSize = Math.max(
    1,
    Math.floor(Math.min(560, window.innerWidth - 32, availableHeight - 4)),
  );

  experience.style.setProperty('--stage-top', `${insets.top}px`);
  experience.style.setProperty('--stage-bottom', `${insets.bottom}px`);
  experience.style.setProperty('--fallback-top', `${Math.floor(insets.top + (availableHeight - fallbackSize) * 0.5)}px`);
  experience.style.setProperty('--fallback-left', `${Math.floor((window.innerWidth - fallbackSize) * 0.5)}px`);
  experience.style.setProperty('--fallback-size', `${fallbackSize}px`);
  scene?.resize(window.innerWidth, window.innerHeight, insets);

  const fallbackPixelRatio = getFallbackPixelRatio();

  if (!scene && activeDestination && (
    fallbackRender?.destination !== activeDestination ||
    fallbackRender.size !== fallbackSize ||
    fallbackRender.pixelRatio !== fallbackPixelRatio
  )) {
    void drawFallback(activeDestination, fallbackSize, fallbackPixelRatio);
  }

  // Resizing clears the drawing buffer, so redraw even in a hidden tab or the stage stays blank.
  setSceneFrame(getCurrentFrame());
}

function requestLayout(): void {
  if (layoutFrame !== null) return;
  layoutFrame = window.requestAnimationFrame(updateLayout);
}

function shouldAnimate(): boolean {
  return Boolean(scene && !reducedMotion && !document.hidden && (transition || currentView === 'reef'));
}

function reconcileAnimation(): void {
  if (shouldAnimate()) {
    if (animationFrame === null) {
      animationFrame = window.requestAnimationFrame(renderScene);
    }
    return;
  }

  if (animationFrame !== null) {
    window.cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
}

function clearTransition(): void {
  transition = null;

  if (transitionTimer !== null) {
    window.clearTimeout(transitionTimer);
    transitionTimer = null;
  }
}

function completeTransition(time: number): void {
  const completed = transition;

  if (!completed) return;

  clearTransition();
  setCurrentView(completed.direction === 'to-qr' ? 'qr' : 'reef');
  setPhase(currentView === 'qr' ? 'revealed' : 'reef');
  revealStatus.hidden = true;
  shareMessage.textContent = currentView === 'qr' ? 'QR view ready to scan.' : 'Living reef restored.';
  renderControls();
  setSceneFrame(
    currentView === 'qr' ? getRevealFrame(0, true) : getReverseRevealFrame(0, true),
    time,
  );
}

function renderScene(now: number): void {
  animationFrame = null;

  if (!scene || reducedMotion || document.hidden) return;

  if (transition) {
    const elapsed = now - transition.startedAt;
    const frame =
      transition.direction === 'to-qr'
        ? getRevealFrame(elapsed, false)
        : getReverseRevealFrame(elapsed, false);
    applyRevealFrame(frame);

    if (elapsed >= REVEAL_DURATION_MS) {
      completeTransition(now);
    } else {
      setPhase(
        transition.direction === 'to-qr'
          ? frame.phase
          : frame.phase === 'revealed'
            ? 'reverse-lifting'
            : 'reverse-scattering',
      );
      setCanvasDescription();
      scene.render(now / 1_000);
    }
  } else {
    scene.render(now / 1_000);
  }

  reconcileAnimation();
}

function beginTransition(direction: TransitionDirection, replay = false): void {
  if (!activeDestination || !scene) return;
  if (transition) return;
  if (!replay && ((direction === 'to-qr' && currentView === 'qr') || (direction === 'to-reef' && currentView === 'reef'))) {
    return;
  }

  transition = { direction, startedAt: performance.now() };
  const firstFrame =
    direction === 'to-qr'
      ? getRevealFrame(0, reducedMotion)
      : getReverseRevealFrame(0, reducedMotion);
  applyRevealFrame(firstFrame);
  revealStatusText.textContent =
    direction === 'to-qr' ? 'The reef is gathering into a code…' : 'The reef is returning to the deep…';
  revealStatus.hidden = reducedMotion;
  shareMessage.textContent = '';
  renderControls();
  setPhase(direction === 'to-qr' ? firstFrame.phase : 'reverse-lifting');

  if (reducedMotion) {
    completeTransition(performance.now());
    return;
  }

  // A hidden tab delivers no animation frames, so the timeline must also finish on a timer.
  transitionTimer = window.setTimeout(() => {
    transitionTimer = null;
    completeTransition(performance.now());
  }, REVEAL_DURATION_MS + 120);
  reconcileAnimation();
}

function setFormError(message: string): void {
  formMessage.textContent = message;
  destinationInput.setAttribute('aria-invalid', 'true');
  destinationInput.focus();
}

function clearFormError(): void {
  formMessage.textContent = '';
  destinationInput.removeAttribute('aria-invalid');
}

function validationMessage(reason: 'empty' | 'invalid' | 'unsupported-protocol'): string {
  if (reason === 'empty') return 'Enter a destination URL to create a reef.';
  if (reason === 'unsupported-protocol') return 'Use an HTTP or HTTPS destination.';
  return 'Enter a complete URL, including https://.';
}

function getFallbackPixelRatio(): number {
  return Math.max(1, window.devicePixelRatio || 1);
}

async function drawFallback(destination: string, size: number, pixelRatio: number): Promise<void> {
  // Recorded before drawing so a failed attempt is not retried on every layout pass.
  fallbackRender = { destination, size, pixelRatio };

  try {
    await QRCode.toCanvas(fallbackCanvas, destination, {
      errorCorrectionLevel: 'M',
      margin: 4,
      width: Math.round(size * pixelRatio),
      color: {
        dark: '#092f35ff',
        light: '#f0dfadff',
      },
    });
  } catch (error) {
    fallbackCanvas.hidden = true;
    shareMessage.textContent = 'The QR code could not be drawn in this browser.';
    console.warn('a-que-ar could not draw the fallback QR code.', error);
    return;
  }

  fallbackCanvas.style.removeProperty('width');
  fallbackCanvas.style.removeProperty('height');

  if (activeDestination === destination && scene === null) {
    fallbackCanvas.hidden = false;
  }
}

async function activateDestination(
  destination: string,
  focusControls: boolean,
): Promise<boolean> {
  clearFormError();
  shareMessage.textContent = '';
  shareFallback.hidden = true;
  const surfaceChanged = activeDestination !== destination;

  if (surfaceChanged) {
    try {
      const surface = createQrSurface(destination);
      scene?.setSurface(surface);
    } catch (error) {
      if (error instanceof QrCapacityError) {
        setFormError(error.message);
        return false;
      }
      throw error;
    }
  }

  activeDestination = destination;
  openLink.href = destination;
  dockFormSlot.append(form);
  clearTransition();

  if (scene) {
    fallbackCanvas.hidden = true;
    setCurrentView('reef');
    setPhase('reef');
    setSceneFrame(getReverseRevealFrame(0, true));
  } else {
    setCurrentView('qr');
    setPhase('revealed');
  }

  renderControls();
  updateLayout();

  if (focusControls) {
    (scene ? viewToggle : replayButton).focus();
  }

  reconcileAnimation();
  return true;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (transition) return;
  const result = parseDestination(destinationInput.value);

  if (!result.ok) {
    setFormError(validationMessage(result.reason));
    return;
  }

  void activateDestination(result.destination, true).then((started) => {
    if (!started) return;
    const nextUrl = `${window.location.pathname}${window.location.search}${toShareFragment(result.destination)}`;
    window.history.replaceState(null, '', nextUrl);
  });
});

destinationInput.addEventListener('input', clearFormError);

viewToggle.addEventListener('click', () => {
  beginTransition(currentView === 'reef' ? 'to-qr' : 'to-reef');
});

sceneCanvas.addEventListener('click', () => {
  beginTransition(currentView === 'reef' ? 'to-qr' : 'to-reef');
});

sceneCanvas.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  beginTransition(currentView === 'reef' ? 'to-qr' : 'to-reef');
});

replayButton.addEventListener('click', () => {
  if (!activeDestination) return;
  if (!scene) {
    renderControls();
    return;
  }
  beginTransition('to-qr', true);
});

openLink.addEventListener('click', () => {
  shareMessage.textContent = 'Opening the destination in a new tab.';
});

shareButton.addEventListener('click', async () => {
  if (!activeDestination) return;

  const shareUrl = window.location.href;
  const shareData = {
    title: 'a-que-ar',
    text: 'Follow this living link through the deep.',
    url: shareUrl,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      shareMessage.textContent = 'Experience shared.';
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        shareMessage.textContent = 'Sharing was cancelled.';
        return;
      }
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      shareMessage.textContent = 'Share URL copied.';
      return;
    } catch {
      // The selectable field below is the final fallback.
    }
  }

  shareFallbackInput.value = shareUrl;
  shareFallback.hidden = false;
  shareFallbackInput.select();
  shareMessage.textContent = 'Copy this URL to share the reef.';
  requestLayout();
});

sceneCanvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  const lostScene = scene;
  scene = null;
  clearTransition();
  reconcileAnimation();
  lostScene?.dispose();
  sceneCanvas.hidden = true;
  revealStatus.hidden = true;
  revealStatusText.textContent = '';
  document.documentElement.dataset.renderer = 'fallback';

  if (activeDestination) {
    setCurrentView('qr');
    setPhase('revealed');
    renderControls();
    requestLayout();
  }
});

window.addEventListener('resize', requestLayout);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    reconcileAnimation();
    return;
  }
  requestLayout();
  reconcileAnimation();
});
motionQuery.addEventListener('change', (event) => {
  reducedMotion = event.matches;

  if (reducedMotion && transition) {
    completeTransition(performance.now());
  }

  requestLayout();
  reconcileAnimation();
});
window.addEventListener('pagehide', (event) => {
  // A back/forward-cache restore resumes the render loop, so keep the renderer alive for it.
  if (!event.persisted) scene?.dispose();
});

const layoutObserver = new ResizeObserver(requestLayout);
layoutObserver.observe(header);
layoutObserver.observe(creatorCard);
layoutObserver.observe(dock);

setCurrentView('reef');
setPhase('idle');
renderControls();
// The first layout runs synchronously so a tab that never paints still gets a sized, drawn stage.
updateLayout();
reconcileAnimation();

const sharedDestination = fromShareFragment(window.location.hash);

if (sharedDestination.ok) {
  destinationInput.value = sharedDestination.destination;
  void activateDestination(sharedDestination.destination, false);
} else if (sharedDestination.reason !== 'missing') {
  setFormError('This shared reef contains an invalid destination.');
}
