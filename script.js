import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";
import { ACCESSORIES, CUBE_COLORS, STORAGE_KEYS } from "./shop-data.js";

const canvasWrap = document.querySelector("#canvas-wrap");
const loadMessage = document.querySelector("#load-message");
const overlay = document.querySelector("#overlay");
const overlayKicker = document.querySelector("#overlay-kicker");
const overlayIcon = document.querySelector("#overlay-icon");
const overlayTitle = document.querySelector("#overlay-title");
const overlayMessage = document.querySelector("#overlay-message");
const playButton = document.querySelector("#play-button");
const scoreElement = document.querySelector("#score");
const speedElement = document.querySelector("#speed");
const bestScoreElement = document.querySelector("#best-score");
const walletElement = document.querySelector("#wallet");
const laneIndicators = [...document.querySelectorAll(".lane-indicator span")];
const toast = document.querySelector("#toast");

const LANES = [-2.4, 0, 2.4];
const PLAYER_Z = 3.5;
const ROAD_LENGTH = 100;
const COIN_VALUE = 25;
const obstacleColors = [0xff4b8b, 0xffb84a, 0x7d69ff];
const buildingColors = [0x414b7a, 0x47588a, 0x63517d, 0x3e6278];
const BEST_SCORE_KEY = "neon-dash-best-score";
const STARTING_CUBE_COLOR = "lime";
const clock = new THREE.Clock();

let renderer;
let scene;
let camera;
let playerGroup;
let player;
let playerShadow;
let playerAccessory;
let hazards = [];
let coins = [];
let cityObjects = [];
let lane = 1;
let targetLane = 1;
let jumpVelocity = 0;
let jumpHeight = 0;
let score = 0;
let distance = 0;
let coinCount = 0;
let walletBalance = Number(localStorage.getItem(STORAGE_KEYS.coins) || 0);
let bestScore = Number(localStorage.getItem(BEST_SCORE_KEY) || 0);
let speed = 15;
let spawnDistance = 30;
let gameState = "ready";
let toastTimeout;
let lastWaveWasFull = false;

bestScoreElement.textContent = String(bestScore).padStart(4, "0");
walletElement.textContent = String(walletBalance);

function makeMaterial(color, roughness = 0.72, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, ...extra });
}

