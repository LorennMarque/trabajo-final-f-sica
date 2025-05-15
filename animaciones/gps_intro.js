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

// Create satellite sprites
const dots = [];
const signals = []; // Array para las señales
const numDots = 3;
const radius = 100; // Orbit radius
const animationDuration = 2000; // Duration in milliseconds for dots to reach final orbit
const startTime = performance.now();
const baseSpeed = 0.001; // Base rotation speed for all dots

// Parámetros para las señales
const signalMaterial = new THREE.LineDashedMaterial({
    color: 0xffffff,
    dashSize: 3,
    gapSize: 3,
    opacity: 0.5,
    transparent: true
});

// Calculate initial angles to ensure equal distribution (120 degrees apart)
const angleStep = (2 * Math.PI) / numDots;

// Función para crear una nueva señal
function createSignal(startX, startY) {
    const points = [];
    points.push(new THREE.Vector3(startX, startY, 0));
    points.push(new THREE.Vector3(0, 0, 0));
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, signalMaterial.clone());
    line.computeLineDistances(); // Necesario para el efecto de línea punteada
    
    line.userData = {
        progress: 0,
        speed: 0.02,
        opacity: 1
    };
    
    scene.add(line);
    return line;
}

for (let i = 0; i < numDots; i++) {
    // Create sprite material with satellite texture
    const spriteMaterial = new THREE.SpriteMaterial({
        map: satelliteTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 1
    });
    
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(20, 20, 1); // Adjust size of satellite
    
    // Start all satellites at center
    sprite.position.set(0, 0, 0);
    sprite.userData = {
        initialAngle: i * angleStep,
        delay: i * 300,
        lastSignalTime: 0 // Tiempo del último envío de señal
    };
    dots.push(sprite);
    signals.push([]); // Array para las señales de cada satélite
    scene.add(sprite);
}

camera.position.z = 300;

// Animation
function animate() {
    const currentTime = performance.now();
    requestAnimationFrame(animate);

    // Calculate the shared rotation angle for all dots
    const sharedRotation = baseSpeed * (currentTime - startTime);

    dots.forEach((sprite, index) => {
        const timeSinceStart = currentTime - startTime - sprite.userData.delay;
        
        if (timeSinceStart <= 0) {
            // Keep satellite at center until its delay is over
            sprite.position.set(0, 0, 0);
            return;
        }

        // Calculate progress (0 to 1) for the expansion animation
        const progress = Math.min(timeSinceStart / animationDuration, 1);
        
        // Current radius based on progress
        const currentRadius = radius * progress;
        
        // Calculate current angle - maintain equal spacing while rotating
        const currentAngle = sprite.userData.initialAngle + sharedRotation;
        
        // Update position
        sprite.position.x = Math.cos(currentAngle) * currentRadius;
        sprite.position.y = Math.sin(currentAngle) * currentRadius;

        // Rotate sprite to face center
        sprite.material.rotation = currentAngle + Math.PI/2;

        // Generar nueva señal aleatoriamente
        if (progress === 1 && Math.random() < 0.02 && currentTime - sprite.userData.lastSignalTime > 1000) {
            const signal = createSignal(sprite.position.x, sprite.position.y);
            signals[index].push(signal);
            sprite.userData.lastSignalTime = currentTime;
        }
    });

    // Actualizar y animar señales
    signals.forEach((satelliteSignals, index) => {
        for (let i = satelliteSignals.length - 1; i >= 0; i--) {
            const signal = satelliteSignals[i];
            signal.userData.progress += signal.userData.speed;
            signal.userData.opacity = Math.max(0, 1 - signal.userData.progress);

            // Actualizar posición de inicio de la señal
            const sprite = dots[index];
            const positions = signal.geometry.attributes.position.array;
            positions[0] = sprite.position.x;
            positions[1] = sprite.position.y;
            signal.geometry.attributes.position.needsUpdate = true;

            // Actualizar opacidad
            signal.material.opacity = signal.userData.opacity;

            // Eliminar señales que han completado su animación
            if (signal.userData.progress >= 1) {
                scene.remove(signal);
                signal.geometry.dispose();
                signal.material.dispose();
                satelliteSignals.splice(i, 1);
            }
        }
    });

    renderer.render(scene, camera);
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
