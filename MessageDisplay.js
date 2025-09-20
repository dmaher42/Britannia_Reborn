export class MessageDisplay {
  constructor({ logElement, statusElement, modeElement, maxMessages = 6 } = {}) {
    this.logElement = logElement ?? null;
    this.statusElement = statusElement ?? null;
    this.modeElement = modeElement ?? null;
    this.maxMessages = maxMessages;
    this.messages = [];
    this.status = '';
    this.mode = null;
    this.render();
  }

  setStatus(text) {
    this.status = text ?? '';
    if (this.statusElement) {
      this.statusElement.textContent = this.status;
    }
  }

  setMode(mode) {
    this.mode = mode;
    if (this.modeElement) {
      this.modeElement.textContent = mode ? `Mode: ${mode.toUpperCase()}` : 'Mode: Walk';
    }
  }

  log(message) {
    if (!message) return;
    this.messages.push(message);
    if (this.messages.length > this.maxMessages) {
      this.messages.splice(0, this.messages.length - this.maxMessages);
    }
    this.render();
  }

  clear() {
    this.messages = [];
    this.render();
  }

  render() {
    if (!this.logElement) return;
    this.logElement.replaceChildren();
    this.messages.slice().reverse().forEach((entry) => {
      const line = document.createElement('div');
      line.className = 'message';
      line.textContent = entry;
      this.logElement.appendChild(line);
    });
  }
}