function addBox(parent, size, position, material, castShadow = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function buildScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x151d39);
  scene.fog = new THREE.Fog(0x151d39, 28, 90);

  camera = new THREE.PerspectiveCamera(54, 1, 0.1, 130);
  camera.position.set(0, 6.7, 11.5);
  camera.lookAt(0, 1.1, -8);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  canvasWrap.append(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xb7caff, 0x31304c, 2.1));

  const keyLight = new THREE.DirectionalLight(0xfff0cf, 3);
  keyLight.position.set(-5, 12, 8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -12;
  keyLight.shadow.camera.right = 12;
  keyLight.shadow.camera.top = 18;
  keyLight.shadow.camera.bottom = -18;
  scene.add(keyLight);

  const pinkLight = new THREE.PointLight(0xff4b8b, 25, 30);
  pinkLight.position.set(-7, 5, -12);
  scene.add(pinkLight);
  const blueLight = new THREE.PointLight(0x5b70ff, 28, 35);
  blueLight.position.set(7, 4, -25);
  scene.add(blueLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, ROAD_LENGTH),
    makeMaterial(0x242b50, 0.92),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.12, -38);
  ground.receiveShadow = true;
  scene.add(ground);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(9.4, ROAD_LENGTH),
    makeMaterial(0x30375e, 0.84),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -0.1, -38);
  road.receiveShadow = true;
  scene.add(road);

  const edgeMaterial = makeMaterial(0xd7ff70, 0.45, {
    emissive: 0x637b25,
    emissiveIntensity: 0.35,
  });
  for (const x of [-4.6, 4.6]) {
    const rail = addBox(scene, [0.09, 0.045, ROAD_LENGTH], [x, -0.055, -38], edgeMaterial);
    rail.receiveShadow = false;
  }

  const dividerMaterial = makeMaterial(0x8c9add, 0.6, {
    emissive: 0x222954,
    emissiveIntensity: 0.3,
  });
  for (const x of [-1.6, 1.6]) {
    for (let z = -82; z < 12; z += 5) {
      const marker = addBox(scene, [0.035, 0.025, 2.25], [x, -0.04, z], dividerMaterial);
      marker.userData.trackMarker = true;
    }
  }

  buildCity();

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = [];
  for (let i = 0; i < 180; i += 1) {
    starPositions.push((Math.random() - 0.5) * 90, 8 + Math.random() * 28, -Math.random() * 105);
  }
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: 0xc3ceff, size: 0.12, transparent: true, opacity: 0.75 }),
  );
  scene.add(stars);

  playerGroup = new THREE.Group();
  playerGroup.position.set(LANES[1], 0, PLAYER_Z);
  scene.add(playerGroup);

  const savedColorId = localStorage.getItem(STORAGE_KEYS.cubeColor) || STARTING_CUBE_COLOR;
  const cubeColor = CUBE_COLORS.find((color) => color.id === savedColorId) || CUBE_COLORS[0];
  const playerMaterial = makeMaterial(cubeColor.value, 0.34, {
    emissive: cubeColor.value,
    emissiveIntensity: 0.42,
  });
  player = addBox(playerGroup, [1.12, 1.12, 1.12], [0, 0.56, 0], playerMaterial, true);

  const topAccent = addBox(
    playerGroup,
    [0.62, 0.13, 0.64],
    [0, 1.19, -0.02],
    makeMaterial(0xf4ffcb, 0.3),
    true,
  );
  topAccent.castShadow = false;

  const eyeMaterial = makeMaterial(0x18213c, 0.25);
  addBox(playerGroup, [0.12, 0.15, 0.045], [-0.23, 0.64, 0.57], eyeMaterial);
  addBox(playerGroup, [0.12, 0.15, 0.045], [0.23, 0.64, 0.57], eyeMaterial);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.82, 32),
    new THREE.MeshBasicMaterial({ color: 0x090d20, transparent: true, opacity: 0.35 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(LANES[1], -0.045, PLAYER_Z);
  scene.add(shadow);
  playerShadow = shadow;
  applyAccessory(localStorage.getItem(STORAGE_KEYS.equippedAccessory));

  resizeRenderer();
  window.addEventListener("resize", resizeRenderer);
  loadMessage.classList.add("is-hidden");
}

function applyAccessory(accessoryId) {
  if (!playerGroup) return;
  if (playerAccessory) {
    playerGroup.remove(playerAccessory);
    playerAccessory.traverse((child) => {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
      else child.material?.dispose();
    });
    playerAccessory = null;
  }
  if (!ACCESSORIES.some((accessory) => accessory.id === accessoryId)) return;

  playerAccessory = new THREE.Group();
  const darkMaterial = makeMaterial(0x26304f, 0.38);
  const accentMaterial = makeMaterial(0xffd84d, 0.34, { emissive: 0x69400a, emissiveIntensity: 0.4 });

  if (accessoryId === "cap") {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.1, 24), accentMaterial);
    brim.position.y = 1.31;
    playerAccessory.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.48, 20), accentMaterial);
    crown.position.y = 1.57;
    playerAccessory.add(crown);
  } else if (accessoryId === "headphones") {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.57, 0.08, 10, 28, Math.PI), accentMaterial);
    band.rotation.z = Math.PI;
    band.position.set(0, 1.1, 0);
    playerAccessory.add(band);
    for (const x of [-0.57, 0.57]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.43, 0.22), darkMaterial);
      ear.position.set(x, 0.91, 0);
      playerAccessory.add(ear);
    }
  } else if (accessoryId === "crown") {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.61, 0.57, 0.2, 5), accentMaterial);
    base.position.y = 1.34;
    playerAccessory.add(base);
    for (let point = 0; point < 5; point += 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.38, 4), accentMaterial);
      const angle = (point / 5) * Math.PI * 2;
      spike.position.set(Math.cos(angle) * 0.43, 1.6, Math.sin(angle) * 0.43);
      playerAccessory.add(spike);
    }
  }

  playerAccessory.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
  });
  playerGroup.add(playerAccessory);
}

