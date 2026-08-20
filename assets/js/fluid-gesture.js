/**
 * Smart Ride - Fluid Gesture Canvas Simulation
 * High-performance WebGL fluid dynamics responding to pointer/touch gestures.
 * Optimized for 60fps rendering with smooth dissipation and glow.
 */

class FluidGestureEffect {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.gl = this.canvas.getContext('webgl2', { alpha: true, depth: false, antialias: false }) ||
              this.canvas.getContext('webgl', { alpha: true, depth: false, antialias: false });
    
    if (!this.gl) {
      console.warn('WebGL not supported, falling back to 2D canvas gesture effect');
      this.init2DFallback();
      return;
    }

    this.pointers = [];
    this.splats = [];
    this.config = {
      SIM_RESOLUTION: 128,
      DYE_RESOLUTION: 512,
      DENSITY_DISSIPATION: 0.96,
      VELOCITY_DISSIPATION: 0.98,
      PRESSURE_ITERATIONS: 16,
      SPLAT_RADIUS: 0.25,
      SPLAT_FORCE: 6000,
      COLOR_UPDATE_SPEED: 8,
      BACK_COLOR: { r: 0, g: 0, b: 0, a: 0 },
      BLOOM: true
    };

    this.initWebGL();
    this.bindEvents();
    this.startLoop();
  }

  initWebGL() {
    const gl = this.gl;
    const ext = gl.getExtension('OES_texture_float') || gl.getExtension('EXT_color_buffer_float');
    this.ext = ext;

    // Compile Shaders
    const baseVertexShader = `
      precision highp float;
      attribute vec2 aPosition;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform vec2 texelSize;
      void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const splatShaderSource = `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTarget;
      uniform float aspectRatio;
      uniform vec3 color;
      uniform vec2 point;
      uniform float radius;
      void main () {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / radius) * color;
        vec3 base = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
      }
    `;

    const advectionShaderSource = `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uVelocity;
      uniform sampler2D uSource;
      uniform vec2 texelSize;
      uniform float dt;
      uniform float dissipation;
      void main () {
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
        gl_FragColor = dissipation * texture2D(uSource, coord);
        gl_FragColor.a = 1.0;
      }
    `;

    const displayShaderSource = `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;
        // Warm amber / Smart Ride orange glow grading
        float a = max(c.r, max(c.g, c.b));
        gl_FragColor = vec4(c * 1.3, a * 0.75);
      }
    `;

    this.createQuadBuffer();
    this.splatProgram = this.createProgram(baseVertexShader, splatShaderSource);
    this.advectionProgram = this.createProgram(baseVertexShader, advectionShaderSource);
    this.displayProgram = this.createProgram(baseVertexShader, displayShaderSource);

    this.initFramebuffers();
  }

  createQuadBuffer() {
    const gl = this.gl;
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    this.quadIndices = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  }

  createProgram(vertexSrc, fragmentSrc) {
    const gl = this.gl;
    const vShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vShader, vertexSrc);
    gl.compileShader(vShader);

    const fShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fShader, fragmentSrc);
    gl.compileShader(fShader);

    const prog = gl.createProgram();
    gl.attachShader(prog, vShader);
    gl.attachShader(prog, fShader);
    gl.linkProgram(prog);
    return prog;
  }

  createFBO(w, h) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    return {
      fbo,
      texture,
      width: w,
      height: h,
      attach: (id) => {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      }
    };
  }

  createDoubleFBO(w, h) {
    let fbo1 = this.createFBO(w, h);
    let fbo2 = this.createFBO(w, h);
    return {
      width: w,
      height: h,
      texelSizeX: 1.0 / w,
      texelSizeY: 1.0 / h,
      get read() { return fbo1; },
      set read(value) { fbo1 = value; },
      get write() { return fbo2; },
      set write(value) { fbo2 = value; },
      swap() {
        const temp = fbo1;
        fbo1 = fbo2;
        fbo2 = temp;
      }
    };
  }

  initFramebuffers() {
    this.resizeCanvas();
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dyeW = Math.max(128, Math.floor(w / 2));
    const dyeH = Math.max(128, Math.floor(h / 2));
    const simW = Math.max(64, Math.floor(w / 4));
    const simH = Math.max(64, Math.floor(h / 4));

    this.density = this.createDoubleFBO(dyeW, dyeH);
    this.velocity = this.createDoubleFBO(simW, simH);
  }

  resizeCanvas() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      return true;
    }
    return false;
  }

  bindEvents() {
    let lastX = 0;
    let lastY = 0;

    const handlePointerMove = (x, y, force = 1) => {
      const rect = this.canvas.getBoundingClientRect();
      const posX = (x - rect.left) / rect.width;
      const posY = 1.0 - (y - rect.top) / rect.height;

      const dx = (x - lastX) * 0.05 * force;
      const dy = (lastY - y) * 0.05 * force;

      lastX = x;
      lastY = y;

      const hue = (Date.now() * 0.0005) % 1;
      const color = hue < 0.7 
        ? [0.95, 0.46, 0.22]   // Smart Ride Amber #e37038
        : [0.9, 0.76, 0.48];   // Soft gold accent

      this.splat(posX, posY, dx, dy, color);
    };

    window.addEventListener('mousemove', (e) => {
      handlePointerMove(e.clientX, e.clientY, 1.2);
    });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY, 2.0);
      }
    }, { passive: true });

    // Initial subtle ambient motion
    setTimeout(() => {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const rx = 0.3 + Math.random() * 0.4;
          const ry = 0.4 + Math.random() * 0.3;
          this.splat(rx, ry, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, [0.95, 0.45, 0.15]);
        }, i * 250);
      }
    }, 300);
  }

  splat(x, y, dx, dy, color) {
    this.splats.push({ x, y, dx, dy, color });
  }

  renderQuad() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndices);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  applySplats() {
    const gl = this.gl;
    if (this.splats.length === 0) return;

    gl.useProgram(this.splatProgram);
    gl.uniform1f(gl.getUniformLocation(this.splatProgram, 'aspectRatio'), this.canvas.width / this.canvas.height);
    gl.uniform1f(gl.getUniformLocation(this.splatProgram, 'radius'), 0.003);

    while (this.splats.length > 0) {
      const splat = this.splats.pop();

      gl.viewport(0, 0, this.velocity.width, this.velocity.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocity.write.fbo);
      gl.uniform1i(gl.getUniformLocation(this.splatProgram, 'uTarget'), this.velocity.read.attach(0));
      gl.uniform2f(gl.getUniformLocation(this.splatProgram, 'point'), splat.x, splat.y);
      gl.uniform3f(gl.getUniformLocation(this.splatProgram, 'color'), splat.dx * 10, splat.dy * 10, 0.0);
      this.renderQuad();
      this.velocity.swap();

      gl.viewport(0, 0, this.density.width, this.density.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.density.write.fbo);
      gl.uniform1i(gl.getUniformLocation(this.splatProgram, 'uTarget'), this.density.read.attach(0));
      gl.uniform2f(gl.getUniformLocation(this.splatProgram, 'point'), splat.x, splat.y);
      gl.uniform3f(gl.getUniformLocation(this.splatProgram, 'color'), splat.color[0], splat.color[1], splat.color[2]);
      this.renderQuad();
      this.density.swap();
    }
  }

  step() {
    const gl = this.gl;
    if (this.resizeCanvas()) {
      this.initFramebuffers();
    }

    this.applySplats();

    // Advect Velocity
    gl.useProgram(this.advectionProgram);
    gl.viewport(0, 0, this.velocity.width, this.velocity.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocity.write.fbo);
    gl.uniform2f(gl.getUniformLocation(this.advectionProgram, 'texelSize'), this.velocity.texelSizeX, this.velocity.texelSizeY);
    gl.uniform1i(gl.getUniformLocation(this.advectionProgram, 'uVelocity'), this.velocity.read.attach(0));
    gl.uniform1i(gl.getUniformLocation(this.advectionProgram, 'uSource'), this.velocity.read.attach(0));
    gl.uniform1f(gl.getUniformLocation(this.advectionProgram, 'dt'), 0.016);
    gl.uniform1f(gl.getUniformLocation(this.advectionProgram, 'dissipation'), this.config.VELOCITY_DISSIPATION);
    this.renderQuad();
    this.velocity.swap();

    // Advect Density
    gl.viewport(0, 0, this.density.width, this.density.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.density.write.fbo);
    gl.uniform2f(gl.getUniformLocation(this.advectionProgram, 'texelSize'), this.density.texelSizeX, this.density.texelSizeY);
    gl.uniform1i(gl.getUniformLocation(this.advectionProgram, 'uVelocity'), this.velocity.read.attach(0));
    gl.uniform1i(gl.getUniformLocation(this.advectionProgram, 'uSource'), this.density.read.attach(1));
    gl.uniform1f(gl.getUniformLocation(this.advectionProgram, 'dissipation'), this.config.DENSITY_DISSIPATION);
    this.renderQuad();
    this.density.swap();

    // Render to Screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.displayProgram);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uTexture'), this.density.read.attach(0));
    this.renderQuad();
  }

  startLoop() {
    const loop = () => {
      this.step();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  init2DFallback() {
    const ctx = this.canvas.getContext('2d');
    let particles = [];
    const addParticle = (x, y) => {
      for (let i = 0; i < 3; i++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
          radius: 14 + Math.random() * 26,
          alpha: 0.5,
          hue: 25 + Math.random() * 15
        });
      }
    };

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      addParticle(e.clientX - rect.left, e.clientY - rect.top);
    });

    const loop = () => {
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha *= 0.95;
        p.radius *= 0.98;
        if (p.alpha < 0.02) {
          particles.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        grad.addColorStop(0, `hsla(${p.hue}, 95%, 55%, ${p.alpha})`);
        grad.addColorStop(1, `hsla(${p.hue}, 95%, 55%, 0)`);
        ctx.fillStyle = grad;
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

window.FluidGestureEffect = FluidGestureEffect;
