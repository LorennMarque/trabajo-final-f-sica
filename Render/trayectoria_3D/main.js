// Configuración básica
let scene, camera, renderer, controls;

// Constantes
const EARTH_DIAMETER = 12742000; // Diámetro de la Tierra en metros
const SCALE_FACTOR = 0.0000002; // Factor de escala para las órbitas
const EARTH_RADIUS_SCALED = (EARTH_DIAMETER/2) * SCALE_FACTOR; // Radio de la Tierra escalado

// Función para cargar y procesar el CSV
async function loadOrbitData() {
    const response = await fetch('orbitas_3D.csv');
    const data = await response.text();
    const rows = data.split('\n');
    const headers = rows[0].split(',');
    
    const orbitPoints = {
        sat1: [],
        sat2: [],
        sat3: []
    };
    
    // Empezar desde 1 para saltar los headers
    for(let i = 1; i < rows.length; i++) {
        if(rows[i].trim() === '') continue;
        const values = rows[i].split(',');

        // Puntos para el primer satélite
        orbitPoints.sat1.push(new THREE.Vector3(
            parseFloat(values[1]) * SCALE_FACTOR,
            parseFloat(values[2]) * SCALE_FACTOR,
            parseFloat(values[3]) * SCALE_FACTOR
        ));

        // Puntos para el segundo satélite
        orbitPoints.sat2.push(new THREE.Vector3(
            parseFloat(values[4]) * SCALE_FACTOR,
            parseFloat(values[5]) * SCALE_FACTOR,
            parseFloat(values[6]) * SCALE_FACTOR
        ));

        // Puntos para el tercer satélite
        orbitPoints.sat3.push(new THREE.Vector3(
            parseFloat(values[7]) * SCALE_FACTOR,
            parseFloat(values[8]) * SCALE_FACTOR,
            parseFloat(values[9]) * SCALE_FACTOR
        ));
    }
    
    return orbitPoints;
}

// Función para crear la línea de la órbita
function createOrbitLine(points, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
        color: color,
        dashSize: 0.5,
        gapSize: 0.3,
        scale: 1,
    });
    
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    return line;
}

// Función para crear un satélite (esfera pequeña)
function createSatellite(color) {
    const geometry = new THREE.SphereGeometry(EARTH_RADIUS_SCALED * 0.1, 16, 16); // Satélites 10% del tamaño de la Tierra
    const material = new THREE.MeshPhongMaterial({
        color: color,
        shininess: 30,
        emissive: color,
        emissiveIntensity: 0.3
    });
    return new THREE.Mesh(geometry, material);
}

// Inicialización de la escena
async function init() {
    // Crear escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Configurar cámara
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(15, 15, 15);
    camera.lookAt(0, 0, 0);

    // Configurar renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Agregar controles orbitales
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = EARTH_RADIUS_SCALED * 2;
    controls.maxDistance = EARTH_RADIUS_SCALED * 50;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    // Crear la Tierra (esfera azul)
    const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS_SCALED, 32, 32);
    const earthMaterial = new THREE.MeshPhongMaterial({
        color: 0x0077be,
        shininess: 25,
        emissive: 0x112244,
        emissiveIntensity: 0.2
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);

    // Agregar iluminación
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Cargar y agregar las órbitas
    const orbitPoints = await loadOrbitData();
    
    // Colores para cada satélite
    const colors = {
        sat1: 0xff0000,  // Rojo
        sat2: 0x00ff00,  // Verde
        sat3: 0x0000ff   // Azul
    };

    // Crear y agregar las líneas de órbita
    const orbitLine1 = createOrbitLine(orbitPoints.sat1, colors.sat1);
    const orbitLine2 = createOrbitLine(orbitPoints.sat2, colors.sat2);
    const orbitLine3 = createOrbitLine(orbitPoints.sat3, colors.sat3);
    
    scene.add(orbitLine1);
    scene.add(orbitLine2);
    scene.add(orbitLine3);

    // Crear y agregar los satélites
    const sat1 = createSatellite(colors.sat1);
    const sat2 = createSatellite(colors.sat2);
    const sat3 = createSatellite(colors.sat3);

    // Posicionar los satélites en el primer punto de sus órbitas respectivas
    if(orbitPoints.sat1.length > 0) sat1.position.copy(orbitPoints.sat1[0]);
    if(orbitPoints.sat2.length > 0) sat2.position.copy(orbitPoints.sat2[0]);
    if(orbitPoints.sat3.length > 0) sat3.position.copy(orbitPoints.sat3[0]);

    scene.add(sat1);
    scene.add(sat2);
    scene.add(sat3);

    // Agregar una grilla de ayuda
    const gridHelper = new THREE.GridHelper(EARTH_RADIUS_SCALED * 20, 20, 0x303030, 0x303030);
    scene.add(gridHelper);

    // Manejar el redimensionamiento de la ventana
    window.addEventListener('resize', onWindowResize, false);
}

// Función para manejar el redimensionamiento
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Función de animación
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Iniciar la aplicación
init().then(() => {
    animate();
}).catch(error => {
    console.error('Error al inicializar:', error);
});
