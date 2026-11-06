import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";
import { ACCESSORIES, CUBE_COLORS, STORAGE_KEYS } from "./shop-data.js";

const previewStage = document.querySelector("#preview-stage");
const loadingMessage = document.querySelector("#preview-loading");
const walletElement = document.querySelector("#wallet");
const colorOptions = document.querySelector("#color-options");
const accessoryList = document.querySelector("#accessory-list");
const statusMessage = document.querySelector("#shop-status");
const previewCaption = document.querySelector("#preview-caption");

let renderer;
let cubeMaterial;
let runnerPreview;
let accessoryGroup;
let selectedColor = localStorage.getItem(STORAGE_KEYS.cubeColor) || CUBE_COLORS[0].id;
let equippedAccessory = localStorage.getItem(STORAGE_KEYS.equippedAccessory) || "";
let walletBalance = Number(localStorage.getItem(STORAGE_KEYS.coins) || 0);
let ownedAccessories = readOwnedAccessories();

function readOwnedAccessories() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.accessories) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((id) => ACCESSORIES.some((accessory) => accessory.id === id));
  } catch (error) {
    console.error("Could not read owned runner accessories:", error);
    return [];
  }
}

function createAccessory(id, parent, material) {
  if (id === "cap") {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.1, 24), material);
    brim.position.y = 1.31;
    parent.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.48, 20), material);
    crown.position.y = 1.57;
    parent.add(crown);
  } else if (id === "headphones") {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.57, 0.08, 10, 28, Math.PI), material);
    band.rotation.z = Math.PI;
    band.position.set(0, 1.1, 0);
    parent.add(band);
    for (const x of [-0.57, 0.57]) {
      const ear = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.43, 0.22),
        new THREE.MeshStandardMaterial({ color: 0x26304f, roughness: 0.38 }),
      );
      ear.position.set(x, 0.91, 0);
      parent.add(ear);
    }
  } else if (id === "crown") {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.61, 0.57, 0.2, 5), material);
    base.position.y = 1.34;
    parent.add(base);
    for (let point = 0; point < 5; point += 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.38, 4), material);
      const angle = (point / 5) * Math.PI * 2;
      spike.position.set(Math.cos(angle) * 0.43, 1.6, Math.sin(angle) * 0.43);
      parent.add(spike);
    }
  }
}

function updatePreviewAccessory() {
  if (!accessoryGroup) return;
  accessoryGroup.traverse((child) => {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
    else child.material?.dispose();
  });
  accessoryGroup.clear();
  if (!ownedAccessories.includes(equippedAccessory)) {
    equippedAccessory = "";
    localStorage.removeItem(STORAGE_KEYS.equippedAccessory);
  }
  if (!equippedAccessory) {
    previewCaption.textContent = "Your runner, your style.";
    return;
  }
  const accent = new THREE.MeshStandardMaterial({
    color: 0xffd84d,
    emissive: 0x69400a,
    emissiveIntensity: 0.4,
    roughness: 0.34,
  });
  createAccessory(equippedAccessory, accessoryGroup, accent);
  const item = ACCESSORIES.find((accessory) => accessory.id === equippedAccessory);
  previewCaption.textContent = `${item.name} equipped — ready to run.`;
}

