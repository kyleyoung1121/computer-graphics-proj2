// =====================================================================
//  Project 2: Cube world -- Level 2
//  - Add a color map & height map (both PNG files)
//  - Load in data from the maps to apply to the grid of cubes
//  - Properly scale/sample from the maps when the grid resolution is higher or lower
//  - Add some resolution options for the user to play around with (I added cube resolution, and image resolution options)
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

  uniform mat4 uModel;        // moves/scales THIS cube into the world
  uniform mat4 uView;         // where the camera is and where it looks
  uniform mat4 uProjection;   // perspective: far things look smaller

  varying vec3 vNormal;       // handed to the fragment shader

  void main() {
    // Turn the normal the same way the cube is turned.
    vNormal = normalize(mat3(uModel) * aNormal);

    // model -> world -> camera -> screen  (vector math below is shown right to left)
    gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
  }
`;

const fragmentShaderSource = glsl`
  precision mediump float;

  // cube's color (RGB, 0-1)
  uniform vec3 uColor;
  varying vec3 vNormal;

  void main() {
    // Simple lighting so we can tell the faces of a cube apart.
    // A face pointing toward the light is bright; one facing away is dim.
    vec3 lightDirection = normalize(vec3(0.5, 1.0, 0.3));
    float brightness = max(dot(vNormal, lightDirection), 0.0);

    // Keep 30% "ambient" light so faces in shadow aren't pure black.
    float light = 0.3 + 0.7 * brightness;

    gl_FragColor = vec4(uColor * light, 1.0);   // 1.0 = fully opaque
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
// 3. THE SCENE: a grid of cubes, adjusted in height & color based on height/color maps
//    This part has nothing to do with WebGL - it's just data.
// ---------------------------------------------------------------------

let cubeResolutionLevel = 5;
let imageResolutionLevel = 2;

const imageResolutionOptionsText = [
  10,50,100,250,500,1000
]

function displayResolutions() {
  document.getElementById("cube_resolution_text").innerHTML = "Cube Resolution = " + 2 ** (1 + cubeResolutionLevel) + " (1 or 2 to step + or -)";
  document.getElementById("image_resolution_text").innerHTML = "Image Resolution = " + imageResolutionOptionsText[imageResolutionLevel] + " (3 or 4 to step + or -)";
}
displayResolutions();

const heightImages = [
  "height_map_0_img",
  "height_map_1_img",
  "height_map_2_img",
  "height_map_3_img",
  "height_map_4_img",
  "height_map_5_img",
]

const colorImages = [
  "color_map_0_img",
  "color_map_1_img",
  "color_map_2_img",
  "color_map_3_img",
  "color_map_4_img",
  "color_map_5_img",
]

let cubes = [];

function addCubes() {
  const GRID_SIZE = 2 ** (1 + cubeResolutionLevel);
  const TOPOLOGY_HEIGHT = 0.25 * GRID_SIZE;
  const TOPOLOGY_OFFSET = 0.01 * GRID_SIZE;

  const heightImg = document.getElementById(heightImages[imageResolutionLevel]);
  const heightCanvas = document.getElementById("height_canvas");
  const heightContext = heightCanvas.getContext('2d'); 
  heightCanvas.width = heightImg.width; 
  heightCanvas.height = heightImg.height; 
  heightContext.drawImage(heightImg, 0, 0);

  const colorImg = document.getElementById(colorImages[imageResolutionLevel]);
  const colorCanvas = document.getElementById("color_canvas");
  const colorContext = colorCanvas.getContext('2d'); 
  colorCanvas.width = colorImg.width; 
  colorCanvas.height = colorImg.height; 
  colorContext.drawImage(colorImg, 0, 0);

  cubes = [];

  // Case 1: Higher cube resolution than image resolution
  if (GRID_SIZE > heightImg.width) {
    console.log("Case 1: Higher cube resolution than image resolution");
    const ratio = heightImg.width / GRID_SIZE
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {

        const newPos = [Math.floor(row * ratio), Math.floor(col * ratio)]

        const heightData = heightContext.getImageData( 
          newPos[0], newPos[1], 1, 1 
        ).data;
        
        const colorData = colorContext.getImageData( 
          newPos[0], newPos[1], 1, 1 
        ).data;
    
        cubes.push({
          x: (col - (GRID_SIZE - 1) / 2),
          z: (row - (GRID_SIZE - 1) / 2),
          height: (heightData[0]/255)*TOPOLOGY_HEIGHT+TOPOLOGY_OFFSET,
          color: [colorData[0]/255, colorData[1]/255, colorData[2]/255],
        });
      }
    }
  }

  // Case 2: Higher image resolution than cube resolution
  else if (GRID_SIZE < heightImg.width) {
    console.log("Case 2: Higher image resolution than cube resolution");
    const ratio = heightImg.width / GRID_SIZE
    const flooredRatio = Math.floor(ratio);
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {

        const newPos = [Math.floor(row * ratio), Math.floor(col * ratio)]

        const heightData = heightContext.getImageData( 
          newPos[0], newPos[1], flooredRatio, flooredRatio 
        ).data;
        
        let heightDataIterator = 0;
        let heightAggregate = 0;
        while (heightDataIterator < (heightData.length - 1)) {
          heightAggregate += heightData[heightDataIterator];
          heightDataIterator += 4;
        }
        // Get the average height in this region
        heightAggregate /= (heightDataIterator/4);

        const colorData = colorContext.getImageData( 
          newPos[0], newPos[1], flooredRatio, flooredRatio 
        ).data;

        let colorDataIterator = 0;
        let redAggregate = 0;
        let greenAggregate = 0;
        let blueAggregate = 0;
        while (colorDataIterator < (colorData.length - 3)) {
          redAggregate += colorData[colorDataIterator];
          greenAggregate += colorData[colorDataIterator+1];
          blueAggregate += colorData[colorDataIterator+2];
          colorDataIterator += 4;
        }
        // Get the average color in this region
        redAggregate /= (colorDataIterator/4);
        greenAggregate /= (colorDataIterator/4);
        blueAggregate /= (colorDataIterator/4);
    
        cubes.push({
          x: (col - (GRID_SIZE - 1) / 2),
          z: (row - (GRID_SIZE - 1) / 2),
          height: (heightAggregate/255)*TOPOLOGY_HEIGHT+TOPOLOGY_OFFSET,
          color: [colorData[0]/255, colorData[1]/255, colorData[2]/255],
        });
      }
    }
  }

  // Case 3: Resolution equal
  else {
    console.log("Case 3: Resolution equal");
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {

        const heightData = heightContext.getImageData( 
          row, col, 1, 1 
        ).data;
        
        const colorData = colorContext.getImageData( 
          row, col, 1, 1 
        ).data;
    
        cubes.push({
          x: (col - (GRID_SIZE - 1) / 2),
          z: (row - (GRID_SIZE - 1) / 2),
          height: (heightData[0]/255)*TOPOLOGY_HEIGHT+TOPOLOGY_OFFSET,
          color: [colorData[0]/255, colorData[1]/255, colorData[2]/255],
        });
      }
    }
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

