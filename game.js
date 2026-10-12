
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const goldText = document.getElementById("gold");
const shopGold = document.getElementById("shopGold");
const finalGold = document.getElementById("finalGold");

const mainMenu = document.getElementById("mainMenu");
const shopScreen = document.getElementById("shopScreen");
const gameOverScreen = document.getElementById("gameOver");
const controls = document.getElementById("controls");
const hud = document.getElementById("hud");

// Images are stored in the repository root.
const files = {
  road: "Road1.png",
  car: "Car1.png",
  zombie0: "Zombie1.png",
  zombie1: "Zombie2.png",
  zombie2: "Zombie3.png"
};

const images = {};

for (const [key, filename] of Object.entries(files)) {
  const img = new Image();
  img.src = filename;
  images[key] = img;
}

let W = 0;
let H = 0;
let running = false;
let animationId = null;
let lastTime = 0;
let gold = 0;
let roadOffset = 0;
let zombies = [];
let bullets = [];
let playerLane = 1;
let shootCooldown = 0;

const player = {
  y: 0,
  width: 0,
  height: 0
};

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  W = window.innerWidth;
  H = window.innerHeight;

  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);

  canvas.style.width = W + "px";
  canvas.style.height = H + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  player.width = Math.min(W * 0.17, 95);
  player.height = player.width * 1.35;
  player.y = H * 0.70;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function roadBounds() {
  const roadWidth = W * 0.84;
  return {
    x: (W - roadWidth) / 2,
    width: roadWidth,
    laneWidth: roadWidth / 3
  };
}

function laneCenter(lane) {
  const road = roadBounds();
  return road.x + road.laneWidth * lane + road.laneWidth / 2;
}

function drawImageCover(img, x, y, width, height) {
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x, y, width, height);
  }
}

function drawRoad(delta) {
  const road = roadBounds();

  if (images.road.complete && images.road.naturalWidth > 0) {
    const img = images.road;
    const tileHeight = Math.max(H * 0.8, 250);
    roadOffset = (roadOffset + delta * 0.12) % tileHeight;

    ctx.save();
    ctx.beginPath();
    ctx.rect(road.x, 0, road.width, H);
    ctx.clip();

    for (let y = -tileHeight + roadOffset; y < H; y += tileHeight) {
      ctx.drawImage(img, road.x, y, road.width, tileHeight);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = "#47653b";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#555";
    ctx.fillRect(road.x, 0, road.width, H);
  }

  // Three-lane markings.
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 3;
  ctx.setLineDash([28, 24]);

  for (let i = 1; i <= 2; i++) {
    const x = road.x + road.laneWidth * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  ctx.restore();
}

function makeZombies() {
  // Two zombies occupy two different lanes; one lane remains empty.
  const lanes = [0, 2];

  zombies = lanes.map((lane, index) => ({
    lane,
    y: H * (index === 0 ? 0.16 : 0.32),
    type: index,
    width: Math.min(roadBounds().laneWidth * 0.9, 100),
    height: Math.min(roadBounds().laneWidth * 1.05, 115),
    alive: true
  }));
}

function drawZombie(zombie) {
  const img = images["zombie" + zombie.type];
  const x = laneCenter(zombie.lane) - zombie.width / 2;

  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x, zombie.y, zombie.width, zombie.height);
  } else {
    ctx.fillStyle = "#68b34a";
    ctx.fillRect(x, zombie.y, zombie.width, zombie.height);
    ctx.fillStyle = "#fff";
    ctx.fillText("Z", x + zombie.width / 2, zombie.y + zombie.height / 2);
  }
}

function drawPlayer() {
  const x = laneCenter(playerLane) - player.width / 2;

  if (images.car.complete && images.car.naturalWidth > 0) {
    ctx.drawImage(images.car, x, player.y, player.width, player.height);
  } else {
    ctx.fillStyle = "#e4c33b";
    ctx.fillRect(x, player.y, player.width, player.height);
  }
}

function drawBullets() {
  ctx.fillStyle = "#ffec70";

  for (const bullet of bullets) {
    ctx.fillRect(bullet.x - 3, bullet.y, 6, 18);
  }
}

