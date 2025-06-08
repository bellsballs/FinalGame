class TitleScene extends Phaser.Scene {
    constructor() {
        super("TitleScene"); // Scene key
    }

    create() {
        // Title text
        this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 50, "Collect all the coins!", {
            fontSize: '32px',
            fill: '#ffff00',
            fontFamily: 'Arial',
            backgroundColor: '#000000',
            padding: { x: 16, y: 10 },
            align: 'center'
        }).setOrigin(0.5);

        // Instructions to start
        this.add.text(this.cameras.main.centerX, this.cameras.main.centerY + 40, "Click or press SPACE to start", {
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Start game on mouse click
        this.input.once('pointerdown', () => {
            this.scene.start("platformerScene", { level: 1 });
        });

        // Start game on spacebar
        this.input.keyboard.once('keydown-SPACE', () => {
            this.scene.start("platformerScene", { level: 1 });
        });

        // Credits option
        this.add.text(this.cameras.main.centerX, this.cameras.main.centerY + 100, "Press C for Credits", {
            fontSize: '16px',
            fill: '#bbbbbb',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Show credits on C press
        this.input.keyboard.once('keydown-C', () => {
            this.scene.start("CreditsScene");
        });
    }
}





class Platformer extends Phaser.Scene {
    constructor() {
        super("platformerScene");
    }

    // Game setup and player status
    init(data) {
        this.currentLevel = data.level || 1;
        this.ACCELERATION = 250;
        this.DRAG = 500;
        this.physics.world.gravity.y = 1500;
        this.PARTICLE_VELOCITY = 50;
        this.SCALE = 2.0;
        this.canDoubleJump = false;
        this.hasDashed = false;
        this.DASH_VELOCITY = 600;
        this.DASH_DURATION = 200;
        this.isDashing = false;
        this.playerHealth = 3;
        this.powerupActive = false;
        this.JUMP_VELOCITY_DEFAULT = -600;
        this.JUMP_VELOCITY = this.JUMP_VELOCITY_DEFAULT;
    }

    // Setup game objects, physics, audio
    create() {
        // Load map and layers
        const levelKey = `platformer-level-${this.currentLevel}`;
        this.map = this.add.tilemap(levelKey, 18, 18, 45, 25);
        this.tileset = this.map.addTilesetImage("kenny_tilemap_packed", "tilemap_tiles");
        this.groundLayer = this.map.createLayer("Ground-n-Platforms", this.tileset, 0, 0);
        this.groundLayer.setCollisionByProperty({ collides: true });
        this.cameras.main.setBackgroundColor('#87ceeb'); // behind tiles

        // Set up input
        this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

        // Load coins and powerups from map
        this.coins = this.map.createFromObjects("Objects", { name: "coin", key: "tilemap_sheet", frame: 151 });
        this.powerups = this.map.createFromObjects("Objects", { name: "power", key: "tilemap_sheet", frame: 152 });

        // Enable physics for coins and powerups
        this.physics.world.enable(this.powerups, Phaser.Physics.Arcade.STATIC_BODY);
        this.physics.world.enable(this.coins, Phaser.Physics.Arcade.STATIC_BODY);

        this.coinGroup = this.add.group(this.coins);
        this.powerupGroup = this.add.group(this.powerups);

        // Track number of coins required
        this.coinsRemaining = this.coins.length;
        if (this.currentLevel === 2) {
            this.coinsRemaining = 11;
        }

        // Load cactus hazards from map
        this.cacti = this.map.createFromObjects("Objects", { name: "cactus", key: "tilemap_sheet", frame: 127 });
        if (this.cacti && this.cacti.length > 0) {
            this.physics.world.enable(this.cacti, Phaser.Physics.Arcade.STATIC_BODY);
            this.cactusGroup = this.add.group(this.cacti);
        } else {
            this.cactusGroup = this.add.group();
        }

        // Create player
        my.sprite.player = this.physics.add.sprite(30, 250, "platformer_characters", "tile_0000.png");
        my.sprite.player.setCollideWorldBounds(true);
        this.physics.add.collider(my.sprite.player, this.groundLayer);

        // Show health
        this.healthText = this.add.text(16, 16, `Health: ${this.playerHealth}`, {
            fontSize: '18px',
            fill: '#ffffff',
            fontFamily: 'Arial',
            backgroundColor: '#000000',
            padding: { x: 10, y: 5 }
        });
        this.healthText.setScrollFactor(0);
        this.healthText.setDepth(9999);

        // Load sounds
        this.coinSound = this.sound.add('coin');
        this.powerupSound = this.sound.add('powerup');
        this.impactSound = this.sound.add('impact');
        this.dashSound = this.sound.add('dashsound');
        this.deathSound = this.sound.add('death');

        // Overlap handlers
        this.physics.add.overlap(my.sprite.player, this.powerupGroup, (player, powerup) => {
            powerup.destroy();
            this.activateJumpBoost();
            this.powerupSound?.play();
        });

        this.physics.add.overlap(my.sprite.player, this.coinGroup, (player, coin) => {
            coin.destroy();
            this.coinsRemaining--;
            this.coinSound?.play();
            if (this.coinsRemaining <= 0) this.levelComplete();
        });

        this.physics.add.overlap(my.sprite.player, this.cactusGroup, (player, cactus) => {
            this.takeDamage();
            this.impactSound?.play();
        });

        // Input and debug
        cursors = this.input.keyboard.createCursorKeys();
        this.rKey = this.input.keyboard.addKey('R');

        this.input.keyboard.on('keydown-D', () => {
            this.physics.world.drawDebug = !this.physics.world.drawDebug;
            this.physics.world.debugGraphic.clear();
        });

        // Particle setup
        my.vfx.walking = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_03.png', 'smoke_09.png'],
            scale: { start: 0.03, end: 0.1 },
            lifespan: 350,
            alpha: { start: 1, end: 0.1 },
            quantity: 1,
            frequency: 100,
            maxParticles: 10,
        });
        my.vfx.walking.stop();

        // Camera config
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.startFollow(my.sprite.player, true, 0.25, 0.25);
        this.cameras.main.setDeadzone(50, 50);
        this.cameras.main.setZoom(this.SCALE);

        // Win text
        this.levelClearedText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, "Level Cleared!", {
            fontSize: '32px',
            fill: '#00ff00',
            fontFamily: 'Arial',
            backgroundColor: '#000000',
            padding: { x: 20, y: 10 },
            align: 'center'
        });
        this.levelClearedText.setOrigin(0.5).setScrollFactor(0).setVisible(false);

        // Sounds
        this.footstepSounds = [this.sound.add('footstep01'), this.sound.add('footstep02')];
        this.currentFootstepIndex = 0;
        this.lastFootstepTime = 0;
        this.footstepCooldown = 200;

        this.jumpSound = this.sound.add('footstep08');
    }

    // Called every frame
    update() {
        let isWalking = false;

        // Movement logic
        if (cursors.left.isDown) {
            my.sprite.player.setAccelerationX(-this.ACCELERATION);
            my.sprite.player.resetFlip();
            my.sprite.player.anims.play('walk', true);
            my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth / 2 - 10, my.sprite.player.displayHeight / 2 - 5, false);
            my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
            isWalking = true;
        } else if (cursors.right.isDown) {
            my.sprite.player.setAccelerationX(this.ACCELERATION);
            my.sprite.player.setFlip(true, false);
            my.sprite.player.anims.play('walk', true);
            my.vfx.walking.startFollow(my.sprite.player, -my.sprite.player.displayWidth / 2 + 10, my.sprite.player.displayHeight / 2 - 5, false);
            my.vfx.walking.setParticleSpeed(-this.PARTICLE_VELOCITY, 0);
            isWalking = true;
        } else {
            my.sprite.player.setAccelerationX(0);
            my.sprite.player.setDragX(this.DRAG);
            my.sprite.player.anims.play('idle');
            my.vfx.walking.stop();
        }

        // Footstep timing
        if (isWalking && my.sprite.player.body.blocked.down) {
            my.vfx.walking.start();
            const now = this.time.now;
            if (now - this.lastFootstepTime > this.footstepCooldown) {
                this.footstepSounds[this.currentFootstepIndex].play();
                this.currentFootstepIndex = 1 - this.currentFootstepIndex;
                this.lastFootstepTime = now;
            }
        }

        // Jump and double jump
        if (!my.sprite.player.body.blocked.down && !this.isDashing) {
            my.sprite.player.anims.play('jump', true);
        }

        if (my.sprite.player.body.blocked.down) {
            this.canDoubleJump = true;
            this.hasDashed = false;
        }

        if (Phaser.Input.Keyboard.JustDown(cursors.up)) {
            if (my.sprite.player.body.blocked.down || this.canDoubleJump) {
                my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);
                this.jumpSound.play();
                if (!my.sprite.player.body.blocked.down) this.canDoubleJump = false;
            }
        }

        // Dash
        if (Phaser.Input.Keyboard.JustDown(this.shiftKey) && !this.hasDashed && !this.isDashing) {
            this.isDashing = true;
            this.hasDashed = true;
            let direction = (cursors.left.isDown) ? -1 : (cursors.right.isDown ? 1 : (my.sprite.player.body.velocity.x >= 0 ? 1 : -1));
            my.sprite.player.setVelocityX(direction * this.DASH_VELOCITY);
            my.sprite.player.setAccelerationX(0);
            my.sprite.player.setTint(0xffaaaa);
            this.time.delayedCall(this.DASH_DURATION, () => {
                this.isDashing = false;
                my.sprite.player.clearTint();
            });
        }

        // Restart
        if (Phaser.Input.Keyboard.JustDown(this.rKey)) {
            this.scene.restart({ level: this.currentLevel });
        }
    }

    // Handles level transition
    levelComplete() {
        this.levelClearedText.setVisible(true);
        this.physics.pause();
        my.sprite.player.anims.stop();
        my.sprite.player.setTint(0x00ff00);
        this.time.delayedCall(3000, () => {
            this.scene.start(this.currentLevel === 1 ? "platformerScene" : "TitleScene", { level: 2 });
        });
    }

    // Boosts jump temporarily
    activateJumpBoost() {
        if (this.powerupActive) return;
        this.powerupActive = true;
        this.JUMP_VELOCITY = -900;
        my.sprite.player.setTint(0x00ffff);
        this.time.delayedCall(5000, () => {
            this.JUMP_VELOCITY = this.JUMP_VELOCITY_DEFAULT;
            this.powerupActive = false;
            my.sprite.player.clearTint();
        });
    }

    // Handles taking damage
    takeDamage() {
        if (this.playerInvincible) return;
        this.playerHealth--;
        console.log("Player hit! Health:", this.playerHealth);
        this.healthText.setText(`Health: ${this.playerHealth}`);

        if (this.playerHealth <= 0) {
            this.playerInvincible = true;
            my.sprite.player.setTint(0xff0000);
            this.deathSound?.play();
            this.cameras.main.fadeOut(1000, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.restart({ level: this.currentLevel });
            });
            return;
        }

        my.sprite.player.setTint(0xff0000);
        this.playerInvincible = true;
        this.time.delayedCall(1000, () => {
            this.playerInvincible = false;
            my.sprite.player.clearTint();
        });
    }
}
class CreditsScene extends Phaser.Scene {
    constructor() {
        super("CreditsScene");
    }

    create() {
        this.cameras.main.setBackgroundColor('#000000');

        this.add.text(this.cameras.main.centerX, 60, "Game Credits", {
            fontSize: '32px',
            fill: '#ffffff',
            fontFamily: 'Arial',
            align: 'center'
        }).setOrigin(0.5);

        const credits = `
        Created by: Bella Weaver
        Music: Kenny Music Pack
        Tiles & Sprites: Kenney.nl
        Built with: Phaser

        Thanks for playing!
        `;

        this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, credits, {
            fontSize: '18px',
            fill: '#aaaaaa',
            fontFamily: 'Arial',
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(this.cameras.main.centerX, this.cameras.main.height - 50, "Press SPACE or click to return", {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.input.once('pointerdown', () => {
            this.scene.start("TitleScene");
        });

        this.input.keyboard.once('keydown-SPACE', () => {
            this.scene.start("TitleScene");
        });
    }
}


