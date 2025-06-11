// Configuración básica de Three.js
let scene, camera, renderer;
let antenas = [];
let receptor = null;
let circles = [];
let intersectionPoints = [];
let isPlaying = false;
let timeData = [];
let currentStep = 0;

// Constantes
const WORLD_SIZE = 300;
const ANTENA_RADIUS = 5;
const RECEPTOR_RADIUS = 3;
const STEPS = [
    {
        title: "Paso 1: Posicionamiento de Antenas",
        description: "Las antenas se colocan en posiciones fijas conocidas en el plano 2D."
    },
    {
        title: "Paso 2: Señales de Radio",
        description: "Cada antena emite señales de radio que viajan a la velocidad de la luz."
    },
    {
        title: "Paso 3: Medición de Distancias",
        description: "El receptor mide el tiempo que tarda en recibir la señal de cada antena."
    },
    {
        title: "Paso 4: Trilateración",
        description: "Usando las distancias, se crean círculos alrededor de cada antena. La intersección de estos círculos revela la posición del receptor."
    }
];

function init() {
    // Configurar escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e1e1e);

    // Configurar cámara
    camera = new THREE.OrthographicCamera(
        WORLD_SIZE / -2,
        WORLD_SIZE / 2,
        WORLD_SIZE / 2,
        WORLD_SIZE / -2,
        1,
        1000
    );
    camera.position.z = 100;

    // Configurar renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Crear grid
    const gridHelper = new THREE.GridHelper(WORLD_SIZE, 20, 0x303030, 0x303030);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    // Crear antenas
    createAntenas();
    
    // Crear receptor
    createReceptor();
    
    // Configurar UI
    setupUI();
    
    // Event listeners
    setupEventListeners();
    
    // Iniciar animación
    animate();
}

function createAntenas() {
    const positions = [
        { x: -100, y: -100 },
        { x: 100, y: -100 },
        { x: 0, y: 100 }
    ];
    
    positions.forEach((pos, index) => {
        const geometry = new THREE.CircleGeometry(ANTENA_RADIUS, 32);
        const material = new THREE.MeshBasicMaterial({
            color: getAntennaColor(index),
            side: THREE.DoubleSide
        });
        const antena = new THREE.Mesh(geometry, material);
        antena.position.set(pos.x, pos.y, 0);
        scene.add(antena);
        antenas.push(antena);
    });
}

function createReceptor() {
    const geometry = new THREE.CircleGeometry(RECEPTOR_RADIUS, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        side: THREE.DoubleSide
    });
    receptor = new THREE.Mesh(geometry, material);
    receptor.position.set(0, 0, 0);
    scene.add(receptor);
}

function getAntennaColor(index) {
    const colors = [0xff0000, 0x00ff00, 0x0000ff];
    return colors[index];
}

function createDistanceCircle(center, radius, color) {
    const geometry = new THREE.CircleGeometry(radius, 64);
    const material = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.5
    });
    const circle = new THREE.LineLoop(geometry, material);
    circle.position.copy(center);
    return circle;
}

function updateDistanceCircles() {
    // Limpiar círculos anteriores
    circles.forEach(circle => scene.remove(circle));
    circles = [];
    
    // Crear nuevos círculos
    antenas.forEach((antena, index) => {
        const distance = receptor.position.distanceTo(antena.position);
        const circle = createDistanceCircle(
            antena.position,
            distance,
            getAntennaColor(index)
        );
        scene.add(circle);
        circles.push(circle);
    });
}

function setupUI() {
    const ui = document.createElement('div');
    ui.style.position = 'absolute';
    ui.style.top = '20px';
    ui.style.left = '20px';
    ui.style.color = 'white';
    ui.style.fontFamily = 'Arial, sans-serif';
    
    // Título del paso actual
    const title = document.createElement('h2');
    title.id = 'stepTitle';
    title.textContent = STEPS[0].title;
    ui.appendChild(title);
    
    // Descripción del paso
    const description = document.createElement('p');
    description.id = 'stepDescription';
    description.textContent = STEPS[0].description;
    ui.appendChild(description);
    
    // Controles
    const controls = document.createElement('div');
    controls.style.marginTop = '20px';
    
    // Botón siguiente
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Siguiente Paso';
    nextButton.onclick = nextStep;
    controls.appendChild(nextButton);
    
    ui.appendChild(controls);
    document.body.appendChild(ui);
}

function nextStep() {
    currentStep = (currentStep + 1) % STEPS.length;
    document.getElementById('stepTitle').textContent = STEPS[currentStep].title;
    document.getElementById('stepDescription').textContent = STEPS[currentStep].description;
    
    // Actualizar visualización según el paso
    updateVisualization();
}

function updateVisualization() {
    switch(currentStep) {
        case 0:
            // Mostrar solo antenas
            circles.forEach(circle => circle.visible = false);
            break;
        case 1:
            // Mostrar señales de radio
            circles.forEach(circle => circle.visible = true);
            break;
        case 2:
            // Mostrar mediciones
            updateDistanceCircles();
            break;
        case 3:
            // Mostrar trilateración completa
            updateDistanceCircles();
            calculateIntersections();
            break;
    }
}

function setupEventListeners() {
    let isDragging = false;
    
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', () => isDragging = false);
    
    function onMouseDown(event) {
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        
        const intersects = raycaster.intersectObject(receptor);
        
        if (intersects.length > 0) {
            isDragging = true;
        }
    }
    
    function onMouseMove(event) {
        if (!isDragging) return;
        
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1));
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersection);
        
        // Limitar el movimiento dentro del mundo
        intersection.x = Math.max(Math.min(intersection.x, WORLD_SIZE/2), -WORLD_SIZE/2);
        intersection.y = Math.max(Math.min(intersection.y, WORLD_SIZE/2), -WORLD_SIZE/2);
        
        receptor.position.copy(intersection);
        
        // Actualizar visualización si es necesario
        if (currentStep >= 2) {
            updateDistanceCircles();
            if (currentStep === 3) {
                calculateIntersections();
            }
        }
    }
}

function calculateIntersections() {
    // Limpiar intersecciones anteriores
    intersectionPoints.forEach(point => scene.remove(point));
    intersectionPoints = [];
    
    // Calcular intersecciones entre círculos
    for (let i = 0; i < circles.length; i++) {
        for (let j = i + 1; j < circles.length; j++) {
            const center1 = antenas[i].position;
            const center2 = antenas[j].position;
            const radius1 = circles[i].scale.x;
            const radius2 = circles[j].scale.x;
            
            const d = center1.distanceTo(center2);
            
            if (d > radius1 + radius2 || d < Math.abs(radius1 - radius2)) {
                continue; // No hay intersección
            }
            
            // Crear punto de intersección
            const geometry = new THREE.CircleGeometry(2, 32);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                side: THREE.DoubleSide
            });
            const point = new THREE.Mesh(geometry, material);
            point.position.copy(receptor.position);
            scene.add(point);
            intersectionPoints.push(point);
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// Iniciar la simulación
init(); 