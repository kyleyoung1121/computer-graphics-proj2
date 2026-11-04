// =====================================================================
//  A grid of cubes with random colors and random heights, in WebGL
// =====================================================================
//
// THE BIG PICTURE
// ---------------
// WebGL can only draw points, lines and triangles. To draw a cube we
// describe it as 12 triangles (2 per face × 6 faces), hand those
// triangles to the GPU, and then ask the GPU to draw that cube once for
// every cube in our list, each time with a different position, height
// and color.
//
// Every frame of WebGL drawing follows the same basic steps:
//
//   1. SHADERS  - small programs that run on the GPU. The *vertex shader*
//                 decides where each corner (vertex) of a triangle lands
//                 on the screen. The *fragment shader* decides the color
//                 of each pixel inside the triangle.
//   2. BUFFERS  - we copy our vertex data (the corners of the cube) into
//                 GPU memory once, at startup.
//   3. UNIFORMS - values that stay the same for a whole draw call, like
//                 "this cube is red" or "this cube is 3 units tall".
//                 We change them before drawing each cube.
//   4. DRAW     - we tell the GPU "draw 36 vertices as triangles".
//
// The sections below follow that same order.


// ---------------------------------------------------------------------
// 0. Get a WebGL "context" from the <canvas> element in index.html.
//    The context (gl) is the object we use to issue every WebGL command.
// ---------------------------------------------------------------------
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl');


// ---------------------------------------------------------------------
// 1. SHADERS
//    Shaders are written in GLSL, a C-like language. We store the source
//    code in JavaScript strings, then compile them for the GPU.
//
//    Three kinds of shader variables:
//      attribute - a different value for every vertex (e.g. its position)
//      uniform   - one value shared by every vertex in a draw call
//      varying   - passed from the vertex shader to the fragment shader
// ---------------------------------------------------------------------

// Identity function to match 'glsl literal' linter
const glsl = x => x;

const vertexShaderSource = glsl`
  attribute vec3 aPosition;   // corner position of the cube (model space)
  attribute vec3 aNormal;     // direction the face is pointing

  uniform mat4 uModel;        // moves/scales THIS cube into the world
  uniform mat4 uView;         // where the camera is and where it looks
  uniform mat4 uProjection;   // perspective: far things look smaller

  varying vec3 vNormal;       // handed to the fragment shader

  void main() {
    // Turn the normal the same way the cube is turned. Our cubes are only
    // stretched and moved, never rotated, so this changes nothing here.
    // It would matter if you added rotation.
    vNormal = normalize(mat3(uModel) * aNormal);

    // The famous line: model -> world -> camera -> screen.
    // Read it right to left: first place the cube in the world (uModel),
    // then view it from the camera (uView), then apply perspective.
    gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
  }
`;

const fragmentShaderSource = glsl`
  precision mediump float;

  uniform vec4 uColor;        // this cube's color (red, green, blue: 0..1)
  varying vec3 vNormal;

  void main() {
    // Simple lighting so we can tell the faces of a cube apart.
    // A face pointing toward the light is bright; one facing away is dim.
    vec3 lightDirection1 = normalize(vec3(-0.6, 0.3, 0.4));
    vec3 lightDirection2 = normalize(vec3(-0.4, 0.5, 0.6));
    float brightness = max(dot(vNormal, lightDirection1), max(dot(vNormal, lightDirection2), 0.0));

    // Keep 30% "ambient" light so faces in shadow aren't pure black.
    float light = 0.3 + 0.7 * brightness;

    // gl_FragColor = vec4(1.0 * (uColor[0] * light), 1.0 * (uColor[1] * light), 1.0 * (uColor[2] * light), 1.0);
    gl_FragColor = vec4(1.0 * (uColor[0] * light), 0.85 * (uColor[1] * light), 0.75 * (uColor[2] * light), uColor[3]);
  }
`;

gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

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
const cubeVertices = new Float32Array([
  // Front face (normal points toward +z)
  -0.5, 0, 0.5,   0, 0, 1,
   0.5, 0, 0.5,   0, 0, 1,
   0.5, 1, 0.5,   0, 0, 1,
  -0.5, 0, 0.5,   0, 0, 1,
   0.5, 1, 0.5,   0, 0, 1,
  -0.5, 1, 0.5,   0, 0, 1,

  // Back face (-z)
  -0.5, 0, -0.5,  0, 0, -1,
   0.5, 1, -0.5,  0, 0, -1,
   0.5, 0, -0.5,  0, 0, -1,
  -0.5, 0, -0.5,  0, 0, -1,
  -0.5, 1, -0.5,  0, 0, -1,
   0.5, 1, -0.5,  0, 0, -1,

  // Top face (+y)
  -0.5, 1, -0.5,  0, 1, 0,
  -0.5, 1,  0.5,  0, 1, 0,
   0.5, 1,  0.5,  0, 1, 0,
  -0.5, 1, -0.5,  0, 1, 0,
   0.5, 1,  0.5,  0, 1, 0,
   0.5, 1, -0.5,  0, 1, 0,

  // Bottom face (-y)
  -0.5, 0, -0.5,  0, -1, 0,
   0.5, 0,  0.5,  0, -1, 0,
  -0.5, 0,  0.5,  0, -1, 0,
  -0.5, 0, -0.5,  0, -1, 0,
   0.5, 0, -0.5,  0, -1, 0,
   0.5, 0,  0.5,  0, -1, 0,

  // Right face (+x)
   0.5, 0, -0.5,  1, 0, 0,
   0.5, 1, -0.5,  1, 0, 0,
   0.5, 1,  0.5,  1, 0, 0,
   0.5, 0, -0.5,  1, 0, 0,
   0.5, 1,  0.5,  1, 0, 0,
   0.5, 0,  0.5,  1, 0, 0,

  // Left face (-x)
  -0.5, 0, -0.5, -1, 0, 0,
  -0.5, 1,  0.5, -1, 0, 0,
  -0.5, 1, -0.5, -1, 0, 0,
  -0.5, 0, -0.5, -1, 0, 0,
  -0.5, 0,  0.5, -1, 0, 0,
  -0.5, 1,  0.5, -1, 0, 0,
]);
const VERTEX_COUNT = 36;

// Copy the vertex data into GPU memory.
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

// Tell the GPU how to read the buffer: which numbers are the position
// and which are the normal.
//   stride = bytes from one vertex to the next = 6 floats × 4 bytes = 24
//   offset = where in each vertex this attribute starts
const BYTES_PER_FLOAT = 4;
const stride = 6 * BYTES_PER_FLOAT;

const aPosition = gl.getAttribLocation(program, 'aPosition');
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, stride, 0);

const aNormal = gl.getAttribLocation(program, 'aNormal');
gl.enableVertexAttribArray(aNormal);
gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, stride, 3 * BYTES_PER_FLOAT);

// Look up where each uniform lives so we can set it later.
const uModel = gl.getUniformLocation(program, 'uModel');
const uView = gl.getUniformLocation(program, 'uView');
const uProjection = gl.getUniformLocation(program, 'uProjection');
const uColor = gl.getUniformLocation(program, 'uColor');


// ---------------------------------------------------------------------
// 3. THE SCENE: cubes positioned in a x-z plane
//    This part has nothing to do with WebGL - it's just data.
// ---------------------------------------------------------------------

function grassHeightAlgorithm(row, col, gridSize) {
  const x = row - (gridSize/2);
  const y = col - (gridSize/2);
  return (4*Math.cos((x+y)/5) + 3*Math.sin(y/3) - Math.cos(x/11) + 10) * 0.6
}

// GRASS HILLS
const GRID_SIZE = 100;
const grassCubes = [];
for (let row = 0; row < GRID_SIZE; row++) {
  for (let col = 0; col < GRID_SIZE; col++) {
    grassCubes.push({
      x: (col - (GRID_SIZE - 1) / 2),
      z: (row - (GRID_SIZE - 1) / 2),
      height: grassHeightAlgorithm(row, col, GRID_SIZE),
      color: [Math.random()*0.2, 0.6 - Math.random() * 0.2, Math.random()*0.2, 1.0],   // random RGB
    });
  }
}

// CLOUDS
const cloudColor = [1,1,1,0.4]
const cloudCubes = [
  {
    x: 0, y: 1, z: 0,
    height: 1,
    color: cloudColor,
  },
  {
    x: 1, y: 1, z: 0,
    height: 1,
    color: cloudColor,
  },
  {
    x: -1, y: 1, z: 0,
    height: 1,
    color: cloudColor,
  },
  {
    x: 0, y: 1, z: 1,
    height: 1,
    color: cloudColor,
  },
  {
    x: 0, y: 1, z: -1,
    height: 1,
    color: cloudColor,
  },
  
];
for (let row = 0; row < 5; row++) {
  for (let col = 0; col < 3; col++) {
    cloudCubes.push({
      x: (col - 1),
      y: 0,
      z: (row - 2),
      height: 1,
      color: cloudColor,
    });
  }
}

const cloudBezierPoints = [
  {z:0, y:0},
  {z:100, y:50},
  {z:200, y:-50},
  {z:300, y:0},
]

const cloudInstances = [];

