class CanvasRenderer {
  #filtersSupported; // Are filters supported?
  constructor(canvas) {
    if (!canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = `canvas2d-context`;

      document.body.appendChild(this.canvas);
    } else {
      this.canvas = canvas;
    }

    this.ctx = this.canvas.getContext('2d'); // Hence, the Canvas Renderer was born

    // Loading Defaults...
    this.ctx.imageSmoothingEnabled = false; // Default to Pixelation!
    if (this.ctx.filter) {
      this.#filtersSupported = true;
    } else {
      this.#filtersSupported = false;
    }
  }

  fill(r, g = r, b = r, a = 1) {
    this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  stroke(r, g = r, b = r) {
    this.ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;;
  }

  shadow(x = 1, y = 1, blur = 2) {
    this.ctx.shadowColor = this.ctx.fillStyle;
    this.ctx.shadowOffsetX = x;
    this.ctx.shadowOffsetY = y;
    this.ctx.shadowBlur = blur;
  } // New Command
  
  rect(x, y, width, height) {
    this.ctx.fillRect(x, y, width, height);
  }

  line(x1, y1, x2, y2) {
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
  }

  text(txt = 'Placeholder', x, y, h = 0) {
    const lines = txt.split("\n");
    const lines_ln = lines.length;
    for (let i = 0; i < lines_ln; i++) {
      this.ctx.fillText(lines[i], x, y + h * i);
    }
  }

  textSize(size = 24) {
    this.ctx.font = size + 'px Monospace'; // We default to monospace font
  } 

  textAlign(mode = "left") {
    this.ctx.textAlign = mode;
  }

  strokeWeight(num) {
    this.ctx.lineWidth = num;
  }

  cursor(type) {
    const ARROW = "arrow";
    const HAND = "pointer";
    const CROSS = "crosshair";

    this.canvas.style.cursor = type;
  }
}

// Exports
export { CanvasRenderer }