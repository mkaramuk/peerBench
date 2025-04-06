const svg = document.getElementById('torus-svg');
const svgNS = "http://www.w3.org/2000/svg";

let width = window.innerWidth;
let height = window.innerHeight;

// --- Randomize Parameters ---
const R = Math.random() * 100 + 100; // Major Radius (100-200)
const r = Math.random() * 50 + 25;  // Minor Radius (25-75) ensures hole changes
const numMajor = Math.floor(Math.random() * 20) + 20; // Density Major segments (20-40)
const numMinor = Math.floor(Math.random() * 10) + 10; // Density Minor segments (10-20)
const tiltX = (Math.random() - 0.5) * Math.PI; // Initial X tilt (-PI/2 to PI/2)
const tiltY = (Math.random() - 0.5) * Math.PI; // Initial Y tilt (-PI/2 to PI/2)
const rotationSpeed = (Math.random() * 0.01) + 0.005; // Rotation speed (0.005-0.015 rad/frame)

// --- 3D Point Generation ---
function generateTorusPoints(R, r, numMajor, numMinor) {
    const points = [];
    for (let i = 0; i < numMajor; i++) {
        const majorAngle = 2 * Math.PI * i / numMajor;
        const cosMajor = Math.cos(majorAngle);
        const sinMajor = Math.sin(majorAngle);

        for (let j = 0; j < numMinor; j++) {
            const minorAngle = 2 * Math.PI * j / numMinor;
            const cosMinor = Math.cos(minorAngle);
            const sinMinor = Math.sin(minorAngle);

            const x = (R + r * cosMinor) * cosMajor;
            const y = (R + r * cosMinor) * sinMajor;
            const z = r * sinMinor;
            points.push({ x, y, z, i, j }); // Store segment indices
        }
    }
    return points;
}

// --- 3D Rotation ---
function rotateX(point, angle) {
    const y = point.y;
    const z = point.z;
    point.y = y * Math.cos(angle) - z * Math.sin(angle);
    point.z = y * Math.sin(angle) + z * Math.cos(angle);
}

function rotateY(point, angle) {
    const x = point.x;
    const z = point.z;
    point.x = x * Math.cos(angle) + z * Math.sin(angle);
    point.z = -x * Math.sin(angle) + z * Math.cos(angle);
}

function rotateZ(point, angle) {
    const x = point.x;
    const y = point.y;
    point.x = x * Math.cos(angle) - y * Math.sin(angle);
    point.y = x * Math.sin(angle) + y * Math.cos(angle);
}

// --- Projection ---
function project(point) {
    // Simple orthographic projection
    const scale = 1.5; // Adjust scale as needed
    return {
        x: point.x * scale + width / 2,
        y: point.y * scale + height / 2
    };
}

// --- Drawing ---
const points3D = generateTorusPoints(R, r, numMajor, numMinor);
const paths = [];

// Create paths for major and minor segments
for (let i = 0; i < numMajor; i++) {
    for (let j = 0; j < numMinor; j++) {
        const pathMajor = document.createElementNS(svgNS, 'path');
        pathMajor.setAttribute('stroke', 'grey');
        pathMajor.setAttribute('stroke-width', '1');
        pathMajor.setAttribute('fill', 'none');
        svg.appendChild(pathMajor);
        paths.push({ type: 'major', i, j, element: pathMajor });

        const pathMinor = document.createElementNS(svgNS, 'path');
        pathMinor.setAttribute('stroke', 'grey');
        pathMinor.setAttribute('stroke-width', '1');
        pathMinor.setAttribute('fill', 'none');
        svg.appendChild(pathMinor);
        paths.push({ type: 'minor', i, j, element: pathMinor });
    }
}


let angle = 0;

function animate() {
    // Clone points for rotation to avoid modifying originals permanently per frame
    const rotatedPoints = points3D.map(p => ({ ...p }));

    // Apply initial tilt
    rotatedPoints.forEach(p => {
        rotateX(p, tiltX);
        rotateY(p, tiltY);
    });

    // Apply animation rotation (around Y axis for this example)
    rotatedPoints.forEach(p => rotateY(p, angle));

    // Project points
    const projectedPoints = rotatedPoints.map(project);

    // Update SVG paths
    paths.forEach(pathInfo => {
        const { type, i, j, element } = pathInfo;
        const currentPointIndex = i * numMinor + j;

        let nextPointIndex;
        if (type === 'major') {
            // Connect point to the next point in the same major ring
            nextPointIndex = i * numMinor + (j + 1) % numMinor;
        } else { // type === 'minor'
            // Connect point to the corresponding point in the next major ring
            nextPointIndex = ((i + 1) % numMajor) * numMinor + j;
        }

        const p1 = projectedPoints[currentPointIndex];
        const p2 = projectedPoints[nextPointIndex];

        element.setAttribute('d', `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`);
    });


    angle += rotationSpeed;
    requestAnimationFrame(animate);
}

// Handle window resize
window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
});

// Initial setup for viewbox
svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

// Apply initial tilt to base points ONCE
points3D.forEach(p => {
   rotateX(p, tiltX);
   rotateY(p, tiltY);
});


animate(); 