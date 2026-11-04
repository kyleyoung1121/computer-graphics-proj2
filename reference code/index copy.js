// =====================================================================
//  Project 2: Cube world -- Level 0
//  - Create a web application using html, css, javascript and webgl. 
//  - A portion of this page (a header) should give a title, your name and have space for information about your project. 
//  - Display a single cube of dimensions 2x2x2 in your scene.  
// =====================================================================

// Get a reference to WebGL
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl');


// ---------------------------------------------------------------------
// 1. SHADERS (GLSL)
// ---------------------------------------------------------------------

// Identity function to match 'glsl literal' linter
const glsl = x => x;

const vertexShaderSource = glsl`
  attribute vec3 aPosition;   // corner position of the cube (model space)
  attribute vec3 aNormal;     // direction the face is pointing
  attribute vec3 aColor;      // this vertex's color (red, green, blue: 0..1)

  uniform mat4 uModel;        // moves/scales THIS cube into the world
  uniform mat4 uView;         // where the camera is and where it looks
  uniform mat4 uProjection;   // perspective: far things look smaller

  varying vec3 vNormal;       // handed to the fragment shader
  varying vec3 vColor;        // handed to the fragment shader

  void main() {
    // Turn the normal the same way the cube is turned.
    vNormal = normalize(mat3(uModel) * aNormal);

    vColor = aColor;

    // model -> world -> camera -> screen  (vector math below is shown right to left)
    gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
  }
`;

const fragmentShaderSource = glsl`
  precision mediump float;

  // cube's color (RGB, 0-1)
  varying vec3 vColor;
  varying vec3 vNormal;

  void main() {
    // Simple lighting so we can tell the faces of a cube apart.
    // A face pointing toward the light is bright; one facing away is dim.
    vec3 lightDirection = normalize(vec3(0.5, 1.0, 0.3));
    float brightness = max(dot(vNormal, lightDirection), 0.0);

    // Keep 30% "ambient" light so faces in shadow aren't pure black.
    float light = 0.3 + 0.7 * brightness;

    vec3 colorMod = vNormal * 0.2;

    gl_FragColor = vec4(vColor * light, 1.0);   // 1.0 = fully opaque

  }
`;

// Compile one shader and report any GLSL errors.
function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

// A "program" is a vertex shader + a fragment shader linked together.
const program = gl.createProgram();
gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexShaderSource));
gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource));
gl.linkProgram(program);
gl.useProgram(program);


// ---------------------------------------------------------------------
// 2. CUBE GEOMETRY → BUFFER
//    One cube, 1 unit wide, with its bottom at y = 0 (so it sits on the
//    ground). Every cube in the scene reuses this same data; uModel is
//    what makes each one different.
//
//    Each face = 2 triangles = 6 vertices. Each vertex has 6 numbers:
//         x,    y,    z,      nx, ny, nz   (position, then normal)
// ---------------------------------------------------------------------

const BROWN = [0.37, 0.27, 0.19];
const MUTED_GREEN = [0.20, 0.37, 0.19];
const OLIVE_GREEN = [0.28, 0.37, 0.19];
const DARK_GREEN = [0.19, 0.25, 0.15];
const VIBRANT_GREEN = [0.22, 0.47, 0.07];
const WHITE = [0, 0, 0];