const cameraStepSizeDegrees = 10;
let cameraProgressDegrees = 0;

document.addEventListener("keydown", (event) => {
  event.preventDefault();
  switch (event.key) {

    case "ArrowLeft":
      //****TO DO: Change camera x position move left
      cameraProgressDegrees += cameraStepSizeDegrees;
      draw();
      break;

    case "ArrowRight":
      //****TO DO: Change camera x position move right
      cameraProgressDegrees -= cameraStepSizeDegrees;
      draw();
      break;

    case "r":
      // Reset camera
      cameraProgressDegrees = 0;
      draw();
      break;

    case "1":
      // Adjust Cube Resolution
      cubeResolutionLevel += 1;
      if (cubeResolutionLevel > 9) {
        cubeResolutionLevel = 0;
      }
      displayResolutions();
      draw();
      break;
    
      case "2":
      // Adjust Cube Resolution
      cubeResolutionLevel -= 1;
      if (cubeResolutionLevel < 0) {
        cubeResolutionLevel = 9;
      }
      displayResolutions();
      draw();
      break;

    case "3":
      // Adjust Image Resolution
      imageResolutionLevel += 1;
      if (imageResolutionLevel > 5) {
        imageResolutionLevel = 0;
      }
      displayResolutions();
      draw();
      break;
    
    case "4":
      // Adjust Image Resolution
      imageResolutionLevel -= 1;
      if (imageResolutionLevel < 0) {
        imageResolutionLevel = 5;
      }
      displayResolutions();
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
  const GRID_SIZE = 2 ** (1 + cubeResolutionLevel);
  gl.uniformMatrix4fv(uProjection, false, perspective(Math.PI / 4, aspect, 0.1, GRID_SIZE * 10));
  gl.uniformMatrix4fv(uView, false, lookAt(calculateCameraPosition(GRID_SIZE), [0, 0, 0], [0, 1, 0]));


  // Draw every cube: same triangles each time, different uniforms.
  addCubes();
  for (const cube of cubes) {
    // First stretch the cube to its height, then move it to its spot.
    // (In multiply(a, b), b happens first, so scaling goes on the right.)
    const model = multiply(
      translation(cube.x, 0, cube.z),
      scaling(1, cube.height, 1),
    );

    gl.uniformMatrix4fv(uModel, false, model);
    gl.uniform3fv(uColor, cube.color);
    gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
  }
}

draw();

// Redraw if the browser window changes size.
window.addEventListener('resize', draw);