function buildPreview() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b2545);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  camera.position.set(3.1, 2.8, 5.2);
  camera.lookAt(0, 0.8, 0);

  const rendererInstance = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  rendererInstance.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  rendererInstance.outputColorSpace = THREE.SRGBColorSpace;
  rendererInstance.toneMapping = THREE.ACESFilmicToneMapping;
  rendererInstance.toneMappingExposure = 1.2;
  previewStage.append(rendererInstance.domElement);
  renderer = rendererInstance;

  scene.add(new THREE.HemisphereLight(0xdce5ff, 0x34304b, 2.2));
  const keyLight = new THREE.DirectionalLight(0xfff0cf, 3);
  keyLight.position.set(-4, 7, 5);
  scene.add(keyLight);

  const cubeColor = CUBE_COLORS.find((color) => color.id === selectedColor) || CUBE_COLORS[0];
  cubeMaterial = new THREE.MeshStandardMaterial({
    color: cubeColor.value,
    emissive: cubeColor.value,
    emissiveIntensity: 0.12,
    roughness: 0.34,
  });
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.35, 1.35), cubeMaterial);
  cube.position.y = 0.7;
  cube.castShadow = true;

  runnerPreview = new THREE.Group();
  runnerPreview.add(cube);
  accessoryGroup = new THREE.Group();
  runnerPreview.add(accessoryGroup);
  scene.add(runnerPreview);
  updatePreviewAccessory();

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.3, 48),
    new THREE.MeshStandardMaterial({ color: 0x303b63, roughness: 0.86 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  scene.add(ground);

  const clock = new THREE.Clock();
  function render() {
    requestAnimationFrame(render);
    const elapsed = clock.getElapsedTime();
    runnerPreview.rotation.y = Math.sin(elapsed * 0.7) * 0.12;
    runnerPreview.rotation.x = Math.sin(elapsed * 0.5) * 0.035;
    renderer.render(scene, camera);
  }

  function resize() {
    const { width, height } = previewStage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();
  loadingMessage.classList.add("is-hidden");
  render();
}

function renderColorChoices() {
  colorOptions.replaceChildren();
  CUBE_COLORS.forEach((color) => {
    const button = document.createElement("button");
    button.className = "color-choice";
    button.type = "button";
    button.setAttribute("aria-label", `${color.name} cube color`);
    button.setAttribute("aria-pressed", String(color.id === selectedColor));
    button.style.setProperty("--swatch-color", color.css);

    const swatch = document.createElement("span");
    swatch.className = "color-swatch";
    const label = document.createElement("span");
    label.textContent = color.name;
    button.append(swatch, label);
    button.addEventListener("click", () => {
      selectedColor = color.id;
      localStorage.setItem(STORAGE_KEYS.cubeColor, color.id);
      cubeMaterial.color.setHex(color.value);
      cubeMaterial.emissive.setHex(color.value);
      renderColorChoices();
      statusMessage.textContent = `${color.name} color saved.`;
    });
    colorOptions.append(button);
  });
}

function renderAccessories() {
  accessoryList.replaceChildren();
  ACCESSORIES.forEach((accessory) => {
    const owned = ownedAccessories.includes(accessory.id);
    const equipped = equippedAccessory === accessory.id;
    const card = document.createElement("article");
    card.className = "accessory-card";

    const icon = document.createElement("span");
    icon.className = "accessory-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = accessory.icon;

    const info = document.createElement("span");
    info.className = "accessory-info";
    const title = document.createElement("strong");
    title.textContent = accessory.name;
    const description = document.createElement("small");
    description.textContent = accessory.description;
    info.append(title, description);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "accessory-button";
    button.textContent = equipped ? "EQUIPPED" : owned ? "EQUIP" : `● ${accessory.price}`;
    button.disabled = equipped;
    button.setAttribute("aria-label", equipped
      ? `${accessory.name} equipped`
      : owned
        ? `Equip ${accessory.name}`
        : `Buy ${accessory.name} for ${accessory.price} coins`);
    button.addEventListener("click", () => {
      if (owned) {
        equippedAccessory = accessory.id;
        localStorage.setItem(STORAGE_KEYS.equippedAccessory, equippedAccessory);
        statusMessage.textContent = `${accessory.name} equipped.`;
      } else if (walletBalance >= accessory.price) {
        walletBalance -= accessory.price;
        ownedAccessories = [...ownedAccessories, accessory.id];
        equippedAccessory = accessory.id;
        localStorage.setItem(STORAGE_KEYS.coins, String(walletBalance));
        localStorage.setItem(STORAGE_KEYS.accessories, JSON.stringify(ownedAccessories));
        localStorage.setItem(STORAGE_KEYS.equippedAccessory, equippedAccessory);
        statusMessage.textContent = `${accessory.name} purchased and equipped!`;
        updateWallet();
      } else {
        statusMessage.textContent = `Collect ${accessory.price - walletBalance} more coins to buy ${accessory.name}.`;
      }
      updatePreviewAccessory();
      renderAccessories();
    });

    card.append(icon, info, button);
    accessoryList.append(card);
  });
}

function updateWallet() {
  walletElement.textContent = String(walletBalance);
}

try {
  updateWallet();
  buildPreview();
  renderColorChoices();
  renderAccessories();
} catch (error) {
  loadingMessage.classList.remove("is-hidden");
  loadingMessage.textContent = "Could not load the shop preview. Refresh and try again.";
  console.error("Runner shop failed to initialize:", error);
}