const cubeVertices = new Float32Array([
    // Front face (normal points toward +z)
    -0.5,  0,  0.5,  0,  0,  1,   ...BROWN,
     0.5,  0,  0.5,  0,  0,  1,   ...BROWN,
     0.5,  1,  0.5,  0,  0,  1,   ...VIBRANT_GREEN,
    -0.5,  0,  0.5,  0,  0,  1,   ...BROWN,
     0.5,  1,  0.5,  0,  0,  1,   ...VIBRANT_GREEN,
    -0.5,  1,  0.5,  0,  0,  1,   ...OLIVE_GREEN,

    // Back face (-z)
    -0.5,  0, -0.5,  0,  0, -1,   ...BROWN,
     0.5,  1, -0.5,  0,  0, -1,   ...DARK_GREEN,
     0.5,  0, -0.5,  0,  0, -1,   ...BROWN,
    -0.5,  0, -0.5,  0,  0, -1,   ...BROWN,
    -0.5,  1, -0.5,  0,  0, -1,   ...MUTED_GREEN,
     0.5,  1, -0.5,  0,  0, -1,   ...DARK_GREEN,

    // Top face (+y)
    -0.5,  1, -0.5,  0,  1,  0,   ...MUTED_GREEN,
    -0.5,  1,  0.5,  0,  1,  0,   ...OLIVE_GREEN,
     0.5,  1,  0.5,  0,  1,  0,   ...VIBRANT_GREEN,
    -0.5,  1, -0.5,  0,  1,  0,   ...MUTED_GREEN,
     0.5,  1,  0.5,  0,  1,  0,   ...VIBRANT_GREEN,
     0.5,  1, -0.5,  0,  1,  0,   ...DARK_GREEN,

    // Bottom face (-y)
    -0.5,  0, -0.5,  0, -1,  0,   ...BROWN,
     0.5,  0,  0.5,  0, -1,  0,   ...BROWN,
    -0.5,  0,  0.5,  0, -1,  0,   ...BROWN,
    -0.5,  0, -0.5,  0, -1,  0,   ...BROWN,
     0.5,  0, -0.5,  0, -1,  0,   ...BROWN,
     0.5,  0,  0.5,  0, -1,  0,   ...BROWN,

    // Right face (+x)
     0.5,  0, -0.5,  1,  0,  0,   ...BROWN,
     0.5,  1, -0.5,  1,  0,  0,   ...DARK_GREEN,
     0.5,  1,  0.5,  1,  0,  0,   ...VIBRANT_GREEN,
     0.5,  0, -0.5,  1,  0,  0,   ...BROWN,
     0.5,  1,  0.5,  1,  0,  0,   ...VIBRANT_GREEN,
     0.5,  0,  0.5,  1,  0,  0,   ...BROWN,

    // Left face (-x)
    -0.5,  0, -0.5, -1,  0,  0,   ...BROWN,
    -0.5,  1,  0.5, -1,  0,  0,   ...OLIVE_GREEN,
    -0.5,  1, -0.5, -1,  0,  0,   ...MUTED_GREEN,
    -0.5,  0, -0.5, -1,  0,  0,   ...BROWN,
    -0.5,  0,  0.5, -1,  0,  0,   ...BROWN,
    -0.5,  1,  0.5, -1,  0,  0,   ...OLIVE_GREEN,
]);
const CUBE_VERTEX_COUNT = 36;

const cloudCubeVertices = new Float32Array([
    // Front face (normal points toward +z)
    -0.5,  0,  0.5,  0,  0,  1,   ...WHITE,
     0.5,  0,  0.5,  0,  0,  1,   ...WHITE,
     0.5,  1,  0.5,  0,  0,  1,   ...WHITE,
    -0.5,  0,  0.5,  0,  0,  1,   ...WHITE,
     0.5,  1,  0.5,  0,  0,  1,   ...WHITE,
    -0.5,  1,  0.5,  0,  0,  1,   ...WHITE,

    // Back face (-z)
    -0.5,  0, -0.5,  0,  0, -1,   ...WHITE,
     0.5,  1, -0.5,  0,  0, -1,   ...WHITE,
     0.5,  0, -0.5,  0,  0, -1,   ...WHITE,
    -0.5,  0, -0.5,  0,  0, -1,   ...WHITE,
    -0.5,  1, -0.5,  0,  0, -1,   ...WHITE,
     0.5,  1, -0.5,  0,  0, -1,   ...WHITE,

    // Top face (+y)
    -0.5,  1, -0.5,  0,  1,  0,   ...WHITE,
    -0.5,  1,  0.5,  0,  1,  0,   ...WHITE,
     0.5,  1,  0.5,  0,  1,  0,   ...WHITE,
    -0.5,  1, -0.5,  0,  1,  0,   ...WHITE,
     0.5,  1,  0.5,  0,  1,  0,   ...WHITE,
     0.5,  1, -0.5,  0,  1,  0,   ...WHITE,

    // Bottom face (-y)
    -0.5,  0, -0.5,  0, -1,  0,   ...WHITE,
     0.5,  0,  0.5,  0, -1,  0,   ...WHITE,
    -0.5,  0,  0.5,  0, -1,  0,   ...WHITE,
    -0.5,  0, -0.5,  0, -1,  0,   ...WHITE,
     0.5,  0, -0.5,  0, -1,  0,   ...WHITE,
     0.5,  0,  0.5,  0, -1,  0,   ...WHITE,

    // Right face (+x)
     0.5,  0, -0.5,  1,  0,  0,   ...WHITE,
     0.5,  1, -0.5,  1,  0,  0,   ...WHITE,
     0.5,  1,  0.5,  1,  0,  0,   ...WHITE,
     0.5,  0, -0.5,  1,  0,  0,   ...WHITE,
     0.5,  1,  0.5,  1,  0,  0,   ...WHITE,
     0.5,  0,  0.5,  1,  0,  0,   ...WHITE,

    // Left face (-x)
    -0.5,  0, -0.5, -1,  0,  0,   ...WHITE,
    -0.5,  1,  0.5, -1,  0,  0,   ...WHITE,
    -0.5,  1, -0.5, -1,  0,  0,   ...WHITE,
    -0.5,  0, -0.5, -1,  0,  0,   ...WHITE,
    -0.5,  0,  0.5, -1,  0,  0,   ...WHITE,
    -0.5,  1,  0.5, -1,  0,  0,   ...WHITE,
]);
const CLOUD_CUBE_VERTEX_COUNT = 36;

