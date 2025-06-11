// Configuración básica
let scene, camera, renderer, controls;
let timeData = [];
let satellites = {};
let isPlaying = false;
let currentTimeIndex = 0;
let positionSphere = null;
let solution1Sphere = null;
let solution2Sphere = null;
let distanceSpheres = [];
let satelliteLines = [];
let intersectionMeshes = [];
let orbitLines = [];
let gridHelper = null;

// Constantes
const EARTH_DIAMETER = 12742000; // Diámetro de la Tierra en metros
const SCALE_FACTOR = 0.0000002; // Factor de escala para las órbitas
const EARTH_RADIUS_SCALED = (EARTH_DIAMETER/2) * SCALE_FACTOR; // Radio de la Tierra escalado
const FIXED_RADIUS = 1.0; // Radio fijo en radios terrestres

// Estado de las capas
const layerState = {
    orbits: true,
    distances: true,
    grid: true,
    connections: true
};

// Función para cargar y procesar el CSV
async function loadOrbitData() {
    try {
        const response = await fetch('/orbitas_3D.csv');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
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
            
            // Verificar que tenemos suficientes valores
            if (values.length < 10) continue;

            // Guardar el tiempo
            const time = parseFloat(values[0]);
            if (isNaN(time)) continue;
            timeData.push(time);

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
    } catch (error) {
        console.error('Error cargando datos de órbita:', error);
        throw error;
    }
}

// Función para actualizar la posición de los satélites
function updateSatellitePositions(timeIndex) {
    if (timeIndex >= 0 && timeIndex < timeData.length) {
        satellites.sat1.position.copy(orbitPoints.sat1[timeIndex]);
        satellites.sat2.position.copy(orbitPoints.sat2[timeIndex]);
        satellites.sat3.position.copy(orbitPoints.sat3[timeIndex]);
        
        document.getElementById('timeDisplay').textContent = `t: ${timeData[timeIndex].toFixed(2)}`;
        
        // Actualizar velocidades
        updateVelocities(timeIndex);
    }
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
    const geometry = new THREE.SphereGeometry(EARTH_RADIUS_SCALED * 0.1, 16, 16);
    const material = new THREE.MeshPhongMaterial({
        color: color,
        shininess: 30,
        emissive: color,
        emissiveIntensity: 0.3
    });
    return new THREE.Mesh(geometry, material);
}

// Función para crear una esfera de distancia
function createDistanceSphere(radius, position, color) {
    const group = new THREE.Group();
    
    // Esfera principal semitransparente
    const sphereGeometry = new THREE.SphereGeometry(radius, 32, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    
    // Wireframe para el contorno
    const wireGeometry = new THREE.SphereGeometry(radius, 16, 16);
    const wireMaterial = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3,
        linewidth: 1
    });
    const wireframe = new THREE.LineSegments(
        new THREE.WireframeGeometry(wireGeometry),
        wireMaterial
    );
    
    // Crear puntos para los círculos de referencia
    const circlePoints = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        circlePoints.push(new THREE.Vector3(
            Math.cos(theta) * radius,
            Math.sin(theta) * radius,
            0
        ));
    }
    
    const circleMaterial = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.2
    });
    
    // Círculo XY
    const circleXY = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(circlePoints),
        circleMaterial
    );
    
    // Círculo XZ
    const circleXZ = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(circlePoints),
        circleMaterial.clone()
    );
    circleXZ.rotation.x = Math.PI/2;
    
    // Círculo YZ
    const circleYZ = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(circlePoints),
        circleMaterial.clone()
    );
    circleYZ.rotation.y = Math.PI/2;
    
    group.add(sphere);
    group.add(wireframe);
    group.add(circleXY);
    group.add(circleXZ);
    group.add(circleYZ);
    
    group.position.copy(position);
    return group;
}

