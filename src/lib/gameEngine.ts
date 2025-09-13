import { GameState, DinoState, Obstacle, Cloud } from './gameTypes';
import { GAME_CONFIG, SPRITE_CONFIG } from './gameConfig';
import { audioManager } from './audioManager';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gameState: GameState;
  private dinoState: DinoState;
  private obstacles: Obstacle[] = [];
  private clouds: Cloud[] = [];
  private keys: Set<string> = new Set();
  private lastTime: number = 0;
  private nextObstacleDistance: number = 0;
  private animationId: number = 0;
  private isRunning: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    this.gameState = {
      state: 'MENU',
      score: 0,
      highScore: parseInt(localStorage.getItem('dino-high-score') || '0'),
      speed: GAME_CONFIG.game.initialSpeed,
      groundX: 0,
    };

    this.dinoState = {
      x: GAME_CONFIG.dino.x,
      y: GAME_CONFIG.dino.groundY,
      velocityY: 0,
      state: 'RUNNING',
      animationFrame: 0,
      animationTimer: 0,
    };

    this.setupEventListeners();
    this.generateInitialClouds();
    this.nextObstacleDistance = GAME_CONFIG.obstacles.minDistance;
  }

  private setupEventListeners() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      this.handleInput(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    this.canvas.addEventListener('click', () => {
      this.handleInput('Space');
    });

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleInput('Space');
    });
  }

  private handleInput(code: string) {
    audioManager.resumeContext();

    if (this.gameState.state === 'MENU' || this.gameState.state === 'GAME_OVER') {
      if (code === 'Space') {
        this.startGame();
      }
    } else if (this.gameState.state === 'PLAYING') {
      if (code === 'Space' && this.dinoState.state !== 'JUMPING') {
        this.jump();
      } else if (code === 'ArrowDown') {
        this.duck();
      }
    }
  }

  private startGame() {
    this.gameState.state = 'PLAYING';
    this.gameState.score = 0;
    this.gameState.speed = GAME_CONFIG.game.initialSpeed;
    this.gameState.groundX = 0;
    
    this.dinoState.x = GAME_CONFIG.dino.x;
    this.dinoState.y = GAME_CONFIG.dino.groundY;
    this.dinoState.velocityY = 0;
    this.dinoState.state = 'RUNNING';
    this.dinoState.animationFrame = 0;
    this.dinoState.animationTimer = 0;

    this.obstacles = [];
    this.nextObstacleDistance = GAME_CONFIG.obstacles.minDistance;
  }

  private jump() {
    if (this.dinoState.y >= GAME_CONFIG.dino.groundY) {
      this.dinoState.velocityY = GAME_CONFIG.dino.jumpForce;
      this.dinoState.state = 'JUMPING';
      audioManager.playSound('jump', 0.3);
    }
  }

  private duck() {
    if (this.dinoState.y >= GAME_CONFIG.dino.groundY) {
      this.dinoState.state = 'DUCKING';
    }
  }

  private generateInitialClouds() {
    for (let i = 0; i < 5; i++) {
      this.clouds.push({
        x: Math.random() * GAME_CONFIG.canvas.width,
        y: 20 + Math.random() * 60,
        speed: 0.5 + Math.random() * 1,
      });
    }
  }

  private updateDino(deltaTime: number) {
    if (this.gameState.state !== 'PLAYING') return;

    // Handle ducking
    if (!this.keys.has('ArrowDown') && this.dinoState.state === 'DUCKING') {
      this.dinoState.state = 'RUNNING';
    }

    // Apply gravity
    this.dinoState.velocityY += GAME_CONFIG.dino.gravity;
    if (this.dinoState.velocityY > GAME_CONFIG.dino.maxFallSpeed) {
      this.dinoState.velocityY = GAME_CONFIG.dino.maxFallSpeed;
    }

    // Update position
    this.dinoState.y += this.dinoState.velocityY;

    // Ground collision
    if (this.dinoState.y >= GAME_CONFIG.dino.groundY) {
      this.dinoState.y = GAME_CONFIG.dino.groundY;
      this.dinoState.velocityY = 0;
      if (this.dinoState.state === 'JUMPING') {
        this.dinoState.state = 'RUNNING';
      }
    }

    // Animation
    this.dinoState.animationTimer += deltaTime;
    const frameTime = SPRITE_CONFIG.dino[this.dinoState.state.toLowerCase() as keyof typeof SPRITE_CONFIG.dino].frameTime;
    if (frameTime > 0 && this.dinoState.animationTimer >= frameTime) {
      this.dinoState.animationTimer = 0;
      this.dinoState.animationFrame = (this.dinoState.animationFrame + 1) % 
        SPRITE_CONFIG.dino[this.dinoState.state.toLowerCase() as keyof typeof SPRITE_CONFIG.dino].frames;
    }
  }

  private updateObstacles(deltaTime: number) {
    if (this.gameState.state !== 'PLAYING') return;

    // Move existing obstacles
    this.obstacles = this.obstacles.filter(obstacle => {
      obstacle.x -= this.gameState.speed;
      return obstacle.x + obstacle.width > 0;
    });

    // Generate new obstacles
    this.nextObstacleDistance -= this.gameState.speed;
    if (this.nextObstacleDistance <= 0) {
      this.generateObstacle();
      this.nextObstacleDistance = GAME_CONFIG.obstacles.minDistance + 
        Math.random() * (GAME_CONFIG.obstacles.maxDistance - GAME_CONFIG.obstacles.minDistance);
    }
  }

  private generateObstacle() {
    const types: Obstacle['type'][] = ['CACTUS_SMALL', 'CACTUS_LARGE', 'BIRD_HIGH', 'BIRD_LOW'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let obstacle: Obstacle;

    switch (type) {
      case 'CACTUS_SMALL':
        obstacle = {
          x: GAME_CONFIG.canvas.width,
          y: GAME_CONFIG.ground.y - SPRITE_CONFIG.obstacles.cactus_small.height,
          width: SPRITE_CONFIG.obstacles.cactus_small.width,
          height: SPRITE_CONFIG.obstacles.cactus_small.height,
          type,
        };
        break;
      case 'CACTUS_LARGE':
        obstacle = {
          x: GAME_CONFIG.canvas.width,
          y: GAME_CONFIG.ground.y - SPRITE_CONFIG.obstacles.cactus_large.height,
          width: SPRITE_CONFIG.obstacles.cactus_large.width,
          height: SPRITE_CONFIG.obstacles.cactus_large.height,
          type,
        };
        break;
      case 'BIRD_HIGH':
        obstacle = {
          x: GAME_CONFIG.canvas.width,
          y: GAME_CONFIG.ground.y - 80,
          width: SPRITE_CONFIG.obstacles.bird.width,
          height: SPRITE_CONFIG.obstacles.bird.height,
          type,
        };
        break;
      case 'BIRD_LOW':
        obstacle = {
          x: GAME_CONFIG.canvas.width,
          y: GAME_CONFIG.ground.y - 40,
          width: SPRITE_CONFIG.obstacles.bird.width,
          height: SPRITE_CONFIG.obstacles.bird.height,
          type,
        };
        break;
    }

    this.obstacles.push(obstacle);
  }

  private updateClouds() {
    if (this.gameState.state !== 'PLAYING') return;

    this.clouds.forEach(cloud => {
      cloud.x -= cloud.speed;
      if (cloud.x + SPRITE_CONFIG.clouds.width < 0) {
        cloud.x = GAME_CONFIG.canvas.width + Math.random() * 200;
        cloud.y = 20 + Math.random() * 60;
      }
    });
  }

  private updateGame(deltaTime: number) {
    if (this.gameState.state !== 'PLAYING') return;

    // Update score
    this.gameState.score += 0.1;

    // Increase speed
    if (Math.floor(this.gameState.score) % GAME_CONFIG.game.speedIncreaseInterval === 0) {
      this.gameState.speed = Math.min(this.gameState.speed + GAME_CONFIG.game.speedIncrease, 15);
    }

    // Update ground position
    this.gameState.groundX -= this.gameState.speed;
    if (this.gameState.groundX <= -24) {
      this.gameState.groundX = 0;
    }

    // Check collisions
    this.checkCollisions();

    // Play score sound every 100 points
    if (Math.floor(this.gameState.score) % 100 === 0 && this.gameState.score > 0) {
      audioManager.playSound('score', 0.2);
    }
  }

  private checkCollisions() {
    const dinoRect = {
      x: this.dinoState.x + 5,
      y: this.dinoState.y + 5,
      width: GAME_CONFIG.dino.width - 10,
      height: this.dinoState.state === 'DUCKING' ? GAME_CONFIG.dino.duckHeight - 10 : GAME_CONFIG.dino.height - 10,
    };

    for (const obstacle of this.obstacles) {
      const obstacleRect = {
        x: obstacle.x + 3,
        y: obstacle.y + 3,
        width: obstacle.width - 6,
        height: obstacle.height - 6,
      };

      if (this.isColliding(dinoRect, obstacleRect)) {
        this.gameOver();
        return;
      }
    }
  }

  private isColliding(rect1: any, rect2: any): boolean {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
  }

  private gameOver() {
    this.gameState.state = 'GAME_OVER';
    this.dinoState.state = 'DEAD';
    audioManager.playSound('hit', 0.5);

    // Update high score
    const score = Math.floor(this.gameState.score);
    if (score > this.gameState.highScore) {
      this.gameState.highScore = score;
      localStorage.setItem('dino-high-score', score.toString());
    }
  }

  private render() {
    // Clear canvas
    this.ctx.fillStyle = '#f7f7f7';
    this.ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);

    // Draw clouds
    this.renderClouds();

    // Draw ground
    this.renderGround();

    // Draw obstacles
    this.renderObstacles();

    // Draw dino
    this.renderDino();

    // Draw UI
    this.renderUI();
  }

  private renderClouds() {
    this.ctx.fillStyle = '#c0c0c0';
    this.clouds.forEach(cloud => {
      // Simple cloud shape
      this.ctx.beginPath();
      this.ctx.arc(cloud.x, cloud.y, 8, 0, Math.PI * 2);
      this.ctx.arc(cloud.x + 12, cloud.y, 12, 0, Math.PI * 2);
      this.ctx.arc(cloud.x + 24, cloud.y, 8, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  private renderGround() {
    this.ctx.fillStyle = '#535353';
    this.ctx.fillRect(0, GAME_CONFIG.ground.y, GAME_CONFIG.canvas.width, 2);

    // Ground texture
    this.ctx.fillStyle = '#b0b0b0';
    for (let x = this.gameState.groundX; x < GAME_CONFIG.canvas.width; x += 24) {
      if (Math.random() > 0.7) {
        this.ctx.fillRect(x, GAME_CONFIG.ground.y + 2, 2, 2);
      }
    }
  }

  private renderDino() {
    this.ctx.fillStyle = '#535353';
    
    const dinoHeight = this.dinoState.state === 'DUCKING' ? GAME_CONFIG.dino.duckHeight : GAME_CONFIG.dino.height;
    
    // Simple dino shape
    this.ctx.fillRect(this.dinoState.x, this.dinoState.y, GAME_CONFIG.dino.width, dinoHeight);
    
    // Dino details
    this.ctx.fillStyle = '#ffffff';
    // Eye
    this.ctx.fillRect(this.dinoState.x + 25, this.dinoState.y + 8, 3, 3);
    
    // Different poses
    if (this.dinoState.state === 'DEAD') {
      this.ctx.fillStyle = '#ff0000';
      this.ctx.fillRect(this.dinoState.x + 25, this.dinoState.y + 8, 3, 3);
    }
  }

  private renderObstacles() {
    this.ctx.fillStyle = '#535353';
    
    this.obstacles.forEach(obstacle => {
      switch (obstacle.type) {
        case 'CACTUS_SMALL':
        case 'CACTUS_LARGE':
          // Cactus shape
          this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
          // Cactus arms
          if (obstacle.type === 'CACTUS_LARGE') {
            this.ctx.fillRect(obstacle.x - 4, obstacle.y + 10, 8, 3);
            this.ctx.fillRect(obstacle.x + obstacle.width - 4, obstacle.y + 20, 8, 3);
          }
          break;
        case 'BIRD_HIGH':
        case 'BIRD_LOW':
          // Bird shape (animated)
          const wingOffset = Math.sin(Date.now() * 0.01) * 3;
          this.ctx.fillRect(obstacle.x, obstacle.y + wingOffset, obstacle.width, obstacle.height);
          // Wing details
          this.ctx.fillRect(obstacle.x + 5, obstacle.y + wingOffset - 5, 15, 3);
          this.ctx.fillRect(obstacle.x + 5, obstacle.y + wingOffset + obstacle.height + 2, 15, 3);
          break;
      }
    });
  }

  private renderUI() {
    this.ctx.fillStyle = '#535353';
    this.ctx.font = '16px monospace';
    this.ctx.textAlign = 'right';
    
    // Score
    const score = Math.floor(this.gameState.score).toString().padStart(5, '0');
    this.ctx.fillText(`HI ${this.gameState.highScore.toString().padStart(5, '0')} ${score}`, 
                     GAME_CONFIG.canvas.width - 20, 30);

    // Game state messages
    this.ctx.textAlign = 'center';
    this.ctx.font = '24px monospace';

    if (this.gameState.state === 'MENU') {
      this.ctx.fillText('PRESS SPACE TO START', GAME_CONFIG.canvas.width / 2, GAME_CONFIG.canvas.height / 2 - 20);
    } else if (this.gameState.state === 'GAME_OVER') {
      this.ctx.fillText('GAME OVER', GAME_CONFIG.canvas.width / 2, GAME_CONFIG.canvas.height / 2 - 40);
      this.ctx.font = '16px monospace';
      this.ctx.fillText('PRESS SPACE TO RESTART', GAME_CONFIG.canvas.width / 2, GAME_CONFIG.canvas.height / 2 - 10);
    }
  }

  private gameLoop = (currentTime: number) => {
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    this.updateDino(deltaTime);
    this.updateObstacles(deltaTime);
    this.updateClouds();
    this.updateGame(deltaTime);

    this.render();

    if (this.isRunning) {
      this.animationId = requestAnimationFrame(this.gameLoop);
    }
  };

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    audioManager.initialize();
    this.lastTime = performance.now();
    this.animationId = requestAnimationFrame(this.gameLoop);
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  getScore() {
    return Math.floor(this.gameState.score);
  }

  getHighScore() {
    return this.gameState.highScore;
  }
}