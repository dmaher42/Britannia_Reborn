const CHARACTER_CLASSES = ['fighter', 'mage', 'bard', 'ranger'];
const DIRECTIONS = ['south', 'west', 'east', 'north'];
const ACTIONS = ['idle', 'walk', 'attack', 'cast', 'die'];

const DEFAULT_FRAME_COUNTS = {
  idle: 4,
  walk: 4,
  attack: 4,
  cast: 4,
  die: 4,
};

const DEFAULT_FRAME_TIMES = {
  idle: 320,
  walk: 120,
  attack: 90,
  cast: 110,
  die: 140,
};

export class AnimationSystem {
  constructor(spriteRenderer) {
    this.spriteRenderer = spriteRenderer;
    this.animations = new Map();
    this.activeAnimations = new Map();
    this.entityStates = new Map();
    this.setupCharacterAnimations();
    this.setupPlayerAnimations();
  }

  setupCharacterAnimations() {
    CHARACTER_CLASSES.forEach((charClass, classIndex) => {
      DIRECTIONS.forEach((direction, directionIndex) => {
        ACTIONS.forEach((action, actionIndex) => {
          const name = `${charClass}_${direction}_${action}`;
          const frameCount = this.getFrameCount(action);
          const animation = {
            sheet: 'characters',
            frameWidth: this.spriteRenderer?.tileSize ?? 32,
            frameHeight: this.spriteRenderer?.tileSize ?? 32,
            frames: [],
            frameTime: this.getFrameTime(action),
            loop: action === 'idle' || action === 'walk',
          };
          const startX = this.getAnimationStartX(classIndex, directionIndex, actionIndex);
          const startY = this.getAnimationStartY(classIndex, directionIndex, actionIndex);
          for (let frame = 0; frame < frameCount; frame += 1) {
            animation.frames.push({
              sheet: 'characters',
              x: startX + frame * animation.frameWidth,
              y: startY,
              width: animation.frameWidth,
              height: animation.frameHeight,
            });
          }
          this.animations.set(name, animation);
        });
      });
    });
    
    // Setup specific NPC animations (using the same layout but different sprite sheets)
    this.setupSpecificNPCAnimations();
  }

  /**
   * Setup animations for specific NPCs like Iolo and Shamino
   * These use the same animation structure but reference their own sprite sheets
   */
  setupSpecificNPCAnimations() {
    const specificNPCs = [
      { name: 'iolo', sheet: 'iolo', classType: 'bard' },
      { name: 'shamino', sheet: 'shamino', classType: 'ranger' },
      { name: 'avatar', sheet: 'avatar', classType: 'fighter' },
    ];
    
    specificNPCs.forEach(({ name, sheet, classType }) => {
      const classIndex = CHARACTER_CLASSES.indexOf(classType);
      if (classIndex === -1) return;
      
      DIRECTIONS.forEach((direction, directionIndex) => {
        ACTIONS.forEach((action, actionIndex) => {
          const animationName = `${name}_${direction}_${action}`;
          const frameCount = this.getFrameCount(action);
          const animation = {
            sheet: sheet,
            frameWidth: this.spriteRenderer?.tileSize ?? 32,
            frameHeight: this.spriteRenderer?.tileSize ?? 32,
            frames: [],
            frameTime: this.getFrameTime(action),
            loop: action === 'idle' || action === 'walk',
          };
          const startX = this.getAnimationStartX(classIndex, directionIndex, actionIndex);
          const startY = this.getAnimationStartY(classIndex, directionIndex, actionIndex);
          for (let frame = 0; frame < frameCount; frame += 1) {
            animation.frames.push({
              sheet: sheet,
              x: startX + frame * animation.frameWidth,
              y: startY,
              width: animation.frameWidth,
              height: animation.frameHeight,
            });
          }
          this.animations.set(animationName, animation);
        });
      });
    });
  }

  setupPlayerAnimations() {
    // Create animations for the player character using the player.png sprite sheet
    // Assuming the player sprite sheet has the same layout as the character sheet
    // but is specifically for the player/Avatar character
    DIRECTIONS.forEach((direction, directionIndex) => {
      ACTIONS.forEach((action, actionIndex) => {
        const name = `player_${direction}_${action}`;
        const frameCount = this.getFrameCount(action);
        const animation = {
          sheet: 'player',
          frameWidth: this.spriteRenderer?.tileSize ?? 32,
          frameHeight: this.spriteRenderer?.tileSize ?? 32,
          frames: [],
          frameTime: this.getFrameTime(action),
          loop: action === 'idle' || action === 'walk',
        };
        // For now, assume a simple layout where each direction/action combination
        // is laid out in rows and columns. This may need adjustment based on 
        // the actual sprite sheet layout provided in image1
        const startX = actionIndex * animation.frameWidth * frameCount;
        const startY = directionIndex * animation.frameHeight;
        for (let frame = 0; frame < frameCount; frame += 1) {
          animation.frames.push({
            sheet: 'player',
            x: startX + frame * animation.frameWidth,
            y: startY,
            width: animation.frameWidth,
            height: animation.frameHeight,
          });
        }
        this.animations.set(name, animation);
      });
    });
  }