// Copy the vertex data into GPU memory.
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

// Tell the GPU how to read the buffer: which numbers are the position
// and which are the normal.
//   stride = bytes from one vertex to the next = 6 floats × 4 bytes = 24
//   offset = where in each vertex this attribute starts
const BYTES_PER_FLOAT = 4;
const stride = 9 * BYTES_PER_FLOAT;

// aPosition: the first 3 numbers of each vertex (x, y, z), offset 0.
const aPosition = gl.getAttribLocation(program, 'aPosition');
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, stride, 0);

// aNormal: the next 3 numbers (nx, ny, nz), so skip past the 3 position
// floats = 12 bytes into each vertex.
const aNormal = gl.getAttribLocation(program, 'aNormal');
gl.enableVertexAttribArray(aNormal);
gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, stride, 3 * BYTES_PER_FLOAT);

// aColor: the last 3 numbers (r, g, b), so skip past position AND
// normal: 6 floats = 24 bytes into each vertex.
const aColor = gl.getAttribLocation(program, 'aColor');
gl.enableVertexAttribArray(aColor);
gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 6 * BYTES_PER_FLOAT);

// Look up where each uniform lives so we can set it later.
const uModel = gl.getUniformLocation(program, 'uModel');
const uView = gl.getUniformLocation(program, 'uView');
const uProjection = gl.getUniformLocation(program, 'uProjection');
const uColor = gl.getUniformLocation(program, 'uColor');


// ---------------------------------------------------------------------
// 3. THE SCENE: cubes positioned in a x-z plane
//    This part has nothing to do with WebGL - it's just data.
// ---------------------------------------------------------------------

function heightAlgorithm(row, col, gridSize) {
  const x = row - (gridSize/2);
  const y = col - (gridSize/2);

  // return 10 + (0 - x**2 - y**2) * 0.005

  return (4*Math.cos((x+y)/5) + 3*Math.sin(y/3) - Math.cos(x/11) + 10) * 0.4
}

const GRID_SIZE = 100;

const cubes = [];
for (let row = 0; row < GRID_SIZE; row++) {
  for (let col = 0; col < GRID_SIZE; col++) {
    cubes.push({
      x: (col - (GRID_SIZE - 1) / 2),
      z: (row - (GRID_SIZE - 1) / 2),
      height: heightAlgorithm(row, col, GRID_SIZE),
      color: [Math.random()*0.3, 0.8 - Math.random() * 0.2, Math.random()*0.3],   // random RGB
    });
  }
}

// ---------------------------------------------------------------------
// 4. MATRIX HELPERS
//    A 4×4 matrix can move, scale, or rotate points. WebGL stores
//    matrices as 16 numbers in "column-major" order: the first 4 numbers
//    are the first COLUMN, not the first row. That's why the translation
//    (x, y, z) appears in the last 4 numbers below.
//
//    (Real projects usually use a library such as glMatrix for this.)
// ---------------------------------------------------------------------

// Move a point by (x, y, z).
function translation(x, y, z) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ];
}

