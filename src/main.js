import Phaser from 'phaser';
import './style.css';

const GAME_WIDTH = 480;
const GAME_HEIGHT = 270;
const WORLD_WIDTH = 2600;
const GROUND_Y = 232;
const MAX_HEALTH = 6;
const MOVE_SPEED = 154;

const COLORS = {
  skyTop: 0x223f66,
  skyBottom: 0x7bb1c7,
  ground: 0x37543a,
  platform: 0x6d7c46,
  platformDark: 0x34442d,
  vine: 0x245b2c,
  ui: 0xffffff,
  heart: 0xff4b69,
  fire: 0xff6b1a,
  gold: 0xffd35a,
};

class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    makeTextures(this);
    this.cameras.main.setBackgroundColor('#121622');

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x15283a).setOrigin(0);
    for (let i = 0; i < 36; i += 1) {
      const x = 250 + i * 10;
      const y = 42 + (i % 5) * 12;
      this.add.image(x, y, 'vineWall').setScale(1.5);
    }
    this.add.image(188, 138, 'titleBrady').setScale(3);
    this.add.image(278, 118, 'titleFire').setScale(3.4);

    this.add.text(16, 16, 'BRADY AND THE', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffe98d',
      stroke: '#2b1730',
      strokeThickness: 4,
    });
    this.add.text(16, 42, 'MAGICAL CAKE', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#ff9ed1',
      stroke: '#2b1730',
      strokeThickness: 5,
    });

    this.add.text(GAME_WIDTH / 2, 228, 'TAP OR PRESS SPACE', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('GameScene'));
    this.input.once('pointerdown', () => this.scene.start('GameScene'));
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.mobileInput = { left: false, right: false, jump: false, fire: false };
  }

  create() {
    makeTextures(this);
    this.health = MAX_HEALTH;
    this.fireMode = false;
    this.invincibleUntil = 0;
    this.lastDamageAt = 0;
    this.lastFireAt = 0;
    this.mobileInput = { left: false, right: false, jump: false, fire: false };

    this.createWorld();
    this.createLevel();
    this.createHud();
    this.createControls();

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12, 0, 38);
  }

  createWorld() {
    this.add.rectangle(0, 0, WORLD_WIDTH, GAME_HEIGHT, COLORS.skyBottom).setOrigin(0);
    for (let i = 0; i < 16; i += 1) {
      const shade = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(COLORS.skyTop),
        Phaser.Display.Color.ValueToColor(COLORS.skyBottom),
        16,
        i,
      );
      this.add.rectangle(0, i * 18, WORLD_WIDTH, 18, Phaser.Display.Color.GetColor(shade.r, shade.g, shade.b)).setOrigin(0);
    }
    for (let x = 60; x < WORLD_WIDTH; x += 190) {
      this.add.image(x, 188 + ((x / 190) % 2) * 8, 'tree').setScale(2).setAlpha(0.45);
    }

    this.platforms = this.physics.add.staticGroup();
    this.hazards = this.physics.add.group();
    this.birds = this.physics.add.group({ allowGravity: false });
    this.pickups = this.physics.add.group({ allowGravity: false });
    this.fireballs = this.physics.add.group({ allowGravity: false });
    this.walls = this.physics.add.staticGroup();

    for (let x = 0; x < WORLD_WIDTH; x += 32) {
      this.platforms.create(x + 16, GROUND_Y + 16, 'groundTile');
    }
  }

  createLevel() {
    this.player = this.physics.add.sprite(42, GROUND_Y - 28, 'brady');
    this.player.setCollideWorldBounds(true);
    this.player.setDragX(0);
    this.player.setMaxVelocity(MOVE_SPEED, 420);
    this.player.facing = 1;

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.hazards, this.platforms);
    this.physics.add.collider(this.fireballs, this.platforms, (fireball) => fireball.destroy());
    this.physics.add.collider(this.fireballs, this.walls, (fireball, wall) => {
      fireball.destroy();
      wall.destroy();
    });

    let x = 180;
    let y = 184;
    let platformIndex = 0;
    while (x < WORLD_WIDTH - 280) {
      const width = Phaser.Math.Between(3, 6);
      y = Phaser.Math.Clamp(y + Phaser.Math.Between(-42, 34), 96, 196);
      this.addPlatform(x, y, width);
      this.decoratePlatform(x, y, width, platformIndex);
      x += Phaser.Math.Between(185, 255);
      platformIndex += 1;
    }

    this.goal = this.physics.add.staticSprite(WORLD_WIDTH - 100, GROUND_Y - 34, 'goalCake').setScale(1.5);
    this.physics.add.overlap(this.player, this.goal, () => this.finish(true));

    this.physics.add.overlap(this.player, this.hazards, (_, hazard) => this.damage(hazard));
    this.physics.add.overlap(this.player, this.birds, (_, bird) => this.damage(bird));
    this.physics.add.overlap(this.player, this.pickups, (_, pickup) => this.collect(pickup));
    this.physics.add.overlap(this.fireballs, this.hazards, (fireball, hazard) => {
      fireball.destroy();
      hazard.destroy();
    });
    this.physics.add.overlap(this.fireballs, this.birds, (fireball, bird) => {
      fireball.destroy();
      bird.destroy();
    });
  }

  addPlatform(x, y, width) {
    for (let i = 0; i < width; i += 1) {
      this.platforms.create(x + i * 32, y, 'platformTile');
    }
  }

  decoratePlatform(x, y, width, index) {
    const center = x + ((width - 1) * 16);
    if (index % 2 === 0) {
      const snake = this.hazards.create(center, y - 20, 'snake');
      snake.setData('kind', 'snake');
      snake.setVelocityX(index % 4 === 0 ? 42 : -42);
      snake.setBounce(1, 0);
      snake.setCollideWorldBounds(false);
    }
    if (index % 3 === 0) {
      this.pickups.create(x + 18, y - 28, 'potion').setData('kind', 'potion');
    }
    if (index === 2 || index === 6) {
      this.pickups.create(center, y - 32, 'fireCake').setData('kind', 'fire');
    }
    if (index === 4) {
      this.pickups.create(center, y - 34, 'starCake').setData('kind', 'invincible');
    }
    if (index % 5 === 1) {
      const bird = this.birds.create(center + 76, y - 78, 'bird');
      bird.setData('originX', bird.x);
      bird.setData('originY', bird.y);
      bird.setData('phase', Math.random() * Math.PI * 2);
      bird.setVelocityX(index % 2 ? -48 : 48);
    }
    if (index % 4 === 3) {
      this.hazards.create(x + 10, y - 18, 'fireHazard').setData('kind', 'fire');
    }
    if (index === 5 || index === 8) {
      this.walls.create(x + width * 32 + 42, y - 24, 'vineWall');
    }
  }

  createHud() {
    this.hud = this.add.container(0, 0).setScrollFactor(0).setDepth(20);
    this.hearts = [];
    for (let i = 0; i < MAX_HEALTH / 2; i += 1) {
      const heart = this.add.image(18 + i * 20, 18, 'heart').setScale(1.4);
      this.hearts.push(heart);
      this.hud.add(heart);
    }
    this.powerText = this.add.text(92, 10, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#172033',
      strokeThickness: 3,
    });
    this.hud.add(this.powerText);
  }

  createControls() {
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys('A,D,SPACE,ENTER');

    this.controlLayer = this.add.container(0, 0).setScrollFactor(0).setDepth(30);
    const controls = [
      ['left', 48, 222, '<'],
      ['right', 112, 222, '>'],
      ['jump', 368, 222, '^'],
      ['fire', 432, 222, '*'],
    ];
    controls.forEach(([name, x, y, label]) => {
      const button = this.add.circle(x, y, 28, 0x0d1320, 0.58).setStrokeStyle(2, 0xffffff, 0.75);
      const text = this.add.text(x, y - 2, label, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
      }).setOrigin(0.5);
      button.setInteractive(new Phaser.Geom.Circle(28, 28, 36), Phaser.Geom.Circle.Contains);
      button.on('pointerdown', (pointer) => {
        pointer.event?.preventDefault?.();
        this.mobileInput[name] = true;
      });
      button.on('pointerup', () => { this.mobileInput[name] = false; });
      button.on('pointerupoutside', () => { this.mobileInput[name] = false; });
      this.controlLayer.add([button, text]);
    });

    this.input.addPointer(3);
    this.input.on('pointerup', () => this.releaseActionButtons());
    this.input.on('pointercancel', () => this.releaseActionButtons());
    window.addEventListener('blur', () => this.resetMobileInput(), { passive: true });
  }

  update(time) {
    this.syncHeldTouchMovement();
    const left = this.cursors?.left.isDown || this.keys?.A.isDown || this.mobileInput.left;
    const right = this.cursors?.right.isDown || this.keys?.D.isDown || this.mobileInput.right;
    const jump = Phaser.Input.Keyboard.JustDown(this.cursors?.space) || Phaser.Input.Keyboard.JustDown(this.keys?.SPACE) || this.consumeMobile('jump');
    const fire = Phaser.Input.Keyboard.JustDown(this.keys?.ENTER) || this.consumeMobile('fire');

    if (left) {
      this.player.setVelocityX(-MOVE_SPEED);
      this.player.facing = -1;
      this.player.setFlipX(true);
    } else if (right) {
      this.player.setVelocityX(MOVE_SPEED);
      this.player.facing = 1;
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    if (jump && this.player.body.blocked.down) {
      this.player.setVelocityY(-286);
    }

    if (fire && this.fireMode && time - this.lastFireAt > 280) {
      this.shootFireball();
      this.lastFireAt = time;
    }

    this.hazards.children.iterate((hazard) => {
      if (!hazard?.active || hazard.getData('kind') !== 'snake') return;
      if (hazard.body.blocked.left) hazard.setVelocityX(42);
      if (hazard.body.blocked.right) hazard.setVelocityX(-42);
    });

    this.birds.children.iterate((bird) => {
      if (!bird?.active) return;
      const originX = bird.getData('originX');
      const phase = bird.getData('phase');
      bird.y = bird.getData('originY') + Math.sin(time / 350 + phase) * 14;
      if (Math.abs(bird.x - originX) > 92) {
        bird.setVelocityX(-bird.body.velocity.x);
        bird.setFlipX(bird.body.velocity.x < 0);
      }
    });

    if (this.player.y > GAME_HEIGHT + 60) {
      this.finish(false);
    }

    this.updateHud(time);
  }

  consumeMobile(name) {
    if (!this.mobileInput[name]) return false;
    this.mobileInput[name] = false;
    return true;
  }

  releaseActionButtons() {
    this.mobileInput.jump = false;
    this.mobileInput.fire = false;
  }

  resetMobileInput() {
    this.mobileInput = { left: false, right: false, jump: false, fire: false };
  }

  syncHeldTouchMovement() {
    const pointers = [this.input.activePointer, ...this.input.manager.pointers];
    const held = {
      left: false,
      right: false,
    };

    pointers.forEach((pointer) => {
      if (!pointer?.isDown) return;
      const x = pointer.x;
      const y = pointer.y;
      if (y < GAME_HEIGHT - 84) return;
      if (x < 82) held.left = true;
      if (x >= 82 && x < 168) held.right = true;
    });

    this.mobileInput.left = held.left;
    this.mobileInput.right = held.right;
  }

  shootFireball() {
    const fireball = this.fireballs.create(this.player.x + this.player.facing * 18, this.player.y - 3, 'fireball');
    fireball.setVelocityX(this.player.facing * 260);
    fireball.setVelocityY(-20);
    fireball.setData('born', this.time.now);
    this.time.delayedCall(1600, () => fireball.active && fireball.destroy());
  }

  collect(pickup) {
    const kind = pickup.getData('kind');
    pickup.destroy();
    if (kind === 'potion') {
      this.health = Math.min(MAX_HEALTH, this.health + 2);
    }
    if (kind === 'fire') {
      this.fireMode = true;
    }
    if (kind === 'invincible') {
      this.invincibleUntil = this.time.now + 60000;
    }
  }

  damage(source) {
    const now = this.time.now;
    if (now < this.invincibleUntil || now - this.lastDamageAt < 950) return;
    this.lastDamageAt = now;
    this.health -= 2;
    this.player.setTint(0xff8080);
    this.player.setVelocity(source.x < this.player.x ? 160 : -160, -145);
    this.time.delayedCall(180, () => this.player.clearTint());
    if (this.health <= 0) {
      this.finish(false);
    }
  }

  updateHud(time) {
    this.hearts.forEach((heart, index) => {
      heart.setVisible(this.health >= (index + 1) * 2);
    });
    const invincible = Math.max(0, Math.ceil((this.invincibleUntil - time) / 1000));
    const powers = [];
    if (this.fireMode) powers.push('FIRE');
    if (invincible > 0) powers.push(`INV ${invincible}`);
    this.powerText.setText(powers.join('  '));
    this.player.setAlpha(invincible > 0 && Math.floor(time / 110) % 2 === 0 ? 0.72 : 1);
  }

  finish(won) {
    this.scene.start('EndScene', { won });
  }
}

