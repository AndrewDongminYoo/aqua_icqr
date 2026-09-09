import * as THREE from 'three';

import type { QrSurface } from './qr-surface';
import type { RevealFrame } from './reveal-timeline';
import { getFishTransform, getReefModuleTransform } from './scene-math';

const COLORS = {
  abyss: 0x031c26,
  deepWater: 0x073f50,
  lagoon: 0x0a7b7d,
  sand: 0xf0dfad,
  darkCoral: 0x5b252d,
  darkKelp: 0x164735,
  darkLagoon: 0x073e4b,
  kelp: 0x2f8f68,
  kelpLight: 0x58bc7c,
  coral: 0xf27b58,
  coralLight: 0xf2ad68,
  foam: 0xc8f4e8,
  decorativeLight: 0x4c9b82,
} as const;

const DARK_REEF_COLORS = [COLORS.darkCoral, COLORS.darkKelp, COLORS.darkLagoon] as const;

const FISH_COUNT = 18;
const SURFACE_SIZE = 10.8;
const START_CAMERA = new THREE.Vector3(8.5, 7.2, 10.5);
const END_CAMERA = new THREE.Vector3(0, 15, 0.001);

function createDecorativeSurface(): QrSurface {
  const gridSize = 29;
  const quietZone = 4;
  const cells = new Uint8Array(gridSize * gridSize);

  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      const inQuietZone =
        row < quietZone ||
        column < quietZone ||
        row >= gridSize - quietZone ||
        column >= gridSize - quietZone;
      const wave = Math.sin(row * 0.72) + Math.cos(column * 0.58) + Math.sin((row + column) * 0.31);
      cells[row * gridSize + column] = !inQuietZone && wave > 0.7 ? 1 : 0;
    }
  }

  return {
    moduleCount: gridSize - quietZone * 2,
    gridSize,
    quietZone,
    cells,
    isDark(row, column) {
      return cells[row * gridSize + column] === 1;
    },
  };
}

function createFishGeometry(): {
  body: THREE.BufferGeometry;
  tail: THREE.BufferGeometry;
  fin: THREE.BufferGeometry;
} {
  const body = new THREE.OctahedronGeometry(0.52, 0);
  body.scale(1.55, 0.68, 0.52);

  const tail = new THREE.ConeGeometry(0.46, 0.68, 3);
  tail.rotateZ(-Math.PI * 0.5);
  tail.translate(-0.94, 0, 0);

  const fin = new THREE.ConeGeometry(0.22, 0.45, 3);
  fin.translate(-0.05, 0.53, 0);

  return { body, tail, fin };
}

function createCoralCluster(
  materials: readonly THREE.Material[],
  x: number,
  z: number,
  rotation: number,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0.1, z);
  group.rotation.y = rotation;

  const branches = [
    { x: 0, height: 1.4, tilt: -0.1 },
    { x: -0.36, height: 0.95, tilt: -0.42 },
    { x: 0.34, height: 1.12, tilt: 0.38 },
  ];

  branches.forEach((branch, index) => {
    const geometry = new THREE.ConeGeometry(0.17 + index * 0.018, branch.height, 5);
    geometry.translate(0, branch.height * 0.5, 0);
    const mesh = new THREE.Mesh(geometry, materials[index % materials.length]);
    mesh.position.x = branch.x;
    mesh.rotation.z = branch.tilt;
    group.add(mesh);
  });

  return group;
}

function createKelpCluster(
  material: THREE.Material,
  x: number,
  z: number,
  count: number,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0.06, z);

  for (let index = 0; index < count; index += 1) {
    const height = 0.8 + (index % 3) * 0.36;
    const geometry = new THREE.ConeGeometry(0.13, height, 4);
    geometry.translate(0, height * 0.5, 0);
    const blade = new THREE.Mesh(geometry, material);
    blade.position.x = (index - (count - 1) * 0.5) * 0.22;
    blade.position.z = Math.sin(index * 2.4) * 0.18;
    blade.rotation.z = (index % 2 === 0 ? -1 : 1) * 0.08;
    group.add(blade);
  }

  return group;
}

