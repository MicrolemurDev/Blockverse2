// Core Renderer
class WebGL2Renderer {
  // Privates
  #currentProgram;

  // Initiation
  constructor(canvas = false, data) {
    if (!canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = `gl2context`;

      document.body.appendChild(this.canvas);
    } else {
      this.canvas = canvas;
    }

    this.width = this.canvas.width;
    this.height = this.canvas.height;

    if (!data) {
      this.gl = this.canvas.getContext('webgl2', {
        preserveDrawingBuffer: true,
        antialias: false,
        premultipliedAlpha: false,
        powerPreference: "high-performance",
        stencil: false
      });
    } else {
      this.gl = this.canvas.getContext('webgl2', data);
    }

    if(!this.gl) {
      return null;
    }
  }

  // Compiling Shaders
  createVertexShader(source) {
    const shader = this.gl.createShader(this.gl.VERTEX_SHADER);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw this.gl.getShaderInfoLog(shader);
    } else {
      return shader;
    }
  }

  createFragmentShader(source) {
    const shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw this.gl.getShaderInfoLog(shader);
    } else {
      return shader;
    }
  }

  createProgram(vertexShader, fragmentShader) {
    const program = this.gl.createProgram()
    this.gl.attachShader(program, vertexShader)
    this.gl.attachShader(program, fragmentShader)
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
        throw "Error linking shaders."
    } else {
      return program;  
    }
  }

  // Uniform/Attrib Helpers
  setProgram(program) {
    this.gl.useProgram(program);
    this.#currentProgram = program;
  }

  getAttrib(name = "default") {
    return this.gl.getAttribLocation(this.#currentProgram, name);
  }
  
  getUniform(name = "default") {
    return this.gl.getUniformLocation(this.#currentProgram, name);
  }
}

// Exports
export { WebGL2Renderer }