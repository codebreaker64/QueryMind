import { useEffect, useRef } from 'react'

export default function ShaderBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Sync canvas drawing buffer size with layout size
    function syncSize() {
      const w = canvas.clientWidth || window.innerWidth
      const h = canvas.clientHeight || window.innerHeight
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }

    let resizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(syncSize)
      resizeObserver.observe(canvas)
    } else {
      window.addEventListener('resize', syncSize)
    }
    syncSize()

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) {
      console.warn('[ShaderBackground] WebGL not supported, falling back to CSS background.')
      return
    }

    // Vertex shader code
    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `

    // Fragment shader code
    const fsSource = `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      varying vec2 v_texCoord;

      void main() {
        vec2 uv = v_texCoord;
        vec2 mouse = u_mouse / u_resolution;
        
        // Base colors from the Quantum Dark system
        vec3 background = vec3(0.035, 0.035, 0.043); // #09090b
        vec3 primary = vec3(0.388, 0.4, 0.945);    // #6366f1
        vec3 accent = vec3(0.024, 0.714, 0.839);     // #06b6d4
        
        float time = u_time * 0.1;
        
        // Procedural noise for the "quantum" field
        float n = sin(uv.x * 12.0 + time) * cos(uv.y * 8.0 - time * 0.5);
        n += sin(uv.x * 24.0 - time * 1.2) * cos(uv.y * 16.0 + time * 0.8);
        n *= 0.5 + 0.5;
        
        // Create a subtle grid
        vec2 grid = fract(uv * 50.0);
        float line = smoothstep(0.02, 0.0, grid.x) + smoothstep(0.02, 0.0, grid.y);
        
        // Combine layers
        vec3 color = background;
        
        // Add primary glow
        color = mix(color, primary, n * 0.12);
        
        // Interactive mouse glow
        float dist = length(uv - mouse);
        float mouseGlow = smoothstep(0.4, 0.0, dist);
        color += primary * mouseGlow * 0.15;
        
        // Subtle grid lines
        color += vec3(0.2, 0.2, 0.4) * line * 0.05;
        
        // Floating "particles" or data points
        float particles = pow(sin(uv.x * 100.0 + time) * cos(uv.y * 100.0 - time), 20.0);
        color += accent * particles * 0.2;

        gl_FragColor = vec4(color, 1.0);
      }
    `

    function loadShader(type, source) {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    const vertexShader = loadShader(gl.VERTEX_SHADER, vsSource)
    const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fsSource)
    if (!vertexShader || !fragmentShader) return

    const program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program))
      return
    }

    gl.useProgram(program)

    // Set up vertex buffer
    const vertices = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
       1.0,  1.0,
    ])
    const vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

    const aPosition = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(aPosition)
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(program, 'u_time')
    const uResolution = gl.getUniformLocation(program, 'u_resolution')
    const uMouse = gl.getUniformLocation(program, 'u_mouse')

    let mouseX = canvas.width / 2
    let mouseY = canvas.height / 2

    const handleMouseMove = (event) => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width && rect.height) {
        const nx = (event.clientX - rect.left) / rect.width
        const ny = 1.0 - (event.clientY - rect.top) / rect.height
        mouseX = nx * canvas.width
        mouseY = ny * canvas.height
      }
    }

    window.addEventListener('mousemove', handleMouseMove)

    let animationFrameId
    const render = (time) => {
      if (!resizeObserver) syncSize()
      gl.viewport(0, 0, canvas.width, canvas.height)
      
      gl.uniform1f(uTime, time * 0.001)
      gl.uniform2f(uResolution, canvas.width, canvas.height)
      gl.uniform2f(uMouse, mouseX, mouseY)

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('mousemove', handleMouseMove)
      if (resizeObserver) {
        resizeObserver.disconnect()
      } else {
        window.removeEventListener('resize', syncSize)
      }
      gl.deleteBuffer(vertexBuffer)
      gl.deleteProgram(program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
    }
  }, [])

  return (
    <div className="fixed inset-0 w-full h-full -z-10 bg-[#050508] overflow-hidden pointer-events-none">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  )
}