function update(delta) {
  roadOffset += delta * 0.12;
  shootCooldown = Math.max(0, shootCooldown - delta);

  for (const zombie of zombies) {
    if (!zombie.alive) continue;

    zombie.y += delta * 0.025;

    if (zombie.y + zombie.height >= player.y) {
      endGame();
      return;
    }
  }

  for (const bullet of bullets) {
    bullet.y -= delta * 0.65;

    const target = zombies.find(zombie =>
      zombie.alive &&
      zombie.lane === bullet.lane &&
      zombie.y < bullet.y &&
      zombie.y + zombie.height > bullet.y - 30
    );

    if (target) {
      target.alive = false;
      bullet.hit = true;
      gold += 10;
      goldText.textContent = gold;
    }
  }

  bullets = bullets.filter(bullet => bullet.y > -30 && !bullet.hit);

  // Spawn a replacement in the same lane after a zombie is killed.
  for (let i = 0; i < zombies.length; i++) {
    if (!zombies[i].alive) {
      const lane = zombies[i].lane;
      const type = Math.floor(Math.random() * 3);

      zombies[i] = {
        lane,
        y: -120,
        type,
        width: Math.min(roadBounds().laneWidth * 0.9, 100),
        height: Math.min(roadBounds().laneWidth * 1.05, 115),
        alive: true
      };
    }
  }
}

function draw(delta) {
  ctx.clearRect(0, 0, W, H);

  drawRoad(delta);

  for (const zombie of zombies) {
    if (zombie.alive) drawZombie(zombie);
  }

  drawBullets();
  drawPlayer();
}

function gameLoop(timestamp) {
  if (!running) return;

  const delta = Math.min(timestamp - (lastTime || timestamp), 40);
  lastTime = timestamp;

  update(delta);
  draw(delta);

  if (running) {
    animationId = requestAnimationFrame(gameLoop);
  }
}

function startGame() {
  if (animationId) cancelAnimationFrame(animationId);

  gold = 0;
  goldText.textContent = "0";
  playerLane = 1;
  bullets = [];
  roadOffset = 0;
  shootCooldown = 0;

  makeZombies();

  mainMenu.classList.add("hidden");
  shopScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  controls.classList.remove("hidden");
  hud.classList.remove("hidden");

  running = true;
  lastTime = 0;
  animationId = requestAnimationFrame(gameLoop);
}

function shoot() {
  if (!running || shootCooldown > 0) return;

  shootCooldown = 250;

  bullets.push({
    lane: playerLane,
    x: laneCenter(playerLane),
    y: player.y
  });
}

function moveLeft() {
  if (running) playerLane = Math.max(0, playerLane - 1);
}

function moveRight() {
  if (running) playerLane = Math.min(2, playerLane + 1);
}

function endGame() {
  running = false;

  if (animationId) cancelAnimationFrame(animationId);

  controls.classList.add("hidden");
  gameOverScreen.classList.remove("hidden");
  finalGold.textContent = gold;
}

function goHome() {
  running = false;

  if (animationId) cancelAnimationFrame(animationId);

  controls.classList.add("hidden");
  shopScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  mainMenu.classList.remove("hidden");
  hud.classList.add("hidden");
}

document.getElementById("playButton").addEventListener("click", startGame);

document.getElementById("shopButton").addEventListener("click", () => {
  shopGold.textContent = gold;
  mainMenu.classList.add("hidden");
  shopScreen.classList.remove("hidden");
});

document.getElementById("backButton").addEventListener("click", () => {
  shopScreen.classList.add("hidden");
  mainMenu.classList.remove("hidden");
});

document.getElementById("restartButton").addEventListener("click", startGame);
document.getElementById("homeButton").addEventListener("click", goHome);
document.getElementById("menuButton").addEventListener("click", goHome);

document.getElementById("leftButton").addEventListener("pointerdown", moveLeft);
document.getElementById("rightButton").addEventListener("pointerdown", moveRight);
document.getElementById("shootButton").addEventListener("pointerdown", shoot);

// Keyboard controls for testing on a computer.
window.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") moveLeft();
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") moveRight();
  if (event.code === "Space") shoot();
});

hud.classList.add("hidden");