  registerAnimation(name, config) {
    if (!config) return;
    const frameWidth = config.frameWidth ?? this.spriteRenderer?.tileSize ?? 32;
    const frameHeight = config.frameHeight ?? this.spriteRenderer?.tileSize ?? 32;
    const frameCount = Number.isFinite(config.frames) ? config.frames : config.frameCount ?? 4;
    const animation = {
      sheet: config.sheet ?? 'characters',
      frameWidth,
      frameHeight,
      frameTime: Number.isFinite(config.frameTime) ? config.frameTime : 120,
      loop: Boolean(config.loop),
      frames: [],
    };
    const startX = config.startX ?? 0;
    const startY = config.startY ?? 0;
    for (let frame = 0; frame < frameCount; frame += 1) {
      animation.frames.push({
        sheet: animation.sheet,
        x: startX + frame * frameWidth,
        y: startY,
        width: frameWidth,
        height: frameHeight,
      });
    }
    this.animations.set(name, animation);
  }

  getAnimationStartX(classIndex) {
    const frameWidth = this.spriteRenderer?.tileSize ?? 32;
    return 0 * frameWidth;
  }

  getAnimationStartY(classIndex, directionIndex, actionIndex) {
    const frameHeight = this.spriteRenderer?.tileSize ?? 32;
    const actionsPerDirection = ACTIONS.length;
    const directionsPerClass = DIRECTIONS.length * actionsPerDirection;
    const rowIndex = classIndex * directionsPerClass + directionIndex * actionsPerDirection + actionIndex;
    return rowIndex * frameHeight;
  }

  getFrameCount(action) {
    return DEFAULT_FRAME_COUNTS[action] ?? 4;
  }

  getFrameTime(action) {
    return DEFAULT_FRAME_TIMES[action] ?? 150;
  }

  playAnimation(entityId, animationName, options = {}) {
    if (!entityId || !animationName) return;
    const animation = this.animations.get(animationName);
    if (!animation) return;
    this.activeAnimations.set(entityId, {
      animation,
      currentFrame: 0,
      lastFrameTime: performance.now(),
      isPlaying: true,
      loop: options.loop ?? animation.loop,
    });
  }

  stopAnimation(entityId) {
    if (!entityId) return;
    this.activeAnimations.delete(entityId);
  }

  updateAnimations() {
    const now = performance.now();
    this.activeAnimations.forEach((animData, entityId) => {
      if (!animData.isPlaying) return;
      if (now - animData.lastFrameTime < animData.animation.frameTime) {
        return;
      }
      animData.currentFrame += 1;
      if (animData.currentFrame >= animData.animation.frames.length) {
        if (animData.loop ?? animData.animation.loop) {
          animData.currentFrame = 0;
        } else {
          animData.isPlaying = false;
          animData.currentFrame = animData.animation.frames.length - 1;
        }
      }
      animData.lastFrameTime = now;
      this.activeAnimations.set(entityId, animData);
    });
  }

  ensureAnimation(entityId, animationName) {
    const state = this.activeAnimations.get(entityId);
    if (!state || state.animationName !== animationName) {
      this.playAnimation(entityId, animationName);
      const anim = this.activeAnimations.get(entityId);
      if (anim) {
        anim.animationName = animationName;
        this.activeAnimations.set(entityId, anim);
      }
    }
  }

  renderEntity(entityId, destX, destY, options = {}) {
    const animData = this.activeAnimations.get(entityId);
    if (!animData) return;
    if (!animData.animation) return;
    const scale = options.scale ?? this.spriteRenderer.scale;
    this.spriteRenderer.drawAnimatedSprite(animData.animation, animData.currentFrame, destX, destY, { scale });
  }

  setEntityState(entityId, state) {
    if (!entityId) return;
    const previous = this.entityStates.get(entityId);
    if (previous && previous.action === state.action && previous.direction === state.direction && previous.base === state.base) {
      return;
    }
    this.entityStates.set(entityId, state);
    if (state.animation) {
      this.ensureAnimation(entityId, state.animation);
      return;
    }
    if (state.base) {
      this.ensureAnimation(entityId, state.base);
    }
  }

  getCharacterAnimationName(member, action = 'idle') {
    const direction = (member?.facing ?? 'south').toLowerCase();
    const normalizedAction = ACTIONS.includes(action) ? action : 'idle';
    
    // Check if this is the player character (Avatar) and use custom player sprites
    if (member?.name === 'Avatar') {
      return `player_${direction}_${normalizedAction}`;
    }
    
    // For other characters, use the regular class-based animations
    const base = (member?.class ?? 'fighter').toLowerCase();
    return `${base}_${direction}_${normalizedAction}`;
  }
}
