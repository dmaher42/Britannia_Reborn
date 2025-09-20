const DEFAULT_DESCRIPTION = 'You see nothing special.';

const asNumber = (value, fallback = 0) =>
  Number.isFinite(value) ? Number(value) : fallback;

const cloneJSONLike = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneJSONLike(entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneJSONLike(entry)])
    );
  }
  return value;
};

const rehydrateAdditionalFields = (target, source, skipKeys = []) => {
  const reserved = new Set(['id', 'name', 'type', 'x', 'y', ...skipKeys]);
  Object.keys(source).forEach((key) => {
    if (reserved.has(key)) return;
    const value = source[key];
    if (value === undefined) return;
    target[key] = cloneJSONLike(value);
  });
};

export class WorldObject {
  constructor(id, name, type, x, y, options = {}) {
    if (!id) throw new Error('WorldObject requires an id.');
    this.id = id;
    this.name = name ?? id;
    this.type = type ?? 'item';
    this.x = asNumber(x, 0);
    this.y = asNumber(y, 0);
    this.weight = asNumber(options.weight, 1);
    this.description = options.description ?? DEFAULT_DESCRIPTION;
    this.canGet = options.canGet ?? true;
    this.canUse = options.canUse ?? false;
    this.isOpen = options.isOpen ?? false;
    this.contains = Array.isArray(options.contains) ? [...options.contains] : [];
    this.flags = { ...(options.flags ?? {}) };
  }

  clone() {
    return WorldObject.fromJSON(this.toJSON());
  }

  setPosition(x, y) {
    this.x = asNumber(x, this.x);
    this.y = asNumber(y, this.y);
  }

  position() {
    return { x: this.x, y: this.y };
  }

  blocksMovement() {
    return false;
  }

  onLook() {
    return this.description;
  }

  onGet() {
    if (!this.canGet) {
      return { success: false, message: "You can't take that." };
    }
    return { success: true, message: `You take the ${this.name}.` };
  }

  onUse() {
    if (!this.canUse) {
      return { success: false, message: "Nothing happens." };
    }
    return { success: true, message: 'You interact with the object.' };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      x: this.x,
      y: this.y,
      weight: this.weight,
      description: this.description,
      canGet: this.canGet,
      canUse: this.canUse,
      isOpen: this.isOpen,
      flags: { ...this.flags },
      contains: this.contains.map((entry) =>
        entry instanceof WorldObject ? entry.toJSON() : entry
      ),
    };
  }

  static fromJSON(data = {}) {
    if (!data || typeof data !== 'object') {
      throw new TypeError('Invalid world object data.');
    }
    const { type } = data;
    const Class = type ? WORLD_OBJECT_REGISTRY[type] : undefined;

    if (Class && typeof Class.fromJSON === 'function' && Class.fromJSON !== WorldObject.fromJSON) {
      return Class.fromJSON(data);
    }

    const instance = Class
      ? new Class(data.id, data.name, data.x, data.y, data)
      : new WorldObject(data.id, data.name, data.type, data.x, data.y, data);

    if (!(instance instanceof WorldObject)) {
      return instance;
    }

    if (!Class) {
      rehydrateAdditionalFields(instance, data, ['contains']);
      instance.contains = Array.isArray(data.contains)
        ? data.contains.map((entry) => {
            if (entry instanceof WorldObject) return entry;
            if (entry && typeof entry === 'object') {
              return WorldObject.fromJSON(entry);
            }
            return entry;
          })
        : [];
    }

    return instance;
  }
}

export class Item extends WorldObject {
  constructor(id, name, x, y, options = {}) {
    super(id, name, 'item', x, y, {
      ...options,
      canGet: options.canGet ?? true,
      canUse: options.canUse ?? Boolean(options.food || options.consumable || options.onUse),
    });
    this.stats = { ...(options.stats ?? {}) };
    this.stackable = options.stackable ?? false;
    this.quantity = Number.isFinite(options.quantity) ? Math.max(1, options.quantity) : 1;
    this.food = Boolean(options.food);
    this.consumable = Boolean(options.consumable ?? this.food);
    this.onConsume = typeof options.onUse === 'function' ? options.onUse : null;
    if (!options.description) {
      this.description = `You see ${this.article()} ${this.name}.`;
    }
  }

  article() {
    const first = (this.name ?? '').trim().charAt(0).toLowerCase();
    if (!first) return 'a';
    return 'aeiou'.includes(first) ? 'an' : 'a';
  }

  onUse(context = {}) {
    if (!this.canUse) {
      return { success: false, message: 'Nothing happens.' };
    }
    if (this.onConsume) {
      return this.onConsume({ ...context, item: this });
    }
    if (this.food) {
      const { character } = context;
      if (character && typeof character.heal === 'function') {
        const healed = character.heal(5);
        return {
          success: true,
          consumed: true,
          message: `You eat the ${this.name}. ${healed > 0 ? 'You feel refreshed.' : 'It has no effect.'}`,
        };
      }
      return {
        success: true,
        consumed: true,
        message: `You eat the ${this.name}. Delicious!`,
      };
    }
    return { success: true, message: `You inspect the ${this.name}.` };
  }