for (let i = 0; i < 10; i++) {
  if (i % 2 == 0) {
    cloudInstances.push({
      pathStartingProgress: 50,
      xOffset: (i * 10) - 50,
      yOffset: 0,
      zOffset: -50,
    })
  } else {
    cloudInstances.push({
      pathStartingProgress: 0,
      xOffset: (i * 10) - 50,
      yOffset: 0,
      zOffset: -50,
    })
  }
}
for (let i = 0; i < 10; i++) {
  if (i % 2 == 0) {
    cloudInstances.push({
      pathStartingProgress: 75,
      xOffset: (i * 10) - 50,
      yOffset: 0,
      zOffset: -50,
    })
  } else {
    cloudInstances.push({
      pathStartingProgress: 25,
      xOffset: (i * 10) - 50,
      yOffset: 0,
      zOffset: -50,
    })
  }
}


// LAKES
const lakeColor = [0.2,0.2,1,0.3]
const lakeCubes = [{
  x: 0,
  z: 0,
  height: 20,
  color: lakeColor,   // random RGB
}]

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

var fpsInterval, now, then, elapsed;

function startAnimating(fps) {
    fpsInterval = 1000 / fps;
    then = window.performance.now();
    animate();
}

function animate(newtime) {
    requestAnimationFrame(animate);
    now = newtime;
    elapsed = now - then;

    // if enough time has elapsed, draw the next frame
    if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval);

        // Progress moving objects (such as the camera & clouds)
        cameraProgressDegrees += cameraStepSizeDegrees;
        if (cameraProgressDegrees >= 360) {
          cameraProgressDegrees = 0;
        }
        cloudProgress += cloudStepSize;
        if (cloudProgress >= 100) {
          cloudProgress = 0;
        }

        draw();
    }
}

const cameraStepSizeDegrees = 0.05;
let cameraProgressDegrees = 45;

const cloudStepSize = 0.15;
let cloudProgress = 0;


document.addEventListener("keydown", (event) => {
  event.preventDefault();
  switch (event.key) {

    case "r":
      // Reset camera
      cameraProgressDegrees = 45;
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
  // gl.clearColor(0.39, 0.71, 0.89, 1); // sky blue
  gl.clearColor(0.72, 0.55, 0.43, 1); 

  // Depth testing makes near cubes hide far cubes, no matter which
  // order we draw them in. Each frame we clear the depth info too.
  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // The camera is the same for every cube, so set it once.
  const aspect = canvas.width / canvas.height;
  gl.uniformMatrix4fv(uProjection, false, perspective(Math.PI / 4, aspect, 0.1, 1000));
  gl.uniformMatrix4fv(uView, false, lookAt(calculateCameraPosition(100), [0, 0, 0], [0, 1, 0]));

  // Draw every grass cube: same triangles each time, different uniforms.
  for (const cube of grassCubes) {
    // First stretch the cube to its height, then move it to its spot.
    // (In multiply(a, b), b happens first, so scaling goes on the right.)
    const model = multiply(
      translation(cube.x, 0, cube.z),
      scaling(1, cube.height, 1),
    );

    gl.uniformMatrix4fv(uModel, false, model);
    gl.uniform4fv(uColor, cube.color);
    gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
  }

  // Draw each cloud
  for (const cloud of cloudInstances) {
    // For each cloud, compute all relevant Bezier curve coeffecients
    let [p0, p1, p2, p3] = cloudBezierPoints;

    // Math: https://www.youtube.com/watch?v=7adUs4o2_JM
    let cz = 3 * (p1.z - p0.z);
    let bz = 3 * (p2.z - p1.z) - cz;
    let az = p3.z - p0.z - cz - bz;

    let cy = 3 * (p1.y - p0.y);
    let by = 3 * (p2.y - p1.y) - cy;
    let ay = p3.y - p0.y - cy -by;

    // Some cloud instances start with a head start
    let t = (cloudProgress + cloud.pathStartingProgress)/100;
    if (t > 1) {
      t -= 1;
    }

    let zt = az*(t*t*t) + bz*(t*t) + cz*t + p0.z;
    let yt = ay*(t*t*t) + by*(t*t) + cy*t + p0.y;

    for (const cube of cloudCubes) {
      // First stretch the cube to its height, then move it to its spot.
      // (In multiply(a, b), b happens first, so scaling goes on the right.)
      const model = multiply(
        translation(cube.x + cloud.xOffset, 20 + cube.y + cloud.yOffset + yt/2, cube.z + cloud.zOffset + zt/2.5),
        scaling(1, 1, 1),
      );

      gl.uniformMatrix4fv(uModel, false, model);
      gl.uniform4fv(uColor, cube.color);
      gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
    }
  }
  
  for (const lake of lakeCubes) {
    // First stretch the cube to its height, then move it to its spot.
    // (In multiply(a, b), b happens first, so scaling goes on the right.)
    const model = multiply(
      translation(lake.x, 0, lake.z),
      scaling(99, 7, 99.5),
    );

    gl.uniformMatrix4fv(uModel, false, model);
    gl.uniform4fv(uColor, lake.color);
    gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
  }
}

// Redraw if the browser window changes size.
window.addEventListener('resize', draw);

// 30 FPS
startAnimating(30);