export class AquariumScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera();
  private readonly surfaceRoot = new THREE.Group();
  private readonly fish: THREE.Group[] = [];
  private readonly reefRoot = new THREE.Group();
  private readonly lightShaftRoot = new THREE.Group();
  private readonly particles: THREE.Points;
  private readonly reusableCameraPosition = new THREE.Vector3();
  private readonly reusableModulePosition = new THREE.Vector3();
  private readonly reusableModuleRotation = new THREE.Euler();
  private readonly reusableModuleQuaternion = new THREE.Quaternion();
  private readonly reusableModuleScale = new THREE.Vector3();
  private readonly reusableModuleMatrix = new THREE.Matrix4();
  private cameraViewHeight = 2;
  private verticalViewOffset = 0;
  private surfaceModules: THREE.InstancedMesh | null = null;
  private surfaceGridSize = 0;
  private surfaceCellSize = 0;
  private surfaceDarkCells = new Uint8Array();
  private lastSurfaceProgress = Number.NaN;
  private revealFrame: RevealFrame = {
    phase: 'scattering',
    fishProgress: 0,
    cameraProgress: 0,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setClearColor(COLORS.deepWater, 1);

    this.scene.background = new THREE.Color(COLORS.deepWater);
    this.scene.fog = new THREE.FogExp2(COLORS.deepWater, 0.026);
    this.camera.near = 0.1;
    this.camera.far = 80;
    this.camera.up.set(0, 0, -1);

    this.scene.add(this.surfaceRoot);
    this.scene.add(this.reefRoot);
    this.addLights();
    this.addSeabed();
    this.addReef();
    this.addFish();
    this.particles = this.addParticles();
    this.addLightShafts();
    this.rebuildSurface(createDecorativeSurface(), DARK_REEF_COLORS, COLORS.decorativeLight);
    this.setRevealFrame(this.revealFrame);
  }

  setSurface(surface: QrSurface): void {
    this.rebuildSurface(surface, DARK_REEF_COLORS, COLORS.sand);
  }

  private rebuildSurface(
    surface: QrSurface,
    darkColors: readonly number[],
    lightColor: number,
  ): void {
    for (const child of [...this.surfaceRoot.children]) {
      this.surfaceRoot.remove(child);
      this.disposeObject(child);
    }

    const cellSize = SURFACE_SIZE / surface.gridSize;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      flatShading: true,
      roughness: 0.84,
    });
    const modules = new THREE.InstancedMesh(
      geometry,
      material,
      surface.gridSize * surface.gridSize,
    );
    const light = new THREE.Color(lightColor);
    const darkPalette = darkColors.map((color) => new THREE.Color(color));
    const darkCells = new Uint8Array(surface.gridSize * surface.gridSize);
    let instance = 0;

    for (let row = 0; row < surface.gridSize; row += 1) {
      for (let column = 0; column < surface.gridSize; column += 1) {
        const isDark = surface.isDark(row, column);
        darkCells[instance] = isDark ? 1 : 0;
        modules.setColorAt(
          instance,
          isDark
            ? darkPalette[((row * 5 + column * 3) % 7) % darkPalette.length]
            : light,
        );
        instance += 1;
      }
    }

    modules.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (modules.instanceColor) modules.instanceColor.needsUpdate = true;
    modules.frustumCulled = false;
    modules.name = 'qr-surface';
    this.surfaceRoot.add(modules);
    this.surfaceModules = modules;
    this.surfaceGridSize = surface.gridSize;
    this.surfaceCellSize = cellSize;
    this.surfaceDarkCells = darkCells;
    this.lastSurfaceProgress = Number.NaN;
    this.updateSurfaceModules(this.revealFrame.cameraProgress);
  }

  private updateSurfaceModules(progress: number): void {
    if (!this.surfaceModules || progress === this.lastSurfaceProgress) return;

    let instance = 0;

    for (let row = 0; row < this.surfaceGridSize; row += 1) {
      for (let column = 0; column < this.surfaceGridSize; column += 1) {
        const transform = getReefModuleTransform(
          row,
          column,
          this.surfaceGridSize,
          this.surfaceCellSize,
          this.surfaceDarkCells[instance] === 1,
          progress,
        );
        this.reusableModulePosition.set(
          transform.position.x,
          transform.position.y,
          transform.position.z,
        );
        this.reusableModuleRotation.set(
          transform.rotation.x,
          transform.rotation.y,
          transform.rotation.z,
        );
        this.reusableModuleQuaternion.setFromEuler(this.reusableModuleRotation);
        this.reusableModuleScale.set(
          transform.scale.x,
          transform.scale.y,
          transform.scale.z,
        );
        this.reusableModuleMatrix.compose(
          this.reusableModulePosition,
          this.reusableModuleQuaternion,
          this.reusableModuleScale,
        );
        this.surfaceModules.setMatrixAt(instance, this.reusableModuleMatrix);
        instance += 1;
      }
    }

    this.surfaceModules.instanceMatrix.needsUpdate = true;
    this.lastSurfaceProgress = progress;
  }

  setRevealFrame(frame: RevealFrame): void {
    this.revealFrame = frame;
    this.updateSurfaceModules(frame.cameraProgress);
    this.reefRoot.position.y = -frame.cameraProgress * 0.55;
    this.reefRoot.scale.y = Math.max(0.02, 1 - frame.cameraProgress);
    this.reefRoot.visible = frame.cameraProgress < 0.97;
    this.lightShaftRoot.visible = frame.cameraProgress < 0.94;
    this.particles.visible = frame.cameraProgress < 0.94;
  }

  resize(
    width: number,
    height: number,
    insets?: { top: number; bottom: number },
  ): void {
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const requestedTop = Math.max(0, insets?.top ?? 0);
    const requestedBottom = Math.max(0, insets?.bottom ?? 0);
    const requestedTotal = requestedTop + requestedBottom;
    const insetScale =
      requestedTotal > safeHeight - 1 ? (safeHeight - 1) / requestedTotal : 1;
    const topInset = requestedTop * insetScale;
    const bottomInset = requestedBottom * insetScale;
    const availableHeight = Math.max(1, safeHeight - topInset - bottomInset);
    const availableAspect = safeWidth / availableHeight;
    const shortestAxisSize = 13.8;
    const contentViewHeight =
      availableAspect < 1 ? shortestAxisSize / availableAspect : shortestAxisSize;
    const worldUnitsPerPixel = contentViewHeight / availableHeight;
    const viewHeight = worldUnitsPerPixel * safeHeight;
    const viewWidth = worldUnitsPerPixel * safeWidth;
    this.cameraViewHeight = viewHeight;
    this.verticalViewOffset = insets
      ? (topInset - bottomInset) * 0.5 * worldUnitsPerPixel
      : availableAspect < 0.75
        ? -3.7
        : 0;

    this.camera.left = -viewWidth * 0.5;
    this.camera.right = viewWidth * 0.5;
    this.updateCameraProjection();

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(safeWidth, safeHeight, false);
  }

  render(timeSeconds: number): void {
    this.updateFish(timeSeconds);
    this.updateCamera();
    this.particles.rotation.y = timeSeconds * 0.018;
    this.particles.position.y = Math.sin(timeSeconds * 0.32) * 0.14;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposeObject(this.scene);
    this.renderer.dispose();
  }

  private addLights(): void {
    const ambient = new THREE.HemisphereLight(COLORS.foam, COLORS.abyss, 2.3);
    const sun = new THREE.DirectionalLight(0xfff0c7, 3.6);
    sun.position.set(-5, 12, 7);
    this.scene.add(ambient, sun);
  }

  private addSeabed(): void {
    const geometry = new THREE.CylinderGeometry(7.9, 8.5, 0.72, 8);
    const material = new THREE.MeshStandardMaterial({
      color: 0xb99b67,
      flatShading: true,
      roughness: 0.96,
    });
    const seabed = new THREE.Mesh(geometry, material);
    seabed.position.y = -0.31;
    seabed.rotation.y = Math.PI * 0.125;
    this.scene.add(seabed);
  }

  private addReef(): void {
    const coralMaterials = [
      new THREE.MeshStandardMaterial({ color: COLORS.coral, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: COLORS.coralLight, flatShading: true }),
    ];
    const kelpMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.kelp,
      flatShading: true,
    });
    const kelpLightMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.kelpLight,
      flatShading: true,
    });
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x54756e,
      flatShading: true,
      roughness: 1,
    });

    this.reefRoot.add(createCoralCluster(coralMaterials, -6.1, 4.1, -0.45));
    this.reefRoot.add(createCoralCluster(coralMaterials, 6.25, -3.6, 0.58));
    this.reefRoot.add(createKelpCluster(kelpMaterial, 6.15, 3.75, 7));
    this.reefRoot.add(createKelpCluster(kelpLightMaterial, -6.25, -3.65, 6));

    for (let index = 0; index < 7; index += 1) {
      const geometry = new THREE.DodecahedronGeometry(0.38 + (index % 3) * 0.16, 0);
      const rock = new THREE.Mesh(geometry, rockMaterial);
      const angle = index * 1.87;
      const radius = 6.25 + (index % 2) * 0.55;
      rock.position.set(Math.cos(angle) * radius, 0.08, Math.sin(angle) * radius);
      rock.rotation.set(index * 0.21, angle, index * 0.13);
      rock.scale.y = 0.62;
      this.reefRoot.add(rock);
    }

    this.scene.add(this.reefRoot);
  }

  private addFish(): void {
    const geometries = createFishGeometry();
    const bodyMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x46d0b4, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0xf0b44f, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0xef7155, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x72d7c5, flatShading: true }),
    ];
    const tailMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.coralLight,
      flatShading: true,
    });
    const finMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.foam,
      flatShading: true,
    });

    for (let index = 0; index < FISH_COUNT; index += 1) {
      const fish = new THREE.Group();
      const body = new THREE.Mesh(geometries.body, bodyMaterials[index % bodyMaterials.length]);
      const tail = new THREE.Mesh(geometries.tail, tailMaterial);
      const fin = new THREE.Mesh(geometries.fin, finMaterial);
      fish.add(body, tail, fin);
      this.fish.push(fish);
      this.scene.add(fish);
    }
  }

  private addParticles(): THREE.Points {
    const count = 120;
    const positions = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.399;
      const radius = 2.5 + (index % 17) * 0.48;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = 0.8 + (index % 13) * 0.48;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: COLORS.foam,
      opacity: 0.42,
      size: 0.035,
      transparent: true,
      depthWrite: false,
    });
    const particles = new THREE.Points(geometry, material);
    this.scene.add(particles);
    return particles;
  }

  private addLightShafts(): void {
    const material = new THREE.MeshBasicMaterial({
      color: 0xa9edda,
      opacity: 0.055,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    for (let index = 0; index < 3; index += 1) {
      const geometry = new THREE.ConeGeometry(1.5 + index * 0.45, 11, 5, 1, true);
      const shaft = new THREE.Mesh(geometry, material);
      shaft.position.set(-5 + index * 4.8, 6.2, -3.5 + index * 1.1);
      shaft.rotation.z = -0.11 + index * 0.07;
      this.lightShaftRoot.add(shaft);
    }

    this.scene.add(this.lightShaftRoot);
  }

  private updateFish(timeSeconds: number): void {
    this.fish.forEach((fish, index) => {
      const transform = getFishTransform(
        index,
        timeSeconds,
        this.revealFrame.fishProgress,
      );
      fish.position.set(transform.x, transform.y, transform.z);
      fish.rotation.set(0, transform.heading, Math.sin(timeSeconds * 1.8 + index) * 0.04);
      fish.scale.setScalar(transform.scale);
      fish.visible = this.revealFrame.fishProgress < 0.985;
    });
  }

  private updateCamera(): void {
    this.reusableCameraPosition.lerpVectors(
      START_CAMERA,
      END_CAMERA,
      this.revealFrame.cameraProgress,
    );
    this.camera.position.copy(this.reusableCameraPosition);
    this.camera.zoom = THREE.MathUtils.lerp(0.88, 1.2, this.revealFrame.cameraProgress);
    this.camera.lookAt(0, 0, 0);
    this.updateCameraProjection();
  }

  private updateCameraProjection(): void {
    const projectionCenter = this.verticalViewOffset / this.camera.zoom;
    this.camera.top = projectionCenter + this.cameraViewHeight * 0.5;
    this.camera.bottom = projectionCenter - this.cameraViewHeight * 0.5;
    this.camera.updateProjectionMatrix();
  }

  private disposeObject(root: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();

    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) return;
      if (object instanceof THREE.InstancedMesh) object.dispose();
      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      objectMaterials.forEach((material) => materials.add(material));
    });

    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }
}