  toJSON() {
    return {
      ...super.toJSON(),
      stats: { ...this.stats },
      stackable: this.stackable,
      quantity: this.quantity,
      food: this.food,
      consumable: this.consumable,
    };
  }
}

export class Door extends WorldObject {
  constructor(id, name, x, y, options = {}) {
    super(id, name, 'door', x, y, {
      ...options,
      canGet: false,
      canUse: true,
    });
    this.isOpen = Boolean(options.isOpen);
    this.locked = Boolean(options.locked);
    this.opensTo = options.opensTo ?? null;
    if (!options.description) {
      this.description = `A ${this.name} ${this.isOpen ? 'stands open' : 'bars the way'}.`;
    }
  }

  blocksMovement() {
    return !this.isOpen;
  }

  onLook() {
    return `The ${this.name} is ${this.isOpen ? 'open' : 'closed'}.`;
  }

  setOpen(open) {
    if (this.locked) return false;
    this.isOpen = Boolean(open);
    return true;
  }

  toggle() {
    if (this.locked) return { success: false, message: "It won't budge." };
    this.isOpen = !this.isOpen;
    return {
      success: true,
      message: `You ${this.isOpen ? 'open' : 'close'} the ${this.name}.`,
    };
  }

  onUse() {
    return this.toggle();
  }

  onLeverToggle(state) {
    if (this.locked) return;
    this.isOpen = Boolean(state);
  }
}

export class Container extends WorldObject {
  constructor(id, name, x, y, options = {}) {
    super(id, name, 'container', x, y, {
      ...options,
      canGet: false,
      canUse: true,
      isOpen: options.isOpen ?? false,
    });
    this.contains = Array.isArray(options.contains)
      ? options.contains.map((entry) =>
          entry instanceof WorldObject ? entry.clone() : WorldObject.fromJSON(entry)
        )
      : [];
    if (!options.description) {
      this.description = `A ${this.name} ${this.isOpen ? 'lies open' : 'rests closed'}.`;
    }
  }

  onLook() {
    if (!this.isOpen) {
      return `The ${this.name} is closed.`;
    }
    if (this.contains.length === 0) {
      return `The ${this.name} is empty.`;
    }
    const itemList = this.contains.map((item) => item.name).join(', ');
    return `Inside you see ${itemList}.`;
  }

  onUse() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      if (this.contains.length === 0) {
        return { success: true, message: `You open the ${this.name}. It is empty.` };
      }
      const contents = this.contains.map((item) => item.name).join(', ');
      return {
        success: true,
        message: `You open the ${this.name}. Inside you find ${contents}.`,
      };
    }
    return { success: true, message: `You close the ${this.name}.` };
  }

  take(itemId = null) {
    if (!this.isOpen) {
      return { success: false, message: `The ${this.name} is closed.` };
    }
    if (this.contains.length === 0) {
      return { success: false, message: `The ${this.name} is empty.` };
    }
    let index = 0;
    if (itemId) {
      index = this.contains.findIndex((item) => item.id === itemId);
      if (index === -1) {
        return { success: false, message: 'That is not inside.' };
      }
    }
    const [item] = this.contains.splice(index, 1);
    return {
      success: true,
      item,
      message: `You take the ${item.name} from the ${this.name}.`,
    };
  }

  toJSON() {
    return {
      ...super.toJSON(),
      contains: this.contains.map((item) => item.toJSON()),
    };
  }
}

export class Lever extends WorldObject {
  constructor(id, name, x, y, options = {}) {
    super(id, name, 'lever', x, y, {
      ...options,
      canGet: false,
      canUse: true,
    });
    this.state = Boolean(options.state);
    this.toggles = options.toggles ?? null;
    if (!options.description) {
      this.description = `A lever protrudes from the wall. It is ${this.state ? 'pulled' : 'upright'}.`;
    }
  }

  onLook() {
    return `The ${this.name} is ${this.state ? 'pulled down' : 'in the up position'}.`;
  }

  onUse(context = {}) {
    this.state = !this.state;
    const { world } = context;
    let message = `You ${this.state ? 'pull' : 'reset'} the ${this.name}.`;
    if (this.toggles && world?.findObjectById) {
      const target = world.findObjectById(this.toggles);
      if (target && typeof target.onLeverToggle === 'function') {
        target.onLeverToggle(this.state);
        message += ` In the distance you hear ${target.isOpen ? 'something slide open.' : 'a door closing.'}`;
      }
    }
    return { success: true, message };
  }
}

export class Npc extends WorldObject {
  constructor(id, name, x, y, options = {}) {
    super(id, name, 'npc', x, y, {
      ...options,
      canGet: false,
      canUse: false,
    });
    this.dialogue = options.dialogue ?? [];
  }

  onLook() {
    return this.description ?? `You see ${this.name}.`;
  }
}

const WORLD_OBJECT_REGISTRY = {
  item: Item,
  door: Door,
  container: Container,
  lever: Lever,
  npc: Npc,
};

export const registerWorldObjectType = (type, ctor) => {
  if (!type || typeof ctor !== 'function') return;
  WORLD_OBJECT_REGISTRY[type] = ctor;
};

export const cloneWorldObject = (object) => (object instanceof WorldObject ? object.clone() : null);

