
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;
const laneX = [W / 6, W / 2, W * 5 / 6];

const $ = id => document.getElementById(id);

const assets = {};

const files = {
  road: "Road1.png",
  car: "Car1.png",
  zombie0: "Zombie1.png",
  zombie1: "Zombie2.png",
  zombie2: "Zombie3.png"
};

for (const [key, file] of Object.entries(files)) {
  const img = new Image();
  img.src = "assets/" + file;
  img.onload = () => assets[key] = img;
}

let state = "menu";
let coins = Number(localStorage.getItem("zombietzGold") || 0);
let earned = 0;
let lane = 1;
let zombies = [];
let bullets = [];
let roadOffset = 0;
let shotCooldown = 0;
let lastTime = 0;
let wave = 1;
let noticeTimer = 0;

const carY = 665;
const carW = 58;
const carH = 92;

function updateGold() {
  $("gold").textContent = coins;
  $("menuGold").textContent = coins;
  $("shopGold").textContent = coins;
  localStorage.setItem("zombietzGold", coins);
}

function showScreen(name) {
  ["menu", "shop", "gameOver"].forEach(id => {
    $(id).classList.toggle("hidden", id !== name);
  });

  $("hud").classList.toggle("hidden", name !== "playing");
}

function startGame() {
  state = "playing";
  lane = 1;
  zombies = [];
  bullets = [];
  earned = 0;
  wave = 1;
  shotCooldown = 0;
  roadOffset = 0;

  spawnTwoZombies();
  showScreen("playing");
  $("wave").textContent = wave;
}

function spawnTwoZombies() {
  // Select two different lanes; the third lane remains empty.
  const chosen = [0, 1, 2]
    .sort(() => Math.random() - 0.5)
    .slice(0, 2);

  zombies = chosen.map((zLane, i) => ({
    lane: zLane,
    x: laneX[zLane],
    y: -80 - i * 100,
    type: Math.floor(Math.random() * 3),
    speed: 65 + Math.random() * 20
  }));
}