function buildCity() {
  const windowMaterial = makeMaterial(0xffdf8a, 0.3, {
    emissive: 0x75521d,
    emissiveIntensity: 0.65,
  });
  const treeMaterials = [
    makeMaterial(0x48bd91, 0.82),
    makeMaterial(0x61ce9b, 0.82),
    makeMaterial(0x379b83, 0.82),
  ];

  for (let index = 0; index < 18; index += 1) {
    for (const side of [-1, 1]) {
      const group = new THREE.Group();
      const z = 10 - index * 6;
      const x = side * (7.6 + Math.random() * 2.8);

      if (index % 3 === 1) {
        const trunk = addBox(group, [0.28, 1.35, 0.28], [0, 0.56, 0], makeMaterial(0x8c6042));
        trunk.castShadow = true;
        const crown = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.82, 1),
          treeMaterials[index % treeMaterials.length],
        );
        crown.position.y = 1.6;
        crown.castShadow = true;
        group.add(crown);
      } else {
        const width = 2.4 + Math.random() * 1.8;
        const depth = 2.2 + Math.random() * 1.8;
        const height = 4.5 + Math.random() * 7;
        const building = addBox(
          group,
          [width, height, depth],
          [0, height / 2 - 0.12, 0],
          makeMaterial(buildingColors[index % buildingColors.length], 0.88),
          true,
        );
        building.castShadow = true;
        const roof = addBox(
          group,
          [width * 0.82, 0.16, depth * 0.82],
          [0, height - 0.08, 0],
          makeMaterial(0x858eb6, 0.72),
        );
        roof.castShadow = false;

        const facing = side < 0 ? 1 : -1;
        for (let floor = 0; floor < Math.floor(height / 1.35); floor += 1) {
          for (let column = -1; column <= 1; column += 1) {
            const window = addBox(
              group,
              [0.34, 0.48, 0.045],
              [column * width * 0.27, 0.8 + floor * 1.22, facing * (depth / 2 + 0.025)],
              windowMaterial,
            );
            window.castShadow = false;
          }
        }
      }

      group.position.set(x, 0, z);
      scene.add(group);
      cityObjects.push(group);
    }
  }
}

function resizeRenderer() {
  if (!renderer || !camera) return;
  const { width, height } = canvasWrap.getBoundingClientRect();
  if (width === 0 || height === 0) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function createObstacle(laneIndex, z) {
  const group = new THREE.Group();
  group.position.set(LANES[laneIndex], 0, z);
  const color = obstacleColors[Math.floor(Math.random() * obstacleColors.length)];
  const material = makeMaterial(color, 0.38, {
    emissive: color,
    emissiveIntensity: 0.13,
  });
  const obstacle = addBox(group, [1.18, 1.18, 1.18], [0, 0.59, 0], material, true);
  obstacle.rotation.y = Math.PI / 4;

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.14, 0.46),
    makeMaterial(0xffffff, 0.3, { emissive: color, emissiveIntensity: 0.24 }),
  );
  top.position.set(0, 1.24, 0);
  top.castShadow = true;
  group.add(top);

  group.userData = { lane: laneIndex, passed: false };
  scene.add(group);
  hazards.push(group);
}

function createCoin(laneIndex, z) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffd84d,
    emissive: 0xa96408,
    emissiveIntensity: 0.85,
    metalness: 0.68,
    roughness: 0.25,
  });
  const coin = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.13, 10, 22), material);
  coin.position.set(LANES[laneIndex], 1.35, z);
  coin.castShadow = true;
  coin.userData = { lane: laneIndex, collected: false };
  scene.add(coin);
  coins.push(coin);
}

function shuffledLanes() {
  const lanes = [0, 1, 2];
  for (let index = lanes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [lanes[index], lanes[swapIndex]] = [lanes[swapIndex], lanes[index]];
  }
  return lanes;
}

function createPattern(z) {
  const difficulty = THREE.MathUtils.clamp(distance / 900, 0, 1);
  const coinChance = THREE.MathUtils.lerp(0.34, 0.18, difficulty);
  if (Math.random() < coinChance) {
    const coinLane = Math.floor(Math.random() * LANES.length);
    for (let index = 0; index < 5; index += 1) {
      createCoin(coinLane, z - index * 2.3);
    }
    lastWaveWasFull = false;
    return;
  }

  const fullRowChance = THREE.MathUtils.lerp(0.03, 0.1, difficulty);
  const twoLaneChance = THREE.MathUtils.lerp(0.22, 0.56, difficulty);
  const roll = Math.random();
  const obstacleCount = roll < fullRowChance && !lastWaveWasFull
    ? 3
    : roll < fullRowChance + twoLaneChance || lastWaveWasFull
      ? 2
      : 1;
  shuffledLanes().slice(0, obstacleCount).forEach((laneIndex) => createObstacle(laneIndex, z));
  lastWaveWasFull = obstacleCount === LANES.length;
}