// Stretch a point by (sx, sy, sz).
function scaling(sx, sy, sz) {
  return [
    sx, 0,  0,  0,
    0,  sy, 0,  0,
    0,  0,  sz, 0,
    0,  0,  0,  1,
  ];
}

// Multiply two matrices: the result does b first, then a.
function multiply(a, b) {
  const result = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) {
        result[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
      }
    }
  }
  return result;
}

// Perspective projection: makes far-away objects look smaller.
//   fieldOfView - how wide the camera sees, in radians
//   aspect      - canvas width / height, so things aren't stretched
//   near, far   - nothing closer than near or farther than far is drawn
function perspective(fieldOfView, aspect, near, far) {
  const f = 1 / Math.tan(fieldOfView / 2);
  return [
    f / aspect, 0, 0,                               0,
    0,          f, 0,                               0,
    0,          0, (far + near) / (near - far),    -1,
    0,          0, (2 * far * near) / (near - far), 0,
  ];
}

// Camera matrix: place a camera at `eye`, looking at `target`.
// `up` says which way is "up" for the camera (normally +y).
function lookAt(eye, target, up) {
  const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const normalize = (a) => {
    const length = Math.hypot(a[0], a[1], a[2]);
    return [a[0] / length, a[1] / length, a[2] / length];
  };

  // Build the camera's own three axes:
  const zAxis = normalize(subtract(eye, target)); // points backward, away from what we look at
  const xAxis = normalize(cross(up, zAxis));      // points to the camera's right
  const yAxis = cross(zAxis, xAxis);              // points to the camera's up

  return [
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,
  ];
}


// ---------------------------------------------------------------------
// 5. DRAW
// ---------------------------------------------------------------------

var stop = false;
var frameCount = 0;
var fps, fpsInterval, startTime, now, then, elapsed;

function startAnimating(fps) {
    fpsInterval = 1000 / fps;
    then = window.performance.now();
    startTime = then;
    console.log(startTime);
    animate();
}

function animate(newtime) {
    requestAnimationFrame(animate);
    now = newtime;
    elapsed = now - then;

    // if enough time has elapsed, draw the next frame
    if (elapsed > fpsInterval) {

        // Get ready for next frame by setting then=now, but...
        // Also, adjust for fpsInterval not being multiple of 16.67
        then = now - (elapsed % fpsInterval);

        // draw stuff here
        cameraProgressDegrees += cameraStepSizeDegrees;
        draw();

        console.log()
    }
}

const cameraStepSizeDegrees = 0.2;
let cameraProgressDegrees = 0;

document.addEventListener("keydown", (event) => {
  event.preventDefault();
  switch (event.key) {

    case "r":
      // Reset camera
      cameraProgressDegrees = 0;
      draw();
      break;
    default:
      return; 
  }
});

function toRadians(angle) {
  return angle * (Math.PI / 180);
}

function calculateCameraPosition(radius) {
  const x = radius * Math.cos(toRadians(cameraProgressDegrees));
  const z = radius * Math.sin(toRadians(cameraProgressDegrees));

  return [x, radius/3, z];
}

function draw() {

  // Make the canvas's pixel size match its size on the page.
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);

  // Clear the screen to black (red, green, blue, alpha).
  gl.clearColor(0, 0, 0, 1);

  // Depth testing makes near cubes hide far cubes, no matter which
  // order we draw them in. Each frame we clear the depth info too.
  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // The camera is the same for every cube, so set it once.
  const aspect = canvas.width / canvas.height;
  gl.uniformMatrix4fv(uProjection, false, perspective(Math.PI / 4, aspect, 0.1, 1000));
  gl.uniformMatrix4fv(uView, false, lookAt(calculateCameraPosition(100), [0, 0, 0], [0, 1, 0]));

  // Draw every cube: same triangles each time, different uniforms.
  for (const cube of cubes) {
    // First stretch the cube to its height, then move it to its spot.
    // (In multiply(a, b), b happens first, so scaling goes on the right.)
    const model = multiply(
      translation(cube.x, 0, cube.z),
      scaling(1, cube.height, 1),
    );

    gl.uniformMatrix4fv(uModel, false, model);
    gl.uniform3fv(uColor, cube.color);
    gl.drawArrays(gl.TRIANGLES, 0, CUBE_VERTEX_COUNT);
  }
}

// Redraw if the browser window changes size.
window.addEventListener('resize', draw);

startAnimating(30);