function drawRoad(dt) {
  roadOffset = (roadOffset + dt * 170) % 64;

  if (assets.road) {
    // Road image should be a top-down, three-lane road.
    ctx.drawImage(assets.road, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#303530";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#424842";
    ctx.fillRect(25, 0, W - 50, H);
  }

  // Keep all three lanes clearly visible.
  ctx.save();
  ctx.strokeStyle = "#ded8a5";
  ctx.lineWidth = 3;
  ctx.setLineDash([35, 29]);
  ctx.lineDashOffset = -roadOffset;

  ctx.beginPath();
  ctx.moveTo(W / 3, 0);
  ctx.lineTo(W / 3, H);
  ctx.moveTo(W * 2 / 3, 0);
  ctx.lineTo(W * 2 / 3, H);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#11181199";
  ctx.fillRect(0, 0, 18, H);
  ctx.fillRect(W - 18, 0, 18, H);
}

function drawCar() {
  if (assets.car) {
    ctx.drawImage(
      assets.car,
      laneX[lane] - carW / 2,
      carY - carH / 2,
      carW,
      carH
    );
  } else {
    // Temporary car visual until Car1.png is loaded.
    ctx.fillStyle = "#75cf50";
    ctx.fillRect(laneX[lane] - 23, carY - 44, 46, 88);

    ctx.fillStyle = "#b7d6d9";
    ctx.fillRect(laneX[lane] - 15, carY - 25, 30, 19);

    ctx.fillStyle = "#151a15";
    ctx.fillRect(laneX[lane] - 18, carY + 10, 36, 17);
  }
}

function drawZombie(z) {
  const img = assets["zombie" + z.type];
  const w = 62;
  const h = 76;

  if (img) {
    ctx.drawImage(img, z.x - w / 2, z.y - h / 2, w, h);
  } else {
    // Temporary zombie visual if images haven't loaded.
    ctx.fillStyle = ["#82a96a", "#9b9b63", "#527e4d"][z.type];

    ctx.beginPath();
    ctx.ellipse(z.x, z.y, 23, 29, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1a2517";
    ctx.fillRect(z.x - 13, z.y - 8, 8, 6);
    ctx.fillRect(z.x + 5, z.y - 8, 8, 6);

    ctx.fillStyle = "#d8e3c7";
    ctx.fillRect(z.x - 10, z.y + 9, 20, 5);
  }
}

function drawBullets() {
  ctx.strokeStyle = "#f9ffda";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";

  bullets.forEach(b => {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + 10);
    ctx.lineTo(b.x, b.y - 10);
    ctx.stroke();
  });
}

function move(dir) {
  if (state !== "playing") return;
  lane = Math.max(0, Math.min(2, lane + dir));
}

function shoot() {
  if (state !== "playing" || shotCooldown > 0) return;

  shotCooldown = 0.25;

  bullets.push({
    x: laneX[lane],
    y: carY - 55,
    speed: 600
  });

  // One shot kills one zombie in the player's lane.
  const target = zombies
    .filter(z => z.lane === lane && z.y < carY - 35)
    .sort((a, b) => b.y - a.y)[0];

  if (target) {
    zombies = zombies.filter(z => z !== target);

    coins += 10;
    earned += 10;
    updateGold();

    $("notice").textContent = "+10 GOLD";
    noticeTimer = 0.9;

    wave = 1 + Math.floor(earned / 100);
    $("wave").textContent = wave;
  } else {
    $("notice").textContent = "AIM AT A ZOMBIE'S LANE";
    noticeTimer = 0.7;
  }
}

function endGame() {
  state = "gameOver";
  $("earned").textContent = earned;
  showScreen("gameOver");
}

function update(dt) {
  if (state !== "playing") return;

  shotCooldown = Math.max(0, shotCooldown - dt);
  roadOffset += dt * 170;

  bullets.forEach(b => b.y -= b.speed * dt);
  bullets = bullets.filter(b => b.y > -20);

  zombies.forEach(z => {
    z.y += z.speed * dt;
  });

  // A zombie reaching the player's car ends the run.
  if (zombies.some(z => z.y + 35 >= carY - carH / 2)) {
    endGame();
    return;
  }

  // Refill defeated zombies in an unoccupied lane.
  // Never put two zombies in the same lane.
  while (zombies.length < 2) {
    const occupied = zombies.map(z => z.lane);
    const free = [0, 1, 2].filter(l => !occupied.includes(l));

    if (!free.length) break;

    const newLane = free[Math.floor(Math.random() * free.length)];

    zombies.push({
      lane: newLane,
      x: laneX[newLane],
      y: -85,
      type: Math.floor(Math.random() * 3),
      speed: 65 + Math.random() * 20
    });
  }

  if (noticeTimer > 0) {
    noticeTimer -= dt;

    if (noticeTimer <= 0) {
      $("notice").textContent = "ONE SHOT. ONE ZOMBIE.";
    }
  }
}

function render(dt) {
  ctx.clearRect(0, 0, W, H);
  drawRoad(dt);

  if (state === "playing") {
    drawBullets();
    zombies.forEach(drawZombie);
    drawCar();
  }
}

function loop(time) {
  const dt = Math.min((time - lastTime) / 1000 || 0, 0.04);
  lastTime = time;

  update(dt);
  render(dt);

  requestAnimationFrame(loop);
}

$("playBtn").addEventListener("click", startGame);

$("shopBtn").addEventListener("click", () => {
  showScreen("shop");
  updateGold();
});

$("backBtn").addEventListener("click", () => {
  showScreen("menu");
});

$("retryBtn").addEventListener("click", startGame);

$("homeBtn").addEventListener("click", () => {
  state = "menu";
  showScreen("menu");
});

$("leftBtn").addEventListener("pointerdown", e => {
  e.preventDefault();
  move(-1);
});

$("rightBtn").addEventListener("pointerdown", e => {
  e.preventDefault();
  move(1);
});

$("shootBtn").addEventListener("pointerdown", e => {
  e.preventDefault();
  shoot();
});

window.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
    move(-1);
  }

  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
    move(1);
  }

  if (e.code === "Space") {
    e.preventDefault();
    shoot();
  }
});

updateGold();
showScreen("menu");
requestAnimationFrame(loop);