function removeFromScene(object) {
  scene.remove(object);
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose());
    } else {
      child.material?.dispose();
    }
  });
}

function resetGame() {
  hazards.forEach(removeFromScene);
  coins.forEach(removeFromScene);
  hazards = [];
  coins = [];
  lane = 1;
  targetLane = 1;
  laneIndicators.forEach((indicator, index) => {
    indicator.classList.toggle("is-current", index === lane);
  });
  score = 0;
  distance = 0;
  coinCount = 0;
  speed = 15;
  spawnDistance = speed * 2.1;
  lastWaveWasFull = false;
  jumpVelocity = 0;
  jumpHeight = 0;
  playerGroup.position.set(LANES[1], 0, PLAYER_Z);
  player.position.set(0, 0.56, 0);
  player.rotation.set(0, 0, 0);
  playerShadow.scale.setScalar(1);
  playerShadow.material.opacity = 0.35;
  playerShadow.position.x = LANES[1];
  updateScore();
  createCoin(1, -22);
  createCoin(1, -24.3);
  createCoin(1, -26.6);
  shuffledLanes().slice(0, 2).forEach((laneIndex, index) => {
    createObstacle(laneIndex, -53 - index * 27);
  });
  gameState = "running";
  overlay.classList.add("is-hidden");
  clock.getDelta();
}

function updateScore() {
  scoreElement.textContent = String(Math.floor(score)).padStart(4, "0");
  speedElement.textContent = `${(speed / 15).toFixed(1)}x`;
}

function moveLane(direction) {
  if (gameState !== "running") return;
  targetLane = THREE.MathUtils.clamp(targetLane + direction, 0, LANES.length - 1);
  lane = targetLane;
  laneIndicators.forEach((indicator, index) => {
    indicator.classList.toggle("is-current", index === lane);
  });
}

function jump() {
  if (gameState !== "running" || jumpHeight > 0.05) return;
  jumpVelocity = 9.2;
}

function endGame() {
  if (gameState !== "running") return;
  gameState = "over";
  const finalScore = Math.floor(score);
  const isNewBest = finalScore > bestScore;
  if (isNewBest) {
    bestScore = finalScore;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
    bestScoreElement.textContent = String(bestScore).padStart(4, "0");
  }
  overlayKicker.textContent = isNewBest ? "NEW PERSONAL BEST!" : "RUN COMPLETE";
  overlayIcon.textContent = isNewBest ? "🏆" : "💥";
  overlayTitle.textContent = "Nice run!";
  overlayMessage.textContent = `Score ${finalScore} · ${coinCount} coin${coinCount === 1 ? "" : "s"} collected. ${isNewBest ? "That’s your new best — can you top it?" : "Ready to give it another go?"}`;
  playButton.innerHTML = 'RUN IT BACK <span aria-hidden="true">→</span>';
  overlay.classList.remove("is-hidden");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 1050);
}

function updateTrack(delta) {
  for (const item of scene.children) {
    if (item.userData.trackMarker) {
      item.position.z += speed * delta;
      if (item.position.z > 14) item.position.z -= ROAD_LENGTH;
    }
  }
}

function updateCity(delta) {
  for (const object of cityObjects) {
    object.position.z += speed * delta;
    if (object.position.z > 14) {
      object.position.z -= ROAD_LENGTH;
      object.position.x = Math.sign(object.position.x) * (7.6 + Math.random() * 2.8);
    }
  }
}

function updateHazards(delta) {
  for (const hazard of hazards) {
    hazard.position.z += speed * delta;
    hazard.rotation.y += delta * 0.55;

    const withinCollisionDepth = Math.abs(hazard.position.z - PLAYER_Z) <= 1.1;
    if (!hazard.userData.passed && withinCollisionDepth) {
      const overlapsLane = Math.abs(playerGroup.position.x - hazard.position.x) < 1.4;
      if (overlapsLane && jumpHeight < 1.38) {
        endGame();
        return;
      }
    }
    if (hazard.position.z > PLAYER_Z + 1.1) hazard.userData.passed = true;
  }

  hazards = hazards.filter((hazard) => {
    if (hazard.position.z > PLAYER_Z + 6) {
      removeFromScene(hazard);
      return false;
    }
    return true;
  });

  spawnDistance -= speed * delta;
  if (spawnDistance <= 0) {
    createPattern(-82);
    const difficulty = THREE.MathUtils.clamp(distance / 900, 0, 1);
    const waveInterval = THREE.MathUtils.lerp(2.1, 1.15, difficulty);
    spawnDistance = speed * THREE.MathUtils.randFloat(waveInterval * 0.92, waveInterval * 1.08);
  }
}