// Función para crear una esfera de intersección
function createIntersectionSphere(position, radius) {
    const group = new THREE.Group();
    
    // Esfera principal
    const sphereGeometry = new THREE.SphereGeometry(radius, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.2
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    
    // Wireframe
    const wireGeometry = new THREE.SphereGeometry(radius, 16, 16);
    const wireMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.5
    });
    const wireframe = new THREE.LineSegments(
        new THREE.WireframeGeometry(wireGeometry),
        wireMaterial
    );
    
    group.add(sphere);
    group.add(wireframe);
    group.position.copy(position);
    return group;
}

// Función para crear una esfera de solución
function createSolutionSphere(color) {
    const group = new THREE.Group();
    
    // Esfera central
    const sphereGeometry = new THREE.SphereGeometry(EARTH_RADIUS_SCALED * 0.15, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.6
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    
    // Wireframe exterior
    const wireGeometry = new THREE.SphereGeometry(EARTH_RADIUS_SCALED * 0.15, 16, 16);
    const wireMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8
    });
    const wireframe = new THREE.LineSegments(
        new THREE.WireframeGeometry(wireGeometry),
        wireMaterial
    );
    
    group.add(sphere);
    group.add(wireframe);
    return group;
}

// Función para crear una línea
function createLine(start, end, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: 0.5,
        linewidth: 2
    });
    return new THREE.Line(geometry, material);
}

// Función para convertir coordenadas esféricas a cartesianas
function sphericalToCartesian(radius, latitude, longitude) {
    // Convertir grados a radianes
    const latRad = latitude * Math.PI / 180;
    const lonRad = longitude * Math.PI / 180;
    
    // Radio escalado (multiplicar por el radio terrestre escalado)
    const r = radius * EARTH_RADIUS_SCALED;
    
    // Conversión a coordenadas cartesianas
    // Nota: Ajustamos las fórmulas para que:
    // - Latitud 0° sea el ecuador
    // - Latitud +90° sea el polo norte
    // - Longitud 0° sea el punto (r,0,0)
    const x = r * Math.cos(latRad) * Math.cos(lonRad);
    const y = r * Math.cos(latRad) * Math.sin(lonRad);
    const z = r * Math.sin(latRad);
    
    return { x, y, z };
}

// Función para actualizar la posición del receptor usando coordenadas esféricas
function updateTestPositionSpherical(latitude, longitude) {
    const coords = sphericalToCartesian(FIXED_RADIUS, latitude, longitude);
    
    if (!positionSphere) {
        const geometry = new THREE.SphereGeometry(EARTH_RADIUS_SCALED * 0.1, 16, 16);
        const material = new THREE.MeshPhongMaterial({
            color: 0xffff00,
            shininess: 30,
            emissive: 0xffff00,
            emissiveIntensity: 0.3
        });
        positionSphere = new THREE.Mesh(geometry, material);
        scene.add(positionSphere);
    }
    
    positionSphere.position.set(coords.x, coords.y, coords.z);
    
    // Actualizar display de coordenadas
    document.getElementById('coordX').textContent = `X: ${(coords.x/EARTH_RADIUS_SCALED).toFixed(2)} RT`;
    document.getElementById('coordY').textContent = `Y: ${(coords.y/EARTH_RADIUS_SCALED).toFixed(2)} RT`;
    document.getElementById('coordZ').textContent = `Z: ${(coords.z/EARTH_RADIUS_SCALED).toFixed(2)} RT`;
    
    return new THREE.Vector3(coords.x, coords.y, coords.z);
}

// Función para actualizar los valores mostrados en los sliders
function updateSphericalDisplayValues(latitude, longitude) {
    document.getElementById('latitudeValue').textContent = `${latitude.toFixed(1)}°`;
    document.getElementById('longitudeValue').textContent = `${longitude.toFixed(1)}°`;
}