class EndScene extends Phaser.Scene {
  constructor() {
    super('EndScene');
  }

  create(data) {
    this.cameras.main.setBackgroundColor(data.won ? '#183926' : '#331a24');
    this.add.text(GAME_WIDTH / 2, 82, data.won ? 'CAKE FOUND!' : 'TRY AGAIN', {
      fontFamily: 'monospace',
      fontSize: '30px',
      color: data.won ? '#ffe88a' : '#ff9bad',
      stroke: '#101018',
      strokeThickness: 5,
    }).setOrigin(0.5);
    this.add.image(GAME_WIDTH / 2, 142, data.won ? 'goalCake' : 'brady').setScale(data.won ? 2 : 3);
    this.add.text(GAME_WIDTH / 2, 224, 'TAP OR PRESS SPACE', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('GameScene'));
    this.input.once('pointerdown', () => this.scene.start('GameScene'));
  }
}

function makeTextures(scene) {
  if (scene.textures.exists('brady')) return;
  drawTexture(scene, 'brady', 18, 26, (ctx) => {
    ctx.fillStyle = '#6b442d'; ctx.fillRect(7, 1, 5, 3);
    ctx.fillStyle = '#f0b37e'; ctx.fillRect(5, 4, 8, 7);
    ctx.fillStyle = '#4e6e3f'; ctx.fillRect(4, 11, 10, 8);
    ctx.fillStyle = '#213b22'; ctx.fillRect(5, 12, 3, 2); ctx.fillRect(10, 15, 3, 2);
    ctx.fillStyle = '#536a41'; ctx.fillRect(5, 19, 4, 4); ctx.fillRect(10, 19, 4, 4);
    ctx.fillStyle = '#f0b37e'; ctx.fillRect(2, 12, 3, 7); ctx.fillRect(14, 12, 3, 7);
    ctx.fillStyle = '#222'; ctx.fillRect(5, 23, 4, 2); ctx.fillRect(10, 23, 4, 2);
    ctx.fillStyle = '#1f2630'; ctx.fillRect(11, 7, 1, 1);
  });
  drawTexture(scene, 'titleBrady', 38, 34, (ctx) => {
    ctx.fillStyle = '#6b442d'; ctx.fillRect(13, 1, 9, 5);
    ctx.fillStyle = '#f0b37e'; ctx.fillRect(11, 6, 12, 9);
    ctx.fillStyle = '#4e6e3f'; ctx.fillRect(10, 15, 14, 9);
    ctx.fillStyle = '#172916'; ctx.fillRect(12, 17, 3, 2); ctx.fillRect(19, 20, 3, 2);
    ctx.fillStyle = '#fff'; ctx.font = '5px monospace'; ctx.fillText('BRADY', 10, 22);
    ctx.fillStyle = '#f0b37e'; ctx.fillRect(24, 14, 12, 4); ctx.fillRect(3, 11, 8, 4);
    ctx.fillStyle = '#536a41'; ctx.fillRect(11, 24, 5, 6); ctx.fillRect(19, 24, 5, 6);
    ctx.fillStyle = '#222'; ctx.fillRect(9, 30, 7, 2); ctx.fillRect(20, 30, 7, 2);
  });
  drawTexture(scene, 'titleFire', 36, 18, (ctx) => {
    ctx.fillStyle = '#ffef5a'; ctx.fillRect(0, 6, 28, 6);
    ctx.fillStyle = '#ff6b1a'; ctx.fillRect(4, 3, 30, 11);
    ctx.fillStyle = '#d9222a'; ctx.fillRect(12, 1, 23, 15);
    ctx.fillStyle = '#fff2a3'; ctx.fillRect(2, 8, 18, 3);
  });
  drawTexture(scene, 'groundTile', 32, 32, (ctx) => {
    ctx.fillStyle = '#34442d'; ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#54703f'; ctx.fillRect(0, 0, 32, 8);
    ctx.fillStyle = '#8eb55b'; ctx.fillRect(0, 0, 32, 3);
    ctx.fillStyle = '#26331f'; ctx.fillRect(4, 15, 5, 3); ctx.fillRect(20, 23, 7, 2);
  });
  drawTexture(scene, 'platformTile', 32, 12, (ctx) => {
    ctx.fillStyle = '#38472d'; ctx.fillRect(0, 4, 32, 8);
    ctx.fillStyle = '#758f50'; ctx.fillRect(0, 0, 32, 7);
    ctx.fillStyle = '#b1cf68'; ctx.fillRect(0, 0, 32, 2);
  });
  drawTexture(scene, 'snake', 22, 12, (ctx) => {
    ctx.fillStyle = '#2d7d3f'; ctx.fillRect(2, 6, 16, 4);
    ctx.fillRect(15, 4, 5, 5);
    ctx.fillStyle = '#ffdf58'; ctx.fillRect(18, 5, 1, 1);
  });
  drawTexture(scene, 'bird', 22, 14, (ctx) => {
    ctx.fillStyle = '#6a3fa0'; ctx.fillRect(8, 5, 8, 5);
    ctx.fillStyle = '#9d6be0'; ctx.fillRect(1, 2, 8, 4); ctx.fillRect(14, 2, 7, 4);
    ctx.fillStyle = '#f5c84b'; ctx.fillRect(16, 6, 4, 2);
  });
  drawTexture(scene, 'fireHazard', 18, 18, (ctx) => {
    ctx.fillStyle = '#d32f21'; ctx.fillRect(5, 7, 9, 9);
    ctx.fillStyle = '#ff7b1a'; ctx.fillRect(3, 9, 12, 7);
    ctx.fillStyle = '#ffe45c'; ctx.fillRect(7, 5, 5, 9);
  });
  drawTexture(scene, 'potion', 13, 17, (ctx) => {
    ctx.fillStyle = '#b7f7ff'; ctx.fillRect(5, 1, 4, 4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(4, 5, 6, 2);
    ctx.fillStyle = '#df2d6a'; ctx.fillRect(3, 7, 8, 8);
    ctx.fillStyle = '#ff9bbf'; ctx.fillRect(5, 8, 4, 4);
  });
  drawTexture(scene, 'fireCake', 18, 14, (ctx) => {
    ctx.fillStyle = '#7b2b18'; ctx.fillRect(2, 7, 14, 5);
    ctx.fillStyle = '#ff7a1f'; ctx.fillRect(3, 4, 12, 4);
    ctx.fillStyle = '#ffe45c'; ctx.fillRect(5, 1, 8, 4);
  });
  drawTexture(scene, 'starCake', 18, 14, (ctx) => {
    ctx.fillStyle = '#3954bb'; ctx.fillRect(2, 7, 14, 5);
    ctx.fillStyle = '#66e6ff'; ctx.fillRect(3, 4, 12, 4);
    ctx.fillStyle = '#fff45a'; ctx.fillRect(8, 1, 3, 9); ctx.fillRect(5, 4, 9, 3);
  });
  drawTexture(scene, 'goalCake', 34, 34, (ctx) => {
    ctx.fillStyle = '#7e3a7e'; ctx.fillRect(5, 22, 24, 8);
    ctx.fillStyle = '#ffc3ec'; ctx.fillRect(3, 18, 28, 6);
    ctx.fillStyle = '#7e3a7e'; ctx.fillRect(9, 12, 16, 6);
    ctx.fillStyle = '#ffe8a8'; ctx.fillRect(8, 9, 18, 5);
    ctx.fillStyle = '#fff45a'; ctx.fillRect(16, 3, 2, 6);
    ctx.fillStyle = '#ff7a1f'; ctx.fillRect(15, 1, 4, 3);
  });
  drawTexture(scene, 'heart', 12, 11, (ctx) => {
    ctx.fillStyle = '#ff4b69';
    ctx.fillRect(1, 2, 4, 4); ctx.fillRect(7, 2, 4, 4);
    ctx.fillRect(2, 5, 8, 3); ctx.fillRect(4, 8, 4, 2);
  });
  drawTexture(scene, 'fireball', 12, 8, (ctx) => {
    ctx.fillStyle = '#ffe45c'; ctx.fillRect(2, 2, 7, 4);
    ctx.fillStyle = '#ff6b1a'; ctx.fillRect(0, 1, 8, 6);
    ctx.fillStyle = '#d9222a'; ctx.fillRect(0, 3, 4, 3);
  });
  drawTexture(scene, 'vineWall', 24, 42, (ctx) => {
    ctx.fillStyle = '#5a4631'; ctx.fillRect(2, 0, 20, 42);
    ctx.fillStyle = '#23351f'; ctx.fillRect(0, 0, 24, 42);
    ctx.fillStyle = '#2f7a35';
    for (let y = 0; y < 42; y += 7) {
      ctx.fillRect((y * 3) % 20, y, 4, 8);
      ctx.fillRect(13, y + 2, 8, 3);
    }
  });
  drawTexture(scene, 'tree', 32, 54, (ctx) => {
    ctx.fillStyle = '#553b24'; ctx.fillRect(14, 20, 6, 34);
    ctx.fillStyle = '#1f5b35'; ctx.fillRect(5, 8, 22, 20);
    ctx.fillStyle = '#2e7540'; ctx.fillRect(1, 18, 30, 18);
    ctx.fillStyle = '#193f28'; ctx.fillRect(9, 2, 17, 15);
  });
}

function drawTexture(scene, key, width, height, draw) {
  const canvas = scene.textures.createCanvas(key, width, height);
  const ctx = canvas.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  draw(ctx);
  canvas.refresh();
}

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#101018',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 720 },
      debug: false,
    },
  },
  scene: [TitleScene, GameScene, EndScene],
};

new Phaser.Game(config);