function updateCoins(delta) {
  for (const coin of coins) {
    coin.position.z += speed * delta;
    coin.rotation.y += delta * 3.5;
    coin.position.y = 1.35 + Math.sin(performance.now() * 0.004 + coin.position.z) * 0.09;

    if (
      !coin.userData.collected
      && Math.abs(playerGroup.position.x - coin.position.x) < 0.95
      && Math.abs(coin.position.z - PLAYER_Z) < 1.25
    ) {
      coin.userData.collected = true;
      coinCount += 1;
      walletBalance += 1;
      localStorage.setItem(STORAGE_KEYS.coins, String(walletBalance));
      walletElement.textContent = String(walletBalance);
      score += COIN_VALUE;
      showToast(`COIN +${COIN_VALUE}`);
      removeFromScene(coin);
    }
  }

  coins = coins.filter((coin) => {
    if (coin.userData.collected) return false;
    if (coin.position.z > PLAYER_Z + 6) {
      removeFromScene(coin);
      return false;
    }
    return true;
  });
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.04);

  if (gameState === "running") {
    distance += speed * delta * 0.55;
    score = Math.floor(distance) + coinCount * COIN_VALUE;
    speed = Math.min(33, 15 + distance * 0.018);

    playerGroup.position.x = THREE.MathUtils.damp(playerGroup.position.x, LANES[targetLane], 13, delta);
    player.rotation.z = THREE.MathUtils.damp(
      player.rotation.z,
      (LANES[targetLane] - playerGroup.position.x) * -0.12,
      10,
      delta,
    );
    if (jumpHeight > 0 || jumpVelocity > 0) {
      jumpHeight += jumpVelocity * delta;
      jumpVelocity -= 24 * delta;
      if (jumpHeight <= 0) {
        jumpHeight = 0;
        jumpVelocity = 0;
      }
    }
    playerGroup.position.y = jumpHeight;
    player.rotation.x = THREE.MathUtils.damp(player.rotation.x, jumpHeight * 0.13, 7, delta);
    if (jumpHeight === 0) player.position.y = 0.56 + Math.sin(performance.now() * 0.009) * 0.012;

    playerShadow.position.x = playerGroup.position.x;
    const shadowScale = 1 - Math.min(jumpHeight, 1.8) * 0.18;
    playerShadow.scale.setScalar(shadowScale);
    playerShadow.material.opacity = 0.35 - Math.min(jumpHeight, 1.8) * 0.1;

    updateTrack(delta);
    updateCity(delta);
    updateHazards(delta);
    if (gameState === "running") updateCoins(delta);
    updateScore();
  } else if (player) {
    playerGroup.position.y = Math.sin(performance.now() * 0.002) * 0.04;
    player.rotation.y = Math.sin(performance.now() * 0.001) * 0.08;
  }

  if (renderer && scene && camera) renderer.render(scene, camera);
}

function onKeyDown(event) {
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", " "];
  if (keys.includes(event.key)) event.preventDefault();

  if (gameState === "ready" && (event.key === " " || event.key === "ArrowUp" || event.key === "Enter")) {
    resetGame();
    return;
  }
  if (gameState !== "running") return;
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") moveLane(-1);
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") moveLane(1);
  if (event.key === "ArrowUp" || event.key === " ") jump();
}

playButton.addEventListener("click", resetGame);
window.addEventListener("keydown", onKeyDown);
document.querySelector("#left-button").addEventListener("click", () => moveLane(-1));
document.querySelector("#right-button").addEventListener("click", () => moveLane(1));
document.querySelector("#jump-button").addEventListener("click", jump);

try {
  buildScene();
  animate();
} catch (error) {
  loadMessage.classList.remove("is-hidden");
  loadMessage.textContent = "Could not load the 3D game. Check your connection and refresh.";
  console.error("Neon Dash failed to initialize:", error);
}