// Función para crear una línea guía desde el centro de la Tierra hasta el receptor
function createOrUpdateGuideLine(position) {
    if (!window.guideLine) {
        const material = new THREE.LineDashedMaterial({
            color: 0xffff00,
            dashSize: 0.5,
            gapSize: 0.3,
            opacity: 0.5,
            transparent: true
        });
        
        // Crear la geometría con puntos iniciales
        const points = [
            new THREE.Vector3(0, 0, 0),
            position || new THREE.Vector3(0, EARTH_RADIUS_SCALED * 2, 0)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        window.guideLine = new THREE.Line(geometry, material);
        scene.add(window.guideLine);
    }
    
    // Actualizar los puntos de la línea
    const points = [
        new THREE.Vector3(0, 0, 0),
        position
    ];
    window.guideLine.geometry.setFromPoints(points);
    window.guideLine.computeLineDistances();
}

// Función para actualizar las esferas de distancia y líneas
function updateDistanceVisualization(distances, satellitePositions, testPosition) {
    // Limpiar visualizaciones anteriores
    distanceSpheres.forEach(sphere => scene.remove(sphere));
    distanceSpheres = [];
    
    satelliteLines.forEach(line => scene.remove(line));
    satelliteLines = [];
    
    const colors = [0xff0000, 0x00ff00, 0x0000ff];
    
    // Crear nuevas esferas y líneas
    for (let i = 0; i < 3; i++) {
        const satPos = new THREE.Vector3(
            satellitePositions[i][0] * SCALE_FACTOR,
            satellitePositions[i][1] * SCALE_FACTOR,
            satellitePositions[i][2] * SCALE_FACTOR
        );
        
        // Crear esfera de distancia solo si la capa está activa
        if (layerState.distances) {
            const sphere = createDistanceSphere(
                distances[i] * SCALE_FACTOR,
                satPos,
                colors[i]
            );
            scene.add(sphere);
            distanceSpheres.push(sphere);
        }
        
        // Crear línea entre satélite y punto de prueba solo si la capa está activa
        if (layerState.connections) {
            const line = createLine(
                satPos,
                testPosition,
                colors[i]
            );
            scene.add(line);
            satelliteLines.push(line);
        }
    }
    
    // Actualizar el panel de información independientemente de la visibilidad
    updateDistanceDisplay(distances);
}

// Función para calcular la posición
async function calculatePosition(x, y, z, t) {
    try {
        // Asegurarse de que los valores son números válidos
        const validX = isFinite(x) ? x : 0;
        const validY = isFinite(y) ? y : 0;
        const validZ = isFinite(z) ? z : 0;
        const validT = isFinite(t) ? t : 0;

        const response = await fetch('/calculate_position', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                x: validX * EARTH_RADIUS_SCALED / SCALE_FACTOR,
                y: validY * EARTH_RADIUS_SCALED / SCALE_FACTOR,
                z: validZ * EARTH_RADIUS_SCALED / SCALE_FACTOR,
                t: validT
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            // Actualizar la visualización de las soluciones en texto
            document.getElementById('solution1').textContent = 
                `Sol 1: (${data.solution1.map(v => (v * SCALE_FACTOR / EARTH_RADIUS_SCALED).toFixed(2)).join(', ')})`;
            document.getElementById('solution2').textContent = 
                `Sol 2: (${data.solution2.map(v => (v * SCALE_FACTOR / EARTH_RADIUS_SCALED).toFixed(2)).join(', ')})`;

            // Actualizar visualizaciones
            updateSolutionSpheres(data);
            updateDistanceVisualization(
                data.distances,
                data.satellites,
                new THREE.Vector3(validX, validY, validZ).multiplyScalar(EARTH_RADIUS_SCALED)
            );
        } else {
            console.error('Error en el cálculo:', data.error);
            document.getElementById('solution1').textContent = `Error: ${data.error}`;
            document.getElementById('solution2').textContent = '';
            updateSolutionSpheres(null);
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('solution1').textContent = `Error de conexión: ${error.message}`;
        document.getElementById('solution2').textContent = '';
        updateSolutionSpheres(null);
    }
}

// Función para actualizar las esferas de solución
function updateSolutionSpheres(data) {
    // Limpiar las esferas de intersección anteriores
    intersectionMeshes.forEach(mesh => scene.remove(mesh));
    intersectionMeshes = [];

    if (!data || !data.solutions) {
        if (solution1Sphere) solution1Sphere.visible = false;
        if (solution2Sphere) solution2Sphere.visible = false;
        return;
    }
    
    const [sol1, sol2] = data.solutions;
    
    // Crear o actualizar la primera esfera de solución
    if (!solution1Sphere) {
        solution1Sphere = createSolutionSphere(0xff00ff);
        scene.add(solution1Sphere);
    }
    
    // Crear o actualizar la segunda esfera de solución
    if (!solution2Sphere) {
        solution2Sphere = createSolutionSphere(0x00ffff);
        scene.add(solution2Sphere);
    }
    
    // Actualizar posiciones y asegurar visibilidad según el estado de las capas
    if (sol1 && sol1.length === 3) {
        solution1Sphere.position.set(
            sol1[0] * SCALE_FACTOR,
            sol1[1] * SCALE_FACTOR,
            sol1[2] * SCALE_FACTOR
        );
        solution1Sphere.visible = layerState.distances; // Vincular a la visibilidad de esferas de distancia

        if (layerState.distances) {
            const intersection1 = createIntersectionSphere(
                solution1Sphere.position.clone(),
                EARTH_RADIUS_SCALED * 0.2
            );
            scene.add(intersection1);
            intersectionMeshes.push(intersection1);
        }
    }

    if (sol2 && sol2.length === 3) {
        solution2Sphere.position.set(
            sol2[0] * SCALE_FACTOR,
            sol2[1] * SCALE_FACTOR,
            sol2[2] * SCALE_FACTOR
        );
        solution2Sphere.visible = layerState.distances; // Vincular a la visibilidad de esferas de distancia

        if (layerState.distances) {
            const intersection2 = createIntersectionSphere(
                solution2Sphere.position.clone(),
                EARTH_RADIUS_SCALED * 0.2
            );
            scene.add(intersection2);
            intersectionMeshes.push(intersection2);
        }
    }
}

// Función para actualizar la información de velocidades
function updateVelocities(timeIndex) {
    if (timeIndex > 0 && timeIndex < timeData.length) {
        const dt = timeData[timeIndex] - timeData[timeIndex - 1];
        
        // Calcular velocidades para cada satélite
        const satellites = ['sat1', 'sat2', 'sat3'];
        satellites.forEach((sat, index) => {
            const currentPos = new THREE.Vector3(
                orbitPoints[sat][timeIndex].x,
                orbitPoints[sat][timeIndex].y,
                orbitPoints[sat][timeIndex].z
            );
            const prevPos = new THREE.Vector3(
                orbitPoints[sat][timeIndex - 1].x,
                orbitPoints[sat][timeIndex - 1].y,
                orbitPoints[sat][timeIndex - 1].z
            );
            
            const distance = currentPos.distanceTo(prevPos);
            const velocity = distance / dt / 1000; // Convertir a km/s
            
            document.getElementById(`velocity${index + 1}`).textContent = 
                `Sat ${index + 1}: ${velocity.toFixed(2)} km/s`;
        });
    }
}

// Función para actualizar las coordenadas mostradas
function updateCoordinateDisplay(x, y, z) {
    const scale = EARTH_RADIUS_SCALED;
    document.getElementById('coordX').textContent = `X: ${(x/scale).toFixed(2)} radios terrestres`;
    document.getElementById('coordY').textContent = `Y: ${(y/scale).toFixed(2)} radios terrestres`;
    document.getElementById('coordZ').textContent = `Z: ${(z/scale).toFixed(2)} radios terrestres`;
}

// Función para actualizar las distancias mostradas
function updateDistanceDisplay(distances) {
    if (distances) {
        distances.forEach((dist, index) => {
            const distKm = dist / 1000; // Convertir a kilómetros
            document.getElementById(`distance${index + 1}`).textContent = 
                `Sat ${index + 1}: ${distKm.toFixed(2)} km`;
        });
    }
}

// Función para manejar la visibilidad de las capas
function updateLayerVisibility() {
    // Órbitas
    orbitLines.forEach(line => {
        if (line) line.visible = layerState.orbits;
    });
    
    // Esferas de distancia y soluciones
    distanceSpheres.forEach(sphere => {
        if (sphere) sphere.visible = layerState.distances;
    });
    
    if (solution1Sphere) solution1Sphere.visible = layerState.distances;
    if (solution2Sphere) solution2Sphere.visible = layerState.distances;
    
    intersectionMeshes.forEach(mesh => {
        if (mesh) mesh.visible = layerState.distances;
    });
    
    // Grid
    if (gridHelper) {
        gridHelper.visible = layerState.grid;
    }
    
    // Líneas de conexión
    satelliteLines.forEach(line => {
        if (line) line.visible = layerState.connections;
    });
}

// Event listeners para los toggles de capas
document.getElementById('toggleOrbits').addEventListener('change', function(e) {
    layerState.orbits = e.target.checked;
    updateLayerVisibility();
});

document.getElementById('toggleDistances').addEventListener('change', function(e) {
    layerState.distances = e.target.checked;
    updateLayerVisibility();
    
    // Si se desactivan las esferas de distancia, limpiar las visualizaciones
    if (!layerState.distances) {
        distanceSpheres.forEach(sphere => {
            if (sphere) scene.remove(sphere);
        });
        distanceSpheres = [];
        
        intersectionMeshes.forEach(mesh => {
            if (mesh) scene.remove(mesh);
        });
        intersectionMeshes = [];
        
        if (solution1Sphere) solution1Sphere.visible = false;
        if (solution2Sphere) solution2Sphere.visible = false;
    }
});

document.getElementById('toggleGrid').addEventListener('change', function(e) {
    layerState.grid = e.target.checked;
    updateLayerVisibility();
});

document.getElementById('toggleConnections').addEventListener('change', function(e) {
    layerState.connections = e.target.checked;
    updateLayerVisibility();
});

// Inicialización de la escena
async function init() {
    try {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(15, 15, 15);
        camera.lookAt(0, 0, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = EARTH_RADIUS_SCALED * 2;
        controls.maxDistance = EARTH_RADIUS_SCALED * 50;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;

        // Crear la Tierra
        const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS_SCALED, 32, 32);
        const earthMaterial = new THREE.MeshPhongMaterial({
            color: 0x0077be,
            shininess: 25,
            emissive: 0x112244,
            emissiveIntensity: 0.2
        });
        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        scene.add(earth);

        // Iluminación
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        // Cargar datos de órbita
        orbitPoints = await loadOrbitData();
        
        // Configurar slider
        const timeSlider = document.getElementById('timeSlider');
        timeSlider.max = timeData.length - 1;
        timeSlider.value = 0;

        // Colores para cada satélite
        const colors = {
            sat1: 0xff0000,
            sat2: 0x00ff00,
            sat3: 0x0000ff
        };

        // Crear y agregar las líneas de órbita
        const orbitLine1 = createOrbitLine(orbitPoints.sat1, colors.sat1);
        const orbitLine2 = createOrbitLine(orbitPoints.sat2, colors.sat2);
        const orbitLine3 = createOrbitLine(orbitPoints.sat3, colors.sat3);
        
        orbitLines = [orbitLine1, orbitLine2, orbitLine3];
        orbitLines.forEach(line => scene.add(line));

        // Crear y agregar los satélites
        satellites.sat1 = createSatellite(colors.sat1);
        satellites.sat2 = createSatellite(colors.sat2);
        satellites.sat3 = createSatellite(colors.sat3);

        // Posicionar los satélites inicialmente
        updateSatellitePositions(0);

        scene.add(satellites.sat1);
        scene.add(satellites.sat2);
        scene.add(satellites.sat3);

        // Crear grid helper y guardarlo
        gridHelper = new THREE.GridHelper(EARTH_RADIUS_SCALED * 20, 20, 0x303030, 0x303030);
        scene.add(gridHelper);

        // Event listeners para los controles esféricos
        const latitudeSlider = document.getElementById('latitudeSlider');
        const longitudeSlider = document.getElementById('longitudeSlider');
        
        function updatePosition() {
            const latitude = parseFloat(latitudeSlider.value);
            const longitude = parseFloat(longitudeSlider.value);
            
            updateSphericalDisplayValues(latitude, longitude);
            const position = updateTestPositionSpherical(latitude, longitude);
            
            if (position) {
                createOrUpdateGuideLine(position);
                
                // Calcular posición para trilateración usando coordenadas cartesianas
                const coords = sphericalToCartesian(FIXED_RADIUS, latitude, longitude);
                calculatePosition(
                    coords.x / EARTH_RADIUS_SCALED,
                    coords.y / EARTH_RADIUS_SCALED,
                    coords.z / EARTH_RADIUS_SCALED,
                    timeData[currentTimeIndex] || 0
                );
            }
        }
        
        latitudeSlider.addEventListener('input', updatePosition);
        longitudeSlider.addEventListener('input', updatePosition);
        
        // Llamada inicial para establecer la posición
        setTimeout(updatePosition, 100);

        // Event listeners para los toggles de capas
        document.getElementById('toggleOrbits').addEventListener('change', function(e) {
            layerState.orbits = e.target.checked;
            updateLayerVisibility();
        });

        document.getElementById('toggleDistances').addEventListener('change', function(e) {
            layerState.distances = e.target.checked;
            updateLayerVisibility();
        });

        document.getElementById('toggleGrid').addEventListener('change', function(e) {
            layerState.grid = e.target.checked;
            updateLayerVisibility();
        });

        document.getElementById('toggleConnections').addEventListener('change', function(e) {
            layerState.connections = e.target.checked;
            updateLayerVisibility();
        });

        // Modificar el event listener del timeSlider
        document.getElementById('timeSlider').addEventListener('input', function() {
            currentTimeIndex = parseInt(this.value);
            updateSatellitePositions(currentTimeIndex);
            
            // Recalcular la posición cuando cambia el tiempo
            const latitude = parseFloat(latitudeSlider.value);
            const longitude = parseFloat(longitudeSlider.value);
            const coords = sphericalToCartesian(FIXED_RADIUS, latitude, longitude);
            calculatePosition(
                coords.x / EARTH_RADIUS_SCALED,
                coords.y / EARTH_RADIUS_SCALED,
                coords.z / EARTH_RADIUS_SCALED,
                timeData[currentTimeIndex]
            );
        });

        document.getElementById('playButton').addEventListener('click', function() {
            isPlaying = true;
        });

        document.getElementById('pauseButton').addEventListener('click', function() {
            isPlaying = false;
        });

        document.getElementById('resetButton').addEventListener('click', function() {
            isPlaying = false;
            currentTimeIndex = 0;
            timeSlider.value = currentTimeIndex;
            updateSatellitePositions(currentTimeIndex);
        });

        window.addEventListener('resize', onWindowResize, false);
    } catch (error) {
        console.error('Error en la inicialización:', error);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    if (isPlaying) {
        currentTimeIndex = (currentTimeIndex + 1) % timeData.length;
        document.getElementById('timeSlider').value = currentTimeIndex;
        updateSatellitePositions(currentTimeIndex);
        
        // Mantener la visibilidad de las capas durante la reproducción
        updateLayerVisibility();
    }
    
    controls.update();
    renderer.render(scene, camera);
}

init().then(() => {
    animate();
}).catch(error => {
    console.error('Error al inicializar:', error);
});
