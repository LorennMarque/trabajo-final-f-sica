import numpy as np
import pandas as pd
from math import sqrt, pi
import matplotlib.pyplot as plt

# Constantes físicas fundamentales
m_tierra = 5.97e24          # Masa de la Tierra en kg
grav_const = 6.67430e-11    # Constante gravitacional universal en m³/kg·s²
v_luz = 2.998e8             # Velocidad de la luz en m/s

def calculo_orbita_XY(m1, radio, pasos=100000):
    """Calcula órbita en el plano XY"""
    x0, y0, z0 = radio, 0, 0  # Empezamos en el eje X
    r = radio
    v0 = sqrt(grav_const * m1 / r)
    
    # Velocidad inicial para órbita en plano XY
    vx = 0
    vy = v0
    vz = 0
    
    y = np.array([x0, vx, y0, vy, z0, vz])
    return calcular_orbita(y, m1, pasos)

def calculo_orbita_YZ(m1, radio, pasos=100000):
    """Calcula órbita en el plano YZ"""
    x0, y0, z0 = 0, radio, 0  # Empezamos en el eje Y
    r = radio
    v0 = sqrt(grav_const * m1 / r)
    
    # Velocidad inicial para órbita en plano YZ
    vx = 0
    vy = 0
    vz = v0
    
    y = np.array([x0, vx, y0, vy, z0, vz])
    return calcular_orbita(y, m1, pasos)

def calculo_orbita_XZ(m1, radio, pasos=100000):
    """Calcula órbita en el plano XZ"""
    x0, y0, z0 = radio, 0, 0  # Empezamos en el eje X
    r = radio
    v0 = sqrt(grav_const * m1 / r)
    
    # Velocidad inicial para órbita en plano XZ
    vx = 0
    vy = 0
    vz = v0
    
    y = np.array([x0, vx, y0, vy, z0, vz])
    return calcular_orbita(y, m1, pasos)

def calcular_orbita(y, m1, pasos):
    """Función auxiliar que realiza el cálculo de la órbita usando RK4"""
    dt = 1  # Paso de tiempo en segundos
    resultados = []
    tiempo_actual = 0
    
    def F(y, t):
        x, vx, y_, vy, z, vz = y
        r = sqrt(x**2 + y_**2 + z**2)
        a = -grav_const * m1 / r**3
        return np.array([vx, a * x, vy, a * y_, vz, a * z])

    def RK4(y, t, dt):
        k1 = F(y, t)
        k2 = F(y + 0.5 * k1 * dt, t + 0.5 * dt)
        k3 = F(y + 0.5 * k2 * dt, t + 0.5 * dt)
        k4 = F(y + k3 * dt, t + dt)
        return dt * (k1 + 2*k2 + 2*k3 + k4) / 6

    for _ in range(pasos):
        resultados.append({
            't': tiempo_actual,
            'x': y[0],
            'y': y[2],
            'z': y[4]
        })
        y += RK4(y, tiempo_actual, dt)
        tiempo_actual += dt

    return pd.DataFrame(resultados)

def calcular_posicion_3D(df, t, x, y, z):
    """
    Calcula la posición de un receptor usando trilateración 3D
    
    Args:
        df: DataFrame con las posiciones de los satélites
        t: Tiempo específico para el cálculo
        x, y, z: Coordenadas del punto a verificar
    
    Returns:
        Diccionario con:
        - solutions: Tupla con dos posibles soluciones
        - distances: Lista con las distancias a cada satélite
        - satellites: Lista con las posiciones de los satélites
    """
    # Obtiene las posiciones de los satélites en el tiempo t
    fila = df[df["t"] == t]
    if fila.empty:
        raise ValueError(f"No hay datos para el tiempo {t}")

    # Extrae las posiciones de los tres satélites
    p1 = np.array([fila["x1"].iloc[0], fila["y1"].iloc[0], fila["z1"].iloc[0]])
    p2 = np.array([fila["x2"].iloc[0], fila["y2"].iloc[0], fila["z2"].iloc[0]])
    p3 = np.array([fila["x3"].iloc[0], fila["y3"].iloc[0], fila["z3"].iloc[0]])

    # Calcula las distancias entre el punto y cada satélite
    d1 = np.linalg.norm(np.array([x, y, z]) - p1)
    d2 = np.linalg.norm(np.array([x, y, z]) - p2)
    d3 = np.linalg.norm(np.array([x, y, z]) - p3)

    r1 = d1
    r2 = d2
    r3 = d3

    # Construye un sistema de coordenadas local
    ex = (p2 - p1)
    ex = ex / np.linalg.norm(ex)  # Vector unitario en dirección p1->p2
    i = np.dot(ex, p3 - p1)
    temp = p3 - p1 - i * ex
    ey = temp / np.linalg.norm(temp)  # Vector unitario perpendicular a ex
    ez = np.cross(ex, ey)  # Vector unitario perpendicular a ex y ey

    # Distancia entre p1 y p2
    d = np.linalg.norm(p2 - p1)
    j = np.dot(ey, p3 - p1)

    # Calcula las coordenadas en el sistema local
    x_val = (r1**2 - r2**2 + d**2) / (2 * d)
    y_val = (r1**2 - r3**2 + i**2 + j**2 - 2 * i * x_val) / (2 * j)
    
    try:
        z_val = sqrt(abs(r1**2 - x_val**2 - y_val**2))
    except ValueError:
        raise ValueError("No hay intersección real para estas posiciones")

    # Calcula las dos posibles soluciones en coordenadas globales
    sol1 = p1 + x_val * ex + y_val * ey + z_val * ez
    sol2 = p1 + x_val * ex + y_val * ey - z_val * ez

    return {
        'solutions': (sol1, sol2),
        'distances': [d1, d2, d3],
        'satellites': [p1, p2, p3]
    }


# --------- Configuración y ejecución de la simulación ----------
# Radio orbital (aproximadamente una órbita MEO)
radio = 26600000  # metros

# Calcula las órbitas de los tres satélites en diferentes planos
df1 = calculo_orbita_XY(m_tierra, radio)  # Órbita en plano XY
df2 = calculo_orbita_YZ(m_tierra, radio)  # Órbita en plano YZ
df3 = calculo_orbita_XZ(m_tierra, radio)  # Órbita en plano XZ

# Combina los datos de los tres satélites en un único DataFrame
df = df1.merge(df2, on="t", suffixes=("1", "2"))
df = df.merge(df3, on="t")
df.rename(columns={"x": "x3", "y": "y3", "z": "z3"}, inplace=True)

# Ejemplo: Intenta triangular la posición (0,0,0)
posicion_receptor = calcular_posicion_3D(df, 500, 0, 0, 0)
print("Posición triangulada:", posicion_receptor)

print(f"\n \n {df}")

# Guardar el DataFrame como CSV
df.to_csv('orbitas_3D.csv', index=False)

# Visualización 3D de las órbitas
# fig = plt.figure(figsize=(10, 10))
# ax = fig.add_subplot(111, projection='3d')

# Graficar las órbitas
# ax.plot(df['x1'], df['y1'], df['z1'], label='Órbita XY', color='black')
# ax.plot(df['x2'], df['y2'], df['z2'], label='Órbita YZ', color='orange')
# ax.plot(df['x3'], df['y3'], df['z3'], label='Órbita XZ', color='green')

# Configuración del gráfico
# ax.set_xlabel('X')
# ax.set_ylabel('Y')
# ax.set_zlabel('Z')
# ax.legend()
# plt.title('Órbitas de los satélites en diferentes planos')
# plt.savefig('orbitas_3D.png')
# plt.show()
