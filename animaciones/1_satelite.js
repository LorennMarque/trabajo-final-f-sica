// Set up Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

// Load satellite texture
const textureLoader = new THREE.TextureLoader();
const satelliteTexture = textureLoader.load('base/satelite.png');

// Create central satellite sprite
const spriteMaterial = new THREE.SpriteMaterial({
    map: satelliteTexture,
    color: 0xffffff,
    transparent: true,
    opacity: 1
});

const satellite = new THREE.Sprite(spriteMaterial);
satellite.scale.set(30, 30, 1); // Tamaño del satélite central
scene.add(satellite);

// Configuración de anillos
const numRings = 5;
const ringSpacing = 40; // Espacio entre anillos
const rings = [];

// Crear anillos concéntricos
for (let i = 0; i < numRings; i++) {
    const radius = (i + 1) * ringSpacing;
    const segments = 64;
    const ringGeometry = new THREE.RingGeometry(radius - 1, radius + 1, segments);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x444444,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    rings.push(ring);
    scene.add(ring);
}

// Crear punto y signo de interrogación
const pointGeometry = new THREE.CircleGeometry(3, 32);
const pointMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.8
});
const point = new THREE.Mesh(pointGeometry, pointMaterial);
scene.add(point);

// Crear el signo de interrogación usando un sprite con texto canvas
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = 64;
canvas.height = 64;
ctx.fillStyle = 'white';
ctx.font = 'bold 48px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('?', canvas.width/2, canvas.height/2);

const questionTexture = new THREE.Texture(canvas);
questionTexture.needsUpdate = true;

const questionMaterial = new THREE.SpriteMaterial({
    map: questionTexture,
    transparent: true,
    opacity: 0
});

const questionMark = new THREE.Sprite(questionMaterial);
questionMark.scale.set(15, 15, 1);
scene.add(questionMark);

// Variables para la animación del punto
let currentRing = null;
let targetRing = null;
let currentAngle = 0;
let targetAngle = 0;
let lastPointTime = 0;
const pointDelay = 1000; // 1 segundo entre movimientos
let animationProgress = 1; // 1 significa que la animación está completa
let pulseTime = 0; // Tiempo para el efecto de pulso
const pulseDuration = 500; // Duración del pulso en milisegundos

function movePoint() {
    // Guardar posición actual como inicio
    currentRing = targetRing !== null ? targetRing : Math.floor(Math.random() * numRings);
    currentAngle = targetAngle;

    // Generar nueva posición objetivo
    targetRing = Math.floor(Math.random() * numRings);
    targetAngle = Math.random() * Math.PI * 2;

    // Reiniciar progreso de animación
    animationProgress = 0;
    pulseTime = 0;
    
    // Resetear opacidades
    point.material.opacity = 0.8;
    questionMark.material.opacity = 0;
}

// Inicializar primera posición
targetRing = Math.floor(Math.random() * numRings);
targetAngle = Math.random() * Math.PI * 2;
movePoint();

camera.position.z = 300;

// Animation
function animate() {
    requestAnimationFrame(animate);
    const currentTime = performance.now();

    // Actualizar todos los anillos
    rings.forEach((ring, index) => {
        if (index === targetRing && animationProgress >= 1) {
            ring.material.opacity = 0.7;
            ring.material.color.setHex(0xffffff);
        } else if (index === targetRing && animationProgress < 1) {
            // Anillo objetivo durante el movimiento
            ring.material.opacity = 0.2;
            ring.material.color.setHex(0x444444);
            ring.scale.set(1, 1, 1);
        } else {
            // Anillos inactivos
            ring.material.opacity = 0.5;
            ring.material.color.setHex(0x444444);
            ring.scale.set(1, 1, 1);
        }
    });

    // Actualizar posición del punto y signo de interrogación
    if (animationProgress < 1) {
        animationProgress += 0.02; // Velocidad de la transición
        
        // Interpolación suave entre posiciones
        const progress = smoothstep(animationProgress);
        const currentRadius = (currentRing + 1) * ringSpacing;
        const targetRadius = (targetRing + 1) * ringSpacing;
        
        // Interpolar radio y ángulo
        const radius = currentRadius + (targetRadius - currentRadius) * progress;
        const angle = currentAngle + shortestAngle(currentAngle, targetAngle) * progress;
        
        // Actualizar posición de ambos elementos
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        point.position.set(x, y, 0);
        questionMark.position.set(x, y, 0);

        // Transición suave entre punto y signo de interrogación
        if (progress > 0.9) {
            const fadeProgress = (progress - 0.9) * 10; // 0 a 1 en el último 10% del movimiento
            point.material.opacity = 0.8 * (1 - fadeProgress);
            questionMark.material.opacity = fadeProgress;
        }
    } else if (currentTime - lastPointTime > pointDelay) {
        movePoint();
        lastPointTime = currentTime;
    }

    renderer.render(scene, camera);
}

// Función de suavizado para la animación
function smoothstep(x) {
    return x * x * (3 - 2 * x);
}

// Función para calcular el camino más corto entre dos ángulos
function shortestAngle(start, end) {
    const diff = (end - start + Math.PI) % (Math.PI * 2) - Math.PI;
    return diff < -Math.PI ? diff + Math.PI * 2 : diff;
}

// Handle window resize
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
});

animate(); 