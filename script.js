(() => {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const startScreen = document.getElementById("start-screen");
  const gameoverScreen = document.getElementById("gameover-screen");
  const hud = document.getElementById("hud");
  const scoreDisplay = document.getElementById("score-display");
  const finalScoreEl = document.getElementById("final-score");
  const gameoverReasonEl = document.getElementById("gameover-reason");

  const fbFollowBtn = document.getElementById("fb-follow-btn");
  const fbBtnText = document.getElementById("fb-btn-text");
  const fbRequirementHint = document.getElementById("fb-requirement-hint");
  const startBtn = document.getElementById("start-btn");
  const tryAgainBtn = document.getElementById("try-again-btn");

  // Logical Portrait Resolution
  const LOGICAL_W = 720;
  const LOGICAL_H = 1280;
  canvas.width = LOGICAL_W;
  canvas.height = LOGICAL_H;

  // Game State
  let hasFollowedFacebook = false;
  let gameState = "START"; // START | PLAYING | GAMEOVER
  let score = 0;
  let missedFruits = 0;
  const MAX_MISSED = 3;

  let activeObjects = [];
  let slicedHalves = [];
  let juiceParticles = [];
  let slashEffects = [];
  let floatingTexts = [];
  let bladeTrail = [];

  let isPointerDown = false;
  let lastPointer = null;
  let spawnTimer = 0;
  let spawnInterval = 1.65;
  let elapsedTime = 0;
  let screenShake = 0;
  let lastFrameTime = performance.now();

  // Web Audio Sound Synthesizer (Crisp Katana Whoosh, Fruit Slice, Pot Boom)
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function playSliceSound(isCombo = false) {
    try {
      ensureAudio();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(isCombo ? 740 : 540, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.14);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (_) {}
  }

  function playSwipeSound() {
    try {
      ensureAudio();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(920, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch (_) {}
  }

  function playBombSound() {
    try {
      ensureAudio();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(135, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.55);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.58);
    } catch (_) {}
  }

  // Preload All PNG Assets
  const ASSET_PATHS = {
    apple: "assets/apple.png",
    apple_left: "assets/apple_left.png",
    apple_right: "assets/apple_right.png",
    watermelon: "assets/watermelon.png",
    watermelon_left: "assets/watermelon_left.png",
    watermelon_right: "assets/watermelon_right.png",
    orange: "assets/orange.png",
    orange_left: "assets/orange_left.png",
    orange_right: "assets/orange_right.png",
    strawberry: "assets/strawberry.png",
    strawberry_left: "assets/strawberry_left.png",
    strawberry_right: "assets/strawberry_right.png",
    pineapple: "assets/pineapple.png",
    pineapple_left: "assets/pineapple_left.png",
    pineapple_right: "assets/pineapple_right.png",
    yuzu: "assets/yuzu.png",
    yuzu_left: "assets/yuzu_left.png",
    yuzu_right: "assets/yuzu_right.png",
    bomb: "assets/bomb.png"
  };

  const images = {};
  for (const [key, src] of Object.entries(ASSET_PATHS)) {
    const img = new Image();
    img.src = src;
    images[key] = img;
  }

  // Fruit & Bomb Definitions
  const FRUIT_CATALOG = [
    {
      type: "apple",
      radius: 62,
      size: 146,
      points: 1,
      juiceColor: "#e8343a",
      pulpColor: "#fff4d6"
    },
    {
      type: "watermelon",
      radius: 76,
      size: 174,
      points: 2,
      juiceColor: "#eb3646",
      pulpColor: "#ff7a85"
    },
    {
      type: "orange",
      radius: 58,
      size: 138,
      points: 1,
      juiceColor: "#ff991f",
      pulpColor: "#ffd27a"
    },
    {
      type: "strawberry",
      radius: 54,
      size: 130,
      points: 1,
      juiceColor: "#e6293c",
      pulpColor: "#ff9aa4"
    },
    {
      type: "pineapple",
      radius: 72,
      size: 172,
      points: 2,
      juiceColor: "#f2b718",
      pulpColor: "#fff099"
    },
    {
      type: "yuzu",
      radius: 56,
      size: 134,
      points: 3,
      juiceColor: "#f7d426",
      pulpColor: "#fff9b8"
    }
  ];

  // Facebook Follow Requirement Unlock Logic
  fbFollowBtn.addEventListener("click", () => {
    hasFollowedFacebook = true;
    fbFollowBtn.classList.add("followed");
    fbBtnText.textContent = "Thank you for following!";
    fbRequirementHint.textContent = "Start earning points by slicing the chiis!";
    startBtn.classList.remove("locked");
    startBtn.disabled = false;
  });

  startBtn.addEventListener("click", () => {
    if (!hasFollowedFacebook) return;
    startNewGame();
  });

  tryAgainBtn.addEventListener("click", () => {
    startNewGame();
  });

  function startNewGame() {
    ensureAudio();
    score = 0;
    missedFruits = 0;
    elapsedTime = 0;
    spawnTimer = 0.45;
    spawnInterval = 1.65;
    screenShake = 0;

    activeObjects = [];
    slicedHalves = [];
    juiceParticles = [];
    slashEffects = [];
    floatingTexts = [];
    bladeTrail = [];

    scoreDisplay.textContent = "0";
    startScreen.classList.add("hidden");
    gameoverScreen.classList.add("hidden");
    hud.classList.remove("hidden");

    gameState = "PLAYING";
  }

  function triggerGameOver(reasonText) {
    if (gameState !== "PLAYING") return;
    gameState = "GAMEOVER";
    hud.classList.add("hidden");
    finalScoreEl.textContent = String(score);
    gameoverReasonEl.textContent = reasonText;
    gameoverScreen.classList.remove("hidden");
  }

  // Spawn a Wave of Fruits & Occasional Iron Pot Bombs
  function spawnWave() {
    const difficulty = Math.min(elapsedTime / 45, 1);
    const count = 1 + Math.floor(Math.random() * (2 + Math.round(difficulty * 2)));

    for (let i = 0; i < count; i++) {
      const isBomb = Math.random() < (0.16 + difficulty * 0.12);
      const margin = 120;
      const x = margin + Math.random() * (LOGICAL_W - margin * 2);
      const y = LOGICAL_H + 85;

      // Aim upward toward the center kitchen area
      const targetX = LOGICAL_W * (0.25 + Math.random() * 0.5);
      const flightTime = 1.18 + Math.random() * 0.24;
      const gravity = 1480;

      const vx = (targetX - x) / flightTime;
      const peakY = LOGICAL_H * (0.18 + Math.random() * 0.24);
      const vy = -Math.sqrt(2 * gravity * (y - peakY));

      if (isBomb) {
        activeObjects.push({
          isBomb: true,
          type: "bomb",
          x,
          y,
          vx,
          vy,
          gravity,
          radius: 62,
          size: 152,
          rotation: (Math.random() - 0.5) * 0.4,
          vRot: (Math.random() - 0.5) * 3.5,
          sliced: false
        });
      } else {
        const spec = FRUIT_CATALOG[Math.floor(Math.random() * FRUIT_CATALOG.length)];
        activeObjects.push({
          isBomb: false,
          ...spec,
          x,
          y,
          vx,
          vy,
          gravity,
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 4.5,
          sliced: false
        });
      }
    }
  }

  // Convert Screen Touch/Mouse Coordinates to Logical Canvas Coordinates
  function getCanvasPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = LOGICAL_W / rect.width;
    const scaleY = LOGICAL_H / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  // Segment-to-Circle Intersection for Accurate Katana Slicing
  function segmentIntersectsCircle(p1, p2, cx, cy, r) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      return Math.hypot(cx - p1.x, cy - p1.y) <= r;
    }
    let t = ((cx - p1.x) * dx + (cy - p1.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const nearestX = p1.x + t * dx;
    const nearestY = p1.y + t * dy;
    return Math.hypot(cx - nearestX, cy - nearestY) <= r;
  }

  function handleSliceSegment(p1, p2) {
    if (gameState !== "PLAYING") return;

    const sliceAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    let slicedThisStroke = 0;

    for (const obj of activeObjects) {
      if (obj.sliced) continue;
      if (segmentIntersectsCircle(p1, p2, obj.x, obj.y, obj.radius * 0.92)) {
        obj.sliced = true;

        if (obj.isBomb) {
          playBombSound();
          screenShake = 22;
          spawnExplosionParticles(obj.x, obj.y);
          triggerGameOver("");
          return;
        } else {
          slicedThisStroke++;
          score += obj.points;
          scoreDisplay.textContent = String(score);
          splitFruit(obj, sliceAngle);
        }
      }
    }

    if (slicedThisStroke > 0) {
      playSliceSound(slicedThisStroke >= 2);
      if (slicedThisStroke >= 3) {
        const bonus = slicedThisStroke;
        score += bonus;
        scoreDisplay.textContent = String(score);
        floatingTexts.push({
          x: p2.x,
          y: p2.y - 30,
          text: `${slicedThisStroke}x KATANA COMBO +${bonus}`,
          color: "#ffd859",
          alpha: 1,
          vy: -90
        });
      }
    }
  }

  function splitFruit(fruit, angle) {
    // Katana flash slash line
    slashEffects.push({
      x: fruit.x,
      y: fruit.y,
      angle,
      alpha: 1,
      length: fruit.size * 1.45
    });

    // Floating point popup
    floatingTexts.push({
      x: fruit.x,
      y: fruit.y - 25,
      text: `+${fruit.points}`,
      color: "#fff6d6",
      alpha: 1,
      vy: -80
    });

    // Left and Right Split Halves Flying Apart
    const splitSpeed = 165;
    slicedHalves.push({
      img: images[`${fruit.type}_left`],
      x: fruit.x - 14,
      y: fruit.y,
      vx: fruit.vx - splitSpeed,
      vy: fruit.vy - 80,
      gravity: fruit.gravity,
      size: fruit.size,
      rotation: fruit.rotation,
      vRot: -3.8,
      alpha: 1
    });

    slicedHalves.push({
      img: images[`${fruit.type}_right`],
      x: fruit.x + 14,
      y: fruit.y,
      vx: fruit.vx + splitSpeed,
      vy: fruit.vy - 80,
      gravity: fruit.gravity,
      size: fruit.size,
      rotation: fruit.rotation,
      vRot: 3.8,
      alpha: 1
    });

    // Vibrant Juice Splatter Particles
    for (let i = 0; i < 18; i++) {
      const pAngle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 340;
      juiceParticles.push({
        x: fruit.x,
        y: fruit.y,
        vx: Math.cos(pAngle) * speed,
        vy: Math.sin(pAngle) * speed - 60,
        gravity: 780,
        radius: 4 + Math.random() * 7,
        color: i % 3 === 0 ? fruit.pulpColor : fruit.juiceColor,
        alpha: 1,
        life: 0.55 + Math.random() * 0.35
      });
    }
  }

  function spawnExplosionParticles(x, y) {
    for (let i = 0; i < 36; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 150 + Math.random() * 520;
      juiceParticles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        gravity: 400,
        radius: 6 + Math.random() * 11,
        color: i % 2 === 0 ? "#ff5722" : "#ffca28",
        alpha: 1,
        life: 0.8
      });
    }
  }

  // Pointer Events (Touch & Mouse Support)
  let lastSwipeSoundTime = 0;

  function onPointerDown(x, y) {
    isPointerDown = true;
    const pos = getCanvasPos(x, y);
    lastPointer = pos;
    bladeTrail.push({ x: pos.x, y: pos.y, time: performance.now() });
  }

  function onPointerMove(x, y) {
    if (!isPointerDown) return;
    const pos = getCanvasPos(x, y);
    const now = performance.now();
    bladeTrail.push({ x: pos.x, y: pos.y, time: now });

    if (lastPointer) {
      const dist = Math.hypot(pos.x - lastPointer.x, pos.y - lastPointer.y);
      if (dist > 28 && now - lastSwipeSoundTime > 160 && gameState === "PLAYING") {
        playSwipeSound();
        lastSwipeSoundTime = now;
      }
      handleSliceSegment(lastPointer, pos);
    }
    lastPointer = pos;
  }

  function onPointerUp() {
    isPointerDown = false;
    lastPointer = null;
  }

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });

  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    onPointerUp();
  }, { passive: false });

  canvas.addEventListener("mousedown", (e) => {
    onPointerDown(e.clientX, e.clientY);
  });

  window.addEventListener("mousemove", (e) => {
    onPointerMove(e.clientX, e.clientY);
  });

  window.addEventListener("mouseup", () => {
    onPointerUp();
  });

  // Main Update Loop
  function update(dt) {
    const now = performance.now();
    bladeTrail = bladeTrail.filter((pt) => now - pt.time < 150);

    if (screenShake > 0) {
      screenShake = Math.max(0, screenShake - dt * 55);
    }

    if (gameState === "PLAYING") {
      elapsedTime += dt;
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnWave();
        const minInterval = 0.85;
        spawnInterval = Math.max(minInterval, 1.65 - elapsedTime * 0.014);
        spawnTimer = spawnInterval;
      }
    }

    // Update Whole Fruits & Bombs
    for (let i = activeObjects.length - 1; i >= 0; i--) {
      const obj = activeObjects[i];
      obj.x += obj.vx * dt;
      obj.y += obj.vy * dt;
      obj.vy += obj.gravity * dt;
      obj.rotation += obj.vRot * dt;

      if (obj.sliced) {
        activeObjects.splice(i, 1);
        continue;
      }

      // Check if unsliced fruit fell off bottom of screen
      if (obj.y > LOGICAL_H + 140 && obj.vy > 0) {
        activeObjects.splice(i, 1);
        if (!obj.isBomb && gameState === "PLAYING") {
          missedFruits++;
          if (missedFruits >= MAX_MISSED) {
            triggerGameOver("");
          }
        }
      }
    }

    // Update Sliced Fruit Halves
    for (let i = slicedHalves.length - 1; i >= 0; i--) {
      const h = slicedHalves[i];
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.vy += h.gravity * dt;
      h.rotation += h.vRot * dt;
      if (h.y > LOGICAL_H + 180) {
        slicedHalves.splice(i, 1);
      }
    }

    // Update Juice Particles
    for (let i = juiceParticles.length - 1; i >= 0; i--) {
      const p = juiceParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life * 1.4);
      if (p.life <= 0) {
        juiceParticles.splice(i, 1);
      }
    }

    // Update Katana Slash Flashes
    for (let i = slashEffects.length - 1; i >= 0; i--) {
      const s = slashEffects[i];
      s.alpha -= dt * 4.5;
      if (s.alpha <= 0) {
        slashEffects.splice(i, 1);
      }
    }

    // Update Floating Score Popups
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= dt * 1.25;
      if (ft.alpha <= 0) {
        floatingTexts.splice(i, 1);
      }
    }
  }

  // Render Loop
  function render() {
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

    ctx.save();
    if (screenShake > 0) {
      const sx = (Math.random() - 0.5) * screenShake;
      const sy = (Math.random() - 0.5) * screenShake;
      ctx.translate(sx, sy);
    }

    // 1. Juice Splatter Particles
    for (const p of juiceParticles) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Sliced Fruit Halves
    for (const h of slicedHalves) {
      if (!h.img || !h.img.complete) continue;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rotation);
      ctx.drawImage(h.img, -h.size / 2, -h.size / 2, h.size, h.size);
      ctx.restore();
    }

    // 3. Active Whole Fruits & Iron Pot Bombs
    for (const obj of activeObjects) {
      const img = images[obj.type];
      if (!img || !img.complete) continue;
      ctx.save();
      ctx.translate(obj.x, obj.y);
      ctx.rotate(obj.rotation);
      ctx.drawImage(img, -obj.size / 2, -obj.size / 2, obj.size, obj.size);
      ctx.restore();
    }

    // 4. Katana Slash Flash Effects
    for (const s of slashEffects) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.globalAlpha = Math.max(0, s.alpha);

      const grad = ctx.createLinearGradient(-s.length / 2, 0, s.length / 2, 0);
      grad.addColorStop(0, "rgba(255, 255, 255, 0)");
      grad.addColorStop(0.5, "rgba(255, 250, 225, 0.95)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, s.length / 2, 7 * s.alpha, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Floating Score Popups
    for (const ft of floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = "bold 34px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#2d1408";
      ctx.fillText(ft.text, ft.x + 2, ft.y + 3);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 6. Katana Blade Slicing Trail
    if (bladeTrail.length > 1) {
      const now = performance.now();
      for (let i = 1; i < bladeTrail.length; i++) {
        const p0 = bladeTrail[i - 1];
        const p1 = bladeTrail[i];
        const age = (now - p1.time) / 150;
        const life = Math.max(0, 1 - age);

        // Outer Steel / Gold Katana Glow
        ctx.strokeStyle = `rgba(255, 224, 140, ${life * 0.65})`;
        ctx.lineWidth = 18 * life;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();

        // Razor-Sharp White Blade Core
        ctx.strokeStyle = `rgba(255, 255, 255, ${life * 0.95})`;
        ctx.lineWidth = 7 * life;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function gameLoop(now) {
    const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;
    update(dt);
    render();
    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
})();
