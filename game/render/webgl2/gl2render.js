// Constants
const IMPORT_PREFIX = `../../`; // Fix me for minification!

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

  // Compiling Shaders/Programs
  createVertexShader(source) {
    const shader = this.gl.createShader(this.gl.VERTEX_SHADER);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw this.gl.getShaderInfoLog(shader)+"\nVERTEX_SHADER_ERR";
    } else {
      return shader;
    }
  }

  createFragmentShader(source) {
    const shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw this.gl.getShaderInfoLog(shader)+"\nFRAGMENT_SHADER_ERR";
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

  // Import Shaders
  importShader(src) {
    let s = `${IMPORT_PREFIX}${src}`;
    if (s.includes(`${IMPORT_PREFIX}./`)) { s.replace(`${IMPORT_PREFIX}./`, IMPORT_PREFIX); } // Unsure if this is needed

    let shaderType, shaderSource, platform, shader;
    import(s).then((m) => {
      shaderType = m.SHADER_TYPE;
      shaderSource = m.SOURCE;
      platform = m.PLATFORM;

      // Verification
      if (!platform) {
        console.warn(`Shader at ${s} did not specify a platform! Assuming WEBGL2...`);
        platform = 'WEBGL2';
      }

      if (!shaderType) {
        console.error(`Shader at ${s} did not specify type.`);
        return null;
      }

      if (!shaderSource) {
        console.error(`Shader at ${s} did not specify any source.`);
        return null;        
      }

      // Create the shader
      switch (shaderType) {
        case 'VERTEX':
          shader = this.createVertexShader(shaderSource);
          break;

        case 'FRAGMENT':
          shader = this.createFragmentShader(shaderSource);
          break;

        default:
          console.error(`Shader at ${s} did not give a valid type.`);
          return null;
      }

      // If the shader is valid, return it
      if (!shader) {
        console.error(`Shader at ${s} failed to compile.`);
        return null;
      } else {
        return shader; // It worked!
      }
    });
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